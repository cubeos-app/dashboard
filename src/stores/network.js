/**
 * CubeOS Network Store
 * 
 * Sprint 4: Manages network state using Sprint 3 API endpoints.
 * Handles network modes, WiFi scanning/connection, and AP configuration.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Network mode constants matching Go backend
export const NETWORK_MODES = {
  OFFLINE: 'offline',
  ONLINE_ETH: 'online_eth',
  ONLINE_WIFI: 'online_wifi'
}

// Human-readable mode labels
export const MODE_LABELS = {
  [NETWORK_MODES.OFFLINE]: 'Offline (AP Only)',
  [NETWORK_MODES.ONLINE_ETH]: 'Online (Ethernet)',
  [NETWORK_MODES.ONLINE_WIFI]: 'Online (WiFi Client)'
}

// Mode descriptions
export const MODE_DESCRIPTIONS = {
  [NETWORK_MODES.OFFLINE]: 'Air-gapped mode. Access Point only, no internet connectivity.',
  [NETWORK_MODES.ONLINE_ETH]: 'Connect to internet via Ethernet. NAT provides internet to AP clients.',
  [NETWORK_MODES.ONLINE_WIFI]: 'Connect to upstream WiFi via USB dongle. NAT provides internet to AP clients.'
}

// Mode icons (Lucide icon names)
export const MODE_ICONS = {
  [NETWORK_MODES.OFFLINE]: 'WifiOff',
  [NETWORK_MODES.ONLINE_ETH]: 'Cable',
  [NETWORK_MODES.ONLINE_WIFI]: 'Wifi'
}

export const useNetworkStore = defineStore('network', () => {
  // ==========================================
  // State
  // ==========================================
  
  const loading = ref(false)
  const error = ref(null)
  const status = ref(null)
  const apConfig = ref(null)
  const wifiNetworks = ref([])
  const scanning = ref(false)
  const connecting = ref(false)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const currentMode = computed(() => status.value?.mode || NETWORK_MODES.OFFLINE)
  const hasInternet = computed(() => status.value?.internet === true)
  const isAPActive = computed(() => !!status.value?.ap?.ssid)
  const apSSID = computed(() => status.value?.ap?.ssid || 'CubeOS')
  const apClients = computed(() => status.value?.ap?.clients || 0)
  const upstreamInterface = computed(() => status.value?.upstream?.interface || '')
  const upstreamIP = computed(() => status.value?.upstream?.ip || '')
  const gatewayIP = computed(() => status.value?.gateway_ip || '10.42.24.1')
  const subnet = computed(() => status.value?.subnet || '10.42.24.0/24')
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch network status
   */
  async function fetchStatus() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/network/status')
      status.value = response
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch network status:', e)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Set network mode
   * @param {string} mode - One of NETWORK_MODES
   * @param {object} options - Additional options (ssid, password for ONLINE_WIFI)
   */
  async function setMode(mode, options = {}) {
    loading.value = true
    error.value = null
    
    try {
      const body = { mode }
      if (mode === NETWORK_MODES.ONLINE_WIFI) {
        if (!options.ssid) {
          throw new Error('SSID required for WiFi client mode')
        }
        body.ssid = options.ssid
        body.password = options.password || ''
      }
      
      await api.post('/network/mode', body)
      await fetchStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Scan for WiFi networks
   */
  async function scanWiFi() {
    scanning.value = true
    error.value = null
    
    try {
      const response = await api.get('/network/wifi/scan')
      wifiNetworks.value = response.networks || []
      return wifiNetworks.value
    } catch (e) {
      error.value = e.message
      wifiNetworks.value = []
      return []
    } finally {
      scanning.value = false
    }
  }
  
  /**
   * Connect to a WiFi network (for ONLINE_WIFI mode)
   */
  async function connectWiFi(ssid, password) {
    connecting.value = true
    error.value = null
    
    try {
      await api.post('/network/wifi/connect', { ssid, password })
      await fetchStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      connecting.value = false
    }
  }
  
  /**
   * Get AP configuration
   */
  async function fetchAPConfig() {
    try {
      const response = await api.get('/network/ap/config')
      apConfig.value = response
      return response
    } catch (e) {
      error.value = e.message
      return null
    }
  }
  
  /**
   * Update AP configuration
   */
  async function updateAPConfig(config) {
    loading.value = true
    error.value = null
    
    try {
      await api.put('/network/ap/config', config)
      apConfig.value = config
      await fetchStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Get human-readable mode label
   */
  function getModeLabel(mode) {
    return MODE_LABELS[mode] || mode
  }
  
  /**
   * Get mode description
   */
  function getModeDescription(mode) {
    return MODE_DESCRIPTIONS[mode] || ''
  }
  
  /**
   * Get mode icon name
   */
  function getModeIcon(mode) {
    return MODE_ICONS[mode] || 'Network'
  }
  
  /**
   * Format signal strength (dBm to percentage)
   */
  function formatSignal(dbm) {
    if (dbm >= -50) return 100
    if (dbm <= -100) return 0
    return Math.round(2 * (dbm + 100))
  }
  
  /**
   * Get signal strength label
   */
  function getSignalLabel(dbm) {
    const percent = formatSignal(dbm)
    if (percent >= 75) return 'Excellent'
    if (percent >= 50) return 'Good'
    if (percent >= 25) return 'Fair'
    return 'Weak'
  }
  
  /**
   * Get signal strength color class
   */
  function getSignalColor(dbm) {
    const percent = formatSignal(dbm)
    if (percent >= 75) return 'text-green-500'
    if (percent >= 50) return 'text-yellow-500'
    if (percent >= 25) return 'text-orange-500'
    return 'text-red-500'
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    loading,
    error,
    status,
    apConfig,
    wifiNetworks,
    scanning,
    connecting,
    
    // Computed
    currentMode,
    hasInternet,
    isAPActive,
    apSSID,
    apClients,
    upstreamInterface,
    upstreamIP,
    gatewayIP,
    subnet,
    
    // API Methods
    fetchStatus,
    setMode,
    scanWiFi,
    connectWiFi,
    fetchAPConfig,
    updateAPConfig,
    
    // Helper Methods
    getModeLabel,
    getModeDescription,
    getModeIcon,
    formatSignal,
    getSignalLabel,
    getSignalColor
  }
})
