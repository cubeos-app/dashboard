import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAppStoreStore = defineStore('appstore', () => {
  // State
  const stores = ref([])
  const catalog = ref([])
  const categories = ref([])
  const installedApps = ref([])
  const loading = ref(false)
  const syncing = ref(false)
  const installing = ref(null) // App ID being installed
  const error = ref(null)
  const selectedCategory = ref('')
  const searchQuery = ref('')

  // Getters
  const filteredApps = computed(() => {
    let apps = catalog.value

    if (selectedCategory.value) {
      apps = apps.filter(app => 
        app.category?.toLowerCase() === selectedCategory.value.toLowerCase()
      )
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      apps = apps.filter(app => {
        const title = (app.title?.en_us || app.name || '').toLowerCase()
        const desc = (app.description?.en_us || '').toLowerCase()
        return title.includes(query) || desc.includes(query) || app.name.toLowerCase().includes(query)
      })
    }

    return apps
  })

  const installedCount = computed(() => installedApps.value.length)
  const runningCount = computed(() => installedApps.value.filter(a => a.status === 'running').length)

  // Actions
  async function fetchStores() {
    try {
      const data = await api.get('/appstore/stores')
      stores.value = data.stores || []
    } catch (e) {
      error.value = e.message
    }
  }

  async function fetchCatalog(category = '', search = '') {
    loading.value = true
    error.value = null
    try {
      const params = {}
      if (category) params.category = category
      if (search) params.search = search
      
      const data = await api.get('/appstore/apps', params)
      catalog.value = data.apps || []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    try {
      const data = await api.get('/appstore/categories')
      categories.value = data.categories || []
    } catch (e) {
      console.error('Failed to fetch categories:', e)
    }
  }

  async function fetchInstalledApps() {
    try {
      const data = await api.get('/appstore/installed')
      installedApps.value = data.apps || []
    } catch (e) {
      error.value = e.message
    }
  }

  async function syncStores() {
    syncing.value = true
    error.value = null
    try {
      await api.post('/appstore/stores/sync')
      await fetchStores()
      await fetchCatalog()
      await fetchCategories()
    } catch (e) {
      error.value = e.message
    } finally {
      syncing.value = false
    }
  }

  async function syncStore(storeId) {
    syncing.value = true
    error.value = null
    try {
      await api.post(`/appstore/stores/${storeId}/sync`)
      await fetchCatalog()
    } catch (e) {
      error.value = e.message
    } finally {
      syncing.value = false
    }
  }

  async function addStore(url, name, description) {
    try {
      await api.post('/appstore/stores', { url, name, description })
      await fetchStores()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function removeStore(storeId) {
    try {
      await api.delete(`/appstore/stores/${storeId}`)
      await fetchStores()
      await fetchCatalog()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function getApp(storeId, appName) {
    try {
      return await api.get(`/appstore/stores/${storeId}/apps/${appName}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  async function installApp(storeId, appName, options = {}) {
    installing.value = `${storeId}/${appName}`
    error.value = null
    try {
      const result = await api.post('/appstore/installed', {
        store_id: storeId,
        app_name: appName,
        title: options.title,
        env_overrides: options.envOverrides,
        port_overrides: options.portOverrides,
        volume_overrides: options.volumeOverrides
      })
      await fetchInstalledApps()
      await fetchCatalog() // Update installed status
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      installing.value = null
    }
  }

  async function startApp(appId) {
    try {
      await api.post(`/appstore/installed/${appId}/start`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function stopApp(appId) {
    try {
      await api.post(`/appstore/installed/${appId}/stop`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function restartApp(appId) {
    try {
      await api.post(`/appstore/installed/${appId}/restart`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  async function removeApp(appId, deleteData = false) {
    try {
      await api.delete(`/appstore/installed/${appId}?delete_data=${deleteData}`)
      await fetchInstalledApps()
      await fetchCatalog()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // Get app display title
  function getAppTitle(app) {
    if (!app) return ''
    return app.title?.en_us || app.title?.en_US || app.name || ''
  }

  // Get app display description
  function getAppDescription(app) {
    if (!app) return ''
    return app.description?.en_us || app.description?.en_US || ''
  }

  // Initial load
  async function init() {
    await Promise.all([
      fetchStores(),
      fetchCatalog(),
      fetchCategories(),
      fetchInstalledApps()
    ])
  }

  return {
    // State
    stores,
    catalog,
    categories,
    installedApps,
    loading,
    syncing,
    installing,
    error,
    selectedCategory,
    searchQuery,
    
    // Getters
    filteredApps,
    installedCount,
    runningCount,
    
    // Actions
    fetchStores,
    fetchCatalog,
    fetchCategories,
    fetchInstalledApps,
    syncStores,
    syncStore,
    addStore,
    removeStore,
    getApp,
    installApp,
    startApp,
    stopApp,
    restartApp,
    removeApp,
    getAppTitle,
    getAppDescription,
    init
  }
})
