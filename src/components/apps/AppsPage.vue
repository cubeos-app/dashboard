<script setup>
/**
 * AppsPage.vue — S04 Component
 *
 * Shell that renders My Apps / App Store tabs (both modes)
 * and Manager / Docker / Registry tabs (Advanced only).
 * Handles shared data fetching, modals (detail sheet, install flow),
 * and routes ?tab= query param for backward-compat redirects.
 *
 * Pattern: Shell → Standard/Advanced sub-views (following S03 dashboard pattern)
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useAppStoreStore } from '@/stores/appstore'
import { useFavoritesStore } from '@/stores/favorites'
import { useMode } from '@/composables/useMode'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'

import MyAppsTab from './MyAppsTab.vue'
import AppStoreTab from './AppStoreTab.vue'
import AppDetailSheet from './AppDetailSheet.vue'
import InstallFlow from './InstallFlow.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()
const appStoreStore = useAppStoreStore()
const favoritesStore = useFavoritesStore()
const { isAdvanced } = useMode()
const { isMobile } = useBreakpoint()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'my-apps', label: 'My Apps', icon: 'Grid3X3' },
    { key: 'store', label: 'App Store', icon: 'Store' },
  ]
  // Advanced-only tabs are handled by S05
  return tabs
})

const activeTab = ref('my-apps')

// Read ?tab= from route for backward-compat redirects
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

function setTab(key) {
  activeTab.value = key
  // Update URL without navigation
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Detail Sheet ────────────────────────────────────────────
const detailApp = ref(null)
const showDetail = ref(false)

function openDetail(app) {
  detailApp.value = app
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  detailApp.value = null
}

// ─── Install Flow ────────────────────────────────────────────
const installTarget = ref(null) // { storeId, appName, app, options }
const showInstall = ref(false)

function startInstall(storeId, appName, app, options = {}) {
  installTarget.value = { storeId, appName, app, options }
  showInstall.value = true
}

function closeInstall() {
  showInstall.value = false
  installTarget.value = null
}

function handleInstallComplete() {
  // Refresh both stores
  appsStore.fetchApps({ signal: signal() })
  appStoreStore.fetchInstalledApps()
  closeInstall()
}

// ─── Data Fetching ───────────────────────────────────────────
onMounted(async () => {
  appsStore.fetchApps({ signal: signal() })
  appsStore.startPolling()
  favoritesStore.fetchAll({ signal: signal() })
  // Init app store in background
  appStoreStore.init()
})

onUnmounted(() => {
  appsStore.stopPolling()
  appStoreStore.stopPolling()
})

// ─── Header Stats ────────────────────────────────────────────
const headerSubtitle = computed(() => {
  const total = appsStore.appCount
  const running = appsStore.runningCount
  if (total === 0) return 'No apps installed'
  return `${running} of ${total} running`
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <PageHeader
      icon="Grid3X3"
      title="Apps"
      :subtitle="headerSubtitle"
    >
      <template #actions>
        <button
          v-if="activeTab === 'store'"
          @click="appStoreStore.syncStores()"
          :disabled="appStoreStore.syncing"
          aria-label="Sync app stores"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        >
          <Icon
            :name="appStoreStore.syncing ? 'Loader2' : 'RefreshCw'"
            :size="16"
            :class="appStoreStore.syncing ? 'animate-spin' : ''"
          />
          <span class="hidden sm:inline">{{ appStoreStore.syncing ? 'Syncing...' : 'Sync' }}</span>
        </button>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <div
      role="tablist"
      aria-label="Apps sections"
      class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg w-fit"
    >
      <button
        v-for="tab in TAB_DEFS"
        :key="tab.key"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="setTab(tab.key)"
        class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === tab.key
          ? 'bg-theme-card text-theme-primary shadow-sm'
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        <Icon :name="tab.icon" :size="16" class="hidden sm:block" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <MyAppsTab
      v-if="activeTab === 'my-apps'"
      @open-detail="openDetail"
      @open-store="setTab('store')"
    />

    <AppStoreTab
      v-if="activeTab === 'store'"
      @open-detail="openDetail"
      @install="startInstall"
    />

    <!-- App Detail Sheet (slide-over) -->
    <AppDetailSheet
      v-if="showDetail && detailApp"
      :app="detailApp"
      @close="closeDetail"
      @install="(storeId, appName, options) => {
        closeDetail()
        startInstall(storeId, appName, detailApp, options)
      }"
    />

    <!-- Install Flow -->
    <InstallFlow
      v-if="showInstall && installTarget"
      :store-id="installTarget.storeId"
      :app-name="installTarget.appName"
      :app="installTarget.app"
      :options="installTarget.options"
      @done="handleInstallComplete"
      @close="closeInstall"
    />
  </div>
</template>
