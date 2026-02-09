<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAppStoreStore } from '@/stores/appstore'
import { confirm, confirmState } from '@/utils/confirmDialog'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'
import AppCard from './AppCard.vue'
import AppDetailModal from './AppDetailModal.vue'

const appStore = useAppStoreStore()

const selectedApp = ref(null)
const showDetailModal = ref(false)
const installError = ref(null)
const activeTab = ref('browse') // browse, installed, coreapps, stores
const coreApps = ref([])
const coreAppsError = ref('')
const newStoreUrl = ref('')
const newStoreName = ref('')
const addingStore = ref(false)
const addStoreError = ref('')

// Store detail expand state (Sources tab)
const expandedStoreId = ref(null)
const storeDetail = ref(null)
const storeDetailLoading = ref(false)
const storeDetailError = ref(null)

// Installed app detail expand state (Installed tab)
const expandedInstalledId = ref(null)
const installedDetail = ref(null)
const installedDetailLoading = ref(false)
const installedDetailError = ref(null)

// Computed
const hasApps = computed(() => appStore.catalog.length > 0)

// Watch for category/search changes
watch(() => appStore.selectedCategory, () => {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery)
})

// Fetch core apps when tab is activated
watch(() => activeTab.value, async (newTab, oldTab) => {
  if (newTab === 'coreapps' && coreApps.value.length === 0) {
    await fetchCoreApps()
  }
  // Auto-refresh installed apps while viewing Installed tab
  if (newTab === 'installed') {
    appStore.startPolling()
  } else if (oldTab === 'installed') {
    appStore.stopPolling()
  }
})

// Methods
async function fetchCoreApps() {
  coreAppsError.value = ''
  try {
    const data = await api.get('/appstore/coreapps')
    coreApps.value = data.apps || []
  } catch (e) {
    coreAppsError.value = e.message || 'Failed to load core apps'
  }
}

function openAppDetail(app) {
  installError.value = null
  selectedApp.value = app
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  selectedApp.value = null
}

async function handleInstall(storeId, appName, options = {}) {
  installError.value = null
  try {
    await appStore.installApp(storeId, appName, options)
    closeDetail()
  } catch (e) {
    installError.value = e.message || 'Installation failed. Check logs for details.'
  }
}

function handleSearch() {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery)
}

function clearFilters() {
  appStore.selectedCategory = ''
  appStore.searchQuery = ''
  appStore.fetchCatalog()
}

async function handleAddStore() {
  if (!newStoreUrl.value) return
  addingStore.value = true
  addStoreError.value = ''
  try {
    const success = await appStore.addStore(newStoreUrl.value, newStoreName.value || '', '')
    if (success) {
      newStoreUrl.value = ''
      newStoreName.value = ''
    } else {
      addStoreError.value = appStore.error || 'Failed to add store'
    }
  } catch (e) {
    addStoreError.value = e.message
  } finally {
    addingStore.value = false
  }
}

// Store detail expand/collapse (Sources tab — accordion)
async function toggleStoreDetail(storeId) {
  if (expandedStoreId.value === storeId) {
    expandedStoreId.value = null
    storeDetail.value = null
    storeDetailError.value = null
  } else {
    expandedStoreId.value = storeId
    storeDetail.value = null
    storeDetailError.value = null
    await loadStoreDetail(storeId)
  }
}

async function loadStoreDetail(storeId) {
  storeDetailLoading.value = true
  storeDetailError.value = null
  try {
    const data = await appStore.getStoreDetail(storeId)
    if (data) {
      storeDetail.value = data
    } else {
      storeDetailError.value = appStore.error || 'Failed to load store details'
    }
  } catch (e) {
    storeDetailError.value = e.message
  } finally {
    storeDetailLoading.value = false
  }
}

// Installed app detail expand/collapse (Installed tab — accordion)
async function toggleInstalledDetail(appId) {
  if (expandedInstalledId.value === appId) {
    expandedInstalledId.value = null
    installedDetail.value = null
    installedDetailError.value = null
  } else {
    expandedInstalledId.value = appId
    installedDetail.value = null
    installedDetailError.value = null
    await loadInstalledDetail(appId)
  }
}

