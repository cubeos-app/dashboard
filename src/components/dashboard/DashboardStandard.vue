<script setup>
/**
 * DashboardStandard.vue — Session 4
 *
 * Standard mode ("consumer mode") dashboard.
 * Row-based grid layout from useDashboardConfig.gridLayout.
 * Widgets wrapped in WidgetWrapper for per-widget opacity and DnD.
 *
 * SESSION 1: Restored side drop zones (left/right pairing). DnD now supports:
 * - Drag between rows → widget becomes its own full-width row (vertical reorder)
 * - Drag to left/right of a single widget → pairs side-by-side in that row
 * - Drag out of a 2-widget row → remaining widget auto-expands to full width
 *
 * SESSION 4: Touch DnD for mobile.
 * - Drop zones registered with useTouchDrag on mount and refreshed on layout changes.
 * - Touch events handled by WidgetWrapper + useTouchDrag composable.
 * - Both HTML5 DnD (desktop) and touch DnD (mobile) work without conflict.
 * - Drop zones highlight with .touch-drop-active class during touch drag.
 *
 * HTML5 Drag and Drop API — no library dependency.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import { useDashboardResize } from '@/composables/useDashboardResize'
import { useTouchDrag } from '@/composables/useTouchDrag'
import { useAppsStore } from '@/stores/apps'
import { useMonitoringStore } from '@/stores/monitoring'
import Icon from '@/components/ui/Icon.vue'
import ClockWidget from './ClockWidget.vue'
import SearchChatBar from './SearchChatBar.vue'
import AlertBanner from './AlertBanner.vue'
import StatusPill from './StatusPill.vue'
import SystemVitals from './SystemVitals.vue'
import NetworkWidget from './NetworkWidget.vue'
import DiskWidget from './DiskWidget.vue'
import SignalsWidget from './SignalsWidget.vue'
import UptimeLoadWidget from './UptimeLoadWidget.vue'
import NetworkThroughputWidget from './NetworkThroughputWidget.vue'
import RecentLogsWidget from './RecentLogsWidget.vue'
import BatteryWidget from './BatteryWidget.vue'
import AppLauncher from './AppLauncher.vue'
import FavoritesWidget from './FavoritesWidget.vue'
import RecentAppsWidget from './RecentAppsWidget.vue'
import MyAppsWidget from './MyAppsWidget.vue'
import CpuGaugeWidget from './CpuGaugeWidget.vue'
import MemoryGaugeWidget from './MemoryGaugeWidget.vue'
import DiskGaugeWidget from './DiskGaugeWidget.vue'
import TempGaugeWidget from './TempGaugeWidget.vue'
import SwarmOverview from '@/components/swarm/SwarmOverview.vue'
import ServiceGrid from './ServiceGrid.vue'
import AlertsFeed from './AlertsFeed.vue'
import InfoBarWidget from './InfoBarWidget.vue'
import WidgetWrapper from './WidgetWrapper.vue'

const props = defineProps({
  isEditing: { type: Boolean, default: false },
})

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()
const { handleDrop, dragWidgetId, canUndo, canRedo, undo, redo, undoCount, redoCount } = useDashboardEdit()
const { getWidgetWidth } = useDashboardResize()
const {
  isDraggingTouch,
  touchDragWidgetId,
  registerDropZone,
  clearDropZones,
  refreshZoneRects,
} = useTouchDrag()

const {
  showClock,
  showSearch,
  showStatusPill,
  showSystemVitals,
  showNetwork,
  showDisk,
  showSignals,
  showQuickActions,
  showAlerts,
  showUptimeLoad,
  showNetworkThroughput,
  showRecentLogs,
  showBattery,
  showFavorites,
  showRecent,
  showMyApps,
  quickActions: configQuickActions,
  gridLayout,
  isWidgetVisible,
  favoriteCols,
  myAppsRows,
} = useDashboardConfig()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

// ─── Stores for cross-mode widgets (Session 7) ──────────────────
const appsStore = useAppsStore()
const monitoringStore = useMonitoringStore()

const coreApps = computed(() => appsStore.coreApps)
const alerts = computed(() => monitoringStore.alerts)

const searchBarRef = ref(null)
defineExpose({ searchBarRef })

// ─── Template refs for touch drop zone registration ────────────
// Store refs to drop zone DOM elements for touch hit-testing.
const dropZoneRefs = ref({})

function setDropZoneRef(key) {
  return (el) => {
    if (el) {
      dropZoneRefs.value[key] = el
    } else {
      delete dropZoneRefs.value[key]
    }
  }
}

// ─── Drop zone state ──────────────────────────────────────────────
// Tracks which drop zone is currently highlighted (HTML5 DnD).
// Keys use the ORIGINAL gridLayout index (layoutIdx), not the filtered row index.
const activeDropZone = ref(null)

function dropZoneId(position, layoutIdx) {
  return `${position}-${layoutIdx}`
}

function onDragOver(e, position, layoutIdx) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  activeDropZone.value = dropZoneId(position, layoutIdx)
}

function onDragLeave(e, position, layoutIdx) {
  if (activeDropZone.value === dropZoneId(position, layoutIdx)) {
    activeDropZone.value = null
  }
}

function onDrop(e, position, layoutIdx) {
  e.preventDefault()
  activeDropZone.value = null
  handleDrop(layoutIdx, position)
}

function isDropActive(position, layoutIdx) {
  return activeDropZone.value === dropZoneId(position, layoutIdx)
}

// ─── Quick actions pool (full definitions) ───────────────────
const ACTIONS_POOL = {
  add_app:    { label: 'Add App',    icon: 'Plus',              color: 'bg-emerald-500/15 text-emerald-400', action: () => router.push('/apps?tab=store') },
  network:    { label: 'Network',    icon: 'Wifi',              color: 'bg-indigo-500/15 text-indigo-400',   action: () => router.push('/network') },
  storage:    { label: 'Storage',    icon: 'HardDrive',         color: 'bg-amber-500/15 text-amber-400',     action: () => router.push('/storage') },
  ask_cubeos: { label: 'Ask CubeOS', icon: 'MessageSquare',     color: 'bg-violet-500/15 text-violet-400',   action: () => emit('open-chat') },
  system:     { label: 'System',     icon: 'Settings2',         color: 'bg-cyan-500/15 text-cyan-400',       action: () => router.push('/system') },
  settings:   { label: 'Settings',   icon: 'SlidersHorizontal', color: 'bg-rose-500/15 text-rose-400',       action: () => router.push('/settings') },
  monitoring: { label: 'Monitoring', icon: 'BarChart3',         color: 'bg-teal-500/15 text-teal-400',       action: () => router.push('/system?tab=monitoring') },
  logs:       { label: 'Logs',       icon: 'ScrollText',        color: 'bg-slate-500/15 text-slate-400',     action: () => router.push('/system?tab=logs') },
  docs:       { label: 'Docs',       icon: 'BookOpen',          color: 'bg-sky-500/15 text-sky-400',         action: () => router.push('/docs') },
  vpn:        { label: 'VPN',        icon: 'Shield',            color: 'bg-purple-500/15 text-purple-400',   action: () => router.push('/network?tab=vpn') },
}

const filteredQuickActions = computed(() => {
  return configQuickActions.value
    .map(id => ACTIONS_POOL[id] ? { id, ...ACTIONS_POOL[id] } : null)
    .filter(Boolean)
})

/** Whether ask_cubeos should be disabled (Ollama not running) */
function isActionDisabled(qa) {
  if (qa.id !== 'ask_cubeos') return false
  const ollamaApp = appsStore.getAppByName('ollama')
  return !ollamaApp || !appsStore.isRunning(ollamaApp)
}

