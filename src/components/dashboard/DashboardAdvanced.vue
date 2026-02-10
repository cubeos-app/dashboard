<script setup>
/**
 * DashboardAdvanced.vue — Session 4
 *
 * Advanced mode ("kung fu mode") dashboard view.
 * All sections respect useDashboardConfig toggles for customization.
 *
 * SESSION 1: Broke composite sections into independent draggable widgets.
 * - 'disk-signals' → separate 'disk' and 'signals' sections
 * - 'swarm-alerts' → separate 'swarm' and 'alerts' sections
 * Each section is independently positionable via DnD.
 * Uses advancedSectionOrder from useDashboardConfig (with composite ID migration).
 *
 * SESSION 4: Touch DnD for mobile.
 * - Sections support long-press (300ms) to initiate touch drag.
 * - Ghost follows finger, source dims, drop targets highlight.
 * - Section reordering via touch works same as HTML5 DnD.
 * - Auto-scroll near viewport edges during touch drag.
 * - Haptic feedback on drag start + successful drop.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore, DEPLOY_MODES } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useMonitoringStore } from '@/stores/monitoring'
import { useNetworkStore } from '@/stores/network'
import { useDashboardConfig, ADVANCED_SECTION_REGISTRY } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useTouchDrag } from '@/composables/useTouchDrag'
import Icon from '@/components/ui/Icon.vue'
import StatusCard from './StatusCard.vue'
import ServiceGrid from './ServiceGrid.vue'
import AlertsFeed from './AlertsFeed.vue'
import DiskWidget from './DiskWidget.vue'
import SignalsWidget from './SignalsWidget.vue'
import UptimeLoadWidget from './UptimeLoadWidget.vue'
import NetworkThroughputWidget from './NetworkThroughputWidget.vue'
import RecentLogsWidget from './RecentLogsWidget.vue'
import BatteryWidget from './BatteryWidget.vue'
import WidgetWrapper from './WidgetWrapper.vue'
import WidgetErrorBoundary from './WidgetErrorBoundary.vue'
import SwarmOverview from '@/components/swarm/SwarmOverview.vue'

const props = defineProps({
  isEditing: { type: Boolean, default: false },
})

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const monitoringStore = useMonitoringStore()
const networkStore = useNetworkStore()
const { signal } = useAbortOnUnmount()
const { canUndo, canRedo, undo, redo, undoCount, redoCount } = useDashboardEdit()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

// ─── Touch DnD ──────────────────────────────────────────────────
const {
  isDraggingTouch,
  touchDragWidgetId,
  registerDropZone,
  clearDropZones,
  refreshZoneRects,
  onTouchStart: touchDragStart,
  onTouchMove: touchDragMove,
  onTouchEnd: touchDragEnd,
  onTouchCancel: touchDragCancel,
} = useTouchDrag()

// ─── Dashboard config ──────────────────────────────────────────
const {
  showSystemVitals,
  showInfoBar,
  showSwarm,
  showAlerts,
  showFavorites,
  showCoreServices,
  showMyApps,
  showQuickActions,
  showDisk,
  showSignals,
  showUptimeLoad,
  showNetworkThroughput,
  showRecentLogs,
  showBattery,
  raw,
  updateConfig,
  advancedSectionOrder,
  updateAdvancedSectionOrder,
} = useDashboardConfig()

// ─── App lists (must be declared before sectionVisibility to avoid TDZ) ──
const coreApps = computed(() => appsStore.coreApps)
const userApps = computed(() => appsStore.userApps)
const allApps = computed(() => appsStore.apps || [])

const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// ─── Section order (Advanced-specific, Session 1 — individual IDs) ──

const SECTION_LABELS = computed(() => {
  const labels = {}
  for (const [id, meta] of Object.entries(ADVANCED_SECTION_REGISTRY)) {
    labels[id] = meta.label
  }
  return labels
})

/** Which sections are visible based on config toggles */
const sectionVisibility = computed(() => ({
  'gauges': showSystemVitals.value,
  'infobar': showInfoBar.value,
  'disk': showDisk.value,
  'signals': showSignals.value,
  'swarm': showSwarm.value,
  'alerts': showAlerts.value,
  'uptime-load': showUptimeLoad.value,
  'network-throughput': showNetworkThroughput.value,
  'recent-logs': showRecentLogs.value,
  'battery': showBattery.value && systemStore.batteryAvailable,
  'favorites': showFavorites.value && favoriteApps.value.length > 0,
  'core': showCoreServices.value,
  'user-apps': showMyApps.value && userApps.value.length > 0,
  'quick-links': showQuickActions.value,
}))

