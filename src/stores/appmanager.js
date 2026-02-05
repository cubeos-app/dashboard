/**
 * CubeOS App Manager Store
 * 
 * Sprint 4: Updated to handle backend gaps gracefully.
 * 
 * Working endpoints (verified):
 * - GET/POST/DELETE /apps, /apps/{name}, /apps/{name}/start|stop|restart
 * - GET /profiles, POST /profiles/{name}/apply
 * 
 * Backend gaps (return 404, need implementation):
 * - GET/POST/DELETE /ports - Port management
 * - GET/POST/DELETE /fqdns - Domain management  
 * - GET /registry/status, /registry/images - Registry status
 * - GET/PUT /apps/{name}/config - App configuration
 * - GET/POST /casaos/* - CasaOS import
 * - GET/POST /npm/* - NPM integration
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAppManagerStore = defineStore('appmanager', () => {
  // ==========================================
  // State
  // ==========================================
  
  const apps = ref([])
  const ports = ref([])
  const fqdns = ref([])
  const profiles = ref([])
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
        fetchProfiles()
      ])
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // Apps (Working - verified)
  // ==========================================
  
  /**
   * Fetch all apps
   * GET /api/v1/apps - verified working, returns 8 apps
   */
  async function fetchApps() {
    const response = await api.get('/apps')
    apps.value = response.apps || []
  }

  async function registerApp(appData) {
    const response = await api.post('/apps', appData)
    await fetchApps()
    return response
  }

  async function unregisterApp(name) {
    await api.delete(`/apps/${name}`)
    await fetchApps()
  }

  async function enableApp(name) {
    await api.post(`/apps/${name}/enable`)
    await fetchApps()
  }

  async function disableApp(name) {
    await api.post(`/apps/${name}/disable`)
    await fetchApps()
  }

  async function startApp(name) {
    await api.post(`/apps/${name}/start`)
  }

  async function stopApp(name) {
    await api.post(`/apps/${name}/stop`)
  }

  async function restartApp(name) {
    await api.post(`/apps/${name}/restart`)
  }

  async function getAppStatus(name) {
    return await api.get(`/apps/${name}`)
  }

  // ==========================================
  // Ports (Backend gap - returns 404)
  // ==========================================
  
  /**
   * Fetch ports - NOT IMPLEMENTED in backend
   * GET /api/v1/ports returns 404
   */
  async function fetchPorts() {
    try {
      const response = await api.get('/ports')
      ports.value = response.ports || []
      portsAvailable.value = true
    } catch (e) {
      // Expected - endpoint not implemented
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
  // FQDNs/Domains (Backend gap - returns 404)
  // ==========================================
  
  /**
   * Fetch FQDNs - NOT IMPLEMENTED in backend
   * GET /api/v1/fqdns returns 404
   */
  async function fetchFQDNs() {
    try {
      const response = await api.get('/fqdns')
      fqdns.value = response.fqdns || []
      fqdnsAvailable.value = true
    } catch (e) {
      // Expected - endpoint not implemented
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
  // Profiles (Working - verified)
  // ==========================================
  
  /**
   * Fetch profiles
   * GET /api/v1/profiles - verified working, returns 3 profiles
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
   * POST /api/v1/profiles/{name}/apply - verified working
   */
  async function activateProfile(name) {
    await api.post(`/profiles/${name}/apply`)
    await fetchProfiles()
  }

  // ==========================================
  // Registry (Backend gap - returns 404)
  // ==========================================
  
  /**
   * Get registry status - NOT IMPLEMENTED in backend
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
        error: 'Registry status endpoint not implemented',
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
  // CasaOS Import (Backend gap)
  // ==========================================
  
  async function fetchCasaOSStore(url) {
    try {
      const response = await api.get('/casaos/stores', { url })
      return response.apps || []
    } catch (e) {
      // CasaOS import not implemented yet
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
  // NPM Integration (Backend gap)
  // ==========================================
  
  async function getNPMStatus() {
    try {
      return await api.get('/npm/status')
    } catch (e) {
      return { available: false, error: 'NPM status not implemented' }
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
  // Export
  // ==========================================
  
  return {
    // State
    apps,
    ports,
    fqdns,
    profiles,
    loading,
    error,
    
    // Feature availability flags
    portsAvailable,
    fqdnsAvailable,
    registryAvailable,
    
    // Computed
    allocatedPortCount,
    fqdnCount,
    systemApps,
    userApps,
    
    // Actions
    init,
    
    // Apps (working)
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
    
    // Ports (backend gap)
    fetchPorts,
    allocatePort,
    releasePort,
    
    // FQDNs (backend gap)
    fetchFQDNs,
    registerFQDN,
    deregisterFQDN,
    
    // Profiles (working)
    fetchProfiles,
    getProfile,
    createProfile,
    deleteProfile,
    activateProfile,
    
    // Registry (backend gap)
    getRegistryStatus,
    getRegistryImages,
    
    // CasaOS (backend gap)
    fetchCasaOSStore,
    previewCasaOSApp,
    importCasaOSApp,
    
    // NPM (backend gap)
    getNPMStatus,
    getNPMHosts
  }
})
