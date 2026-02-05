/**
 * CubeOS Unified Apps Store
 * 
 * Sprint 4: Replaces fragmented services/appmanager/appstore stores.
 * Uses the new unified /api/v1/apps endpoints from Sprint 3.
 * 
 * Docker Swarm is Single Source of Truth for container state.
 * This store fetches app configurations from the database AND
 * runtime status from Swarm via the Orchestrator.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// App type constants matching Go backend
export const APP_TYPES = {
  SYSTEM: 'system',     // Infrastructure (pihole, npm, registry)
  PLATFORM: 'platform', // CubeOS services (api, dashboard, dozzle)
  NETWORK: 'network',   // VPN, Tor
  AI: 'ai',             // Ollama, ChromaDB
  USER: 'user'          // User-installed apps
}

// Deploy mode constants
export const DEPLOY_MODES = {
  STACK: 'stack',       // Docker Swarm stack
  COMPOSE: 'compose'    // docker-compose (host network services)
}

// Health status constants
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  STARTING: 'starting',
  STOPPED: 'stopped',
  UNKNOWN: 'unknown'
}

// Service categories with Lucide icon names for UI grouping
const APP_CATEGORIES = {
  infrastructure: {
    title: 'Infrastructure',
    icon: 'Server',
    types: [APP_TYPES.SYSTEM]
  },
  platform: {
    title: 'Platform',
    icon: 'LayoutDashboard',
    types: [APP_TYPES.PLATFORM]
  },
  network: {
    title: 'Network & Privacy',
    icon: 'Shield',
    types: [APP_TYPES.NETWORK]
  },
  ai: {
    title: 'AI & ML',
    icon: 'Brain',
    types: [APP_TYPES.AI]
  },
  user: {
    title: 'Applications',
    icon: 'Package',
    types: [APP_TYPES.USER]
  }
}

// Lucide icon mapping for services
const SERVICE_ICONS = {
  // System/Infrastructure
  'pihole': 'Shield',
  'npm': 'Globe',
  'registry': 'Database',
  'hal': 'Cpu',
  // Platform
  'cubeos-api': 'Server',
  'api': 'Server',
  'cubeos-dashboard': 'LayoutDashboard',
  'dashboard': 'LayoutDashboard',
  'dozzle': 'ScrollText',
  // Network
  'wireguard': 'Lock',
  'openvpn': 'Key',
  'tor': 'Eye',
  // AI
  'ollama': 'Brain',
  'chromadb': 'Database',
  // Default
  'default': 'Box'
}

// Service display names
const SERVICE_NAMES = {
  'pihole': 'Pi-hole DNS',
  'npm': 'Nginx Proxy Manager',
  'registry': 'Docker Registry',
  'hal': 'Hardware Abstraction Layer',
  'cubeos-api': 'CubeOS API',
  'api': 'CubeOS API',
  'cubeos-dashboard': 'CubeOS Dashboard',
  'dashboard': 'CubeOS Dashboard',
  'dozzle': 'Dozzle Logs',
  'wireguard': 'WireGuard VPN',
  'openvpn': 'OpenVPN',
  'tor': 'Tor Privacy Network',
  'ollama': 'Ollama LLM',
  'chromadb': 'ChromaDB Vector Store'
}

// Services with web UI - FQDN-only, no ports
// All services must go through NPM reverse proxy
const WEB_UI_SERVICES = {
  'pihole': { fqdn: 'pihole.cubeos.cube', path: '/admin' },
  'npm': { fqdn: 'npm.cubeos.cube' },
  'dozzle': { fqdn: 'dozzle.cubeos.cube' },
  'ollama': { fqdn: 'ollama.cubeos.cube', path: '/api/tags', hasUI: false },
  'registry': { fqdn: 'registry.cubeos.cube', path: '/v2/', hasUI: false },
  'chromadb': { fqdn: 'chromadb.cubeos.cube', hasUI: false },
}

export const useAppsStore = defineStore('apps', () => {
  // ==========================================
  // State
  // ==========================================
  const apps = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const searchQuery = ref('')
  
  // Filter state
  const filterType = ref(null)
  const filterEnabled = ref(null)
  const showSystemApps = ref(false)

  // ==========================================
  // Getters
  // ==========================================
  
  const appCount = computed(() => apps.value.length)
  
  const runningCount = computed(() => 
    apps.value.filter(a => a.status?.running).length
  )

  const healthyCount = computed(() =>
    apps.value.filter(a => a.status?.health === HEALTH_STATUS.HEALTHY).length
  )
  
  // Filter apps based on search and type
  const filteredApps = computed(() => {
    let result = apps.value

    // Apply type filter
    if (filterType.value) {
      result = result.filter(a => a.type === filterType.value)
    }

    // Apply enabled filter
    if (filterEnabled.value !== null) {
      result = result.filter(a => a.enabled === filterEnabled.value)
    }

    // Apply search query
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(a => 
        a.name.toLowerCase().includes(query) ||
        a.display_name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
      )
    }

    return result
  })

  // Apps visible in main view (respects showSystemApps toggle)
  const visibleApps = computed(() => {
    if (showSystemApps.value) {
      return filteredApps.value
    }
    // Hide system and platform apps unless showSystemApps is true
    return filteredApps.value.filter(a => 
      a.type !== APP_TYPES.SYSTEM && a.type !== APP_TYPES.PLATFORM
    )
  })

  // Group apps by category
  const categorizedApps = computed(() => {
    const result = {}
    
    for (const [key, category] of Object.entries(APP_CATEGORIES)) {
      const categoryApps = filteredApps.value.filter(a => 
        category.types.includes(a.type)
      )
      
      if (categoryApps.length > 0) {
        result[key] = {
          title: category.title,
          icon: category.icon,
          items: categoryApps
        }
      }
    }
    
    return result
  })

  // System apps (pihole, npm, registry)
  const systemApps = computed(() => 
    apps.value.filter(a => a.type === APP_TYPES.SYSTEM)
  )

  // Platform apps (api, dashboard, dozzle)
  const platformApps = computed(() => 
    apps.value.filter(a => a.type === APP_TYPES.PLATFORM)
  )

  // User-installed apps
  const userApps = computed(() => 
    apps.value.filter(a => a.type === APP_TYPES.USER)
  )

  // AI/ML apps
  const aiApps = computed(() => 
    apps.value.filter(a => a.type === APP_TYPES.AI)
  )

  // Network apps (VPN, Tor)
  const networkApps = computed(() => 
    apps.value.filter(a => a.type === APP_TYPES.NETWORK)
  )

  // Core apps (system + platform) - always running
  const coreApps = computed(() => 
    apps.value.filter(a => 
      a.type === APP_TYPES.SYSTEM || a.type === APP_TYPES.PLATFORM
    )
  )

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Get an app by its name
   */
  function getAppByName(name) {
    return apps.value.find(a => a.name === name)
  }

  /**
   * Check if an app is a core (system/platform) app
   */
  function isCore(app) {
    return app.type === APP_TYPES.SYSTEM || app.type === APP_TYPES.PLATFORM
  }

  /**
   * Check if an app is running
   */
  function isRunning(app) {
    return app.status?.running === true
  }

  /**
   * Check if an app is healthy
   * API returns "healthy" for Swarm stacks, "running" for Compose services
   */
  function isHealthy(app) {
    const health = app.status?.health
    return health === 'healthy' || health === 'running' || !health
  }

  /**
   * Get a display-friendly name for an app
   */
  function getAppDisplayName(app) {
    if (app.display_name) return app.display_name
    return SERVICE_NAMES[app.name] || formatName(app.name)
  }

  /**
   * Get the Lucide icon name for an app
   */
  function getAppIcon(app) {
    // Try direct match first
    if (SERVICE_ICONS[app.name]) return SERVICE_ICONS[app.name]
    
    // Try without prefix
    const baseName = app.name.replace('cubeos-', '')
    if (SERVICE_ICONS[baseName]) return SERVICE_ICONS[baseName]
    
    // Type-based fallback
    switch (app.type) {
      case APP_TYPES.SYSTEM: return 'Server'
      case APP_TYPES.PLATFORM: return 'LayoutDashboard'
      case APP_TYPES.NETWORK: return 'Shield'
      case APP_TYPES.AI: return 'Brain'
      default: return SERVICE_ICONS.default
    }
  }

  /**
   * Get URL for an app's web UI (if available)
   * ALL URLs go through FQDN via NPM - no direct port access
   */
  function getAppUrl(app) {
    const name = app.name.replace('cubeos-', '')
    
    // Check predefined web UI services (FQDN-only)
    if (WEB_UI_SERVICES[name]) {
      const config = WEB_UI_SERVICES[name]
      // Skip services that are API-only (no web UI)
      if (config.hasUI === false) return null
      const path = config.path || ''
      return `http://${config.fqdn}${path}`
    }
    
    // Use primary FQDN from app data (set by API)
    if (app.fqdns?.length > 0) {
      return `http://${app.fqdns[0].fqdn}`
    }
    
    // No URL available - service must have NPM proxy configured
    // Do NOT fall back to port-based URLs
    return null
  }

  /**
   * Check if app has a web UI
   */
  function hasWebUI(app) {
    const name = app.name.replace('cubeos-', '')
    
    // Check if explicitly marked as no UI
    if (WEB_UI_SERVICES[name]?.hasUI === false) return false
    
    return getAppUrl(app) !== null
  }

  /**
   * Get primary port for an app (for display purposes only)
   */
  function getPrimaryPort(app) {
    if (!app.ports?.length) return null
    const primary = app.ports.find(p => p.is_primary)
    return primary?.port || app.ports[0].port
  }

  /**
   * Get health status badge color class
   */
  function getHealthColor(health) {
    switch (health) {
      case HEALTH_STATUS.HEALTHY: 
      case 'running':  // Compose services return "running" instead of "healthy"
        return 'text-green-500'
      case HEALTH_STATUS.UNHEALTHY: return 'text-red-500'
      case HEALTH_STATUS.STARTING: return 'text-yellow-500'
      case HEALTH_STATUS.STOPPED: return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  /**
   * Get health status label
   */
  function getHealthLabel(health) {
    switch (health) {
      case HEALTH_STATUS.HEALTHY: return 'Healthy'
      case 'running': return 'Running'  // Compose services
      case HEALTH_STATUS.UNHEALTHY: return 'Unhealthy'
      case HEALTH_STATUS.STARTING: return 'Starting'
      case HEALTH_STATUS.STOPPED: return 'Stopped'
      default: return 'Unknown'
    }
  }

  /**
   * Format a name string for display
   */
  function formatName(name) {
    return name
      .replace('cubeos-', '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // ==========================================
  // API Methods
  // ==========================================

  /**
   * Fetch all apps from the API
   */
  async function fetchApps() {
    loading.value = true
    error.value = null
    
    try {
      const params = {}
      if (filterType.value) params.type = filterType.value
      if (filterEnabled.value !== null) params.enabled = filterEnabled.value
      
      const response = await api.get('/apps', params)
      apps.value = response.apps || []
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a single app by name
   */
  async function getApp(name) {
    try {
      return await api.get(`/apps/${encodeURIComponent(name)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Start an app
   */
  async function startApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/start`)
      await fetchApps() // Refresh to get updated status
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Stop an app
   */
  async function stopApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/stop`)
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Restart an app
   */
  async function restartApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/restart`)
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Enable an app (start on boot)
   */
  async function enableApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/enable`)
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Disable an app (don't start on boot)
   */
  async function disableApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/disable`)
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Get logs for an app
   */
  async function getAppLogs(name, lines = 100) {
    try {
      const response = await api.get(`/apps/${encodeURIComponent(name)}/logs`, { lines })
      return response.logs || []
    } catch (e) {
      error.value = e.message
      return []
    }
  }

  /**
   * Set Tor routing for an app
   */
  async function setAppTor(name, enabled) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/tor`, { enabled })
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Set VPN routing for an app
   */
  async function setAppVPN(name, enabled) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/vpn`, { enabled })
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /**
   * Install a new app
   */
  async function installApp(request) {
    try {
      const app = await api.post('/apps', request)
      await fetchApps()
      return app
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Uninstall an app
   */
  async function uninstallApp(name, keepData = false) {
    try {
      await api.delete(`/apps/${encodeURIComponent(name)}?keep_data=${keepData}`)
      await fetchApps()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  // ==========================================
  // UI State Methods
  // ==========================================

  function setSearchQuery(query) {
    searchQuery.value = query
  }

  function setFilterType(type) {
    filterType.value = type
  }

  function setFilterEnabled(enabled) {
    filterEnabled.value = enabled
  }

  function toggleShowSystemApps() {
    showSystemApps.value = !showSystemApps.value
  }

  function clearFilters() {
    filterType.value = null
    filterEnabled.value = null
    searchQuery.value = ''
  }

  // ==========================================
  // Centralized Polling
  // ==========================================
  
  let _pollInterval = null
  let _pollSubscribers = 0
  const POLL_INTERVAL_MS = 10000

  /**
   * Start shared polling. Multiple callers share the same interval.
   * Call stopPolling() on unmount.
   */
  function startPolling() {
    _pollSubscribers++
    if (_pollSubscribers === 1 && !_pollInterval) {
      _pollInterval = setInterval(() => {
        fetchApps()
      }, POLL_INTERVAL_MS)
    }
  }

  /**
   * Decrement subscriber count. Stops polling when no one is listening.
   */
  function stopPolling() {
    _pollSubscribers = Math.max(0, _pollSubscribers - 1)
    if (_pollSubscribers === 0 && _pollInterval) {
      clearInterval(_pollInterval)
      _pollInterval = null
    }
  }

  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    apps,
    allApps: apps,  // HOTFIX: Alias for DashboardView search that uses allApps
    loading,
    error,
    lastUpdated,
    searchQuery,
    filterType,
    filterEnabled,
    showSystemApps,
    
    // Getters
    appCount,
    runningCount,
    healthyCount,
    filteredApps,
    visibleApps,
    categorizedApps,
    systemApps,
    platformApps,
    userApps,
    aiApps,
    networkApps,
    coreApps,
    
    // Helper methods
    getAppByName,
    isCore,
    isRunning,
    isHealthy,
    getAppDisplayName,
    getDisplayName: getAppDisplayName,  // Alias for convenience
    getAppIcon,
    getAppUrl,
    hasWebUI,
    getPrimaryPort,
    getHealthColor,
    getHealthLabel,
    formatName,
    
    // API methods
    fetchApps,
    getApp,
    startApp,
    stopApp,
    restartApp,
    enableApp,
    disableApp,
    getAppLogs,
    setAppTor,
    setAppVPN,
    installApp,
    uninstallApp,
    
    // UI state methods
    setSearchQuery,
    setFilterType,
    setFilterEnabled,
    toggleShowSystemApps,
    clearFilters,
    
    // Polling
    startPolling,
    stopPolling
  }
})