const visibleSections = computed(() =>
  advancedSectionOrder.value.filter(id => sectionVisibility.value[id])
)

// ─── Section drag state (HTML5 DnD) ─────────────────────────────
const dragSectionId = ref(null)
const dragOverSectionId = ref(null)

function onSectionDragStart(e, sectionId) {
  dragSectionId.value = sectionId
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', sectionId)
}

function onSectionDragEnd() {
  dragSectionId.value = null
  dragOverSectionId.value = null
}

function onSectionDragOver(e, sectionId) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverSectionId.value = sectionId
}

function onSectionDragLeave(e, sectionId) {
  if (dragOverSectionId.value === sectionId) {
    dragOverSectionId.value = null
  }
}

function onSectionDrop(e, targetSectionId) {
  e.preventDefault()
  const srcId = dragSectionId.value
  executeSectionReorder(srcId, targetSectionId)
  dragSectionId.value = null
  dragOverSectionId.value = null
}

/**
 * Execute section reorder — shared by both HTML5 DnD and touch DnD.
 */
function executeSectionReorder(srcId, targetSectionId) {
  if (!srcId || srcId === targetSectionId) return

  const order = [...advancedSectionOrder.value]
  const srcIdx = order.indexOf(srcId)
  const destIdx = order.indexOf(targetSectionId)
  if (srcIdx === -1 || destIdx === -1) return

  order.splice(srcIdx, 1)
  order.splice(destIdx, 0, srcId)

  updateAdvancedSectionOrder(order)
}

// ─── Touch drag handlers for sections ───────────────────────────

// Track if this is a touch device to prevent HTML5 DnD conflict
const isTouchActive = ref(false)

// Store refs to section DOM elements for touch drag + drop zone registration
const sectionRefs = ref({})

function setSectionRef(sectionId) {
  return (el) => {
    if (el) {
      sectionRefs.value[sectionId] = el
    } else {
      delete sectionRefs.value[sectionId]
    }
  }
}

function onSectionTouchStart(e, sectionId) {
  if (!props.isEditing) return
  isTouchActive.value = true

  const el = sectionRefs.value[sectionId]
  if (!el) return

  // Use a dummy rowIdx of 0 since Advanced mode doesn't use row-based layout
  touchDragStart(e, sectionId, 0, el)
}

function onSectionTouchMove(e) {
  if (!isDraggingTouch.value) return
  touchDragMove(e)
}

function onSectionTouchEnd(e) {
  if (!isDraggingTouch.value) return
  // Pass null for standard drop, executeSectionReorder for section drop
  touchDragEnd(e, null, executeSectionReorder)
}

function onSectionTouchCancel() {
  touchDragCancel()
}

/** Whether any drag is active (HTML5 or touch) */
const isAnyDragActive = computed(() =>
  !!dragSectionId.value || isDraggingTouch.value
)

// ─── Register sections as touch drop zones ──────────────────────

function registerSectionDropZones() {
  clearDropZones()

  if (!props.isEditing) return

  nextTick(() => {
    for (const sectionId of visibleSections.value) {
      const el = sectionRefs.value[sectionId]
      if (!el || !el.isConnected) continue

      registerDropZone(
        `section-${sectionId}`,
        el,
        'section',
        sectionId,
        'section'
      )
    }

    refreshZoneRects()
  })
}

watch(() => props.isEditing, (editing) => {
  if (editing) {
    nextTick(registerSectionDropZones)
  } else {
    clearDropZones()
    isTouchActive.value = false
  }
})

watch(visibleSections, () => {
  if (props.isEditing) {
    nextTick(registerSectionDropZones)
  }
}, { deep: true })

// ─── Empty state detection ─────────────────────────────────────
const isAllHidden = computed(() => visibleSections.value.length === 0)

