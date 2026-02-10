<script setup>
/**
 * DashboardView.vue — S13 Update
 *
 * Dashboard shell that renders Standard or Advanced sub-view
 * based on the current UI mode. Handles shared data fetching,
 * chat modal, service health modal, and Ctrl+K search focus.
 *
 * S13 changes:
 *   - Added monitoring store fetch (for AlertBanner alerts)
 *   - Added Ctrl+K / Cmd+K global shortcut to focus SearchChatBar
 *   - Recent app tracking via safeSetItem/safeGetItem
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useNetworkStore } from '@/stores/network'
import { useMonitoringStore } from '@/stores/monitoring'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useMode } from '@/composables/useMode'
import { safeGetItem, safeSetItem } from '@/utils/storage'
import PageHeader from '@/components/ui/PageHeader.vue'
import DashboardStandard from './DashboardStandard.vue'
import DashboardAdvanced from './DashboardAdvanced.vue'
import AskCubeOS from '@/components/chat/AskCubeOS.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const networkStore = useNetworkStore()
const monitoringStore = useMonitoringStore()
const { signal } = useAbortOnUnmount()
const { isAdvanced } = useMode()

// Chat modal
const showChatModal = ref(false)
const chatQuery = ref('')

// Health modal (for apps without web UI)
const showHealthModal = ref(false)
const selectedApp = ref(null)

// Ref to StandardDashboard for Ctrl+K
const standardDashRef = ref(null)

// ─── App interaction ──────────────────────────────────────────────

function trackUsage(appName) {
  let recent = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(recent)) recent = []
  recent = recent.filter(n => n !== appName)
  recent.unshift(appName)
  safeSetItem('cubeos-recent', recent.slice(0, 10))
}

function openApp(app) {
  trackUsage(app.name)
  const url = appsStore.getAppUrl(app)
  if (url) {
    window.open(url, '_blank')
  } else {
    selectedApp.value = app
    showHealthModal.value = true
  }
}

function toggleFavorite(name) {
  favoritesStore.toggleFavorite(name)
}

function openChat() {
  chatQuery.value = ''
  showChatModal.value = true
}

// ─── Ctrl+K search focus (via AppHeader custom event) ────────────

function handleFocusSearch() {
  if (!isAdvanced.value && standardDashRef.value?.searchBarRef) {
    standardDashRef.value.searchBarRef.focusInput()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────

onMounted(async () => {
  const s = signal()
  await Promise.all([
    systemStore.fetchAll({ signal: s }),
    appsStore.fetchApps({ signal: s }),
    favoritesStore.fetchAll(),
    networkStore.fetchStatus(),
    monitoringStore.fetchAlerts({ signal: s })
  ])
  appsStore.startPolling()
  window.addEventListener('cubeos:focus-search', handleFocusSearch)
})

onUnmounted(() => {
  appsStore.stopPolling()
  window.removeEventListener('cubeos:focus-search', handleFocusSearch)
})
</script>

<template>
  <div class="p-2 sm:p-4 lg:p-6">
    <PageHeader
      v-if="isAdvanced"
      title="Dashboard"
      subtitle="System overview and service health"
      icon="LayoutDashboard"
    />

    <!-- Mode-aware sub-view -->
    <DashboardAdvanced
      v-if="isAdvanced"
      @open-app="openApp"
      @toggle-favorite="toggleFavorite"
      @open-chat="openChat"
    />
    <DashboardStandard
      v-else
      ref="standardDashRef"
      @open-app="openApp"
      @toggle-favorite="toggleFavorite"
      @open-chat="openChat"
    />

    <!-- ─── Shared Modals ──────────────────────────────────────────── -->

    <AskCubeOS
      :show="showChatModal"
      :initial-query="chatQuery"
      @close="showChatModal = false; chatQuery = ''"
    />

    <ServiceHealthModal
      v-if="selectedApp"
      :show="showHealthModal"
      :service="selectedApp"
      @close="showHealthModal = false"
    />
  </div>
</template>
