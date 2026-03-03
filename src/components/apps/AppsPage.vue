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
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import TabBar from '@/components/ui/TabBar.vue'

import { confirm } from '@/utils/confirmDialog'

import MyAppsTab from './MyAppsTab.vue'
import AppStoreTab from './AppStoreTab.vue'
import AppDetailSheet from './AppDetailSheet.vue'
import InstallFlow from './InstallFlow.vue'
import AppManagerTab from './AppManagerTab.vue'
import DockerTab from './DockerTab.vue'
import RegistryTab from './RegistryTab.vue'
import PortsTab from './PortsTab.vue'
import ProfilesTab from './ProfilesTab.vue'

const { t } = useI18n()
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
    { key: 'my-apps', label: t('apps.myAppsTab'), icon: 'Grid3X3' },
    { key: 'store', label: t('apps.appStore'), icon: 'Store' },
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'manager', label: t('apps.managerTab'), icon: 'Settings' },
      { key: 'docker', label: t('apps.dockerTab'), icon: 'Container' },
      { key: 'registry', label: t('apps.registry'), icon: 'Archive' },
      { key: 'ports', label: t('apps.ports'), icon: 'Plug' },
      { key: 'profiles', label: t('apps.profiles'), icon: 'Layers' }
    )
  }
  return tabs
})

const activeTab = ref('my-apps')

// Read ?tab= from route for backward-compat redirects
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'my-apps' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'my-apps'
  }
})

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

/**
 * Strip common store prefixes from app names for fuzzy matching.
 * "big-bear-syncthing" → "syncthing", "linuxserver-nginx" → "nginx"
 */
function normalizeAppName(name) {
  if (!name) return ''
  return name
    .replace(/^(big-bear|bigbear|linuxserver|cubeos)-/i, '')
    .toLowerCase()
    .trim()
}

/**
 * Find an existing installed app that matches the one being installed.
 * Returns the matching app object or null.
 */
function findDuplicateApp(appName, storeApp) {
  const targetName = normalizeAppName(appName)
  const targetTitle = (storeApp?.title?.en_us || storeApp?.title?.en_US || '').toLowerCase()

  return appsStore.apps.find(installed => {
    const instName = normalizeAppName(installed.name)
    const instTitle = (installed.display_name || '').toLowerCase()

    // Exact normalized name match (e.g. "big-bear-syncthing" vs "syncthing")
    if (instName && targetName && instName === targetName) return true

    // Title match (e.g. both display as "Syncthing")
    if (instTitle && targetTitle && instTitle === targetTitle) return true

    // Name contains (e.g. "syncthing" matches "big-bear-syncthing")
    if (instName && targetName && (instName.includes(targetName) || targetName.includes(instName))) return true

    return false
  })
}

async function startInstall(storeId, appName, app, options = {}) {
  // Check for duplicate installed app
  const duplicate = findDuplicateApp(appName, app)
  if (duplicate) {
    // Determine source of existing vs new install
    const existingIsRegistry = duplicate.source === 'registry'
    const newIsRegistry = storeId === '_registry' || app?._source === 'registry'

    // Same source = block (no use case for duplicate from same store)
    if (existingIsRegistry === newIsRegistry) {
      await confirm({
        title: t('apps.alreadyInstalled'),
        message: t('apps.alreadyInstalledMessage', { name: duplicate.display_name || duplicate.name }),
        confirmText: t('apps.gotIt'),
        cancelText: t('common.cancel'),
        variant: 'info'
      })
      return
    }

    // Different source = warn (e.g. registry ttyd vs store ttyd — different versions)
    const dupSource = existingIsRegistry ? t('apps.offlineRegistry') : t('apps.appStore')
    const dupName = duplicate.display_name || duplicate.name
    const newTitle = app?.title?.en_us || app?.title?.en_US || appName
    const newSource = newIsRegistry ? t('apps.offlineRegistry') : t('apps.appStore')

    const proceed = await confirm({
      title: t('apps.similarAppInstalled'),
      message: t('apps.similarAppInstalledMessage', { existingName: dupName, existingSource: dupSource, newName: newTitle, newSource }),
      confirmText: t('apps.installAnyway'),
      cancelText: t('common.cancel'),
      variant: 'warning'
    })
    if (!proceed) return
  }

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
  if (total === 0) return t('apps.noApps')
  return t('apps.runningCount', { running, total })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <PageHeader
      icon="Grid3X3"
      :title="t('apps.title')"
      :subtitle="headerSubtitle"
    >
      <template #actions>
        <button
          v-if="activeTab === 'store'"
          @click="appStoreStore.syncStores()"
          :disabled="appStoreStore.syncing"
          :aria-label="t('apps.syncStores')"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        >
          <Icon
            :name="appStoreStore.syncing ? 'Loader2' : 'RefreshCw'"
            :size="16"
            :class="appStoreStore.syncing ? 'animate-spin' : ''"
          />
          <span class="hidden sm:inline">{{ appStoreStore.syncing ? t('apps.syncing') : t('apps.sync') }}</span>
        </button>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <TabBar
      :model-value="activeTab"
      @update:model-value="setTab"
      :tabs="TAB_DEFS"
      :aria-label="t('apps.tabsLabel')"
    />

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

    <AppManagerTab v-if="activeTab === 'manager'" />
    <DockerTab v-if="activeTab === 'docker'" />
    <RegistryTab v-if="activeTab === 'registry'" />
    <PortsTab v-if="activeTab === 'ports'" />
    <ProfilesTab v-if="activeTab === 'profiles'" />

    <!-- App Detail Sheet (slide-over) -->
    <AppDetailSheet
      v-if="showDetail && detailApp"
      :app="detailApp"
      @close="closeDetail"
      @install="(storeId, appName, options) => {
        startInstall(storeId, appName, detailApp, options)
        closeDetail()
      }"
    />

    <!-- Install Flow -->
    <InstallFlow
      v-if="showInstall && installTarget && installTarget.app"
      :store-id="installTarget.storeId"
      :app-name="installTarget.appName"
      :app="installTarget.app"
      :options="installTarget.options"
      @done="handleInstallComplete"
      @close="closeInstall"
    />
  </div>
</template>