// ─── System stats ──────────────────────────────────────────────
const cpuUsage = computed(() => systemStore.cpuUsage)
const memoryUsage = computed(() => systemStore.memoryUsage)
const diskUsage = computed(() => systemStore.diskUsage)
const temperature = computed(() => systemStore.temperature)
const tempPercent = computed(() => {
  const t = temperature.value
  if (t === null || t === undefined) return 0
  return Math.min(100, Math.max(0, (t / 85) * 100))
})

// App stats
const runningCount = computed(() => appsStore.runningCount)
const totalCount = computed(() => appsStore.appCount)
const healthyCount = computed(() => appsStore.healthyCount)



// Network
const networkMode = computed(() => networkStore.currentMode || 'unknown')
const networkModeLabel = computed(() => {
  const labels = { offline: 'Offline', online_eth: 'Ethernet', online_wifi: 'WiFi Client' }
  return labels[networkMode.value] || 'Unknown'
})

// WebSocket info
const wsConnected = computed(() => systemStore.wsConnected)
const wsConnections = computed(() => monitoringStore.wsConnectionCount)

// Monitoring
const alerts = computed(() => monitoringStore.alerts)
const alertCount = computed(() => monitoringStore.alertCount)

// Deploy mode stats
const swarmStacks = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.STACK).length)
const composeServices = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.COMPOSE).length)

// Lifecycle
onMounted(async () => {
  const s = signal()
  await Promise.all([
    monitoringStore.fetchAlerts({ signal: s }),
    monitoringStore.fetchWebSocketInfo({ signal: s }),
    monitoringStore.fetchHistory({ period: '1h' })
  ])

  if (props.isEditing) {
    nextTick(registerSectionDropZones)
  }
})

onBeforeUnmount(() => {
  clearDropZones()
})

