<script setup>
/**
 * DashboardView.vue
 *
 * S03 — Dashboard shell that renders Standard or Advanced sub-view
 * based on the current UI mode. Handles shared data fetching, search,
 * chat modal, and service health modal.
 *
 * Replaces: components/DashboardView.vue (old flat dashboard)
 *
 * Data loading:
 *   - System stats via systemStore.fetchAll() (also populated by WebSocket)
 *   - Apps via appsStore.fetchApps() + polling
 *   - Favorites via favoritesStore.fetchAll()
 *   - Network status via networkStore.fetchStatus()
 *   - Monitoring data fetched within DashboardAdvanced (Advanced-specific)
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useNetworkStore } from '@/stores/network'
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
const { signal } = useAbortOnUnmount()
const { isAdvanced } = useMode()

// Chat modal
const showChatModal = ref(false)
const chatQuery = ref('')

// Health modal (for apps without web UI)
const showHealthModal = ref(false)
const selectedApp = ref(null)

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

// ─── Lifecycle ────────────────────────────────────────────────────

onMounted(async () => {
  const s = signal()
  await Promise.all([
    systemStore.fetchAll({ signal: s }),
    appsStore.fetchApps({ signal: s }),
    favoritesStore.fetchAll(),
    networkStore.fetchStatus()
  ])
  appsStore.startPolling()
})

onUnmounted(() => {
  appsStore.stopPolling()
})
</script>

<template>
  <div class="p-2 sm:p-4 lg:p-6">
    <PageHeader
      title="Dashboard"
      :subtitle="isAdvanced ? 'System overview and service health' : 'Your offline services at a glance'"
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