// ─── Grid rows (visibility-filtered, with original layout index) ─
//
// CRITICAL: `layoutIdx` is the index in the unfiltered `gridLayout`.
// All drop handlers must use `layoutIdx`, NOT the v-for iteration index,
// because handleDrop() operates on the full (unfiltered) gridLayout array.

const gridRows = computed(() => {
  return gridLayout.value
    .map((entry, originalIdx) => ({
      row: entry.row,
      visible: entry.row.filter(id => isWidgetVisible(id)),
      hasSearch: entry.row.includes('search') && isWidgetVisible('search'),
      layoutIdx: originalIdx,
    }))
    .filter(entry => entry.visible.length > 0)
})

const quickActionsGridCols = computed(() => {
  const count = filteredQuickActions.value.length
  if (count <= 3) return 'grid-cols-3'
  if (count <= 4) return 'grid-cols-2 sm:grid-cols-4'
  if (count <= 5) return 'grid-cols-3 sm:grid-cols-5'
  if (count <= 6) return 'grid-cols-3 sm:grid-cols-6'
  return 'grid-cols-4 sm:grid-cols-8'
})

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}

const isAllHidden = computed(() => gridRows.value.length === 0)

/**
 * Whether a row can accept a side drop (only single-widget rows).
 * Also checks that the dragged widget isn't already in this row.
 * Works for both HTML5 DnD and touch DnD.
 */
