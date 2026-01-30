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

  // Apps
  async function fetchApps() {
    const response = await api.get('/appmanager/apps')
    apps.value = response.apps || []
  }

  async function registerApp(appData) {
    const response = await api.post('/appmanager/apps', appData)
    await fetchApps()
    return response
  }

  async function unregisterApp(name) {
    await api.delete(`/appmanager/apps/${name}`)
    await fetchApps()
  }

  async function enableApp(name) {
    await api.post(`/appmanager/apps/${name}/enable`)
    await fetchApps()
  }

  async function disableApp(name) {
    await api.post(`/appmanager/apps/${name}/disable`)
    await fetchApps()
  }

  async function startApp(name) {
    await api.post(`/appmanager/apps/${name}/start`)
  }

  async function stopApp(name) {
    await api.post(`/appmanager/apps/${name}/stop`)
  }

  async function restartApp(name) {
    await api.post(`/appmanager/apps/${name}/restart`)
  }

  async function getAppStatus(name) {
    const response = await api.get(`/appmanager/apps/${name}/status`)
    return response
  }

  // Ports
  async function fetchPorts() {
    const response = await api.get('/appmanager/ports')
    ports.value = response.ports || []
  }

  async function allocatePort(portData) {
    const response = await api.post('/appmanager/ports', portData)
    await fetchPorts()
    return response
  }

  async function releasePort(port, protocol = 'tcp') {
    await api.delete(`/appmanager/ports/${port}?protocol=${protocol}`)
    await fetchPorts()
  }

  async function getAvailablePort(type = 'user') {
    const response = await api.get('/appmanager/ports/available', { type })
    return response.port
  }

  // FQDNs
  async function fetchFQDNs() {
    const response = await api.get('/appmanager/fqdns')
    fqdns.value = response.fqdns || []
  }

  async function registerFQDN(fqdnData) {
    const response = await api.post('/appmanager/fqdns', fqdnData)
    await fetchFQDNs()
    return response
  }

  async function deregisterFQDN(fqdn) {
    await api.delete(`/appmanager/fqdns/${encodeURIComponent(fqdn)}`)
    await fetchFQDNs()
  }

  // Profiles
  async function fetchProfiles() {
    const response = await api.get('/appmanager/profiles')
    profiles.value = response.profiles || []
  }

  async function getProfile(id) {
    const response = await api.get(`/appmanager/profiles/${id}`)
    return response
  }

  async function createProfile(name, description = '') {
    const response = await api.post('/appmanager/profiles', { name, description })
    await fetchProfiles()
    return response
  }

  async function deleteProfile(id) {
    await api.delete(`/appmanager/profiles/${id}`)
    await fetchProfiles()
  }

  async function activateProfile(id) {
    await api.post(`/appmanager/profiles/${id}/activate`)
    await fetchProfiles()
  }

  async function setProfileApp(profileId, appId, enabled) {
    await api.put(`/appmanager/profiles/${profileId}/apps/${appId}`, { enabled })
  }

  // Registry
  async function getRegistryStatus() {
    const response = await api.get('/appmanager/registry/status')
    return response
  }

  async function initRegistry() {
    await api.post('/appmanager/registry/init')
  }

  async function getRegistryImages() {
    const response = await api.get('/appmanager/registry/images')
    return response.images || []
  }

  async function cacheImage(imageRef) {
    await api.post('/appmanager/registry/images/cache', { image: imageRef })
  }

  async function deleteRegistryImage(name, tag) {
    await api.delete(`/appmanager/registry/images/${encodeURIComponent(name)}?tag=${encodeURIComponent(tag)}`)
  }

  // CasaOS
  async function fetchCasaOSStore(url) {
    const response = await api.get('/appmanager/casaos/stores', { url })
    return response.apps || []
  }

  async function previewCasaOSApp(json) {
    const response = await api.post('/appmanager/casaos/preview', { json })
    return response
  }

  async function importCasaOSApp(json) {
    const response = await api.post('/appmanager/casaos/import', { json })
    await fetchApps()
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
    fetchPorts,
    allocatePort,
    releasePort,
    getAvailablePort,
    fetchFQDNs,
    registerFQDN,
    deregisterFQDN,
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
    importCasaOSApp
  }
})
