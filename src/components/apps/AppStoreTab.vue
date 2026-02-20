<script setup>
/**
 * AppStoreTab.vue — S04 Component
 *
 * Refactored from AppStoreView.vue.
 * Both modes: search + category filter + app cards.
 * Standard: one-click install with smart defaults.
 * Advanced: + install options (port, FQDN) in detail sheet.
 *
 * Install flow is handled by parent (AppsPage) via @install emit.
 * Detail view is handled by parent via @open-detail emit.
 *
 * Stores/Sources/Installed management tabs are S05 (Advanced-only).
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAppStoreStore } from '@/stores/appstore'
import { useRegistryStore } from '@/stores/registry'
import { useMode } from '@/composables/useMode'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['openDetail', 'install'])

const appStore = useAppStoreStore()
const registryStore = useRegistryStore()
const { isAdvanced } = useMode()
const { panelClass, isActive: wallpaperActive } = useWallpaper()

// ─── Sub-tabs (within Store tab) ─────────────────────────────
const activeSubTab = ref('browse') // browse, installed
const coreApps = ref([])
const coreAppsError = ref('')
const selectedStoreFilter = ref('') // '' = all stores

// ─── Computed ────────────────────────────────────────────────
const hasApps = computed(() => appStore.catalog.length > 0)

// Store options for filter dropdown (All + each registered store)
const storeOptions = computed(() => {
  return appStore.stores.map(s => ({
    id: s.id,
    name: s.name || s.url || s.id
  }))
})

// ─── Watch ───────────────────────────────────────────────────
watch(() => appStore.selectedCategory, () => {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery, selectedStoreFilter.value)
})

watch(selectedStoreFilter, () => {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery, selectedStoreFilter.value)
})

// Auto-refresh installed apps while viewing Installed sub-tab
watch(activeSubTab, (newTab, oldTab) => {
  if (newTab === 'installed') {
    appStore.startPolling()
  } else if (oldTab === 'installed') {
    appStore.stopPolling()
  }
})

// ─── Methods ─────────────────────────────────────────────────
function handleSearch() {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery, selectedStoreFilter.value)
}

function clearFilters() {
  appStore.selectedCategory = ''
  appStore.searchQuery = ''
  selectedStoreFilter.value = ''
  appStore.fetchCatalog()
}

function openDetail(app) {
  emit('openDetail', app)
}

function handleQuickInstall(app, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  const storeId = app.store_id || app.id?.split('/')[0] || ''
  const appName = app.name || app.id?.split('/')[1] || ''
  emit('install', storeId, appName, app, {})
}

function getAppTitle(app) {
  return app.title?.en_us || app.title?.en_US || app.name || ''
}

function getAppTagline(app) {
  return app.tagline?.en_us || app.tagline?.en_US || app.category || ''
}

/**
 * Check if an app's image is available in the local registry.
 * Matches app name against registry image catalog using fuzzy matching.
 * e.g., app "kiwix-serve" matches registry image "kiwix/kiwix-serve"
 */
function isAvailableOffline(app) {
  if (!registryStore.images || registryStore.images.length === 0) return false
  const appName = (app.name || '').toLowerCase()
  if (!appName) return false
  return registryStore.images.some(img => {
    const imgName = (typeof img === 'string' ? img : img.name || '').toLowerCase()
    // Check if the image path contains the app name (e.g., "kiwix/kiwix-serve" contains "kiwix")
    return imgName.includes(appName) || appName.includes(imgName.split('/').pop())
  })
}

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  if (appStore.catalog.length === 0) {
    await appStore.init()
  }
  // Fetch registry images for offline availability badge
  registryStore.fetchImages(true)
})