function canAcceptSideDrop(entry) {
  if (entry.visible.length !== 1) return false
  const dragging = dragWidgetId.value || touchDragWidgetId.value
  if (entry.visible.includes(dragging)) return false
  return true
}

/**
 * Whether any drag is active (HTML5 or touch).
 */
const isAnyDragActive = computed(() => !!dragWidgetId.value || isDraggingTouch.value)

/**
 * Determine the CSS grid class for a row.
 * - 2 widgets: always 2 columns on lg+
 * - 1 widget with 'half' width: 2 columns on lg+ (widget spans 1)
 * - 1 widget with 'full' width: 1 column (default)
 */
function rowGridClass(entry) {
  if (entry.visible.length > 1) return 'lg:grid-cols-2'
  if (entry.visible.length === 1 && getWidgetWidth(entry.visible[0]) === 'half') return 'lg:grid-cols-2'
  return ''
}

/** Whether a widget is in a row with another widget */
function isInPair(entry) {
  return entry.visible.length > 1
}

// ─── Touch drop zone registration ─────────────────────────────────
// Register all visible drop zones with the touch drag system whenever
// the layout or editing state changes. This lets the touch system
// hit-test zones during touchmove.

function registerAllDropZones() {
  clearDropZones()

  if (!props.isEditing) return

  nextTick(() => {
    const refs = dropZoneRefs.value

    for (const [key, el] of Object.entries(refs)) {
      if (!el || !el.isConnected) continue

      // Parse the key format: "position-layoutIdx"
      const parts = key.split('-')
      const position = parts[0] // 'before', 'after', 'left', 'right'
      const layoutIdx = parseInt(parts.slice(1).join('-'), 10)

      if (isNaN(layoutIdx)) continue

      const type = (position === 'left' || position === 'right') ? 'side' : 'row'
      registerDropZone(key, el, position, layoutIdx, type)
    }

    // Refresh cached rects after registration
    refreshZoneRects()
  })
}

// Re-register when editing changes or layout changes
watch(() => props.isEditing, (editing) => {
  if (editing) {
    nextTick(registerAllDropZones)
  } else {
    clearDropZones()
  }
})

watch(gridRows, () => {
  if (props.isEditing) {
    nextTick(registerAllDropZones)
  }
}, { deep: true })

onMounted(() => {
  if (props.isEditing) {
    nextTick(registerAllDropZones)
  }
})

