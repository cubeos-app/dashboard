<script setup>
/**
 * DashboardView.vue — Session 5 Update
 *
 * Dashboard shell that renders Standard or Advanced sub-view.
 * Hosts the settings gear icon and DashboardSettingsModal centrally
 * so both views share the same settings entry point.
 *
 * Keyboard shortcut: Ctrl+, (or Cmd+,) opens settings.
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
import Icon from '@/components/ui/Icon.vue'
import DashboardStandard from './DashboardStandard.vue'
import DashboardAdvanced from './DashboardAdvanced.vue'
import DashboardSettingsModal from './DashboardSettingsModal.vue'
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

// Settings modal (shared between Standard and Advanced)
const showSettings = ref(false)

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

// ─── Keyboard shortcuts ───────────────────────────────────────────
// Ctrl+K / Cmd+K → focus search (Standard mode)
// Ctrl+, / Cmd+, → open settings

function handleFocusSearch() {
  if (!isAdvanced.value && standardDashRef.value?.searchBarRef) {
    standardDashRef.value.searchBarRef.focusInput()
  }
}

function handleKeydown(e) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return

  // Ctrl+, → open/close settings
  if (e.key === ',') {
    e.preventDefault()
    showSettings.value = !showSettings.value
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
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  appsStore.stopPolling()
  window.removeEventListener('cubeos:focus-search', handleFocusSearch)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="p-2 sm:p-4 lg:p-6 relative">
    <!-- Settings gear (floats above both Standard and Advanced views) -->
    <button
      class="absolute top-2 right-2 sm:top-4 sm:right-4 lg:top-6 lg:right-6 w-8 h-8 rounded-lg flex items-center justify-center
             text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/50 transition-colors z-10"
      aria-label="Dashboard settings (Ctrl+,)"
      title="Dashboard settings (Ctrl+,)"
      @click="showSettings = true"
    >
      <Icon name="Settings2" :size="18" :stroke-width="1.5" />
    </button>

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

    <DashboardSettingsModal
      :show="showSettings"
      @close="showSettings = false"
    />

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
