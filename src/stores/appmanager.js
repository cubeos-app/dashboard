import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAppManagerStore = defineStore('appmanager', () => {
  // State
  const apps = ref([])
  const ports = ref([])
  const fqdns = ref([])
  const profiles = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const allocatedPortCount = computed(() => ports.value.length)
  const fqdnCount = computed(() => fqdns.value.length)
  const systemApps = computed(() => apps.value.filter(a => a.type === 'system'))
  const userApps = computed(() => apps.value.filter(a => a.type === 'user'))

  // Initialize - fetch all data
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

  // Apps - /apps endpoints
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
    const response = await api.get(`/apps/${name}`)
    return response
  }

  // Ports - /ports endpoints (if available)
  async function fetchPorts() {
    try {
      const response = await api.get('/ports')
      ports.value = response.ports || []
    } catch (e) {
      // Endpoint may not exist yet
      ports.value = []
    }
  }

  async function allocatePort(portData) {
    const response = await api.post('/ports', portData)
    await fetchPorts()
    return response
  }

  async function releasePort(port, protocol = 'tcp') {
    await api.delete(`/ports/${port}?protocol=${protocol}`)
    await fetchPorts()
  }

  async function getAvailablePort(type = 'user') {
    const response = await api.get('/ports/available', { params: { type } })
    return response.port
  }

  // FQDNs - /fqdns endpoints (if available)
  async function fetchFQDNs() {
    try {
      const response = await api.get('/fqdns')
      fqdns.value = response.fqdns || []
    } catch (e) {
      // Endpoint may not exist yet
      fqdns.value = []
    }
  }

  async function registerFQDN(fqdnData) {
    const response = await api.post('/fqdns', fqdnData)
    await fetchFQDNs()
    return response
  }

  async function deregisterFQDN(fqdn) {
    await api.delete(`/fqdns/${encodeURIComponent(fqdn)}`)
    await fetchFQDNs()
  }

  // Profiles - /profiles endpoints
  async function fetchProfiles() {
    const response = await api.get('/profiles')
    profiles.value = response.profiles || []
  }

  async function getProfile(name) {
    const response = await api.get(`/profiles/${name}`)
    return response
  }

  async function createProfile(name, description = '') {
    const response = await api.post('/profiles', { name, description })
    await fetchProfiles()
    return response
  }

  async function deleteProfile(name) {
    await api.delete(`/profiles/${name}`)
    await fetchProfiles()
  }

  async function activateProfile(name) {
    await api.post(`/profiles/${name}/apply`)
    await fetchProfiles()
  }

  async function setProfileApp(profileName, appName, enabled) {
    await api.put(`/profiles/${profileName}/apps/${appName}`, { enabled })
  }

  // Registry - /registry endpoints (if available)
  async function getRegistryStatus() {
    try {
      const response = await api.get('/registry/status')
      return response
    } catch (e) {
      return { online: false, error: e.message }
    }
  }

  async function initRegistry() {
    await api.post('/registry/init')
  }

  async function getRegistryImages() {
    try {
      const response = await api.get('/registry/images')
      return response.images || []
    } catch (e) {
      return []
    }
  }

  async function cacheImage(imageRef) {
    await api.post('/registry/images/cache', { image: imageRef })
  }

  async function deleteRegistryImage(name, tag) {
    await api.delete(`/registry/images/${encodeURIComponent(name)}?tag=${encodeURIComponent(tag)}`)
  }

  // CasaOS - /casaos endpoints (if available)
  async function fetchCasaOSStore(url) {
    const response = await api.get('/casaos/stores', { params: { url } })
    return response.apps || []
  }

  async function previewCasaOSApp(json) {
    const response = await api.post('/casaos/preview', { json })
    return response
  }

  async function importCasaOSApp(json) {
    const response = await api.post('/casaos/import', { json })
    await fetchApps()
    return response
  }

  // Config Editing
  async function getAppConfig(appName) {
    const response = await api.get(`/apps/${appName}/config`)
    return response
  }

  async function saveAppConfig(appName, compose, env, recreate = true) {
    const response = await api.put(`/apps/${appName}/config`, { compose, env, recreate })
    return response
  }

  // Enhanced Ports
  async function getListeningPorts() {
    const response = await api.get('/ports/listening')
    return response.ports || []
  }

  async function getPortStats() {
    const response = await api.get('/ports/stats')
    return response
  }

  async function syncPorts() {
    const response = await api.post('/ports/sync')
    await fetchPorts()
    return response
  }

  // Enhanced Domains
  async function getDomainsEnhanced() {
    const response = await api.get('/domains')
    return response.domains || []
  }

  async function syncDomains() {
    const response = await api.post('/domains/sync')
    await fetchFQDNs()
    return response
  }

  // NPM
  async function getNPMStatus() {
    const response = await api.get('/npm/status')
    return response
  }

  async function getNPMHosts() {
    const response = await api.get('/npm/hosts')
    return response.hosts || []
  }

  async function initNPM() {
    const response = await api.post('/npm/init')
    return response
  }

  // Migration
  async function runMigration() {
    const response = await api.post('/migrate')
    await init()
    return response
  }

  return {
    // State
    apps,
    ports,
    fqdns,
    profiles,
    loading,
    error,
    // Computed
    allocatedPortCount,
    fqdnCount,
    systemApps,
    userApps,
    // Actions
    init,
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
    fetchPorts,
    allocatePort,
    releasePort,
    getAvailablePort,
    getListeningPorts,
    getPortStats,
    syncPorts,
    fetchFQDNs,
    registerFQDN,
    deregisterFQDN,
    getDomainsEnhanced,
    syncDomains,
    fetchProfiles,
    getProfile,
    createProfile,
    deleteProfile,
    activateProfile,
    setProfileApp,
    getRegistryStatus,
    initRegistry,
    getRegistryImages,
    cacheImage,
    deleteRegistryImage,
    fetchCasaOSStore,
    previewCasaOSApp,
    importCasaOSApp,
    getNPMStatus,
    getNPMHosts,
    initNPM,
    runMigration
  }
})
