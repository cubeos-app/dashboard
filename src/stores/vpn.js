/**
 * CubeOS VPN Store
 * 
 * Sprint 2: Extended with config detail, auto-connect, and public IP methods.
 * Handles WireGuard, OpenVPN, and Tor configurations.
 * 
 * Original methods: fetchConfigs, fetchStatus, addConfig, deleteConfig, connect, disconnect
 * New Sprint 2 methods: fetchConfigDetail, setAutoConnect, fetchPublicIP
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// VPN type constants
export const VPN_TYPES = {
  WIREGUARD: 'wireguard',
  OPENVPN: 'openvpn'
}

// VPN type labels
export const VPN_TYPE_LABELS = {
  [VPN_TYPES.WIREGUARD]: 'WireGuard',
  [VPN_TYPES.OPENVPN]: 'OpenVPN'
}

// VPN type icons
export const VPN_TYPE_ICONS = {
  [VPN_TYPES.WIREGUARD]: 'Lock',
  [VPN_TYPES.OPENVPN]: 'Key'
}

export const useVPNStore = defineStore('vpn', () => {
  // ==========================================
  // State
  // ==========================================
  
  const loading = ref(false)
  const error = ref(null)
  const configs = ref([])
  const status = ref(null)
  
  // Sprint 2: New state refs
  const selectedConfig = ref(null)
  const publicIP = ref(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const activeConfig = computed(() => configs.value.find(c => c.is_active))
  const isConnected = computed(() => status.value?.connected === true)
  const connectedSince = computed(() => status.value?.connected_since || '')
  
  const wireguardConfigs = computed(() => 
    configs.value.filter(c => c.type === VPN_TYPES.WIREGUARD)
  )
  
  const openvpnConfigs = computed(() => 
    configs.value.filter(c => c.type === VPN_TYPES.OPENVPN)
  )
  
  // ==========================================
  // API Methods (Original)
  // ==========================================
  
  /**
   * Fetch all VPN configurations
   */
  async function fetchConfigs(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/vpn/configs', {}, options)
      if (response === null) return
      configs.value = response.configs || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Get VPN status
   */
  async function fetchStatus(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    try {
      const response = await api.get('/vpn/status', {}, options)
      if (response === null) return
      status.value = response
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      status.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Add a new VPN configuration
   */
  async function addConfig(name, type, configData, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      // Convert config file to base64 if it's a File object
      let config = configData
      if (configData instanceof File) {
        config = await fileToBase64(configData)
      }
      
      await api.post('/vpn/configs', {
        name,
        type,
        config
      })
      await fetchConfigs(true)
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Delete a VPN configuration
   */
  async function deleteConfig(name, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      await api.delete(`/vpn/configs/${encodeURIComponent(name)}`)
      await fetchConfigs(true)
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Connect to a VPN configuration
   */
  async function connect(name) {
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/vpn/configs/${encodeURIComponent(name)}/connect`)
      await Promise.all([fetchConfigs(true), fetchStatus(true)])
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Disconnect from VPN
   */
  async function disconnect(name) {
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/vpn/configs/${encodeURIComponent(name)}/disconnect`)
      await Promise.all([fetchConfigs(true), fetchStatus(true)])
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
   * Fetch detailed info for a single VPN config
   * @param {string} name - Config name
   */
  async function fetchConfigDetail(name, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      const response = await api.get(`/vpn/configs/${encodeURIComponent(name)}`)
      selectedConfig.value = response
      return response
    } catch (e) {
      error.value = e.message
      selectedConfig.value = null
      return null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Set auto-connect for a VPN config
   * @param {string} name - Config name
   * @param {boolean} enabled - Whether auto-connect is enabled
   */
  async function setAutoConnect(name, enabled, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      await api.put(`/vpn/configs/${encodeURIComponent(name)}/auto-connect`, { enabled })
      // Update local config list to reflect the change
      const idx = configs.value.findIndex(c => c.name === name)
      if (idx !== -1) {
        configs.value[idx] = { ...configs.value[idx], auto_connect: enabled }
      }
      if (selectedConfig.value?.name === name) {
        selectedConfig.value = { ...selectedConfig.value, auto_connect: enabled }
      }
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  /**
   * Fetch public IP address (useful to verify VPN is working)
   */
  async function fetchPublicIP(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    try {
      const response = await api.get('/vpn/public-ip', {}, options)
      if (response === null) return null
      publicIP.value = response.ip || response.public_ip || null
      return publicIP.value
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      publicIP.value = null
      return null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Get VPN type label
   */
  function getTypeLabel(type) {
    return VPN_TYPE_LABELS[type] || type
  }
  
  /**
   * Get VPN type icon
   */
  function getTypeIcon(type) {
    return VPN_TYPE_ICONS[type] || 'Shield'
  }
  
  /**
   * Convert a File to base64 string
   */
  function fileToBase64(file) {
    // VPN config files should be small - reject anything over 1MB
    const MAX_CONFIG_SIZE = 1024 * 1024
    if (file.size > MAX_CONFIG_SIZE) {
      return Promise.reject(new Error('Config file too large (max 1MB)'))
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Failed to read config file'))
      reader.readAsDataURL(file)
    })
  }
  
  /**
   * Format connection duration
   */
  function formatDuration(connectedSince) {
    if (!connectedSince) return ''
    
    const start = new Date(connectedSince)
    const now = new Date()
    const diff = now - start
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    loading,
    error,
    configs,
    status,
    selectedConfig,
    publicIP,
    
    // Computed
    activeConfig,
    isConnected,
    connectedSince,
    wireguardConfigs,
    openvpnConfigs,
    
    // API Methods (Original)
    fetchConfigs,
    fetchStatus,
    addConfig,
    deleteConfig,
    connect,
    disconnect,
    
    // API Methods (Sprint 2)
    fetchConfigDetail,
    setAutoConnect,
    fetchPublicIP,
    
    // Helper Methods
    getTypeLabel,
    getTypeIcon,
    clearError,
    formatDuration
  }
})
