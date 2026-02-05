/**
 * CubeOS VPN Store
 * 
 * Sprint 4: Manages VPN configurations using Sprint 3 API endpoints.
 * Handles WireGuard, OpenVPN, and Tor configurations.
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
  
  // ==========================================
  // Computed
  // ==========================================
  
  const activeConfig = computed(() => configs.value.find(c => c.is_active))
  const isConnected = computed(() => status.value?.connected === true)
  const publicIP = computed(() => status.value?.public_ip || '')
  const connectedSince = computed(() => status.value?.connected_since || '')
  
  const wireguardConfigs = computed(() => 
    configs.value.filter(c => c.type === VPN_TYPES.WIREGUARD)
  )
  
  const openvpnConfigs = computed(() => 
    configs.value.filter(c => c.type === VPN_TYPES.OPENVPN)
  )
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all VPN configurations
   */
  async function fetchConfigs() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/vpn/configs')
      configs.value = response.configs || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch VPN configs:', e)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get VPN status
   */
  async function fetchStatus() {
    try {
      const response = await api.get('/vpn/status')
      status.value = response
    } catch (e) {
      error.value = e.message
      status.value = null
    }
  }
  
  /**
   * Add a new VPN configuration
   */
  async function addConfig(name, type, configData) {
    loading.value = true
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
      await fetchConfigs()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Delete a VPN configuration
   */
  async function deleteConfig(name) {
    loading.value = true
    error.value = null
    
    try {
      await api.delete(`/vpn/configs/${encodeURIComponent(name)}`)
      await fetchConfigs()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
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
      await Promise.all([fetchConfigs(), fetchStatus()])
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
      await Promise.all([fetchConfigs(), fetchStatus()])
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
    
    // Computed
    activeConfig,
    isConnected,
    publicIP,
    connectedSince,
    wireguardConfigs,
    openvpnConfigs,
    
    // API Methods
    fetchConfigs,
    fetchStatus,
    addConfig,
    deleteConfig,
    connect,
    disconnect,
    
    // Helper Methods
    getTypeLabel,
    getTypeIcon,
    formatDuration
  }
})