onBeforeUnmount(() => {
  clearDropZones()
})
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto relative">
    <!-- Edit mode banner -->
    <div
      v-if="isEditing"
      class="text-center py-2 text-xs text-theme-muted select-none animate-fade-in"
    >
      <div class="flex items-center justify-center gap-3 mb-1">
        <button
          class="flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-[11px]"
          :class="canUndo ? 'text-theme-secondary hover:bg-theme-tertiary' : 'text-theme-muted/30 cursor-not-allowed'"
          :disabled="!canUndo"
          @click="undo"
          title="Undo (Ctrl+Z)"
        >
          <Icon name="Undo2" :size="12" />
          Undo<template v-if="undoCount > 0"> ({{ undoCount }})</template>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-[11px]"
          :class="canRedo ? 'text-theme-secondary hover:bg-theme-tertiary' : 'text-theme-muted/30 cursor-not-allowed'"
          :disabled="!canRedo"
          @click="redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Icon name="Redo2" :size="12" />
          Redo<template v-if="redoCount > 0"> ({{ redoCount }})</template>
        </button>
      </div>
      <span class="hidden sm:inline">Drag widgets to rearrange. Drop beside a widget to pair them side-by-side. Double-click edges to resize.</span>
      <span class="sm:hidden">Long-press and drag to rearrange widgets.</span>
    </div>

    <!-- Empty state when all widgets hidden -->
    <div
      v-if="isAllHidden"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <div class="w-16 h-16 rounded-2xl bg-theme-tertiary flex items-center justify-center mb-4">
        <Icon name="LayoutDashboard" :size="28" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-medium text-theme-secondary mb-2">Dashboard is empty</h3>
      <p class="text-sm text-theme-muted max-w-xs">
        All widgets are hidden. Open settings to add widgets back to your dashboard.
      </p>
    </div>

    <!-- Grid rows from grid_layout config -->
    <template v-for="(entry, filteredIdx) in gridRows" :key="entry.layoutIdx">
      <!-- Drop zone BEFORE this row (insert as new row) -->
      <div
        v-if="isEditing && isAnyDragActive"
        :ref="setDropZoneRef(`before-${entry.layoutIdx}`)"
        class="drop-zone-row"
        :class="isDropActive('before', entry.layoutIdx) ? 'drop-zone-active' : 'drop-zone-idle'"
        @dragover.prevent="onDragOver($event, 'before', entry.layoutIdx)"
        @dragleave="onDragLeave($event, 'before', entry.layoutIdx)"
        @drop="onDrop($event, 'before', entry.layoutIdx)"
      >
        <div class="drop-zone-indicator">
          <Icon name="Plus" :size="12" />
        </div>
      </div>

      <!-- Row container with optional side drop zones -->
      <div class="relative">
        <!--
          Side drop zones: appear when dragging next to a single-widget row.
          Only shown for rows with exactly 1 visible widget.
          Works for both HTML5 DnD and touch DnD.
        -->
        <template v-if="isEditing && isAnyDragActive && canAcceptSideDrop(entry)">
          <!-- Left side drop zone -->
          <div
            :ref="setDropZoneRef(`left-${entry.layoutIdx}`)"
            class="drop-zone-side drop-zone-side-left"
            :class="isDropActive('left', entry.layoutIdx) ? 'drop-zone-side-active' : 'drop-zone-side-idle'"
            @dragover.prevent="onDragOver($event, 'left', entry.layoutIdx)"
            @dragleave="onDragLeave($event, 'left', entry.layoutIdx)"
            @drop="onDrop($event, 'left', entry.layoutIdx)"
          >
            <div class="drop-zone-side-indicator">
              <Icon name="PanelLeft" :size="14" />
            </div>
          </div>

          <!-- Right side drop zone -->
          <div
            :ref="setDropZoneRef(`right-${entry.layoutIdx}`)"
            class="drop-zone-side drop-zone-side-right"
            :class="isDropActive('right', entry.layoutIdx) ? 'drop-zone-side-active' : 'drop-zone-side-idle'"
            @dragover.prevent="onDragOver($event, 'right', entry.layoutIdx)"
            @dragleave="onDragLeave($event, 'right', entry.layoutIdx)"
            @drop="onDrop($event, 'right', entry.layoutIdx)"
          >
            <div class="drop-zone-side-indicator">
              <Icon name="PanelRight" :size="14" />
            </div>
          </div>
        </template>

        <!-- Main grid: 1-col mobile, variable lg+ based on widget dimensions -->
        <div
          class="grid grid-cols-1 gap-4 dash-stagger"
          :class="rowGridClass(entry)"
        >
          <template v-for="widgetId in entry.visible" :key="widgetId">

            <!-- ═══ Clock ═══ -->
            <WidgetWrapper v-if="widgetId === 'clock'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <ClockWidget :card="true" />
            </WidgetWrapper>

            <!-- ═══ Search + Chat bar ═══ -->
            <WidgetWrapper v-if="widgetId === 'search'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <SearchChatBar
                ref="searchBarRef"
                @open-app="(app) => emit('open-app', app)"
                @open-chat="emit('open-chat')"
              />
            </WidgetWrapper>

            <!-- ═══ Status pill ═══ -->
            <WidgetWrapper v-if="widgetId === 'status'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <StatusPill />
            </WidgetWrapper>

            <!-- ═══ System Vitals ═══ -->
            <WidgetWrapper v-if="widgetId === 'vitals'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <SystemVitals />
            </WidgetWrapper>

            <!-- ═══ Network ═══ -->
            <WidgetWrapper v-if="widgetId === 'network'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <NetworkWidget />
            </WidgetWrapper>

            <!-- ═══ Disk ═══ -->
            <WidgetWrapper v-if="widgetId === 'disk'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <DiskWidget />
            </WidgetWrapper>

            <!-- ═══ Signals ═══ -->
            <WidgetWrapper v-if="widgetId === 'signals'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <SignalsWidget />
            </WidgetWrapper>

            <!-- ═══ Uptime & Load (Session 3) ═══ -->
            <WidgetWrapper v-if="widgetId === 'uptime_load'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <UptimeLoadWidget />
            </WidgetWrapper>

            <!-- ═══ Network Throughput (Session 3) ═══ -->
            <WidgetWrapper v-if="widgetId === 'network_throughput'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <NetworkThroughputWidget />
            </WidgetWrapper>

            <!-- ═══ Recent Logs (Session 3) ═══ -->
            <WidgetWrapper v-if="widgetId === 'recent_logs'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <RecentLogsWidget />
            </WidgetWrapper>

            <!-- ═══ Battery (Session 3) ═══ -->
            <WidgetWrapper v-if="widgetId === 'battery'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <BatteryWidget />
            </WidgetWrapper>

            <!-- ═══ Quick Actions ═══ -->
            <WidgetWrapper v-if="widgetId === 'actions' && filteredQuickActions.length > 0" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <div>
                <div
                  :class="cardBase()"
                  class="rounded-2xl p-4 h-full"
                >
                  <div class="grid gap-2" :class="quickActionsGridCols">
                    <button
                      v-for="qa in filteredQuickActions"
                      :key="qa.id"
                      :disabled="isActionDisabled(qa)"
                      class="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all duration-200
                             hover:bg-theme-tertiary hover:-translate-y-px group
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-transparent"
                      @click="!isActionDisabled(qa) && qa.action()"
                    >
                      <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                        :class="qa.color.split(' ')[0]"
                      >
                        <Icon :name="qa.icon" :size="18" :class="qa.color.split(' ')[1]" />
                      </div>
                      <span class="text-[11px] font-medium text-theme-secondary group-hover:text-theme-primary transition-colors">
                        {{ qa.label }}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </WidgetWrapper>

            <!-- ═══ App Launcher (DEPRECATED — kept for migration) ═══ -->
            <WidgetWrapper
              v-if="widgetId === 'launcher'"
              :widget-id="widgetId"
              :editing="isEditing"
              :row-idx="entry.layoutIdx"
              :in-pair="isInPair(entry)"
            >
              <div>
                <AppLauncher
                  :show-favorites="showFavorites"
                  :show-recent="showRecent"
                  :show-my-apps="showMyApps"
                  :my-apps-rows="myAppsRows"
                  :favorite-cols="favoriteCols"
                  @open-app="(app) => emit('open-app', app)"
                  @toggle-favorite="(name) => emit('toggle-favorite', name)"
                />
              </div>
            </WidgetWrapper>

            <!-- ═══ Favorites (Session 7 — decomposed from launcher) ═══ -->
            <WidgetWrapper v-if="widgetId === 'favorites'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <FavoritesWidget @open-app="(app) => emit('open-app', app)" />
            </WidgetWrapper>

            <!-- ═══ Recent Apps (Session 7 — decomposed from launcher) ═══ -->
            <WidgetWrapper v-if="widgetId === 'recent_apps'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <RecentAppsWidget @open-app="(app) => emit('open-app', app)" />
            </WidgetWrapper>

            <!-- ═══ My Apps (Session 7 — decomposed from launcher) ═══ -->
            <WidgetWrapper v-if="widgetId === 'my_apps'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <MyAppsWidget @open-app="(app) => emit('open-app', app)" />
            </WidgetWrapper>

            <!-- ═══ CPU Gauge (Session 7 — decomposed from gauges) ═══ -->
            <WidgetWrapper v-if="widgetId === 'cpu_gauge'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <CpuGaugeWidget />
            </WidgetWrapper>

            <!-- ═══ Memory Gauge (Session 7) ═══ -->
            <WidgetWrapper v-if="widgetId === 'memory_gauge'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <MemoryGaugeWidget />
            </WidgetWrapper>

            <!-- ═══ Disk Gauge (Session 7) ═══ -->
            <WidgetWrapper v-if="widgetId === 'disk_gauge'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <DiskGaugeWidget />
            </WidgetWrapper>

            <!-- ═══ Temperature Gauge (Session 7) ═══ -->
            <WidgetWrapper v-if="widgetId === 'temp_gauge'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <TempGaugeWidget />
            </WidgetWrapper>

            <!-- ═══ Swarm Overview (Session 7 — cross-mode) ═══ -->
            <WidgetWrapper v-if="widgetId === 'swarm'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <SwarmOverview />
            </WidgetWrapper>

            <!-- ═══ Core Services (Session 7 — cross-mode) ═══ -->
            <WidgetWrapper v-if="widgetId === 'core_services'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <ServiceGrid
                :apps="coreApps"
                :loading="appsStore.loading"
                :detailed="true"
                title="Core Services"
                title-icon="Box"
                @open="(app) => emit('open-app', app)"
                @toggle-favorite="(name) => emit('toggle-favorite', name)"
              />
            </WidgetWrapper>

            <!-- ═══ Alerts Feed (Session 7 — cross-mode) ═══ -->
            <WidgetWrapper v-if="widgetId === 'alerts'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <AlertsFeed :alerts="alerts" :loading="monitoringStore.loading" :limit="6" />
            </WidgetWrapper>

            <!-- ═══ Info Bar (Session 9 — cross-mode) ═══ -->
            <WidgetWrapper v-if="widgetId === 'infobar'" :widget-id="widgetId" :editing="isEditing" :row-idx="entry.layoutIdx" :in-pair="isInPair(entry)">
              <InfoBarWidget />
            </WidgetWrapper>

          </template>
        </div>
      </div>

      <!-- Alert banner follows the row that contains search (not in grid, always full-width) -->
      <AlertBanner v-if="entry.hasSearch && showAlerts" />
    </template>

    <!-- Drop zone AFTER last row (append as new row) -->
    <div
      v-if="isEditing && isAnyDragActive && gridRows.length > 0"
      :ref="setDropZoneRef(`after-${gridRows[gridRows.length - 1].layoutIdx}`)"
      class="drop-zone-row"
      :class="isDropActive('after', gridRows[gridRows.length - 1].layoutIdx) ? 'drop-zone-active' : 'drop-zone-idle'"
      @dragover.prevent="onDragOver($event, 'after', gridRows[gridRows.length - 1].layoutIdx)"
      @dragleave="onDragLeave($event, 'after', gridRows[gridRows.length - 1].layoutIdx)"
      @drop="onDrop($event, 'after', gridRows[gridRows.length - 1].layoutIdx)"
    >
      <div class="drop-zone-indicator">
        <Icon name="Plus" :size="12" />
        <span class="text-[10px]">Drop here</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Between-row drop zone styles ─────────────────────────────── */

