<script setup>
/**
 * DashboardAdvanced.vue — Session C Fix
 *
 * Advanced mode ("kung fu mode") dashboard view.
 * All sections respect useDashboardConfig toggles for customization.
 *
 * Session C: Added isEditing prop. When editing, sections show drag handles
 * and can be reordered via HTML5 Drag and Drop (row-level only, no 2-col pairing).
 * Section order persists via config key 'advanced_section_order'.
 *
 * FIX: Added transparent interaction overlay per section during edit mode.
 * Without this overlay, interactive elements inside sections (buttons, links,
 * card click handlers) capture mousedown events and prevent the parent's
 * HTML5 draggable from initiating the drag. The overlay sits above section
 * content but below the drag handle badge.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore, DEPLOY_MODES } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useMonitoringStore } from '@/stores/monitoring'
import { useNetworkStore } from '@/stores/network'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import StatusCard from './StatusCard.vue'
import ServiceGrid from './ServiceGrid.vue'
import AlertsFeed from './AlertsFeed.vue'
import DiskWidget from './DiskWidget.vue'
import SignalsWidget from './SignalsWidget.vue'
import WidgetWrapper from './WidgetWrapper.vue'
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

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

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
  raw,
  updateConfig,
} = useDashboardConfig()

// ─── Section order (Advanced-specific) ──────────────────────────

const DEFAULT_SECTION_ORDER = [
  'gauges', 'infobar', 'disk-signals', 'swarm-alerts',
  'favorites', 'core', 'user-apps', 'quick-links'
]

const SECTION_LABELS = {
  'gauges': 'Status Gauges',
  'infobar': 'Info Bar',
  'disk-signals': 'Disk & Signals',
  'swarm-alerts': 'Swarm & Alerts',
  'favorites': 'Favorites',
  'core': 'Core Services',
  'user-apps': 'User Apps',
  'quick-links': 'Quick Links',
}

const sectionOrder = computed(() => {
  const stored = raw.value?.advanced_section_order
  if (Array.isArray(stored) && stored.length === DEFAULT_SECTION_ORDER.length) {
    return stored
  }
  return DEFAULT_SECTION_ORDER
})

/** Which sections are visible based on config toggles */
const sectionVisibility = computed(() => ({
  'gauges': showSystemVitals.value,
  'infobar': showInfoBar.value,
  'disk-signals': showDisk.value || showSignals.value,
  'swarm-alerts': showSwarm.value || showAlerts.value,
  'favorites': showFavorites.value && favoriteApps.value.length > 0,
  'core': showCoreServices.value,
  'user-apps': showMyApps.value && userApps.value.length > 0,
  'quick-links': showQuickActions.value,
}))

const visibleSections = computed(() =>
  sectionOrder.value.filter(id => sectionVisibility.value[id])
)

// ─── Section drag state ─────────────────────────────────────────
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
  if (!srcId || srcId === targetSectionId) {
    dragSectionId.value = null
    dragOverSectionId.value = null
    return
  }

  const order = [...sectionOrder.value]
  const srcIdx = order.indexOf(srcId)
  const destIdx = order.indexOf(targetSectionId)
  if (srcIdx === -1 || destIdx === -1) return

  order.splice(srcIdx, 1)
  order.splice(destIdx, 0, srcId)

  updateConfig('advanced_section_order', order)
  dragSectionId.value = null
  dragOverSectionId.value = null
}

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

// All apps for the full grid
const coreApps = computed(() => appsStore.coreApps)
const userApps = computed(() => appsStore.userApps)
const allApps = computed(() => appsStore.apps || [])

// Favorites
const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

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
      Drag sections to reorder.
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

    <!-- Sections rendered in order -->
    <template v-for="sectionId in visibleSections" :key="sectionId">
      <div
        class="relative"
        :class="{
          'ring-2 ring-dashed ring-accent/30 rounded-xl p-1': isEditing,
          'opacity-30': dragSectionId === sectionId,
          'ring-accent/60 bg-accent/5': dragOverSectionId === sectionId && dragSectionId !== sectionId,
        }"
        :draggable="isEditing"
        @dragstart="isEditing ? onSectionDragStart($event, sectionId) : null"
        @dragend="isEditing ? onSectionDragEnd() : null"
        @dragover.prevent="isEditing ? onSectionDragOver($event, sectionId) : null"
        @dragleave="isEditing ? onSectionDragLeave($event, sectionId) : null"
        @drop="isEditing ? onSectionDrop($event, sectionId) : null"
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
          Transparent interaction overlay — edit mode only.
          Sits above section content (z-20) but below the drag handle (z-30).
          Prevents buttons/links/inputs inside the section from capturing
          mousedown events that would block the parent's HTML5 drag.
          Without this overlay, interactive elements (ServiceGrid buttons,
          Quick Links buttons, Favorites clickables, etc.) consume the
          mousedown and the draggable never fires dragstart.
        -->
        <div
          v-if="isEditing"
          class="absolute inset-0 z-20 cursor-grab active:cursor-grabbing rounded-xl"
        ></div>

        <!-- ═══ Status Gauges ═══ -->
        <section v-if="sectionId === 'gauges'" class="animate-fade-in">
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
        </section>

        <!-- ═══ Info Bar ═══ -->
        <section v-if="sectionId === 'infobar'" class="animate-fade-in">
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
        </section>

        <!-- ═══ Disk + Signals ═══ -->
        <div
          v-if="sectionId === 'disk-signals'"
          class="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in"
        >
          <WidgetWrapper v-if="showDisk" widget-id="disk">
            <DiskWidget />
          </WidgetWrapper>
          <WidgetWrapper v-if="showSignals" widget-id="signals">
            <SignalsWidget />
          </WidgetWrapper>
        </div>

        <!-- ═══ Swarm + Alerts ═══ -->
        <div
          v-if="sectionId === 'swarm-alerts'"
          class="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <section v-if="showSwarm" class="lg:col-span-2 animate-fade-in">
            <SwarmOverview />
          </section>
          <section v-if="showAlerts" class="animate-fade-in" :class="showSwarm ? '' : 'lg:col-span-3'">
            <AlertsFeed
              :alerts="alerts"
              :loading="monitoringStore.loading"
              :limit="6"
            />
          </section>
        </div>

        <!-- ═══ Favorites ═══ -->
        <section v-if="sectionId === 'favorites'" class="animate-fade-in">
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
        </section>

        <!-- ═══ Core Services ═══ -->
        <ServiceGrid
          v-if="sectionId === 'core'"
          :apps="coreApps"
          :loading="appsStore.loading"
          :detailed="true"
          title="Core Services"
          title-icon="Box"
          @open="(app) => emit('open-app', app)"
          @toggle-favorite="(name) => emit('toggle-favorite', name)"
        />

        <!-- ═══ User Apps ═══ -->
        <ServiceGrid
          v-if="sectionId === 'user-apps'"
          :apps="userApps"
          :detailed="true"
          title="User Applications"
          title-icon="Package"
          @open="(app) => emit('open-app', app)"
          @toggle-favorite="(name) => emit('toggle-favorite', name)"
        />

        <!-- ═══ Quick Links ═══ -->
        <section v-if="sectionId === 'quick-links'" class="animate-fade-in">
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
        </section>
      </div>
    </template>
  </div>
</template>
