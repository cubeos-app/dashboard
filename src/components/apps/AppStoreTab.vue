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
 *
 * Batch 2: Registry installs now emit @install (same as store apps)
 * instead of calling registryStore.deployImage() directly.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStoreStore } from '@/stores/appstore'
import { useAppsStore } from '@/stores/apps'
import { useRegistryStore } from '@/stores/registry'
import { useMode } from '@/composables/useMode'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const emit = defineEmits(['openDetail', 'install'])

const appStore = useAppStoreStore()
const appsStore = useAppsStore()
const registryStore = useRegistryStore()
const { isAdvanced } = useMode()
const { panelClass, isActive: wallpaperActive } = useWallpaper()

// ─── Sub-tabs (within Store tab) ─────────────────────────────
const activeSubTab = ref('browse') // browse, installed
const coreApps = ref([])
const coreAppsError = ref('')
const selectedStoreFilter = ref('') // '' = all stores
const actionError = ref(null)

// ─── Computed ────────────────────────────────────────────────

// Cached apps from API (have full manifest metadata)
const offlineApps = computed(() => {
  if (!registryStore.cachedApps || registryStore.cachedApps.length === 0) return []
  return registryStore.cachedApps.map(cached => ({
    id: `_offline/${cached.app_name}`,
    store_id: cached.store_id,
    name: cached.app_name,
    title: { en_us: cached.title || cached.app_name },
    tagline: { en_us: cached.tagline || cached.image },
    description: { en_us: `Cached for offline deployment: ${cached.image}` },
    category: cached.category || 'Offline Apps',
    icon: cached.icon || '',
    installed: cached.installed,
    _source: 'offline_cache',
    _imageName: cached.image.includes(':') ? cached.image.substring(0, cached.image.lastIndexOf(':')) : cached.image,
    _tag: cached.image.includes(':') ? cached.image.substring(cached.image.lastIndexOf(':') + 1) : 'latest',
    _registryImage: cached.registry_image,
    _storeId: cached.store_id,
    _cachedAt: cached.cached_at
  }))
})

// Merge store catalog + offline cached apps based on active filter
const browsableApps = computed(() => {
  const storeFilter = selectedStoreFilter.value
  const query = (appStore.searchQuery || '').toLowerCase()
  const category = appStore.selectedCategory

  let apps = []

  // Add store catalog apps (unless filtering to offline only)
  if (storeFilter !== '_offline') {
    apps = [...appStore.filteredApps]
  }

  // Add offline cached apps (when showing all, or filtering to offline)
  if (storeFilter === '' || storeFilter === '_offline') {
    let cached = offlineApps.value
    // Apply search filter
    if (query) {
      cached = cached.filter(a => {
        const t = (a.title?.en_us || '').toLowerCase()
        const n = (a.name || '').toLowerCase()
        const img = (a._imageName || '').toLowerCase()
        return t.includes(query) || n.includes(query) || img.includes(query)
      })
    }
    // Apply category filter
    if (category && category !== 'Offline Apps') {
      cached = cached.filter(a => a.category === category)
    }
    apps = [...apps, ...cached]
  }

  return apps
})

const hasApps = computed(() => browsableApps.value.length > 0)

// Store options for filter dropdown (All + each registered store + offline)
const storeOptions = computed(() => {
  const opts = appStore.stores.map(s => ({
    id: s.id,
    name: s.name || s.url || s.id
  }))
  // Add offline as a virtual store if cached apps exist
  if (registryStore.cachedApps?.length > 0) {
    opts.push({ id: '_offline', name: 'Offline Apps' })
  }
  return opts
})

// ─── Watch ───────────────────────────────────────────────────
watch(() => appStore.selectedCategory, () => {
  appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery, selectedStoreFilter.value)
})