// Navigation helpers
function goToMonitoring() { router.push('/system?tab=monitoring') }
function goToLogs() { router.push('/system?tab=logs') }
function goToAppStore() { router.push('/appstore') }
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">

    <!-- Edit mode banner -->
    <div
      v-if="isEditing"
      class="text-center py-2 text-xs text-theme-muted select-none"
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
      <span class="hidden sm:inline">Drag sections to reorder. Each widget moves independently. Double-click edges to resize.</span>
      <span class="sm:hidden">Long-press and drag to reorder sections.</span>
    </div>

    <!-- Empty state when all sections hidden -->
    <div
      v-if="isAllHidden"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <div class="w-16 h-16 rounded-2xl bg-theme-tertiary flex items-center justify-center mb-4">
        <Icon name="LayoutDashboard" :size="28" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-medium text-theme-secondary mb-2">Dashboard is empty</h3>
      <p class="text-sm text-theme-muted max-w-xs">
        All sections are hidden. Open settings to add widgets back to your dashboard.
      </p>
    </div>

    <!-- Sections rendered in order — each is independently draggable -->
    <template v-for="sectionId in visibleSections" :key="sectionId">
      <div
        :ref="setSectionRef(sectionId)"
        class="relative"
        :class="{
          'ring-2 ring-dashed ring-accent/30 rounded-xl p-1 cursor-grab active:cursor-grabbing': isEditing,
          'opacity-30': dragSectionId === sectionId,
          'ring-accent/60 bg-accent/5': dragOverSectionId === sectionId && dragSectionId !== sectionId,
        }"
        :draggable="isEditing && !isTouchActive"
        @dragstart="isEditing ? onSectionDragStart($event, sectionId) : null"
        @dragend="isEditing ? onSectionDragEnd() : null"
        @dragover.prevent="isEditing ? onSectionDragOver($event, sectionId) : null"
        @dragleave="isEditing ? onSectionDragLeave($event, sectionId) : null"
        @drop="isEditing ? onSectionDrop($event, sectionId) : null"
        @touchstart.passive="isEditing ? onSectionTouchStart($event, sectionId) : null"
        @touchmove="onSectionTouchMove($event)"
        @touchend="onSectionTouchEnd($event)"
        @touchcancel="onSectionTouchCancel()"
      >
        <!-- Drag handle (edit mode) -->
        <div
          v-if="isEditing"
          class="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1
                 rounded-full bg-theme-secondary border border-theme-primary shadow-lg cursor-grab
                 active:cursor-grabbing select-none"
        >
          <Icon name="GripHorizontal" :size="12" class="text-theme-muted" />
          <span class="text-[10px] font-medium text-theme-secondary whitespace-nowrap">
            {{ SECTION_LABELS[sectionId] }}
          </span>
        </div>

        <!--
          Section content wrapper: during edit mode, pointer-events:none prevents
          interactive children (buttons, links, inputs) from capturing mousedown,
          so the parent draggable div receives events and HTML5 drag initiates.
        -->
        <div :class="isEditing ? 'pointer-events-none' : ''">

        <!-- ═══ Status Gauges ═══ -->
        <section v-if="sectionId === 'gauges'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="gauges" :label="SECTION_LABELS['gauges']" icon="Activity">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusCard label="CPU" :value="cpuUsage" unit="%" icon="Cpu" />
            <StatusCard
              label="Memory"
              :value="memoryUsage"
              unit="%"
              icon="MemoryStick"
              :subtitle="systemStore.memoryFormatted"
            />
            <StatusCard
              label="Disk"
              :value="diskUsage"
              unit="%"
              icon="HardDrive"
              :subtitle="systemStore.diskFormatted"
            />
            <StatusCard
              label="Temp"
              :value="temperature"
              unit="°C"
              icon="Thermometer"
              :percent="tempPercent"
              :thresholds="{ warning: 65, critical: 80 }"
            />
          </div>
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Info Bar ═══ -->
        <section v-if="sectionId === 'infobar'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="infobar" :label="SECTION_LABELS['infobar']" icon="Info">
          <div class="rounded-xl border border-theme-primary bg-theme-card p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div class="flex items-center gap-2">
              <Icon name="Activity" :size="14" class="text-success" />
              <span class="text-theme-secondary">
                <strong class="text-theme-primary">{{ runningCount }}</strong>/{{ totalCount }} running
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="HeartPulse" :size="14" class="text-success" />
              <span class="text-theme-secondary">
                <strong class="text-theme-primary">{{ healthyCount }}</strong> healthy
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="Layers" :size="14" class="text-accent" />
              <span class="text-theme-secondary">
                {{ swarmStacks }} stacks, {{ composeServices }} compose
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="Globe" :size="14" class="text-accent" />
              <span class="text-theme-secondary">{{ networkModeLabel }}</span>
            </div>
            <div v-if="systemStore.wifiClients !== null" class="flex items-center gap-2">
              <Icon name="Users" :size="14" class="text-theme-tertiary" />
              <span class="text-theme-secondary">{{ systemStore.wifiClients }} clients</span>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :class="wsConnected ? 'bg-success animate-pulse-status' : 'bg-error'"
              ></span>
              <span class="text-theme-secondary">
                WS {{ wsConnected ? 'connected' : 'disconnected' }}
                <template v-if="wsConnections > 0">({{ wsConnections }})</template>
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="Clock" :size="14" class="text-theme-tertiary" />
              <span class="text-theme-secondary">{{ systemStore.uptime.uptime_human }}</span>
            </div>
            <div v-if="systemStore.batteryAvailable" class="flex items-center gap-2">
              <Icon
                :name="systemStore.isCharging ? 'BatteryCharging' : 'Battery'"
                :size="14"
                :class="systemStore.batteryPercent > 20 ? 'text-success' : 'text-error'"
              />
              <span class="text-theme-secondary">{{ systemStore.batteryPercent }}%</span>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <Icon name="Server" :size="14" class="text-theme-muted" />
              <span class="text-theme-muted font-mono">
                {{ systemStore.hostname }}
                <template v-if="systemStore.piModel"> &middot; {{ systemStore.piModel }}</template>
              </span>
            </div>
          </div>
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Disk (independent) ═══ -->
        <section v-if="sectionId === 'disk'" class="animate-fade-in">
          <WidgetWrapper widget-id="disk">
            <DiskWidget />
          </WidgetWrapper>
        </section>

        <!-- ═══ Signals (independent) ═══ -->
        <section v-if="sectionId === 'signals'" class="animate-fade-in">
          <WidgetWrapper widget-id="signals">
            <SignalsWidget />
          </WidgetWrapper>
        </section>

        <!-- ═══ Swarm Overview (independent) ═══ -->
        <section v-if="sectionId === 'swarm'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="swarm" :label="SECTION_LABELS['swarm']" icon="Layers">
          <SwarmOverview />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Alerts Feed (independent) ═══ -->
        <section v-if="sectionId === 'alerts'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="alerts" :label="SECTION_LABELS['alerts']" icon="Bell">
          <AlertsFeed
            :alerts="alerts"
            :loading="monitoringStore.loading"
            :limit="6"
          />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Uptime & Load (Session 3) ═══ -->
        <section v-if="sectionId === 'uptime-load'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="uptime-load" :label="SECTION_LABELS['uptime-load']" icon="Clock">
            <UptimeLoadWidget />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Network Throughput (Session 3) ═══ -->
        <section v-if="sectionId === 'network-throughput'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="network-throughput" :label="SECTION_LABELS['network-throughput']" icon="ArrowUpDown">
            <NetworkThroughputWidget />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Recent Logs (Session 3) ═══ -->
        <section v-if="sectionId === 'recent-logs'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="recent-logs" :label="SECTION_LABELS['recent-logs']" icon="ScrollText">
            <RecentLogsWidget />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Battery (Session 3) ═══ -->
        <section v-if="sectionId === 'battery'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="battery" :label="SECTION_LABELS['battery']" icon="Battery">
            <BatteryWidget />
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Favorites ═══ -->
        <section v-if="sectionId === 'favorites'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="favorites" :label="SECTION_LABELS['favorites']" icon="Star">
          <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="Star" :size="12" class="text-warning" />
            Favorites
          </h2>
          <div class="rounded-xl border border-theme-primary bg-theme-card p-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <button
                v-for="app in favoriteApps"
                :key="app.name"
                class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
                @click="emit('open-app', app)"
              >
                <Icon :name="appsStore.getAppIcon(app)" :size="16" class="text-accent" />
                <span class="text-sm text-theme-primary truncate">{{ appsStore.getDisplayName(app) }}</span>
              </button>
            </div>
          </div>
          </WidgetErrorBoundary>
        </section>

        <!-- ═══ Core Services ═══ -->
        <WidgetErrorBoundary v-if="sectionId === 'core'" widget-id="core" :label="SECTION_LABELS['core']" icon="Box">
          <ServiceGrid
            :apps="coreApps"
            :loading="appsStore.loading"
            :detailed="true"
            title="Core Services"
            title-icon="Box"
            @open="(app) => emit('open-app', app)"
            @toggle-favorite="(name) => emit('toggle-favorite', name)"
          />
        </WidgetErrorBoundary>

        <!-- ═══ User Apps ═══ -->
        <WidgetErrorBoundary v-if="sectionId === 'user-apps'" widget-id="user-apps" :label="SECTION_LABELS['user-apps']" icon="Package">
          <ServiceGrid
            :apps="userApps"
            :detailed="true"
            title="User Applications"
            title-icon="Package"
            @open="(app) => emit('open-app', app)"
            @toggle-favorite="(name) => emit('toggle-favorite', name)"
          />
        </WidgetErrorBoundary>

        <!-- ═══ Quick Links ═══ -->
        <section v-if="sectionId === 'quick-links'" class="animate-fade-in">
          <WidgetErrorBoundary widget-id="quick-links" :label="SECTION_LABELS['quick-links']" icon="Zap">
          <div class="flex flex-wrap gap-2">
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
              @click="goToMonitoring"
            >
              <Icon name="BarChart3" :size="14" class="text-accent" />
              Monitoring
              <span
                v-if="alertCount > 0"
                class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-error-muted text-error"
              >
                {{ alertCount }}
              </span>
            </button>
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
              @click="goToLogs"
            >
              <Icon name="ScrollText" :size="14" class="text-accent" />
              Logs
            </button>
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
              @click="goToAppStore"
            >
              <Icon name="Download" :size="14" class="text-accent" />
              App Store
            </button>
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
              @click="emit('open-chat')"
            >
              <Icon name="MessageSquare" :size="14" class="text-accent" />
              Ask CubeOS
            </button>
          </div>
          </WidgetErrorBoundary>
        </section>
        </div>
      </div>
    </template>
  </div>
</template>
