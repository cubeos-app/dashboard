/**
 * CubeOS Network Store
 * 
 * Sprint 2: Extended with 16 new API methods for DNS, interfaces, settings,
 * modes, connectivity, VPN mode, warning dismiss, WiFi management, and AP controls.
 * 
 * Original Sprint 4 methods: fetchStatus, setMode, scanWiFi, connectWiFi, fetchAPConfig, updateAPConfig
 * New Sprint 2 methods: fetchDNS, saveDNS, fetchInterfaces, fetchSettings, updateSettings,
 *   fetchModes, checkConnectivity, getVPNMode, setVPNMode, dismissWarning,
 *   disconnectWiFi, fetchSavedNetworks, forgetNetwork, fetchWiFiStatus, startAP, stopAP
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
  
  // Sprint 2: New state refs
  const dns = ref(null)
  const interfaces = ref([])
  const networkSettings = ref(null)
  const modes = ref([])
  const connectivity = ref(null)
  const vpnMode = ref(null)
  const savedNetworks = ref([])
  const wifiStatus = ref(null)
  
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
  
  // Sprint 2: New computed properties
  const isOnline = computed(() => connectivity.value?.online === true)
  const primaryDNS = computed(() => dns.value?.primary || '')
  const secondaryDNS = computed(() => dns.value?.secondary || '')
  const isWiFiConnected = computed(() => wifiStatus.value?.connected === true)
  
  // ==========================================
  // API Methods (Original)
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
  // API Methods (Sprint 2: New)
  // ==========================================
  
  /**
   * Fetch DNS configuration
   */
  async function fetchDNS() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/network/dns')
      dns.value = response
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Save DNS configuration
   * @param {object} config - DNS config (primary, secondary)
   */
  async function saveDNS(config) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/network/dns', config)
      dns.value = config
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch network interfaces
   */
  async function fetchInterfaces() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/network/interfaces')
      interfaces.value = response.interfaces || []
    } catch (e) {
      error.value = e.message
      interfaces.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch network settings
   */
  async function fetchSettings() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/network/settings')
      networkSettings.value = response
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Update network settings
   * @param {object} data - Settings to update
   */
  async function updateSettings(data) {
    loading.value = true
    error.value = null
    
    try {
      await api.put('/network/settings', data)
      networkSettings.value = { ...networkSettings.value, ...data }
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch available network modes from API
   */
  async function fetchModes() {
    try {
      const response = await api.get('/network/modes')
      modes.value = response.modes || []
    } catch (e) {
      error.value = e.message
      modes.value = []
    }
  }
  
  /**
   * Check internet connectivity
   */
  async function checkConnectivity() {
    try {
      const response = await api.get('/network/connectivity')
      connectivity.value = response
    } catch (e) {
      error.value = e.message
      connectivity.value = { online: false }
    }
  }
  
  /**
   * Get current VPN mode
   */
  async function getVPNMode() {
    try {
      const response = await api.get('/network/vpn/mode')
      vpnMode.value = response
    } catch (e) {
      error.value = e.message
    }
  }
  
  /**
   * Set VPN mode
   * @param {string} mode - VPN mode to set
   */
  async function setVPNMode(mode) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/network/vpn/mode', { mode })
      vpnMode.value = { ...vpnMode.value, mode }
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Dismiss a network warning banner
   */
  async function dismissWarning() {
    try {
      await api.post('/network/warning/dismiss')
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }
  
  /**
   * Disconnect from current WiFi network
   */
  async function disconnectWiFi() {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/network/wifi/disconnect')
      await fetchStatus()
      await fetchWiFiStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch saved WiFi networks
   */
  async function fetchSavedNetworks() {
    try {
      const response = await api.get('/network/wifi/saved')
      savedNetworks.value = response.networks || []
    } catch (e) {
      error.value = e.message
      savedNetworks.value = []
    }
  }
  
  /**
   * Forget a saved WiFi network
   * @param {string} ssid - Network SSID to forget
   */
  async function forgetNetwork(ssid) {
    loading.value = true
    error.value = null
    
    try {
      await api.delete(`/network/wifi/saved/${encodeURIComponent(ssid)}`)
      await fetchSavedNetworks()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch WiFi connection status
   */
  async function fetchWiFiStatus() {
    try {
      const response = await api.get('/network/wifi/status')
      wifiStatus.value = response
    } catch (e) {
      error.value = e.message
      wifiStatus.value = null
    }
  }
  
  /**
   * Start the Access Point
   */
  async function startAP() {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/network/ap/start')
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
   * Stop the Access Point
   */
  async function stopAP() {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/network/ap/stop')
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
    if (percent >= 75) return 'text-success'
    if (percent >= 50) return 'text-warning'
    if (percent >= 25) return 'text-warning'
    return 'text-error'
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
    dns,
    interfaces,
    networkSettings,
    modes,
    connectivity,
    vpnMode,
    savedNetworks,
    wifiStatus,
    
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
    isOnline,
    primaryDNS,
    secondaryDNS,
    isWiFiConnected,
    
    // API Methods (Original)
    fetchStatus,
    setMode,
    scanWiFi,
    connectWiFi,
    fetchAPConfig,
    updateAPConfig,
    
    // API Methods (Sprint 2)
    fetchDNS,
    saveDNS,
    fetchInterfaces,
    fetchSettings,
    updateSettings,
    fetchModes,
    checkConnectivity,
    getVPNMode,
    setVPNMode,
    dismissWarning,
    disconnectWiFi,
    fetchSavedNetworks,
    forgetNetwork,
    fetchWiFiStatus,
    startAP,
    stopAP,
    
    // Helper Methods
    getModeLabel,
    getModeDescription,
    getModeIcon,
    formatSignal,
    getSignalLabel,
    getSignalColor
  }
})