watch(selectedStoreFilter, (val) => {
  // Only re-fetch from API if filtering to a real store (not offline)
  if (val !== '_offline') {
    appStore.fetchCatalog(appStore.selectedCategory, appStore.searchQuery, val)
  }
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
  // Offline cached apps: if already installed, do nothing; if not, install
  if (app._source === 'offline_cache') {
    if (app.installed) return
    handleOfflineInstall(app)
    return
  }
  // Enrich installed catalog apps with runtime data (status, deploy_mode, etc.)
  if (app.installed) {
    const installed = appStore.installedApps.find(a =>
      a.store_app_id === app.id || a.name === app.name
    )
    if (installed) {
      emit('openDetail', { ...app, ...installed, _catalogData: app })
      return
    }
  }
  emit('openDetail', app)
}

function handleQuickInstall(app, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  // Offline cached apps go through unified install flow
  if (app._source === 'offline_cache') {
    if (app.installed) return
    handleOfflineInstall(app)
    return
  }
  const storeId = app.store_id || app.id?.split('/')[0] || ''
  const appName = app.name || app.id?.split('/')[1] || ''
  emit('install', storeId, appName, app, {})
}

/**
 * Install from offline cache. Fetches tags, picks first available,
 * then emits to AppsPage which opens InstallFlow.vue.
 */
async function handleOfflineInstall(app) {
  const imageName = app._imageName
  if (!imageName) return

  const appName = imageName.split('/').pop().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')

  let tags = []
  try {
    tags = await registryStore.fetchImageTags(imageName)
  } catch (e) {
    // fallback to latest
  }
  const tag = tags?.length > 0 ? tags[0] : 'latest'

  emit('install', '_registry', appName, {
    ...app,
    _source: 'offline_cache',
    _imageName: imageName,
    _tag: tag,
    title: app.title || { en_us: appName }
  }, {})
}

/**
 * Check if a store app has already been cached for offline use
 */
function isAppCachedOffline(app) {
  const appName = app.name || ''
  return registryStore.cachedApps?.some(c => c.app_name === appName)
}

/**
 * Cache a store app for offline use (no deploy)
 */
async function handleCacheForOffline(app, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  const storeId = app.store_id || app.id?.split('/')[0] || ''
  const appName = app.name || app.id?.split('/')[1] || ''
  try {
    await registryStore.cacheAppForOffline(storeId, appName)
    await registryStore.fetchCachedApps(true)
  } catch (err) {
    actionError.value = t('apps.store.cacheError', { error: err.message })
  }
}

function getAppTitle(app) {
  return app.title?.en_us || app.title?.en_US || app.name || ''
}

function getAppTagline(app) {
  return app.tagline?.en_us || app.tagline?.en_US || app.category || ''
}

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  if (appStore.catalog.length === 0) {
    await appStore.init()
  }
  // Fetch cached apps for offline availability badge
  registryStore.fetchCachedApps(true)
})

