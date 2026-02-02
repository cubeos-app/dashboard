/**
 * CubeOS Services Store
 * 
 * Sprint 4: Migrated from deprecated /services/* to verified /apps/* endpoints.
 * 
 * Changes from original:
 * - All /services/* calls replaced with /apps/*
 * - Favorites now use localStorage (backend endpoint not implemented)
 * - Uses unified app data model
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import api from '@/api/client'

// Favorites storage key
const FAVORITES_KEY = 'cubeos_favorites'

export const useServicesStore = defineStore('services', () => {
  // ==========================================
  // State
  // ==========================================
  
  const services = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  
  // Favorites stored in localStorage (not backend)
  const favorites = ref(loadFavorites())
  
  // ==========================================
  // Computed
  // ==========================================
  
  const serviceCount = computed(() => services.value.length)
  const runningCount = computed(() => services.value.filter(s => s.status?.running).length)
  const stoppedCount = computed(() => services.value.filter(s => !s.status?.running).length)
  
  const systemServices = computed(() => 
    services.value.filter(s => s.type === 'system')
  )
  
  const platformServices = computed(() => 
    services.value.filter(s => s.type === 'platform')
  )
  
  const userServices = computed(() => 
    services.value.filter(s => s.type === 'user')
  )
  
  const favoriteServices = computed(() => 
    services.value.filter(s => favorites.value.includes(s.name))
  )
  
  // ==========================================
  // Favorites (localStorage only)
  // ==========================================
  
  /**
   * Load favorites from localStorage
   */
  function loadFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }
  
  /**
   * Save favorites to localStorage
   */
  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.value))
    } catch (e) {
      console.error('Failed to save favorites:', e)
    }
  }
  
  // Watch for changes and persist
  watch(favorites, saveFavorites, { deep: true })
  
  /**
   * Check if service is a favorite
   */
  function isFavorite(name) {
    return favorites.value.includes(name)
  }
  
  /**
   * Toggle favorite status
   */
  function toggleFavorite(name) {
    const index = favorites.value.indexOf(name)
    if (index >= 0) {
      favorites.value.splice(index, 1)
    } else {
      favorites.value.push(name)
    }
  }
  
  /**
   * Add to favorites
   */
  function addFavorite(name) {
    if (!favorites.value.includes(name)) {
      favorites.value.push(name)
    }
  }
  
  /**
   * Remove from favorites
   */
  function removeFavorite(name) {
    const index = favorites.value.indexOf(name)
    if (index >= 0) {
      favorites.value.splice(index, 1)
    }
  }
  
  // ==========================================
  // API Methods (using /apps endpoints)
  // ==========================================
  
  /**
   * Fetch all services (apps)
   * Uses GET /api/v1/apps (verified working: returns 8 apps)
   */
  async function fetchServices() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/apps')
      services.value = response.apps || []
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch services:', e)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch single service by name
   * Uses GET /api/v1/apps/{name} (verified working)
   */
  async function fetchService(name) {
    try {
      const response = await api.get(`/apps/${encodeURIComponent(name)}`)
      
      // Update in local state
      const index = services.value.findIndex(s => s.name === name)
      if (index >= 0) {
        services.value[index] = response
      }
      
      return response
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  
  /**
   * Start a service
   * Uses POST /api/v1/apps/{name}/start (verified working)
   */
  async function startService(name) {
    error.value = null
    
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/start`)
      
      // Update local state optimistically
      const service = services.value.find(s => s.name === name)
      if (service && service.status) {
        service.status.running = true
      }
      
      return true
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  
  /**
   * Stop a service
   * Uses POST /api/v1/apps/{name}/stop (verified working: HTTP 200)
   */
  async function stopService(name) {
    error.value = null
    
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/stop`)
      
      // Update local state optimistically
      const service = services.value.find(s => s.name === name)
      if (service && service.status) {
        service.status.running = false
      }
      
      return true
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  
  /**
   * Restart a service
   * Uses POST /api/v1/apps/{name}/restart (verified working: HTTP 200)
   */
  async function restartService(name) {
    error.value = null
    
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/restart`)
      return true
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  
  /**
   * Get service logs
   * Uses GET /api/v1/apps/{name}/logs (verified working)
   */
  async function getServiceLogs(name, lines = 100) {
    try {
      const response = await api.get(`/apps/${encodeURIComponent(name)}/logs`, { lines })
      return response.logs || []
    } catch (e) {
      error.value = e.message
      throw e
    }
  }
  
  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Get service by name
   */
  function getService(name) {
    return services.value.find(s => s.name === name)
  }
  
  /**
   * Get service status color class
   */
  function getStatusColor(service) {
    if (!service?.status) return 'text-gray-500'
    if (service.status.running) {
      if (service.status.health === 'healthy') return 'text-green-500'
      if (service.status.health === 'unhealthy') return 'text-red-500'
      return 'text-yellow-500'
    }
    return 'text-gray-500'
  }
  
  /**
   * Get service status label
   */
  function getStatusLabel(service) {
    if (!service?.status) return 'Unknown'
    if (!service.status.running) return 'Stopped'
    if (service.status.health === 'healthy') return 'Running'
    if (service.status.health === 'unhealthy') return 'Unhealthy'
    return 'Starting'
  }
  
  /**
   * Check if service can be stopped (not system-critical)
   */
  function canStop(service) {
    if (!service) return false
    // Protect critical infrastructure
    const critical = ['pihole', 'npm']
    return !critical.includes(service.name)
  }
  
  /**
   * Get service display name
   */
  function getDisplayName(service) {
    return service?.display_name || service?.name || 'Unknown'
  }
  
  /**
   * Get service primary URL
   */
  function getServiceUrl(service) {
    if (!service?.fqdns?.length) return null
    return `http://${service.fqdns[0].fqdn}`
  }
  
  /**
   * Get service primary port
   */
  function getServicePort(service) {
    if (!service?.ports?.length) return null
    const primary = service.ports.find(p => p.is_primary)
    return primary?.port || service.ports[0]?.port
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    services,
    loading,
    error,
    lastUpdated,
    favorites,
    
    // Computed
    serviceCount,
    runningCount,
    stoppedCount,
    systemServices,
    platformServices,
    userServices,
    favoriteServices,
    
    // API Methods
    fetchServices,
    fetchService,
    startService,
    stopService,
    restartService,
    getServiceLogs,
    
    // Favorites (localStorage)
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    
    // Helpers
    getService,
    getStatusColor,
    getStatusLabel,
    canStop,
    getDisplayName,
    getServiceUrl,
    getServicePort
  }
})
