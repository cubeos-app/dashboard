<script setup>
/**
 * DashboardView.vue — Session 6 Update
 *
 * Dashboard shell that renders Standard or Advanced sub-view.
 * Hosts the settings gear icon and DashboardSettingsModal centrally
 * so both views share the same settings entry point.
 *
 * Session C: Added edit mode toggle (pencil/check button).
 * Session 5: Added WebSocket connection state indicator.
 * Session 6: Added layout lock icon, undo/redo keyboard shortcuts + buttons,
 *            preset picker modal.
 *
 * Keyboard shortcuts:
 *   Ctrl+, (or Cmd+,) opens settings
 *   Escape exits edit mode
 *   Ctrl+Z (or Cmd+Z) undo layout change (edit mode only)
 *   Ctrl+Shift+Z (or Cmd+Shift+Z) redo layout change (edit mode only)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useNetworkStore } from '@/stores/network'
import { useMonitoringStore } from '@/stores/monitoring'
import { useHardwareStore } from '@/stores/hardware'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useMode } from '@/composables/useMode'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import { useWidgetWebSocket, WS_STATE } from '@/composables/useWidgetWebSocket'
import Icon from '@/components/ui/Icon.vue'
import DashboardStandard from './DashboardStandard.vue'
import DashboardAdvanced from './DashboardAdvanced.vue'
import DashboardSettingsModal from './DashboardSettingsModal.vue'
import PresetPickerModal from './PresetPickerModal.vue'
import AskCubeOS from '@/components/chat/AskCubeOS.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const networkStore = useNetworkStore()
const monitoringStore = useMonitoringStore()
const hardwareStore = useHardwareStore()
const { signal } = useAbortOnUnmount()

// UPS first-boot banner (session-scoped dismissal)
const upsBannerDismissed = ref(false)
const showUPSBanner = computed(() => {
  if (upsBannerDismissed.value) return false
  // Show when detection found something but user hasn't configured
  const cfg = hardwareStore.upsConfig
  if (!cfg || cfg.configured) return false
  const det = hardwareStore.upsDetection
  return det?.suggested_model && det.suggested_model !== ''
})
const { isAdvanced } = useMode()
const { isLayoutLocked } = useDashboardConfig()
const { isEditing, toggleEdit, exitEdit, undo, redo, canUndo, canRedo, undoCount, redoCount } = useDashboardEdit()
const { wsConnectionState } = useWidgetWebSocket()

// Chat modal
const showChatModal = ref(false)
const chatQuery = ref('')

// Health modal (for apps without web UI)
const showHealthModal = ref(false)
const selectedApp = ref(null)

// Settings modal (shared between Standard and Advanced)
const showSettings = ref(false)

// Preset picker modal (Session 6)
const showPresetPicker = ref(false)

// Lock toast (shown when clicking lock icon)
const showLockToast = ref(false)
let lockToastTimer = null

// Ref to StandardDashboard for Ctrl+K
const standardDashRef = ref(null)

// ─── App interaction ──────────────────────────────────────────────

function openApp(app) {
  appsStore.trackRecent(app.name)
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

// ─── Lock icon handler ────────────────────────────────────────────

function handleLockedClick() {
  // Show a brief toast directing user to settings
  showLockToast.value = true
  if (lockToastTimer) clearTimeout(lockToastTimer)
  lockToastTimer = setTimeout(() => {
    showLockToast.value = false
  }, 2500)
}

// ─── Edit toggle with lock check ──────────────────────────────────

function handleEditToggle() {
  if (isLayoutLocked.value && !isEditing.value) {
    handleLockedClick()
    return
  }
  toggleEdit()
}

// ─── Keyboard shortcuts ───────────────────────────────────────────
// Ctrl+K / Cmd+K → focus search (Standard mode)
// Ctrl+, / Cmd+, → open settings
// Escape → exit edit mode
// Ctrl+Z → undo (edit mode)
// Ctrl+Shift+Z → redo (edit mode)

function handleFocusSearch() {
  if (!isAdvanced.value && standardDashRef.value?.searchBarRef) {
    standardDashRef.value.searchBarRef.focusInput()
  }
}

function handleKeydown(e) {
  // Escape → exit edit mode
  if (e.key === 'Escape' && isEditing.value) {
    e.preventDefault()
    exitEdit()
    return
  }

  const mod = e.metaKey || e.ctrlKey
  if (!mod) return

  // Ctrl+Z → undo (edit mode only)
  if (e.key === 'z' && !e.shiftKey && isEditing.value) {
    e.preventDefault()
    undo()
    return
  }

  // Ctrl+Shift+Z → redo (edit mode only)
  if (e.key === 'z' && e.shiftKey && isEditing.value) {
    e.preventDefault()
    redo()
    return
  }

  // Ctrl+, → open/close settings (only when not editing)
  if (e.key === ',') {
    e.preventDefault()
    if (!isEditing.value) {
      showSettings.value = !showSettings.value
    }
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
    monitoringStore.fetchAlerts({ signal: s }),
    hardwareStore.fetchUPSConfig({ signal: s })
  ])
  appsStore.startPolling()
  // Background UPS detection for banner (non-blocking)
  if (!hardwareStore.upsConfig?.configured) {
    hardwareStore.detectUPSHAT({ signal: s }).catch(() => {})
  }
  window.addEventListener('cubeos:focus-search', handleFocusSearch)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  appsStore.stopPolling()
  exitEdit()
  if (lockToastTimer) clearTimeout(lockToastTimer)
  window.removeEventListener('cubeos:focus-search', handleFocusSearch)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="p-2 sm:p-4 lg:p-6 relative">
    <!-- Edit / Settings controls (floats above both Standard and Advanced views) -->
    <div class="absolute top-2 right-2 sm:top-4 sm:right-4 lg:top-6 lg:right-6 flex items-center gap-1 z-10">
      <!-- WebSocket connection indicator (Session 5) -->
      <div
        class="flex items-center gap-1 mr-1"
        :title="wsConnectionState === 'connected'
          ? 'Live updates active'
          : 'Polling mode (WebSocket disconnected)'"
      >
        <span
          class="w-2 h-2 rounded-full transition-colors duration-300"
          :class="{
            'bg-emerald-400': wsConnectionState === 'connected',
            'bg-theme-muted': wsConnectionState === 'disconnected',
          }"
        ></span>
        <span
          v-if="wsConnectionState === 'connected'"
          class="text-[10px] text-emerald-400 font-medium hidden sm:inline"
        >Live</span>
      </div>

      <!-- Edit mode: undo/redo buttons + done/check button (Session 6) -->
      <template v-if="isEditing">
        <!-- Undo button -->
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
          :class="canUndo
            ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary/50'
            : 'text-theme-muted/30 cursor-not-allowed'"
          :disabled="!canUndo"
          aria-label="Undo (Ctrl+Z)"
          :title="`Undo (${undoCount})`"
          @click="undo"
        >
          <Icon name="Undo2" :size="16" :stroke-width="1.5" />
          <span
            v-if="undoCount > 0"
            class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent text-on-accent text-[8px] font-bold flex items-center justify-center"
          >{{ undoCount > 9 ? '9+' : undoCount }}</span>
        </button>

        <!-- Redo button -->
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
          :class="canRedo
            ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary/50'
            : 'text-theme-muted/30 cursor-not-allowed'"
          :disabled="!canRedo"
          aria-label="Redo (Ctrl+Shift+Z)"
          :title="`Redo (${redoCount})`"
          @click="redo"
        >
          <Icon name="Redo2" :size="16" :stroke-width="1.5" />
          <span
            v-if="redoCount > 0"
            class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent text-on-accent text-[8px] font-bold flex items-center justify-center"
          >{{ redoCount > 9 ? '9+' : redoCount }}</span>
        </button>

        <!-- Done/check button -->
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center
                 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors"
          aria-label="Done editing"
          title="Done editing (Esc)"
          @click="toggleEdit"
        >
          <Icon name="Check" :size="18" :stroke-width="2" />
        </button>
      </template>

      <!-- Normal mode: lock/edit pencil + settings gear -->
      <template v-else>
        <!-- Lock icon (shown when layout is locked, replaces pencil) -->
        <button
          v-if="isLayoutLocked"
          class="w-8 h-8 rounded-lg flex items-center justify-center
                 text-warning/60 hover:text-warning hover:bg-warning/10 transition-colors"
          aria-label="Layout is locked"
          title="Layout is locked. Unlock in Settings."
          @click="handleLockedClick"
        >
          <Icon name="Lock" :size="16" :stroke-width="1.5" />
        </button>

        <!-- Edit pencil (shown when layout is NOT locked) -->
        <button
          v-else
          class="w-8 h-8 rounded-lg flex items-center justify-center
                 text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/50 transition-colors"
          aria-label="Edit layout"
          title="Edit layout"
          @click="handleEditToggle"
        >
          <Icon name="Pencil" :size="16" :stroke-width="1.5" />
        </button>

        <!-- Settings gear -->
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center
                 text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/50 transition-colors"
          aria-label="Dashboard settings (Ctrl+,)"
          title="Dashboard settings (Ctrl+,)"
          @click="showSettings = true"
        >
          <Icon name="Settings2" :size="18" :stroke-width="1.5" />
        </button>
      </template>
    </div>

    <!-- Lock toast (Session 6) -->
    <Transition name="toast-fade">
      <div
        v-if="showLockToast"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-theme-card border border-warning/30
               shadow-lg flex items-center gap-2 text-sm text-warning"
      >
        <Icon name="Lock" :size="14" />
        <span>Layout is locked. Unlock in Settings.</span>
      </div>
    </Transition>

    <!-- UPS First-Boot Banner (D4) -->
    <Transition name="toast-fade">
      <div
        v-if="showUPSBanner"
        class="mb-4 bg-theme-card border border-accent/30 rounded-xl p-4 flex items-start gap-3 shadow-sm"
      >
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-muted shrink-0 mt-0.5">
          <Icon name="Zap" :size="16" class="text-accent" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-theme-primary">UPS hardware detected</p>
          <p class="text-xs text-theme-secondary mt-0.5">
            A {{ hardwareStore.upsDetection?.suggested_name || 'UPS HAT' }} was detected on this device.
            Configure it to enable battery monitoring and safe shutdown.
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            @click="router.push('/hardware')"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors"
          >
            Configure
          </button>
          <button
            @click="upsBannerDismissed = true"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            aria-label="Dismiss UPS banner"
          >
            <Icon name="X" :size="14" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Mode-aware sub-view -->
    <DashboardAdvanced
      v-if="isAdvanced"
      :is-editing="isEditing"
      @open-app="openApp"
      @toggle-favorite="toggleFavorite"
      @open-chat="openChat"
    />
    <DashboardStandard
      v-else
      ref="standardDashRef"
      :is-editing="isEditing"
      @open-app="openApp"
      @toggle-favorite="toggleFavorite"
      @open-chat="openChat"
    />

    <!-- ─── Shared Modals ──────────────────────────────────────────── -->

    <DashboardSettingsModal
      :show="showSettings"
      @close="showSettings = false"
      @open-presets="showPresetPicker = true"
    />

    <PresetPickerModal
      :show="showPresetPicker"
      @close="showPresetPicker = false"
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

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -8px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
