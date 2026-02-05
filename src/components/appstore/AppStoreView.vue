<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useAppStoreStore } from '@/stores/appstore'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'
import AppCard from './AppCard.vue'
import AppDetailModal from './AppDetailModal.vue'

const appStore = useAppStoreStore()

const selectedApp = ref(null)
const showDetailModal = ref(false)
const activeTab = ref('browse') // browse, installed, coreapps, stores
const coreApps = ref([])
const newStoreUrl = ref('')
const newStoreName = ref('')
const addingStore = ref(false)
const addStoreError = ref('')

// Computed
const hasApps = computed(() => appStore.catalog.length > 0)

// Watch for category/search changes
watch(() => appStore.selectedCategory, () => {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery)
})

// Fetch core apps when tab is activated
watch(() => activeTab.value, async (newTab) => {
  if (newTab === 'coreapps' && coreApps.value.length === 0) {
    await fetchCoreApps()
  }
})

// Methods
async function fetchCoreApps() {
  try {
    const data = await api.get('/appstore/coreapps')
    coreApps.value = data.apps || []
  } catch (e) {
    // Core apps fetch failed
  }
}

function openAppDetail(app) {
  selectedApp.value = app
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  selectedApp.value = null
}

async function handleInstall(storeId, appName) {
  try {
    await appStore.installApp(storeId, appName)
    closeDetail()
  } catch (e) {
    // Error handled in store
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

onMounted(async () => {
  await appStore.init()
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
    <div class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg mb-6 w-fit">
      <button
        @click="activeTab = 'browse'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'browse' 
          ? 'bg-theme-card text-theme-primary shadow-sm' 
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        Browse
      </button>
      <button
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
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        <!-- Category Filter -->
        <select
          v-model="appStore.selectedCategory"
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
          class="flex items-center gap-4 p-4 rounded-xl border border-theme-primary bg-theme-card"
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
              class="p-2 rounded-lg text-accent hover:bg-accent-muted transition-colors"
              title="Open Web UI"
            >
              <Icon name="ExternalLink" :size="16" />
            </a>

            <router-link
              :to="{ name: 'app-config', params: { appId: app.id } }"
              class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
              title="Edit Config"
            >
              <Icon name="Settings" :size="16" />
            </router-link>

            <button
              v-if="app.status === 'stopped'"
              @click="appStore.startApp(app.id)"
              class="p-2 rounded-lg text-success hover:bg-success-muted transition-colors"
              title="Start"
            >
              <Icon name="Play" :size="16" />
            </button>
            
            <button
              v-if="app.status === 'running'"
              @click="appStore.stopApp(app.id)"
              class="p-2 rounded-lg text-warning hover:bg-warning-muted transition-colors"
              title="Stop"
            >
              <Icon name="Square" :size="16" />
            </button>

            <button
              @click="appStore.restartApp(app.id)"
              class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
              title="Restart"
            >
              <Icon name="RotateCw" :size="16" />
            </button>

            <button
              @click="appStore.removeApp(app.id, false)"
              class="p-2 rounded-lg text-error hover:bg-error-muted transition-colors"
              title="Remove"
            >
              <Icon name="Trash2" :size="16" />
            </button>
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

      <div v-if="coreApps.length === 0" class="text-center py-12">
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
          class="flex items-center gap-4 p-4 rounded-xl border border-theme-primary bg-theme-card"
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
              @click="appStore.syncStore(store.id)"
              :disabled="appStore.syncing"
              class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
              title="Sync"
            >
              <Icon name="RefreshCw" :size="16" :class="appStore.syncing ? 'animate-spin' : ''" />
            </button>
            
            <button
              v-if="store.id !== 'casaos-official'"
              @click="appStore.removeStore(store.id)"
              class="p-2 rounded-lg text-error hover:bg-error-muted transition-colors"
              title="Remove"
            >
              <Icon name="Trash2" :size="16" />
            </button>
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
            class="flex-1 px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
          <input
            v-model="newStoreName"
            type="text"
            placeholder="Name (optional)"
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
      :installing="appStore.installing === selectedApp.id"
      @close="closeDetail"
      @install="handleInstall"
    />
  </div>
</template>
