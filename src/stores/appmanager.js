/**
 * CubeOS App Manager Store
 * 
 * Manages apps, ports, FQDNs, profiles, and registry operations.
 * 
 * Verified endpoints:
 * - GET/POST/DELETE /apps, /apps/{name}, /apps/{name}/start|stop|restart
 * - GET /profiles, POST /profiles/{name}/apply
 * - GET /ports, /ports/reserved, /ports/stats
 * - GET /registry/status, /registry/images, /registry/disk-usage
 * 
 * NOTE: Some methods (initRegistry, cacheImage, setProfileApp, getAvailablePort)
 * are stubs awaiting backend implementation. See TODO markers.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { useAppsApi } from '@/composables/useAppsApi'

const appsApi = useAppsApi()

export const useAppManagerStore = defineStore('appmanager', () => {
  // ==========================================
  // State
  // ==========================================
  
  const apps = ref([])
  const ports = ref([])
  const fqdns = ref([])
  const profiles = ref([])
  const reservedPorts = ref([])
  const portStats = ref({ total: 0, used: 0, available: 0 })
  const loading = ref(false)
  const error = ref(null)
  
  // Track which features are available
  const portsAvailable = ref(false)
  const fqdnsAvailable = ref(false)
  const registryAvailable = ref(false)

  // ==========================================
  // Computed
  // ==========================================
  
  const allocatedPortCount = computed(() => ports.value.length)
  const reservedPortCount = computed(() => reservedPorts.value.length)
  const fqdnCount = computed(() => fqdns.value.length)
  const systemApps = computed(() => apps.value.filter(a => a.type === 'system'))
  const userApps = computed(() => apps.value.filter(a => a.type === 'user'))

  // ==========================================
  // Initialize
  // ==========================================
  
  async function init() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchApps(),
        fetchPorts(),
        fetchFQDNs(),
        fetchProfiles(),
        fetchReservedPorts(),
        fetchPortStats()
      ])
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // Apps
  // ==========================================
  
  /**
   * Fetch all apps
   * GET /api/v1/apps
   */
  async function fetchApps() {
    const response = await appsApi.listApps()
    apps.value = response.apps || []
  }

  async function registerApp(appData) {
    const response = await appsApi.installApp(appData)
    await fetchApps()
    return response
  }

  async function unregisterApp(name) {
    await appsApi.uninstallApp(name)
    await fetchApps()
  }

  async function enableApp(name) {
    await appsApi.enableApp(name)
    await fetchApps()
  }

  async function disableApp(name) {
    await appsApi.disableApp(name)
    await fetchApps()
  }

  async function startApp(name) {
    await appsApi.startApp(name)
    await fetchApps()
  }

  async function stopApp(name) {
    await appsApi.stopApp(name)
    await fetchApps()
  }

  async function restartApp(name) {
    await appsApi.restartApp(name)
    await fetchApps()
  }

  async function getAppStatus(name) {
    return await appsApi.getApp(name)
  }

  // ==========================================
  // Ports
  // ==========================================
  
  /**
   * Fetch ports
   * GET /api/v1/ports
   * Falls back to extracting ports from apps if endpoint unavailable
   */
  async function fetchPorts() {
    try {
      const response = await api.get('/ports')
      ports.value = response.ports || []
      portsAvailable.value = true
    } catch (e) {
      // Endpoint may not be available — extract ports from apps as fallback
      ports.value = []
      portsAvailable.value = false
      
      // Extract ports from apps as fallback
      const allPorts = []
      apps.value.forEach(app => {
        if (app.ports) {
          app.ports.forEach(p => {
            allPorts.push({
              port: p.port,
              protocol: p.protocol || 'tcp',
              app_name: app.name,
              description: p.description || ''
            })
          })
        }
      })
      ports.value = allPorts
    }
  }

  async function allocatePort(portData) {
    if (!portsAvailable.value) {
      throw new Error('Port management not yet implemented in backend')
    }
    const response = await api.post('/ports', portData)
    await fetchPorts()
    return response
  }

  async function releasePort(port, protocol = 'tcp') {
    if (!portsAvailable.value) {
      throw new Error('Port management not yet implemented in backend')
    }
    await api.delete(`/ports/${port}?protocol=${protocol}`)
    await fetchPorts()
  }

  // ==========================================
  // FQDNs/Domains
  // ==========================================
  
  /**
   * Fetch FQDNs
   * GET /api/v1/fqdns
   * Falls back to extracting FQDNs from apps if endpoint unavailable
   */
  async function fetchFQDNs() {
    try {
      const response = await api.get('/fqdns')
      fqdns.value = response.fqdns || []
      fqdnsAvailable.value = true
    } catch (e) {
      // Endpoint may not be available — extract FQDNs from apps as fallback
      fqdns.value = []
      fqdnsAvailable.value = false
      
      // Extract FQDNs from apps as fallback
      const allFqdns = []
      apps.value.forEach(app => {
        if (app.fqdns) {
          app.fqdns.forEach(f => {
            allFqdns.push({
              fqdn: f.fqdn,
              subdomain: f.subdomain,
              app_name: app.name,
              backend_port: f.backend_port
            })
          })
        }
      })
      fqdns.value = allFqdns
    }
  }

  async function registerFQDN(fqdnData) {
    if (!fqdnsAvailable.value) {
      throw new Error('FQDN management not yet implemented in backend')
    }
    const response = await api.post('/fqdns', fqdnData)
    await fetchFQDNs()
    return response
  }

  async function deregisterFQDN(fqdn) {
    if (!fqdnsAvailable.value) {
      throw new Error('FQDN management not yet implemented in backend')
    }
    await api.delete(`/fqdns/${encodeURIComponent(fqdn)}`)
    await fetchFQDNs()
  }

  // ==========================================
  // Profiles
  // ==========================================
  
  /**
   * Fetch profiles
   * GET /api/v1/profiles
   */
  async function fetchProfiles() {
    const response = await api.get('/profiles')
    profiles.value = response.profiles || []
  }

  async function getProfile(name) {
    return await api.get(`/profiles/${name}`)
  }

  async function createProfile(name, description = '') {
    const response = await api.post('/profiles', { name, description })
    await fetchProfiles()
    return response
  }

  async function deleteProfile(name) {
    // No DELETE /profiles/{name} endpoint exists in API
    throw new Error('Profile deletion is not supported')
  }

  /**
   * Activate profile
   * POST /api/v1/profiles/{name}/apply
   */
  async function activateProfile(name) {
    await api.post(`/profiles/${name}/apply`)
    await fetchProfiles()
  }

  /**
   * Enable/disable an app within a profile
   * TODO: ⚡ Backend endpoint not yet implemented — needs PUT /profiles/{name}/apps/{appId} or similar
   * Called by ProfilesTab.vue:62
   *
   * @param {string} profileName - Profile name (not ID)
   * @param {string} appId - App identifier
   * @param {boolean} enabled - Whether the app should be enabled in this profile
   */
  async function setProfileApp(profileName, appId, enabled) {
    error.value = null
    try {
      await api.put(`/profiles/${encodeURIComponent(profileName)}/apps/${encodeURIComponent(appId)}`, { enabled })
      await fetchProfiles()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Registry
  // ==========================================
  
  /**
   * Get registry status
   * GET /api/v1/registry/status
   */
  async function getRegistryStatus() {
    try {
      const response = await api.get('/registry/status')
      registryAvailable.value = true
      return response
    } catch (e) {
      registryAvailable.value = false
      return { 
        online: false, 
        error: 'Registry status endpoint not available',
        _unavailable: true
      }
    }
  }

  async function getRegistryImages() {
    try {
      const response = await api.get('/registry/images')
      return response.images || []
    } catch (e) {
      return []
    }
  }

  /**
   * Initialize (start) the local Docker registry
   * TODO: ⚡ Backend endpoint not yet implemented — needs POST /registry/init or similar
   * Called by RegistryTab.vue:81
   */
  async function initRegistry() {
    error.value = null
    try {
      const result = await api.post('/registry/init')
      registryAvailable.value = true
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Cache (pull) a remote image into the local registry
   * TODO: ⚡ Backend endpoint not yet implemented — needs POST /registry/cache
   * Called by RegistryTab.vue:95
   *
   * @param {string} imageRef - Full image reference (e.g. "nginx:latest")
   */
  async function cacheImage(imageRef) {
    error.value = null
    try {
      const result = await api.post('/registry/cache', { image: imageRef })
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Delete a specific image (or image tag) from the local registry
   * Uses DELETE /registry/images/{name} — tag-level deletion not yet in Swagger
   * Called by RegistryTab.vue:177
   *
   * @param {string} name - Image name
   * @param {string} [tag] - Optional tag (currently ignored — deletes entire image)
   */
  async function deleteRegistryImage(name, tag) {
    error.value = null
    try {
      // TODO: ⚡ When backend supports tag-level deletion, use /registry/images/{name}/tags/{tag}
      const encoded = encodeURIComponent(name)
      await api.delete(`/registry/images/${encoded}`)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // App Config
  // Uses /appstore/installed/{appID}/config for user apps
  // Uses /appstore/coreapps/{appID}/config for core apps
  // ==========================================
  
  /**
   * Get app config
   * GET /api/v1/appstore/installed/{appID}/config
   * GET /api/v1/appstore/coreapps/{appID}/config (for core apps)
   */
  async function getAppConfig(appName, isCore = false) {
    try {
      const base = isCore ? '/appstore/coreapps' : '/appstore/installed'
      return await api.get(`${base}/${encodeURIComponent(appName)}/config`)
    } catch (e) {
      return { 
        compose: '',
        env: {},
        _unavailable: true,
        error: e.message
      }
    }
  }

  async function saveAppConfig(appName, compose, env, recreate = true, isCore = false) {
    const base = isCore ? '/appstore/coreapps' : '/appstore/installed'
    return await api.put(`${base}/${encodeURIComponent(appName)}/config`, { compose, env, recreate })
  }

  // ==========================================
  // CasaOS Import
  // ==========================================
  
  async function fetchCasaOSStore(url) {
    try {
      const response = await api.get('/casaos/stores', { url })
      return response.apps || []
    } catch (e) {
      return []
    }
  }

  async function previewCasaOSApp(json) {
    return await api.post('/casaos/preview', { json })
  }

  async function importCasaOSApp(json) {
    const response = await api.post('/casaos/import', { json })
    await fetchApps()
    return response
  }

  // ==========================================
  // NPM Integration
  // ==========================================
  
  async function getNPMStatus() {
    try {
      return await api.get('/npm/status')
    } catch (e) {
      return { available: false, error: e.message }
    }
  }

  async function getNPMHosts() {
    try {
      const response = await api.get('/npm/hosts')
      return response.hosts || []
    } catch (e) {
      return []
    }
  }

  // ==========================================
  // Reserved Ports & Port Stats
  // ==========================================

  /**
   * Fetch reserved system ports
   * GET /ports/reserved
   */
  async function fetchReservedPorts() {
    try {
      const response = await api.get('/ports/reserved')
      reservedPorts.value = response.ports || response || []
    } catch (e) {
      reservedPorts.value = []
    }
  }

  /**
   * Fetch port allocation statistics
   * GET /ports/stats
   */
  async function fetchPortStats() {
    try {
      const response = await api.get('/ports/stats')
      portStats.value = {
        total: response.total ?? 0,
        used: response.used ?? 0,
        available: response.available ?? 0
      }
    } catch (e) {
      portStats.value = { total: 0, used: 0, available: 0 }
    }
  }

  /**
   * Get next available port in the given range
   * TODO: ⚡ Backend endpoint not yet implemented — needs GET /ports/available?type={type}
   * Falls back to local computation from known ports.
   * Called by PortsTab.vue:36
   *
   * @param {string} type - Port range type: 'user' (6100-6999), 'infrastructure' (6000-6009), etc.
   * @returns {number|null} Next available port, or null if range is full
   */
  async function getAvailablePort(type = 'user') {
    error.value = null
    try {
      const response = await api.get('/ports/available', { type })
      return response.port || null
    } catch (e) {
      // Fallback: compute locally from known allocated ports
      const ranges = {
        infrastructure: [6000, 6009],
        platform: [6010, 6019],
        network: [6020, 6029],
        ai: [6030, 6039],
        user: [6100, 6999]
      }
      const [min, max] = ranges[type] || ranges.user
      const usedPorts = new Set(ports.value.map(p => p.port))
      for (let p = min; p <= max; p++) {
        if (!usedPorts.has(p)) return p
      }
      return null
    }
  }

  // ==========================================
  // FQDN Detail & Edit
  // ==========================================

  /**
   * Get detailed info for a single FQDN
   * GET /fqdns/{fqdn}
   * Returns: full FQDN, subdomain, backend port, SSL status, NPM proxy ID, etc.
   *
   * @param {string} fqdn - The full FQDN string
   */
  async function getFQDNDetail(fqdn) {
    error.value = null
    try {
      return await api.get(`/fqdns/${encodeURIComponent(fqdn)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Update an existing FQDN
   * PUT /fqdns/{fqdn}
   *
   * @param {string} fqdn - The full FQDN string to update
   * @param {Object} data - Update data
   * @param {string} [data.subdomain] - New subdomain
   * @param {number} [data.backend_port] - New backend port
   * @param {boolean} [data.ssl_enabled] - SSL toggle
   */
  async function updateFQDN(fqdn, data) {
    error.value = null
    try {
      const result = await api.put(`/fqdns/${encodeURIComponent(fqdn)}`, data)
      await fetchFQDNs()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    apps,
    ports,
    fqdns,
    profiles,
    reservedPorts,
    portStats,
    loading,
    error,
    
    // Feature availability flags
    portsAvailable,
    fqdnsAvailable,
    registryAvailable,
    
    // Computed
    allocatedPortCount,
    reservedPortCount,
    fqdnCount,
    systemApps,
    userApps,
    
    // Actions
    init,
    
    // Apps
    fetchApps,
    registerApp,
    unregisterApp,
    enableApp,
    disableApp,
    startApp,
    stopApp,
    restartApp,
    getAppStatus,
    getAppConfig,
    saveAppConfig,
    
    // Ports
    fetchPorts,
    allocatePort,
    releasePort,
    
    // Ports — reserved & stats
    fetchReservedPorts,
    fetchPortStats,
    getAvailablePort,
    
    // FQDNs
    fetchFQDNs,
    registerFQDN,
    deregisterFQDN,
    
    // FQDNs — detail & edit
    getFQDNDetail,
    updateFQDN,
    
    // Profiles
    fetchProfiles,
    getProfile,
    createProfile,
    deleteProfile,
    activateProfile,
    setProfileApp,
    
    // Registry
    getRegistryStatus,
    getRegistryImages,
    initRegistry,
    cacheImage,
    deleteRegistryImage,
    
    // CasaOS
    fetchCasaOSStore,
    previewCasaOSApp,
    importCasaOSApp,
    
    // NPM
    getNPMStatus,
    getNPMHosts
  }
})