async function loadInstalledDetail(appId) {
  installedDetailLoading.value = true
  installedDetailError.value = null
  try {
    const data = await appStore.getInstalledAppDetail(appId)
    if (data) {
      installedDetail.value = data
    } else {
      installedDetailError.value = appStore.error || 'Failed to load app details'
    }
  } catch (e) {
    installedDetailError.value = e.message
  } finally {
    installedDetailLoading.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

async function handleRemoveApp(appId) {
  if (!await confirm({
    title: 'Uninstall App',
    message: 'This will stop and remove the app from your system.',
    confirmText: 'Uninstall',
    variant: 'danger',
    checkboxLabel: 'Also delete app data',
    checkboxDefault: true
  })) return
  appStore.removeApp(appId, confirmState.checkboxChecked)
}

async function handleRemoveStore(storeId) {
  if (!await confirm({
    title: 'Remove Store',
    message: 'Remove this app store source? You can re-add it later.',
    confirmText: 'Remove',
    variant: 'danger'
  })) return
  appStore.removeStore(storeId)
}

onMounted(async () => {
  await appStore.init()
  // Start polling if we land directly on the installed tab
  if (activeTab.value === 'installed') {
    appStore.startPolling()
  }
})

onUnmounted(() => {
  appStore.stopPolling()
})
</script>

<template>
  <div class="min-h-full pb-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-xl font-semibold text-theme-primary tracking-tight">App Store</h1>
        <p class="text-theme-tertiary text-sm">Browse and install applications</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="appStore.syncStores()"
          :disabled="appStore.syncing"
          aria-label="Sync app stores"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        >
          <Icon 
            :name="appStore.syncing ? 'Loader2' : 'RefreshCw'" 
            :size="16" 
            :class="appStore.syncing ? 'animate-spin' : ''"
          />
          <span>{{ appStore.syncing ? 'Syncing...' : 'Sync' }}</span>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div role="tablist" aria-label="App store sections" class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg mb-6 w-fit">
      <button
        role="tab"
        :aria-selected="activeTab === 'browse'"
        @click="activeTab = 'browse'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'browse' 
          ? 'bg-theme-card text-theme-primary shadow-sm' 
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        Browse
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'installed'"
        @click="activeTab = 'installed'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
        :class="activeTab === 'installed' 
          ? 'bg-theme-card text-theme-primary shadow-sm' 
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        Installed
        <span 
          v-if="appStore.installedCount > 0"
          class="px-1.5 py-0.5 text-[10px] rounded bg-success-muted text-success"
        >
          {{ appStore.installedCount }}
        </span>
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'coreapps'"
        @click="activeTab = 'coreapps'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
        :class="activeTab === 'coreapps' 
          ? 'bg-theme-card text-theme-primary shadow-sm' 
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        <Icon name="Shield" :size="14" class="text-error" />
        Core Apps
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'stores'"
        @click="activeTab = 'stores'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'stores' 
          ? 'bg-theme-card text-theme-primary shadow-sm' 
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        Sources
      </button>
    </div>

    <!-- Browse Tab -->
    <template v-if="activeTab === 'browse'">
      <!-- Search & Filter -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <!-- Search -->
        <div class="relative flex-1">
          <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            v-model="appStore.searchQuery"
            @keyup.enter="handleSearch"
            type="text"
            placeholder="Search apps..."
            aria-label="Search apps"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <!-- Category Filter -->
        <select
          v-model="appStore.selectedCategory"
          aria-label="Filter by category"
          class="px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Categories</option>
          <option v-for="cat in appStore.categories" :key="cat.name" :value="cat.name">
            {{ cat.name }} ({{ cat.count }})
          </option>
        </select>

        <!-- Clear -->
        <button
          v-if="appStore.selectedCategory || appStore.searchQuery"
          @click="clearFilters"
          class="px-3 py-2 rounded-lg text-sm text-theme-secondary hover:text-error transition-colors"
        >
          Clear
        </button>
      </div>

      <!-- Loading -->
      <div v-if="appStore.loading" class="flex items-center justify-center py-12">
        <Icon name="Loader2" :size="32" class="animate-spin text-accent" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasApps" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
          <Icon name="Package" :size="28" class="text-theme-muted" />
        </div>
        <h3 class="text-base font-semibold text-theme-primary mb-1">No Apps Found</h3>
        <p class="text-theme-tertiary text-sm mb-4">Try syncing the app stores or adjusting your filters.</p>
        <button
          @click="appStore.syncStores()"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          <Icon name="RefreshCw" :size="16" />
          Sync Stores
        </button>
      </div>

      <!-- App Grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <AppCard
          v-for="app in appStore.filteredApps"
          :key="app.id"
          :app="app"
          @click="openAppDetail(app)"
        />
      </div>

      <!-- Results Count -->
      <div v-if="hasApps" class="mt-6 text-center text-xs text-theme-muted">
        Showing {{ appStore.filteredApps.length }} of {{ appStore.catalog.length }} apps
      </div>
    </template>

    <!-- Installed Tab -->
    <template v-else-if="activeTab === 'installed'">
      <div v-if="appStore.installedApps.length === 0" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
          <Icon name="Download" :size="28" class="text-theme-muted" />
        </div>
        <h3 class="text-base font-semibold text-theme-primary mb-1">No Installed Apps</h3>
        <p class="text-theme-tertiary text-sm mb-4">Browse the store and install some apps.</p>
        <button
          @click="activeTab = 'browse'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          Browse Apps
        </button>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="app in appStore.installedApps"
          :key="app.id"
        >
          <!-- App Row -->
          <div class="flex items-center gap-4 p-4 rounded-xl border border-theme-primary bg-theme-card"
            :class="{ 'rounded-b-none border-b-0': expandedInstalledId === app.id }"
          >
            <!-- Icon -->
            <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
              <img v-if="app.icon" :src="app.icon" :alt="app.title" class="w-8 h-8 rounded-lg object-contain" />
              <Icon v-else name="Package" :size="24" class="text-theme-muted" />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-theme-primary text-sm truncate">{{ app.title || app.name }}</h3>
                <span 
                  class="px-1.5 py-0.5 text-[10px] font-medium rounded"
                  :class="app.status === 'running' 
                    ? 'bg-success-muted text-success' 
                    : 'bg-theme-tertiary text-theme-muted'"
                >
                  {{ app.status }}
                </span>
              </div>
              <p class="text-xs text-theme-tertiary truncate">{{ app.category }} | v{{ app.version }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <a
                v-if="app.webui && app.status === 'running'"
                :href="app.webui"
                target="_blank"
                @click.stop
                class="p-2 rounded-lg text-accent hover:bg-accent-muted transition-colors"
                title="Open Web UI"
                :aria-label="'Open Web UI for ' + (app.title || app.name)"
              >
                <Icon name="ExternalLink" :size="16" />
              </a>

              <router-link
                :to="{ name: 'app-config', params: { appId: app.id } }"
                @click.stop
                class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
                title="Edit Config"
                :aria-label="'Edit config for ' + (app.title || app.name)"
              >
                <Icon name="Settings" :size="16" />
              </router-link>

              <button
                v-if="app.status === 'stopped'"
                @click.stop="appStore.startApp(app.id)"
                class="p-2 rounded-lg text-success hover:bg-success-muted transition-colors"
                title="Start"
                :aria-label="'Start ' + (app.title || app.name)"
              >
                <Icon name="Play" :size="16" />
              </button>
              
              <button
                v-if="app.status === 'running'"
                @click.stop="appStore.stopApp(app.id)"
                class="p-2 rounded-lg text-warning hover:bg-warning-muted transition-colors"
                title="Stop"
                :aria-label="'Stop ' + (app.title || app.name)"
              >
                <Icon name="Square" :size="16" />
              </button>

              <button
                @click.stop="appStore.restartApp(app.id)"
                class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
                title="Restart"
                :aria-label="'Restart ' + (app.title || app.name)"
              >
                <Icon name="RotateCw" :size="16" />
              </button>

              <button
                @click.stop="toggleInstalledDetail(app.id)"
                class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
                :class="{ 'bg-theme-tertiary text-theme-primary': expandedInstalledId === app.id }"
                title="Details"
                :aria-label="'Details for ' + (app.title || app.name)"
                :aria-expanded="expandedInstalledId === app.id"
              >
                <Icon name="Info" :size="16" />
              </button>

              <button
                @click.stop="handleRemoveApp(app.id)"
                class="p-2 rounded-lg text-error hover:bg-error-muted transition-colors"
                title="Remove"
                :aria-label="'Remove ' + (app.title || app.name)"
              >
                <Icon name="Trash2" :size="16" />
              </button>
            </div>
          </div>

          <!-- Installed App Detail Panel (expandable) -->
          <div
            v-if="expandedInstalledId === app.id"
            class="rounded-b-xl border border-t-0 border-theme-primary bg-theme-card overflow-hidden transition-all duration-200"
          >
            <!-- Loading skeleton -->
            <div v-if="installedDetailLoading" class="p-4 space-y-3">
              <div class="h-4 w-48 bg-theme-tertiary animate-pulse rounded-lg"></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="installedDetailError" class="p-4">
              <div class="flex items-center gap-3 text-error">
                <Icon name="AlertCircle" :size="16" class="flex-shrink-0" />
                <span class="text-sm">{{ installedDetailError }}</span>
                <button
                  @click="loadInstalledDetail(app.id)"
                  class="ml-auto px-3 py-1 rounded-lg border border-error/30 text-xs text-error hover:bg-error-muted transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>

            <!-- Detail content -->
            <div v-else-if="installedDetail" class="p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Version -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Tag" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Version</p>
                    <p class="text-sm text-theme-primary">{{ installedDetail.version || 'Unknown' }}</p>
                  </div>
                </div>

                <!-- Status -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Activity" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Status</p>
                    <p class="text-sm text-theme-primary">{{ installedDetail.status || app.status }}</p>
                  </div>
                </div>

                <!-- Install Date -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Clock" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Installed</p>
                    <p class="text-sm text-theme-primary">{{ formatDate(installedDetail.installed_at) }}</p>
                  </div>
                </div>

                <!-- Store Source -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Store" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Source</p>
                    <p class="text-sm text-theme-primary">{{ installedDetail.store_id || 'Manual' }}</p>
                  </div>
                </div>

                <!-- Resources (if available) -->
                <div v-if="installedDetail.resources" class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Cpu" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Resources</p>
                    <p class="text-sm text-theme-primary">
                      <span v-if="installedDetail.resources.cpu_percent != null">CPU {{ installedDetail.resources.cpu_percent }}%</span>
                      <span v-if="installedDetail.resources.cpu_percent != null && installedDetail.resources.memory_mb != null"> / </span>
                      <span v-if="installedDetail.resources.memory_mb != null">{{ installedDetail.resources.memory_mb }} MB</span>
                    </p>
                  </div>
                </div>

                <!-- Config Status -->
                <div v-if="installedDetail.config_status" class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Settings" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Config</p>
                    <p class="text-sm text-theme-primary capitalize">{{ installedDetail.config_status }}</p>
                  </div>
                </div>
              </div>

              <!-- Quick Actions Row -->
              <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-theme-primary">
                <a
                  v-if="installedDetail.webui && (installedDetail.status === 'running' || app.status === 'running')"
                  :href="installedDetail.webui"
                  target="_blank"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-muted transition-colors border border-accent/30"
                >
                  <Icon name="ExternalLink" :size="12" />
                  Open Web UI
                </a>
                <router-link
                  :to="{ name: 'app-config', params: { appId: app.id } }"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-theme-secondary hover:bg-theme-tertiary transition-colors border border-theme-primary"
                >
                  <Icon name="Settings" :size="12" />
                  Edit Config
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Core Apps Tab -->
    <template v-else-if="activeTab === 'coreapps'">
      <!-- Warning Banner -->
      <div class="mb-4 p-4 rounded-xl bg-error-muted border border-error/30">
        <div class="flex items-start gap-3">
          <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5 flex-shrink-0" />
          <div>
            <h3 class="font-semibold text-error">System-Critical Applications</h3>
            <p class="text-sm text-error/80 mt-1">
              These apps are essential for CubeOS to function. Modifying them incorrectly may 
              break your system and require physical access to recover. Proceed with extreme caution.
            </p>
          </div>
        </div>
      </div>

      <!-- Core Apps Error -->
      <div v-if="coreAppsError" class="mb-4 p-4 rounded-xl bg-error-muted border border-error/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Icon name="AlertCircle" :size="20" class="text-error flex-shrink-0" />
          <span class="text-sm text-error">{{ coreAppsError }}</span>
        </div>
        <button @click="fetchCoreApps()" class="px-3 py-1 rounded-lg border border-error/30 text-xs text-error hover:bg-error-muted/80 transition-colors">
          Retry
        </button>
      </div>

      <div v-if="coreApps.length === 0 && !coreAppsError" class="text-center py-12">
        <Icon name="Shield" :size="32" class="mx-auto text-theme-muted mb-2" />
        <p class="text-theme-tertiary text-sm">No core apps found</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="app in coreApps"
          :key="app.app_id"
          class="flex items-center gap-4 p-4 rounded-xl border border-error/30 bg-theme-card"
        >
          <div class="w-12 h-12 rounded-xl bg-error-muted flex items-center justify-center flex-shrink-0">
            <Icon name="Shield" :size="24" class="text-error" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-theme-primary text-sm">{{ app.app_id }}</h3>
              <span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-error-muted text-error">
                CORE
              </span>
            </div>
            <p class="text-xs text-theme-muted truncate">{{ app.app_path }}</p>
          </div>

          <router-link
            :to="{ name: 'app-config', params: { appId: app.app_id }, query: { core: 'true' } }"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border border-error/30 text-sm text-error hover:bg-error-muted transition-colors"
          >
            <Icon name="Settings" :size="14" />
            Configure
          </router-link>
        </div>
      </div>
    </template>

    <!-- Stores Tab -->
    <template v-else-if="activeTab === 'stores'">
      <div class="space-y-3">
        <div
          v-for="store in appStore.stores"
          :key="store.id"
        >
          <!-- Store Row (clickable to expand) -->
          <div
            class="flex items-center gap-4 p-4 rounded-xl border border-theme-primary bg-theme-card cursor-pointer hover:bg-theme-secondary transition-colors"
            :class="{ 'rounded-b-none border-b-0': expandedStoreId === store.id }"
            @click="toggleStoreDetail(store.id)"
            @keydown.enter="toggleStoreDetail(store.id)"
            role="button"
            tabindex="0"
            :aria-expanded="expandedStoreId === store.id"
            :aria-label="'Toggle details for ' + store.name"
          >
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon name="Store" :size="20" class="text-accent" />
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-theme-primary text-sm">{{ store.name }}</h3>
              <p class="text-xs text-theme-tertiary truncate">{{ store.description }}</p>
              <p class="text-[10px] text-theme-muted mt-1">
                {{ store.app_count }} apps | Last sync: {{ store.last_sync ? new Date(store.last_sync).toLocaleDateString() : 'Never' }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click.stop="appStore.syncStore(store.id)"
                :disabled="appStore.syncing"
                class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
                title="Sync"
                :aria-label="'Sync ' + store.name"
              >
                <Icon name="RefreshCw" :size="16" :class="appStore.syncing ? 'animate-spin' : ''" />
              </button>
              
              <button
                v-if="store.id !== 'casaos-official'"
                @click.stop="handleRemoveStore(store.id)"
                class="p-2 rounded-lg text-error hover:bg-error-muted transition-colors"
                title="Remove"
                :aria-label="'Remove store ' + store.name"
              >
                <Icon name="Trash2" :size="16" />
              </button>

              <Icon
                name="ChevronDown"
                :size="16"
                class="text-theme-muted transition-transform duration-200"
                :class="{ 'rotate-180': expandedStoreId === store.id }"
              />
            </div>
          </div>

          <!-- Store Detail Panel (expandable) -->
          <div
            v-if="expandedStoreId === store.id"
            class="rounded-b-xl border border-t-0 border-theme-primary bg-theme-card overflow-hidden transition-all duration-200"
          >
            <!-- Loading skeleton -->
            <div v-if="storeDetailLoading" class="p-4 space-y-3">
              <div class="h-4 w-40 bg-theme-tertiary animate-pulse rounded-lg"></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
                <div class="h-10 bg-theme-tertiary animate-pulse rounded-lg"></div>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="storeDetailError" class="p-4">
              <div class="flex items-center gap-3 text-error">
                <Icon name="AlertCircle" :size="16" class="flex-shrink-0" />
                <span class="text-sm">{{ storeDetailError }}</span>
                <button
                  @click.stop="loadStoreDetail(store.id)"
                  class="ml-auto px-3 py-1 rounded-lg border border-error/30 text-xs text-error hover:bg-error-muted transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>

            <!-- Detail content -->
            <div v-else-if="storeDetail" class="p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- URL -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Globe" :size="14" class="text-theme-muted" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">URL</p>
                    <p class="text-sm text-theme-primary truncate">{{ storeDetail.url }}</p>
                  </div>
                </div>

                <!-- App Count -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Package" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Apps</p>
                    <p class="text-sm text-theme-primary">{{ storeDetail.app_count ?? 0 }}</p>
                  </div>
                </div>

                <!-- Last Sync -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Clock" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Last Sync</p>
                    <p class="text-sm text-theme-primary">{{ formatDate(storeDetail.last_sync) }}</p>
                  </div>
                </div>

                <!-- Status -->
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="Activity" :size="14" class="text-theme-muted" />
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider">Status</p>
                    <span
                      class="px-2 py-0.5 text-[10px] font-medium rounded"
                      :class="storeDetail.enabled !== false
                        ? 'bg-success-muted text-success'
                        : 'bg-theme-tertiary text-theme-muted'"
                    >
                      {{ storeDetail.enabled !== false ? 'Enabled' : 'Disabled' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Description -->
              <p v-if="storeDetail.description" class="mt-4 pt-4 border-t border-theme-primary text-sm text-theme-secondary">
                {{ storeDetail.description }}
              </p>

              <!-- View Apps button -->
              <div class="flex items-center gap-2 mt-4 pt-4 border-t border-theme-primary">
                <button
                  @click.stop="activeTab = 'browse'"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-muted transition-colors border border-accent/30"
                >
                  <Icon name="Package" :size="12" />
                  View Apps
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Store Form -->
      <div class="mt-4 p-4 rounded-xl border border-theme-primary bg-theme-card">
        <h4 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Add App Store</h4>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="newStoreUrl"
            type="text"
            placeholder="Store URL (e.g. https://casaos.app/store)"
            aria-label="Store URL"
            class="flex-1 px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
          <input
            v-model="newStoreName"
            type="text"
            placeholder="Name (optional)"
            aria-label="Store name"
            class="sm:w-40 px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
          <button
            @click="handleAddStore"
            :disabled="!newStoreUrl || addingStore"
            class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            <Icon v-if="addingStore" name="Loader2" :size="16" class="animate-spin" />
            <Icon v-else name="Plus" :size="16" />
            Add
          </button>
        </div>
        <p v-if="addStoreError" class="mt-2 text-xs text-error">{{ addStoreError }}</p>
      </div>
    </template>

    <!-- App Detail Modal -->
    <AppDetailModal
      v-if="showDetailModal && selectedApp"
      :app="selectedApp"
      :installing="appStore.installing === `${selectedApp.store_id || ''}/${selectedApp.name || ''}`"
      :install-error="installError"
      @close="closeDetail"
      @install="handleInstall"
    />
  </div>
</template>