onUnmounted(() => {
  appStore.stopPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Sub-tab bar -->
    <div class="flex items-center gap-4">
      <button
        @click="activeSubTab = 'browse'"
        class="text-sm font-medium pb-1 transition-colors"
        :class="activeSubTab === 'browse' ? 'text-theme-primary border-b-2 border-accent' : 'text-theme-secondary hover:text-theme-primary'"
      >
        {{ t('apps.store.browse') }}
      </button>
      <button
        @click="activeSubTab = 'installed'"
        class="text-sm font-medium pb-1 transition-colors"
        :class="activeSubTab === 'installed' ? 'text-theme-primary border-b-2 border-accent' : 'text-theme-secondary hover:text-theme-primary'"
      >
        {{ t('apps.store.installed') }}
        <span
          v-if="appStore.installedCount > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-accent-muted text-accent"
        >
          {{ appStore.installedCount }}
        </span>
      </button>
    </div>

    <!-- ═══ Browse Sub-tab ═══ -->
    <template v-if="activeSubTab === 'browse'">
      <!-- Search + Filters -->
      <div class="flex flex-col sm:flex-row gap-3">
        <!-- Search -->
        <div class="relative flex-1">
          <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            v-model="appStore.searchQuery"
            @input="handleSearch"
            type="text"
            :placeholder="t('apps.store.searchPlaceholder')"
            class="w-full pl-9 pr-4 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary text-sm placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <!-- Category -->
        <select
          v-model="appStore.selectedCategory"
          class="px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">{{ t('apps.store.allCategories') }}</option>
          <option v-for="cat in appStore.categories" :key="cat" :value="cat">{{ cat }}</option>
          <option v-if="offlineApps.length > 0" value="Offline Apps">{{ t('apps.store.offlineApps') }}</option>
        </select>

        <!-- Store filter -->
        <select
          v-if="storeOptions.length > 1"
          v-model="selectedStoreFilter"
          class="px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">{{ t('apps.store.allSources') }}</option>
          <option v-for="store in storeOptions" :key="store.id" :value="store.id">{{ store.name }}</option>
        </select>
      </div>

      <!-- Error -->
      <div
        v-if="actionError"
        class="p-3 rounded-lg bg-error-muted text-error text-sm flex items-center justify-between"
      >
        <span>{{ actionError }}</span>
        <button @click="actionError = null" class="text-error hover:text-error/80">
          <Icon name="X" :size="14" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="appStore.loading" class="flex items-center justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>

      <!-- Empty -->
      <div v-else-if="!hasApps" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
          <Icon name="Package" :size="28" class="text-theme-muted" />
        </div>
        <h3 class="text-base font-semibold text-theme-primary mb-1">{{ t('apps.store.noAppsFound') }}</h3>
        <p class="text-theme-tertiary text-sm mb-4">
          {{ offlineApps.length > 0 ? t('apps.store.noStoreAppsHint') : t('apps.store.syncHint') }}
        </p>
        <div class="flex items-center justify-center gap-3">
          <button
            @click="appStore.syncStores()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
          >
            <Icon name="RefreshCw" :size="16" />
            {{ t('apps.store.syncStores') }}
          </button>
          <button
            v-if="appStore.selectedCategory || appStore.searchQuery || selectedStoreFilter"
            @click="clearFilters"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-sm font-medium text-theme-secondary hover:text-theme-primary"
          >
            {{ t('apps.store.clearFilters') }}
          </button>
        </div>
      </div>

      <!-- App Grid -->
      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
      >
        <button
          v-for="app in browsableApps"
          :key="app.id"
          @click="openDetail(app)"
          class="group relative flex flex-col items-center p-3 rounded-xl border border-theme-primary transition-all duration-150 hover:border-accent/40 hover:shadow-theme-md hover:-translate-y-0.5 text-left"
          :class="wallpaperActive ? panelClass : 'bg-theme-card'"
        >
          <!-- Installed badge -->
          <div v-if="app.installed" class="absolute top-2 right-2">
            <Icon name="CheckCircle" :size="14" class="text-success" />
          </div>

          <!-- Offline / Available Offline badge -->
          <div
            v-if="!app.installed && (app._source === 'offline_cache' || isAppCachedOffline(app))"
            class="absolute top-2 left-2"
            :title="app._source === 'offline_cache' ? t('apps.store.offlineCachedTitle') : t('apps.store.availableOffline')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="app._source === 'offline_cache' ? 'text-success' : 'text-theme-muted'"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
            <Icon v-else-if="app._source === 'offline_cache'" name="HardDrive" :size="24" class="text-success group-hover:text-accent transition-colors" />
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

          <!-- Quick install button (store apps + offline cached apps) -->
          <button
            v-if="!app.installed"
            @click="handleQuickInstall(app, $event)"
            class="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium text-accent bg-accent-muted hover:bg-accent hover:text-on-accent transition-colors"
            :aria-label="t('apps.store.installApp', { title: getAppTitle(app) })"
          >
            <Icon name="Download" :size="12" />
            {{ t('apps.install') }}
          </button>

          <!-- Installed label for store apps that are already installed -->
          <div
            v-if="app.installed"
            class="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-success"
          >
            <Icon name="CheckCircle" :size="12" />
            {{ t('apps.store.installed') }}
          </div>

          <!-- Cache for Offline button (store apps only, not already cached) -->
          <button
            v-if="!app.installed && app._source !== 'offline_cache' && !isAppCachedOffline(app)"
            @click.stop="handleCacheForOffline(app, $event)"
            class="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-accent/70 border border-accent/30 hover:bg-accent-muted hover:text-accent transition-colors"
            :disabled="registryStore.cachingApp === app.name"
            :aria-label="t('apps.store.cacheForOffline', { title: getAppTitle(app) })"
          >
            <Icon name="HardDrive" :size="12" />
            {{ registryStore.cachingApp === app.name ? t('apps.store.caching') : t('apps.store.cacheOffline') }}
          </button>

          <!-- "Cached" badge for store apps that are already cached -->
          <div
            v-if="!app.installed && app._source !== 'offline_cache' && isAppCachedOffline(app)"
            class="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] text-success"
          >
            <Icon name="CheckCircle" :size="12" />
            {{ t('apps.store.cachedOffline') }}
          </div>
        </button>
      </div>

      <!-- Results count -->
      <div v-if="hasApps" class="text-center text-xs text-theme-muted">
        {{ t('apps.store.showingApps', { count: browsableApps.length }) }}
        <template v-if="selectedStoreFilter === '_offline'">{{ t('apps.store.fromOfflineCache') }}</template>
        <template v-else-if="selectedStoreFilter">{{ t('apps.store.fromStore', { store: storeOptions.find(s => s.id === selectedStoreFilter)?.name }) }}</template>
        <template v-else>
          {{ t('apps.store.storeAndOffline', { storeCount: appStore.catalog.length, offlineCount: offlineApps.length }) }}
        </template>
      </div>
    </template>

    <!-- ═══ Installed Sub-tab ═══ -->
    <template v-if="activeSubTab === 'installed'">
      <!-- Empty -->
      <div v-if="appStore.installedApps.length === 0" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-theme-tertiary flex items-center justify-center">
          <Icon name="Download" :size="28" class="text-theme-muted" />
        </div>
        <h3 class="text-base font-semibold text-theme-primary mb-1">{{ t('apps.store.noInstalledApps') }}</h3>
        <p class="text-theme-tertiary text-sm mb-4">{{ t('apps.store.browseToInstall') }}</p>
        <button
          @click="activeSubTab = 'browse'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          {{ t('apps.store.browseApps') }}
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
              :title="t('apps.store.openWebUI')"
              :aria-label="t('apps.store.openWebUIFor', { name: app.title || app.name })"
            >
              <Icon name="ExternalLink" :size="16" />
            </a>

            <!-- Start/Stop -->
            <button
              v-if="app.status === 'stopped'"
              @click.stop="appStore.startApp(app.id)"
              class="p-2 rounded-lg text-success hover:bg-success-muted transition-colors"
              :title="t('apps.start')"
              :aria-label="t('apps.startApp', { name: app.title || app.name })"
            >
              <Icon name="Play" :size="16" />
            </button>
            <button
              v-if="app.status === 'running'"
              @click.stop="appStore.stopApp(app.id)"
              class="p-2 rounded-lg text-warning hover:bg-warning-muted transition-colors"
              :title="t('apps.stop')"
              :aria-label="t('apps.stopApp', { name: app.title || app.name })"
            >
              <Icon name="Square" :size="16" />
            </button>

            <!-- Restart -->
            <button
              @click.stop="appStore.restartApp(app.id)"
              class="p-2 rounded-lg text-theme-secondary hover:bg-theme-tertiary transition-colors"
              :title="t('apps.restart')"
              :aria-label="t('apps.restartApp', { name: app.title || app.name })"
            >
              <Icon name="RotateCw" :size="16" />
            </button>

            <!-- Info — always visible, pinned rightmost -->
            <button
              @click.stop="emit('openDetail', app)"
              class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              :title="t('apps.appInfo')"
              :aria-label="t('apps.store.infoFor', { name: app.title || app.name })"
            >
              <Icon name="Info" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
