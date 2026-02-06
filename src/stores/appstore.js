/**
 * CubeOS App Store Store
 * 
 * Manages app store browsing, installation, and management.
 * 
 * API endpoints (all verified in swagger):
 * 
 * Stores:
 *   GET    /appstore/stores           - List app stores
 *   POST   /appstore/stores           - Register new store
 *   GET    /appstore/stores/{storeID} - Get store details
 *   DELETE /appstore/stores/{storeID} - Remove store
 *   POST   /appstore/stores/sync      - Sync all stores
 *   POST   /appstore/stores/{storeID}/sync - Sync one store
 * 
 * Catalog:
 *   GET    /appstore/apps             - List catalog apps
 *   GET    /appstore/categories       - List categories
 *   GET    /appstore/stores/{storeID}/apps/{appName} - App details
 *   GET    /appstore/stores/{storeID}/apps/{appName}/icon - App icon
 *   GET    /appstore/stores/{storeID}/apps/{appName}/manifest - App manifest
 * 
 * Installed:
 *   GET    /appstore/installed                  - List installed
 *   POST   /appstore/installed                  - Install app
 *   GET    /appstore/installed/{appID}          - Get details
 *   DELETE /appstore/installed/{appID}          - Uninstall
 *   POST   /appstore/installed/{appID}/start    - Start
 *   POST   /appstore/installed/{appID}/stop     - Stop
 *   POST   /appstore/installed/{appID}/restart  - Restart
 *   POST   /appstore/installed/{appID}/action   - Custom action
 *   GET    /appstore/installed/{appID}/config   - Get config
 *   PUT    /appstore/installed/{appID}/config   - Update config
 *   POST   /appstore/installed/{appID}/config/apply - Apply config
 *   GET    /appstore/installed/{appID}/config/backups - List config backups (used by ConfigEditor)
 *   POST   /appstore/installed/{appID}/config/restore/{backup} - Restore config backup (used by ConfigEditor)
 * 
 * Core Apps:
 *   GET    /appstore/coreapps                   - List core apps
 *   GET    /appstore/coreapps/{appID}/config    - Get config
 *   PUT    /appstore/coreapps/{appID}/config    - Update config
 *   POST   /appstore/coreapps/{appID}/config/apply - Apply config
 *   GET    /appstore/coreapps/{appID}/config/backups - List config backups (used by ConfigEditor)
 *   POST   /appstore/coreapps/{appID}/config/restore/{backup} - Restore config backup (used by ConfigEditor)
 * 
 * Other:
 *   GET    /appstore/proxy-hosts      - List NPM proxy hosts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAppStoreStore = defineStore('appstore', () => {
  // ==========================================
  // State
  // ==========================================
  
  const stores = ref([])
  const catalog = ref([])
  const categories = ref([])
  const installedApps = ref([])
  const proxyHosts = ref([])
  
  const selectedStore = ref(null)
  
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
        const title = (app.title?.en_us || app.title?.en_US || app.name || '').toLowerCase()
        const desc = (app.description?.en_us || app.description?.en_US || '').toLowerCase()
        return title.includes(query) || desc.includes(query) || app.name.toLowerCase().includes(query)
      })
    }

    return apps
  })

  const installedCount = computed(() => installedApps.value.length)
  
  const runningCount = computed(() => 
    installedApps.value.filter(a => a.status === 'running').length
  )

  // Check if an app is installed (by name)
  function isInstalled(name) {
    return installedApps.value.some(a => 
      a.name === name || a.app_id === name
    )
  }
  
  // ==========================================
  // Store Management
  // ==========================================
  
  /** GET /appstore/stores */
  async function fetchStores() {
    try {
      const data = await api.get('/appstore/stores')
      stores.value = data.stores || []
    } catch (e) {
      stores.value = []
    }
  }

  /** POST /appstore/stores */
  async function addStore(url, name, description) {
    error.value = null
    try {
      await api.post('/appstore/stores', { url, name, description })
      await fetchStores()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /** DELETE /appstore/stores/{storeID} */
  async function removeStore(storeId) {
    error.value = null
    try {
      await api.delete(`/appstore/stores/${encodeURIComponent(storeId)}`)
      await fetchStores()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  /** POST /appstore/stores/sync - sync all stores */
  async function syncStores() {
    syncing.value = true
    error.value = null
    try {
      await api.post('/appstore/stores/sync')
      // Refresh everything after sync
      await Promise.allSettled([
        fetchStores(),
        fetchCatalog(),
        fetchCategories()
      ])
    } catch (e) {
      error.value = e.message
    } finally {
      syncing.value = false
    }
  }

  /** POST /appstore/stores/{storeID}/sync - sync single store */
  async function syncStore(storeId) {
    syncing.value = true
    error.value = null
    try {
      await api.post(`/appstore/stores/${encodeURIComponent(storeId)}/sync`)
      await Promise.allSettled([
        fetchStores(),
        fetchCatalog()
      ])
    } catch (e) {
      error.value = e.message
    } finally {
      syncing.value = false
    }
  }

  // ==========================================
  // Store & Installed App Detail
  // ==========================================

  /**
   * Get detailed info for a single store
   * GET /appstore/stores/{storeID}
   * Returns: URL, description, app count, last sync time, enabled status
   *
   * @param {string} storeId - Store identifier
   */
  async function getStoreDetail(storeId) {
    error.value = null
    try {
      const response = await api.get(`/appstore/stores/${encodeURIComponent(storeId)}`)
      selectedStore.value = response
      return response
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Get detailed info for an installed app
   * GET /appstore/installed/{appID}
   * Returns: install date, version, resource usage, config status, web UI link
   *
   * @param {string} appId - Installed app identifier
   */
  async function getInstalledAppDetail(appId) {
    error.value = null
    try {
      return await api.get(`/appstore/installed/${encodeURIComponent(appId)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // Catalog Browsing
  // ==========================================
  
  /** GET /appstore/apps */
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
      catalog.value = []
    } finally {
      loading.value = false
    }
  }

  /** GET /appstore/categories */
  async function fetchCategories() {
    try {
      const data = await api.get('/appstore/categories')
      categories.value = data.categories || []
    } catch (e) {
      categories.value = []
    }
  }

  /** GET /appstore/stores/{storeID}/apps/{appName} - detailed app info */
  async function getAppDetails(storeId, appName) {
    try {
      return await api.get(`/appstore/stores/${encodeURIComponent(storeId)}/apps/${encodeURIComponent(appName)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /** GET /appstore/stores/{storeID}/apps/{appName}/manifest */
  async function getAppManifest(storeId, appName) {
    try {
      return await api.get(`/appstore/stores/${encodeURIComponent(storeId)}/apps/${encodeURIComponent(appName)}/manifest`)
    } catch (e) {
      return null
    }
  }

  // ==========================================
  // Installed App Management
  // ==========================================
  
  /** GET /appstore/installed */
  async function fetchInstalledApps() {
    try {
      const data = await api.get('/appstore/installed')
      installedApps.value = data.apps || []
    } catch (e) {
      error.value = e.message
      installedApps.value = []
    }
  }

  /** POST /appstore/installed - install from store */
  async function installApp(storeId, appName, options = {}) {
    installing.value = `${storeId}/${appName}`
    error.value = null
    try {
      const result = await api.post('/appstore/installed', {
        store_id: storeId,
        app_name: appName,
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

  /** DELETE /appstore/installed/{appID} */
  async function removeApp(appId, deleteData = false) {
    error.value = null
    try {
      const params = deleteData ? '?delete_data=true' : ''
      await api.delete(`/appstore/installed/${encodeURIComponent(appId)}${params}`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /** POST /appstore/installed/{appID}/start */
  async function startApp(appId) {
    try {
      await api.post(`/appstore/installed/${encodeURIComponent(appId)}/start`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /** POST /appstore/installed/{appID}/stop */
  async function stopApp(appId) {
    try {
      await api.post(`/appstore/installed/${encodeURIComponent(appId)}/stop`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /** POST /appstore/installed/{appID}/restart */
  async function restartApp(appId) {
    try {
      await api.post(`/appstore/installed/${encodeURIComponent(appId)}/restart`)
      await fetchInstalledApps()
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /** POST /appstore/installed/{appID}/action */
  async function appAction(appId, action) {
    try {
      return await api.post(`/appstore/installed/${encodeURIComponent(appId)}/action`, { action })
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Proxy Hosts
  // ==========================================

  /** GET /appstore/proxy-hosts */
  async function fetchProxyHosts() {
    try {
      const data = await api.get('/appstore/proxy-hosts')
      proxyHosts.value = data.hosts || []
    } catch (e) {
      proxyHosts.value = []
    }
  }
  
  // ==========================================
  // Helpers
  // ==========================================
  
  function getAppTitle(app) {
    if (!app) return ''
    return app.title?.en_us || app.title?.en_US || app.display_name || app.name || ''
  }

  function getAppDescription(app) {
    if (!app) return ''
    return app.description?.en_us || app.description?.en_US || app.description || ''
  }

  /** Build icon URL for store apps */
  function getAppIconUrl(storeId, appName) {
    return `/api/v1/appstore/stores/${encodeURIComponent(storeId)}/apps/${encodeURIComponent(appName)}/icon`
  }

  /** Build screenshot URL */
  function getAppScreenshotUrl(storeId, appName, index) {
    return `/api/v1/appstore/stores/${encodeURIComponent(storeId)}/apps/${encodeURIComponent(appName)}/screenshot/${index}`
  }

  /**
   * Initialize — fetch stores, catalog, categories, and installed apps
   */
  async function init() {
    await Promise.allSettled([
      fetchInstalledApps(),
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
    proxyHosts,
    selectedStore,
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
    
    // Store Management
    fetchStores,
    addStore,
    removeStore,
    syncStores,
    syncStore,
    getStoreDetail,
    getInstalledAppDetail,
    
    // Catalog
    fetchCatalog,
    fetchCategories,
    getAppDetails,
    getAppManifest,
    
    // Installed Apps
    fetchInstalledApps,
    installApp,
    removeApp,
    startApp,
    stopApp,
    restartApp,
    appAction,
    
    // Proxy Hosts
    fetchProxyHosts,
    
    // Helpers
    getAppTitle,
    getAppDescription,
    getAppIconUrl,
    getAppScreenshotUrl,
    isInstalled,
    init
  }
})
