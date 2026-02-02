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
        fetchProfiles()
      ])
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // Apps - GET /apps
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

  // Ports - NOT IMPLEMENTED IN API
  async function fetchPorts() {
    // API endpoint not available
    ports.value = []
  }

  async function allocatePort(portData) {
    throw new Error('Port allocation endpoint not implemented')
  }

  async function releasePort(port, protocol = 'tcp') {
    throw new Error('Port release endpoint not implemented')
  }

  async function getAvailablePort(type = 'user') {
    throw new Error('Available port endpoint not implemented')
  }

  // FQDNs - NOT IMPLEMENTED IN API
  async function fetchFQDNs() {
    // API endpoint not available
    fqdns.value = []
  }

  async function registerFQDN(fqdnData) {
    throw new Error('FQDN registration endpoint not implemented')
  }

  async function deregisterFQDN(fqdn) {
    throw new Error('FQDN deregistration endpoint not implemented')
  }

  // Profiles - GET /profiles
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
    throw new Error('Profile app settings endpoint not implemented')
  }

  // Registry - NOT IMPLEMENTED IN API
  async function getRegistryStatus() {
    throw new Error('Registry status endpoint not implemented')
  }

  async function initRegistry() {
    throw new Error('Registry init endpoint not implemented')
  }

  async function getRegistryImages() {
    throw new Error('Registry images endpoint not implemented')
  }

  async function cacheImage(imageRef) {
    throw new Error('Cache image endpoint not implemented')
  }

  async function deleteRegistryImage(name, tag) {
    throw new Error('Delete registry image endpoint not implemented')
  }

  // CasaOS - NOT IMPLEMENTED IN API
  async function fetchCasaOSStore(url) {
    throw new Error('CasaOS store endpoint not implemented')
  }

  async function previewCasaOSApp(json) {
    throw new Error('CasaOS preview endpoint not implemented')
  }

  async function importCasaOSApp(json) {
    throw new Error('CasaOS import endpoint not implemented')
  }

  // Config Editing - NOT IMPLEMENTED IN API
  async function getAppConfig(appName) {
    throw new Error('App config endpoint not implemented')
  }

  async function saveAppConfig(appName, compose, env, recreate = true) {
    throw new Error('Save app config endpoint not implemented')
  }

  // Enhanced Ports - NOT IMPLEMENTED IN API
  async function getListeningPorts() {
    throw new Error('Listening ports endpoint not implemented')
  }

  async function getPortStats() {
    throw new Error('Port stats endpoint not implemented')
  }

  async function syncPorts() {
    throw new Error('Sync ports endpoint not implemented')
  }

  // Enhanced Domains - NOT IMPLEMENTED IN API
  async function getDomainsEnhanced() {
    throw new Error('Enhanced domains endpoint not implemented')
  }

  async function syncDomains() {
    throw new Error('Sync domains endpoint not implemented')
  }

  // NPM - NOT IMPLEMENTED IN API
  async function getNPMStatus() {
    throw new Error('NPM status endpoint not implemented')
  }

  async function getNPMHosts() {
    throw new Error('NPM hosts endpoint not implemented')
  }

  async function initNPM() {
    throw new Error('NPM init endpoint not implemented')
  }

  // Migration - NOT IMPLEMENTED IN API
  async function runMigration() {
    throw new Error('Migration endpoint not implemented')
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