.drop-zone-row {
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin: -0.25rem 0;
}

.drop-zone-idle {
  border: 2px dashed var(--border-primary, rgba(255,255,255,0.08));
  opacity: 0.4;
}

.drop-zone-idle:hover {
  opacity: 0.7;
}

.drop-zone-active {
  border: 2px dashed var(--accent, #6366f1);
  background-color: rgba(99, 102, 241, 0.08);
  opacity: 1;
}

/* Touch drag active highlight (applied via JS class toggle) */
.drop-zone-row.touch-drop-active {
  border: 2px dashed var(--accent, #6366f1);
  background-color: rgba(99, 102, 241, 0.12);
  opacity: 1;
}

.drop-zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-muted, rgba(255,255,255,0.4));
  pointer-events: none;
}

.drop-zone-active .drop-zone-indicator,
.touch-drop-active .drop-zone-indicator {
  color: var(--accent, #6366f1);
}

/* ─── Side drop zone styles (left/right pairing) ──────────────── */

.drop-zone-side {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3rem;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 0.75rem;
}

.drop-zone-side-left {
  left: -0.5rem;
  border-right: none;
  border-radius: 0.75rem 0 0 0.75rem;
}

.drop-zone-side-right {
  right: -0.5rem;
  border-left: none;
  border-radius: 0 0.75rem 0.75rem 0;
}

.drop-zone-side-idle {
  border: 2px dashed var(--border-primary, rgba(255,255,255,0.08));
  opacity: 0.3;
}

.drop-zone-side-idle:hover {
  opacity: 0.6;
  background-color: rgba(99, 102, 241, 0.04);
}

.drop-zone-side-active {
  border: 2px dashed var(--accent, #6366f1);
  background-color: rgba(99, 102, 241, 0.12);
  opacity: 1;
}

/* Touch drag active highlight for side zones */
.drop-zone-side.touch-drop-active {
  border: 2px dashed var(--accent, #6366f1);
  background-color: rgba(99, 102, 241, 0.15);
  opacity: 1;
}

.drop-zone-side-indicator {
  color: var(--text-muted, rgba(255,255,255,0.4));
  pointer-events: none;
}

.drop-zone-side-active .drop-zone-side-indicator,
.drop-zone-side.touch-drop-active .drop-zone-side-indicator {
  color: var(--accent, #6366f1);
}

/* Fade in animation for edit UI */
.animate-fade-in {
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
