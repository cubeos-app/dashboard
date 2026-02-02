/**
 * CubeOS App Store Store
 * 
 * Sprint 4: Migrated from deprecated /appstore/* to verified /apps/* endpoints.
 * 
 * NOTE: The app store catalog functionality requires backend implementation.
 * Currently only installed app management via /apps is working.
 * 
 * Backend gaps (not yet implemented):
 * - GET /appstore/stores - External app store sources
 * - GET /appstore/apps - Browse available apps
 * - GET /appstore/categories - App categories
 * - POST /appstore/stores/sync - Sync from external stores
 * 
 * Working endpoints (verified):
 * - GET /apps - List installed apps
 * - POST /apps - Install app
 * - DELETE /apps/{name} - Uninstall app
 * - POST /apps/{name}/start|stop|restart - Control app
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAppStoreStore = defineStore('appstore', () => {
  // ==========================================
  // State
  // ==========================================
  
  // Note: stores and catalog require backend implementation
  const stores = ref([])
  const catalog = ref([])
  const categories = ref([])
  
  // Installed apps (works via /apps endpoint)
  const installedApps = ref([])
  
  const loading = ref(false)
  const syncing = ref(false)
  const installing = ref(null)
  const error = ref(null)
  const selectedCategory = ref('')
  const searchQuery = ref('')
  
  // ==========================================
  // Computed
  // ==========================================
  
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
  const runningCount = computed(() => 
    installedApps.value.filter(a => a.status?.running).length
  )
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch stores (NOT IMPLEMENTED IN BACKEND)
   * TODO: Implement GET /appstore/stores or similar
   */
  async function fetchStores() {
    try {
      const data = await api.get('/appstore/stores')
      stores.value = data.stores || []
    } catch (e) {
      // Expected to fail - endpoint not implemented
      stores.value = []
      console.warn('App stores endpoint not implemented yet')
    }
  }

  /**
   * Fetch catalog (NOT IMPLEMENTED IN BACKEND)
   * TODO: Implement GET /appstore/apps or similar
   */
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
      // Expected to fail - endpoint not implemented
      catalog.value = []
      console.warn('App catalog endpoint not implemented yet')
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch categories (NOT IMPLEMENTED IN BACKEND)
   */
  async function fetchCategories() {
    try {
      const data = await api.get('/appstore/categories')
      categories.value = data.categories || []
    } catch (e) {
      categories.value = []
    }
  }

  /**
   * Fetch installed apps
   * Uses GET /api/v1/apps (verified working: returns 8 apps)
   */
  async function fetchInstalledApps() {
    try {
      const data = await api.get('/apps')
      installedApps.value = data.apps || []
    } catch (e) {
      error.value = e.message
    }
  }

  /**
   * Sync stores (NOT IMPLEMENTED IN BACKEND)
   */
  async function syncStores() {
    syncing.value = true
    error.value = null
    try {
      await api.post('/appstore/stores/sync')
      await fetchStores()
      await fetchCatalog()
      await fetchCategories()
    } catch (e) {
      console.warn('Store sync not implemented yet')
    } finally {
      syncing.value = false
    }
  }

  /**
   * Add external store (NOT IMPLEMENTED IN BACKEND)
   */
  async function addStore(url, name, description) {
    try {
      await api.post('/appstore/stores', { url, name, description })
      await fetchStores()
      return true
    } catch (e) {
      error.value = e.message || 'Add store not implemented'
      return false
    }
  }

  /**
   * Install app
   * Uses POST /api/v1/apps (endpoint exists, needs valid payload)
   */
  async function installApp(storeId, appName, options = {}) {
    installing.value = `${storeId}/${appName}`
    error.value = null
    try {
      const result = await api.post('/apps', {
        name: appName,
        display_name: options.title || appName,
        source: storeId || 'custom',
        store_app_id: appName,
        ...options
      })
      await fetchInstalledApps()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      installing.value = null
    }
  }

  /**
   * Start installed app
   * Uses POST /api/v1/apps/{name}/start (verified working)
   */
  async function startApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/start`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Stop installed app
   * Uses POST /api/v1/apps/{name}/stop (verified working)
   */
  async function stopApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/stop`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Restart installed app
   * Uses POST /api/v1/apps/{name}/restart (verified working)
   */
  async function restartApp(name) {
    try {
      await api.post(`/apps/${encodeURIComponent(name)}/restart`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Uninstall app
   * Uses DELETE /api/v1/apps/{name} (endpoint works, returns 404 for nonexistent)
   */
  async function removeApp(name, deleteData = false) {
    try {
      await api.delete(`/apps/${encodeURIComponent(name)}?keep_data=${!deleteData}`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Get app display title
   */
  function getAppTitle(app) {
    if (!app) return ''
    return app.title?.en_us || app.title?.en_US || app.display_name || app.name || ''
  }

  /**
   * Get app display description
   */
  function getAppDescription(app) {
    if (!app) return ''
    return app.description?.en_us || app.description?.en_US || app.description || ''
  }

  /**
   * Check if app is installed
   */
  function isInstalled(name) {
    return installedApps.value.some(a => a.name === name)
  }

  /**
   * Initialize - fetch installed apps (catalog requires backend work)
   */
  async function init() {
    await fetchInstalledApps()
    // These will fail silently until backend implements them:
    await Promise.allSettled([
      fetchStores(),
      fetchCatalog(),
      fetchCategories()
    ])
  }

  // ==========================================
  // Export
  // ==========================================
  
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
    
    // Computed
    filteredApps,
    installedCount,
    runningCount,
    
    // API Methods
    fetchStores,
    fetchCatalog,
    fetchCategories,
    fetchInstalledApps,
    syncStores,
    addStore,
    installApp,
    startApp,
    stopApp,
    restartApp,
    removeApp,
    
    // Helpers
    getAppTitle,
    getAppDescription,
    isInstalled,
    init
  }
})