onUnmounted(() => {
  appStore.stopPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Sub-tabs: Browse / Installed -->
    <div class="flex items-center gap-4 border-b border-theme-primary">
      <button
        @click="activeSubTab = 'browse'"
        class="pb-2.5 px-1 text-sm font-medium transition-colors border-b-2 -mb-px"
        :class="activeSubTab === 'browse'
          ? 'border-accent text-accent'
          : 'border-transparent text-theme-secondary hover:text-theme-primary'"
      >
        Browse
      </button>
      <button
        @click="activeSubTab = 'installed'"
        class="pb-2.5 px-1 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2"
        :class="activeSubTab === 'installed'
          ? 'border-accent text-accent'
          : 'border-transparent text-theme-secondary hover:text-theme-primary'"
      >
        Installed
        <span
          v-if="appStore.installedCount > 0"
          class="px-1.5 py-0.5 text-[10px] rounded bg-success-muted text-success"
        >
          {{ appStore.installedCount }}
        </span>
      </button>
    </div>

    <!-- ═══ Browse Sub-tab ═══ -->
    <template v-if="activeSubTab === 'browse'">
      <!-- Search & Filter -->
      <div class="flex flex-col sm:flex-row gap-3">
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

        <select
          v-if="storeOptions.length > 1"
          v-model="selectedStoreFilter"
          aria-label="Filter by store"
          class="px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Stores</option>
          <option v-for="store in storeOptions" :key="store.id" :value="store.id">
            {{ store.name }}
          </option>
        </select>

        <button
          v-if="appStore.selectedCategory || appStore.searchQuery || selectedStoreFilter"
          @click="clearFilters"
          class="px-3 py-2 rounded-lg text-sm text-theme-secondary hover:text-error transition-colors"
          aria-label="Clear filters"
        >
          Clear
        </button>
      </div>

      <!-- Loading -->
      <div v-if="appStore.loading" class="flex items-center justify-center py-12">
        <Icon name="Loader2" :size="32" class="animate-spin text-accent" />
      </div>

      <!-- Empty -->
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
      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
      >
        <button
          v-for="app in appStore.filteredApps"
          :key="app.id"
          @click="openDetail(app)"
          class="group relative flex flex-col items-center p-3 rounded-xl border border-theme-primary transition-all duration-150 hover:border-accent/40 hover:shadow-theme-md hover:-translate-y-0.5 text-left"
          :class="wallpaperActive ? panelClass : 'bg-theme-card'"
        >
          <!-- Installed badge -->
          <div v-if="app.installed" class="absolute top-2 right-2">
            <Icon name="CheckCircle" :size="14" class="text-success" />
          </div>

          <!-- Available Offline badge -->
          <div
            v-if="!app.installed && isAvailableOffline(app)"
            class="absolute top-2 left-2"
            title="Available offline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-theme-muted"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>

          <!-- Icon -->
          <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted transition-colors">
            <img
              v-if="app.icon"
              :src="app.icon"
              :alt="getAppTitle(app)"
              class="w-8 h-8 rounded-lg object-contain"
              loading="lazy"
              @error="(e) => e.target.style.display = 'none'"
            />
            <Icon v-else name="Package" :size="24" class="text-theme-muted group-hover:text-accent transition-colors" />
          </div>

          <!-- Title -->
          <h3 class="text-xs font-medium text-theme-primary text-center leading-tight truncate w-full">
            {{ getAppTitle(app) }}
          </h3>

          <!-- Category/Tagline -->
          <p class="text-[10px] text-theme-muted text-center truncate w-full mt-0.5">
            {{ getAppTagline(app) }}
          </p>

          <!-- Standard: Quick install button (not installed only) -->
          <button
            v-if="!app.installed"
            @click="handleQuickInstall(app, $event)"
            class="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium text-accent bg-accent-muted hover:bg-accent hover:text-on-accent transition-colors"
            :aria-label="'Install ' + getAppTitle(app)"
          >
            <Icon name="Download" :size="12" />
            Install
          </button>
        </button>
      </div>

      <!-- Results count -->
      <div v-if="hasApps" class="text-center text-xs text-theme-muted">
        Showing {{ appStore.filteredApps.length }} of {{ appStore.catalog.length }} apps
      </div>
    </template>

    <!-- ═══ Installed Sub-tab ═══ -->
    <template v-if="activeSubTab === 'installed'">
      <!-- Empty -->
      <div v-if="appStore.installedApps.length === 0" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
          <Icon name="Download" :size="28" class="text-theme-muted" />
        </div>
        <h3 class="text-base font-semibold text-theme-primary mb-1">No Installed Apps</h3>
        <p class="text-theme-tertiary text-sm mb-4">Browse the store and install some apps.</p>
        <button
          @click="activeSubTab = 'browse'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          Browse Apps
        </button>
      </div>

      <!-- Installed List -->
      <div v-else class="space-y-2">
        <div
          v-for="app in appStore.installedApps"
          :key="app.id"
          class="flex items-center gap-4 p-4 rounded-xl border border-theme-primary"
          :class="wallpaperActive ? panelClass : 'bg-theme-card'"
        >
          <!-- Icon -->
          <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
            <img v-if="app.icon" :src="app.icon" :alt="app.title" class="w-7 h-7 rounded-lg object-contain" />
            <Icon v-else name="Package" :size="20" class="text-theme-muted" />
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
            <p class="text-xs text-theme-tertiary truncate">
              {{ app.category }}
              <template v-if="app.version"> · v{{ app.version }}</template>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1">
            <!-- Open Web UI -->
            <a
              v-if="app.webui && app.status === 'running' && app.webui_type !== 'api'"
              :href="app.webui"
              target="_blank"
              @click.stop
              class="p-2 rounded-lg text-accent hover:bg-accent-muted transition-colors"
              title="Open Web UI"
              :aria-label="'Open Web UI for ' + (app.title || app.name)"
            >
              <Icon name="ExternalLink" :size="16" />
            </a>

            <!-- Start/Stop -->
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

            <!-- Restart -->
            <button
              @click.stop="appStore.restartApp(app.id)"
              class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
              title="Restart"
              :aria-label="'Restart ' + (app.title || app.name)"
            >
              <Icon name="RotateCw" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
