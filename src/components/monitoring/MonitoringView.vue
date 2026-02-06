<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useMonitoringStore } from '@/stores/monitoring'
import { useSystemStore } from '@/stores/system'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const monitoringStore = useMonitoringStore()
const systemStore = useSystemStore()
const { signal } = useAbortOnUnmount()

// WebSocket subscription from App.vue (single-connection architecture)
const wsSubscribe = inject('wsSubscribe', null)
const wsUnsubscribe = inject('wsUnsubscribe', null)
const wsConnected = inject('wsConnected', ref(false))

// ==========================================
// Tabs
// ==========================================

const activeTab = ref('overview')
const tabs = [
  { id: 'overview', label: 'Overview', icon: 'Activity' },
  { id: 'alerts', label: 'Alerts', icon: 'Bell' },
  { id: 'settings', label: 'Settings', icon: 'Settings' }
]

// ==========================================
// Period selector
// ==========================================

const periods = [
  { id: '1h', label: '1h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' }
]

async function selectPeriod(period) {
  await monitoringStore.setPeriod(period)
}

// ==========================================
// Threshold form
// ==========================================

const thresholdForm = ref({
  cpu_percent: 80,
  memory_percent: 80,
  disk_percent: 90,
  temperature_c: 70
})

const saveSuccess = ref(false)
const saveError = ref(null)
let saveSuccessTimeout = null
let saveErrorTimeout = null

watch(() => monitoringStore.thresholds, (val) => {
  if (val) {
    thresholdForm.value = {
      cpu_percent: val.cpu_percent ?? 80,
      memory_percent: val.memory_percent ?? 80,
      disk_percent: val.disk_percent ?? 90,
      temperature_c: val.temperature_c ?? 70
    }
  }
}, { immediate: true })

async function saveThresholds() {
  saveSuccess.value = false
  saveError.value = null
  if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
  if (saveErrorTimeout) clearTimeout(saveErrorTimeout)
  try {
    await monitoringStore.updateThresholds({ ...thresholdForm.value })
    saveSuccess.value = true
    saveSuccessTimeout = setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message || 'Failed to save thresholds'
    saveErrorTimeout = setTimeout(() => { saveError.value = null }, 5000)
  }
}

// ==========================================
// WS Debug section
// ==========================================

const wsDebugOpen = ref(false)

// ==========================================
// SVG Chart helpers
// ==========================================

const chartWidth = 600
const chartHeight = 120

function yScale(percent) {
  return chartHeight - (percent / 100) * chartHeight
}

function buildPoints(field) {
  const data = monitoringStore.history
  if (!data || !data.length) return ''
  const step = chartWidth / Math.max(data.length - 1, 1)
  return data.map((p, i) => `${i * step},${yScale(p[field] ?? 0)}`).join(' ')
}

function buildFillPoints(field) {
  const data = monitoringStore.history
  if (!data || !data.length) return ''
  const step = chartWidth / Math.max(data.length - 1, 1)
  const points = data.map((p, i) => `${i * step},${yScale(p[field] ?? 0)}`)
  const lastX = (data.length - 1) * step
  return [...points, `${lastX},${chartHeight}`, `0,${chartHeight}`].join(' ')
}

const cpuPoints = computed(() => buildPoints('cpu'))
const cpuFillPoints = computed(() => buildFillPoints('cpu'))
const memoryPoints = computed(() => buildPoints('memory'))
const memoryFillPoints = computed(() => buildFillPoints('memory'))
const diskPoints = computed(() => buildPoints('disk'))
const diskFillPoints = computed(() => buildFillPoints('disk'))

// Chart hover tooltip
const hoveredChart = ref(null)
const hoverIndex = ref(-1)

function onChartMouseMove(event, chartField) {
  const svg = event.currentTarget
  const rect = svg.getBoundingClientRect()
  const x = event.clientX - rect.left
  const relX = x / rect.width
  const data = monitoringStore.history
  if (!data || !data.length) return

  const index = Math.min(Math.round(relX * (data.length - 1)), data.length - 1)
  hoveredChart.value = chartField
  hoverIndex.value = index
}

function onChartMouseLeave() {
  hoveredChart.value = null
  hoverIndex.value = -1
}

const hoveredDataPoint = computed(() => {
  const data = monitoringStore.history
  if (!data || hoverIndex.value < 0 || hoverIndex.value >= data.length) return null
  return data[hoverIndex.value]
})

// ==========================================
// Formatting helpers
// ==========================================

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = Number(bytes)
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatTemp(temp) {
  if (temp === null || temp === undefined) return '-'
  return `${Math.round(temp)}°C`
}

function tempColorClass(temp) {
  if (temp === null || temp === undefined) return 'text-theme-muted'
  if (temp > 60) return 'text-error'
  if (temp > 50) return 'text-warning'
  return 'text-success'
}

function severityClass(severity) {
  if (severity === 'critical') return 'bg-error-muted text-error'
  if (severity === 'warning') return 'bg-warning-muted text-warning'
  return 'bg-accent-muted text-accent'
}

function severityIcon(severity) {
  if (severity === 'critical') return 'XCircle'
  if (severity === 'warning') return 'AlertTriangle'
  return 'AlertCircle'
}

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function progressWidth(percent) {
  return `${Math.min(Math.max(percent, 0), 100)}%`
}

function progressColor(percent) {
  if (percent > 90) return 'bg-error'
  if (percent > 75) return 'bg-warning'
  return 'bg-accent'
}

// ==========================================
// Polling & lifecycle
// ==========================================

const initialLoaded = ref(false)
const refreshing = ref(false)
let pollInterval = null
const WS_SUBSCRIBER_KEY = 'monitoring-view'
const POLL_INTERVAL_MS = 5000

// Map WS nested format to monitoring store flat format
function handleWsMessage(data) {
  if (!data) return

  const mapped = {}
  if (data.system) {
    if (data.system.cpu) mapped.cpu_percent = data.system.cpu.percent
    if (data.system.memory) {
      mapped.memory_percent = data.system.memory.percent
      mapped.memory_used = data.system.memory.used
      mapped.memory_total = data.system.memory.total
    }
    if (data.system.disk) {
      mapped.disk_percent = data.system.disk.percent
      mapped.disk_used = data.system.disk.used
      mapped.disk_total = data.system.disk.total
    }
    if (data.system.temperature) {
      mapped.temperature_cpu = data.system.temperature.cpu_temp_c
    }
  }

  // Update monitoring store stats directly (no HTTP round-trip)
  if (Object.keys(mapped).length > 0) {
    monitoringStore.stats = { ...(monitoringStore.stats || {}), ...mapped }
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(() => {
    monitoringStore.fetchStats()
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Watch WS connection: stop polling when connected, start when disconnected
watch(wsConnected, (isConnected) => {
  if (isConnected) {
    stopPolling()
  } else {
    startPolling()
  }
})

onMounted(async () => {
  const s = signal()
  await monitoringStore.fetchAll({ signal: s })
  await monitoringStore.setPeriod('1h')
  initialLoaded.value = true

  // Subscribe to WS stats if available
  if (wsSubscribe) {
    wsSubscribe(WS_SUBSCRIBER_KEY, handleWsMessage)
  }

  // If WS not connected, start HTTP fallback polling
  if (!wsConnected.value) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
  if (wsUnsubscribe) {
    wsUnsubscribe(WS_SUBSCRIBER_KEY)
  }
  if (saveSuccessTimeout) clearTimeout(saveSuccessTimeout)
  if (saveErrorTimeout) clearTimeout(saveErrorTimeout)
})

async function refresh() {
  refreshing.value = true
  try {
    await monitoringStore.fetchAll({ signal: signal() })
    await monitoringStore.setPeriod(monitoringStore.historyPeriod)
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <!-- ==================== Header ==================== -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-theme-primary">Monitoring</h1>
        <p class="text-sm text-theme-tertiary mt-1">Real-time system health and alerts</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- WebSocket status dot -->
        <div
          class="flex items-center gap-1.5 text-xs"
          :class="systemStore.wsConnected ? 'text-success' : 'text-theme-muted'"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="systemStore.wsConnected ? 'bg-success' : 'bg-theme-muted'"
          ></span>
          <span class="hidden sm:inline">{{ systemStore.wsConnected ? 'Live' : 'Polling' }}</span>
        </div>

        <!-- Refresh button -->
        <button
          @click="refresh"
          :disabled="refreshing"
          class="p-2 rounded-lg bg-theme-secondary text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          title="Refresh all data"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': refreshing }" />
        </button>
      </div>
    </div>

    <!-- ==================== Tab Bar ==================== -->
    <div class="flex gap-1 p-1 bg-theme-tertiary rounded-lg overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
        :class="activeTab === tab.id
          ? 'bg-theme-card text-theme-primary shadow-sm'
          : 'text-theme-muted hover:text-theme-secondary'"
      >
        <Icon :name="tab.icon" :size="14" />
        {{ tab.label }}
        <span
          v-if="tab.id === 'alerts' && monitoringStore.alertCount > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-error-muted text-error"
        >
          {{ monitoringStore.alertCount }}
        </span>
      </button>
    </div>

    <!-- ==================== Loading Skeleton ==================== -->
    <template v-if="!initialLoaded">
      <SkeletonLoader variant="stats" />
      <SkeletonLoader variant="card" :count="3" />
    </template>

    <!-- ==================== Error State ==================== -->
    <div
      v-else-if="monitoringStore.error && !monitoringStore.stats"
      class="p-6 rounded-xl bg-theme-card border border-theme-primary text-center"
    >
      <Icon name="AlertTriangle" :size="32" class="text-error mx-auto mb-3" />
      <p class="text-theme-primary font-medium mb-1">Failed to load monitoring data</p>
      <p class="text-sm text-theme-tertiary mb-4">{{ monitoringStore.error }}</p>
      <button
        @click="refresh"
        class="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Icon name="RefreshCw" :size="14" class="mr-1.5" />
        Retry
      </button>
    </div>

    <!-- ==================== Tab Content ==================== -->
    <template v-else>
      <!-- ========== OVERVIEW TAB ========== -->
      <template v-if="activeTab === 'overview'">
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- CPU -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="Cpu" :size="16" class="text-accent" />
              <span class="text-xs font-medium text-theme-tertiary uppercase tracking-wide">CPU</span>
            </div>
            <div class="text-2xl font-semibold text-theme-primary mb-2">{{ monitoringStore.cpuPercent }}%</div>
            <div class="w-full h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="progressColor(monitoringStore.cpuPercent)"
                :style="{ width: progressWidth(monitoringStore.cpuPercent) }"
              ></div>
            </div>
          </div>

          <!-- Memory -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="Server" :size="16" class="text-accent" />
              <span class="text-xs font-medium text-theme-tertiary uppercase tracking-wide">Memory</span>
            </div>
            <div class="text-2xl font-semibold text-theme-primary mb-1">{{ monitoringStore.memoryPercent }}%</div>
            <div class="text-xs text-theme-tertiary mb-2">
              {{ formatBytes(monitoringStore.memoryUsed) }} / {{ formatBytes(monitoringStore.memoryTotal) }}
            </div>
            <div class="w-full h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="progressColor(monitoringStore.memoryPercent)"
                :style="{ width: progressWidth(monitoringStore.memoryPercent) }"
              ></div>
            </div>
          </div>

          <!-- Disk -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="HardDrive" :size="16" class="text-accent" />
              <span class="text-xs font-medium text-theme-tertiary uppercase tracking-wide">Disk</span>
            </div>
            <div class="text-2xl font-semibold text-theme-primary mb-1">{{ monitoringStore.diskPercent }}%</div>
            <div class="text-xs text-theme-tertiary mb-2">
              {{ formatBytes(monitoringStore.diskUsed) }} / {{ formatBytes(monitoringStore.diskTotal) }}
            </div>
            <div class="w-full h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="progressColor(monitoringStore.diskPercent)"
                :style="{ width: progressWidth(monitoringStore.diskPercent) }"
              ></div>
            </div>
          </div>

          <!-- Temperature -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="Thermometer" :size="16" :class="tempColorClass(monitoringStore.temperature)" />
              <span class="text-xs font-medium text-theme-tertiary uppercase tracking-wide">Temp</span>
            </div>
            <div
              class="text-2xl font-semibold mb-2"
              :class="tempColorClass(monitoringStore.temperature)"
            >
              {{ formatTemp(monitoringStore.temperature) }}
            </div>
            <div class="w-full h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="monitoringStore.temperature > 60 ? 'bg-error' : monitoringStore.temperature > 50 ? 'bg-warning' : 'bg-success'"
                :style="{ width: progressWidth(monitoringStore.temperature ?? 0) }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Period Selector -->
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-theme-secondary">History</h2>
          <div class="flex gap-1 p-0.5 bg-theme-tertiary rounded-lg">
            <button
              v-for="p in periods"
              :key="p.id"
              @click="selectPeriod(p.id)"
              class="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              :class="monitoringStore.historyPeriod === p.id
                ? 'bg-theme-card text-theme-primary shadow-sm'
                : 'text-theme-muted hover:text-theme-secondary'"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- History Charts -->
        <div v-if="monitoringStore.loading && !monitoringStore.history.length" class="space-y-4">
          <SkeletonLoader variant="card" :count="3" />
        </div>

        <div v-else-if="!monitoringStore.history.length" class="p-8 rounded-xl bg-theme-card border border-theme-primary text-center">
          <Icon name="Activity" :size="32" class="text-theme-muted mx-auto mb-3" />
          <p class="text-sm text-theme-tertiary">No history data available for this period</p>
        </div>

        <div v-else class="space-y-4">
          <!-- CPU Chart -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="Cpu" :size="14" class="text-accent" />
              <span class="text-xs font-medium text-theme-secondary">CPU Usage</span>
              <span
                v-if="hoveredChart === 'cpu' && hoveredDataPoint"
                class="ml-auto text-xs text-theme-tertiary"
              >
                {{ formatTimestamp(hoveredDataPoint.timestamp) }} — {{ Math.round(hoveredDataPoint.cpu ?? 0) }}%
              </span>
            </div>
            <div class="relative">
              <svg
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                class="w-full h-28 sm:h-32"
                preserveAspectRatio="none"
                @mousemove="onChartMouseMove($event, 'cpu')"
                @mouseleave="onChartMouseLeave"
              >
                <line
                  v-for="y in [0, 25, 50, 75, 100]"
                  :key="y"
                  x1="0" :y1="yScale(y)" :x2="chartWidth" :y2="yScale(y)"
                  stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="4,4"
                />
                <polygon
                  :points="cpuFillPoints"
                  fill="var(--accent-primary)" fill-opacity="0.1"
                />
                <polyline
                  :points="cpuPoints"
                  fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <!-- Memory Chart -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="Server" :size="14" class="text-success" />
              <span class="text-xs font-medium text-theme-secondary">Memory Usage</span>
              <span
                v-if="hoveredChart === 'memory' && hoveredDataPoint"
                class="ml-auto text-xs text-theme-tertiary"
              >
                {{ formatTimestamp(hoveredDataPoint.timestamp) }} — {{ Math.round(hoveredDataPoint.memory ?? 0) }}%
              </span>
            </div>
            <div class="relative">
              <svg
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                class="w-full h-28 sm:h-32"
                preserveAspectRatio="none"
                @mousemove="onChartMouseMove($event, 'memory')"
                @mouseleave="onChartMouseLeave"
              >
                <line
                  v-for="y in [0, 25, 50, 75, 100]"
                  :key="y"
                  x1="0" :y1="yScale(y)" :x2="chartWidth" :y2="yScale(y)"
                  stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="4,4"
                />
                <polygon
                  :points="memoryFillPoints"
                  fill="var(--success)" fill-opacity="0.1"
                />
                <polyline
                  :points="memoryPoints"
                  fill="none" stroke="var(--success)" stroke-width="2" stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>

          <!-- Disk Chart -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <div class="flex items-center gap-2 mb-3">
              <Icon name="HardDrive" :size="14" class="text-warning" />
              <span class="text-xs font-medium text-theme-secondary">Disk Usage</span>
              <span
                v-if="hoveredChart === 'disk' && hoveredDataPoint"
                class="ml-auto text-xs text-theme-tertiary"
              >
                {{ formatTimestamp(hoveredDataPoint.timestamp) }} — {{ Math.round(hoveredDataPoint.disk ?? 0) }}%
              </span>
            </div>
            <div class="relative">
              <svg
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                class="w-full h-28 sm:h-32"
                preserveAspectRatio="none"
                @mousemove="onChartMouseMove($event, 'disk')"
                @mouseleave="onChartMouseLeave"
              >
                <line
                  v-for="y in [0, 25, 50, 75, 100]"
                  :key="y"
                  x1="0" :y1="yScale(y)" :x2="chartWidth" :y2="yScale(y)"
                  stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="4,4"
                />
                <polygon
                  :points="diskFillPoints"
                  fill="var(--warning)" fill-opacity="0.1"
                />
                <polyline
                  :points="diskPoints"
                  fill="none" stroke="var(--warning)" stroke-width="2" stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </template>

      <!-- ========== ALERTS TAB ========== -->
      <template v-if="activeTab === 'alerts'">
        <!-- Empty state -->
        <div
          v-if="!monitoringStore.hasAlerts"
          class="p-12 rounded-xl bg-theme-card border border-theme-primary text-center"
        >
          <Icon name="CheckCircle" :size="40" class="text-success mx-auto mb-4" />
          <p class="text-theme-primary font-medium mb-1">No active alerts</p>
          <p class="text-sm text-theme-tertiary">All systems are operating within normal thresholds</p>
        </div>

        <template v-else>
          <!-- Desktop table -->
          <div class="hidden md:block rounded-xl bg-theme-card border border-theme-primary overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-theme-primary">
                  <th class="text-left px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Severity</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Resource</th>
                  <th class="text-left px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Message</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Threshold</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Actual</th>
                  <th class="text-right px-4 py-3 text-xs font-medium text-theme-tertiary uppercase tracking-wide">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(alert, idx) in monitoringStore.alerts"
                  :key="idx"
                  class="border-b border-theme-primary last:border-b-0"
                >
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                      :class="severityClass(alert.severity)"
                    >
                      <Icon :name="severityIcon(alert.severity)" :size="12" />
                      {{ alert.severity }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-theme-primary font-medium capitalize">{{ alert.resource }}</td>
                  <td class="px-4 py-3 text-theme-secondary">{{ alert.message }}</td>
                  <td class="px-4 py-3 text-right text-theme-tertiary">{{ alert.threshold }}%</td>
                  <td
                    class="px-4 py-3 text-right font-medium"
                    :class="alert.severity === 'critical' ? 'text-error' : 'text-warning'"
                  >
                    {{ alert.actual }}%
                  </td>
                  <td class="px-4 py-3 text-right text-theme-tertiary">{{ formatTimestamp(alert.triggered_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="md:hidden space-y-3">
            <div
              v-for="(alert, idx) in monitoringStore.alerts"
              :key="idx"
              class="p-4 rounded-xl bg-theme-card border border-theme-primary"
            >
              <div class="flex items-center justify-between mb-2">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                  :class="severityClass(alert.severity)"
                >
                  <Icon :name="severityIcon(alert.severity)" :size="12" />
                  {{ alert.severity }}
                </span>
                <span class="text-xs text-theme-tertiary">{{ formatTimestamp(alert.triggered_at) }}</span>
              </div>
              <p class="text-sm font-medium text-theme-primary capitalize mb-1">{{ alert.resource }}</p>
              <p class="text-xs text-theme-secondary mb-2">{{ alert.message }}</p>
              <div class="flex items-center gap-4 text-xs">
                <span class="text-theme-tertiary">Threshold: {{ alert.threshold }}%</span>
                <span
                  :class="alert.severity === 'critical' ? 'text-error' : 'text-warning'"
                  class="font-medium"
                >
                  Actual: {{ alert.actual }}%
                </span>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- ========== SETTINGS TAB ========== -->
      <template v-if="activeTab === 'settings'">
        <div class="space-y-6">
          <!-- Threshold Configuration -->
          <div class="p-5 rounded-xl bg-theme-card border border-theme-primary">
            <h3 class="text-sm font-medium text-theme-primary mb-1">Alert Thresholds</h3>
            <p class="text-xs text-theme-tertiary mb-4">
              Configure the percentage thresholds at which alerts are triggered.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label class="flex items-center gap-1 text-sm font-medium text-theme-secondary mb-1">
                  <Icon name="Cpu" :size="14" class="text-accent" />
                  CPU Alert (%)
                </label>
                <input
                  v-model.number="thresholdForm.cpu_percent"
                  type="number" min="0" max="100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary
                         focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label class="flex items-center gap-1 text-sm font-medium text-theme-secondary mb-1">
                  <Icon name="Server" :size="14" class="text-accent" />
                  Memory Alert (%)
                </label>
                <input
                  v-model.number="thresholdForm.memory_percent"
                  type="number" min="0" max="100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary
                         focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label class="flex items-center gap-1 text-sm font-medium text-theme-secondary mb-1">
                  <Icon name="HardDrive" :size="14" class="text-accent" />
                  Disk Alert (%)
                </label>
                <input
                  v-model.number="thresholdForm.disk_percent"
                  type="number" min="0" max="100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary
                         focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label class="flex items-center gap-1 text-sm font-medium text-theme-secondary mb-1">
                  <Icon name="Thermometer" :size="14" class="text-accent" />
                  Temperature Alert (°C)
                </label>
                <input
                  v-model.number="thresholdForm.temperature_c"
                  type="number" min="0" max="100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary
                         focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>

            <!-- Save button + feedback -->
            <div class="flex items-center gap-3 flex-wrap">
              <button
                @click="saveThresholds"
                :disabled="monitoringStore.savingThresholds"
                class="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium
                       hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Icon
                  v-if="monitoringStore.savingThresholds"
                  name="Loader2" :size="16" class="animate-spin mr-2"
                />
                Save Thresholds
              </button>

              <span v-if="saveSuccess" class="inline-flex items-center gap-1 text-xs text-success">
                <Icon name="CheckCircle" :size="14" />
                Saved successfully
              </span>
              <span v-if="saveError" class="inline-flex items-center gap-1 text-xs text-error">
                <Icon name="XCircle" :size="14" />
                {{ saveError }}
              </span>
            </div>
          </div>

          <!-- WebSocket Debug (Collapsible) -->
          <div class="rounded-xl bg-theme-card border border-theme-primary overflow-hidden">
            <button
              @click="wsDebugOpen = !wsDebugOpen"
              class="w-full flex items-center justify-between p-4 text-left hover:bg-theme-secondary transition-colors"
            >
              <div class="flex items-center gap-2">
                <Icon name="Wifi" :size="16" class="text-theme-tertiary" />
                <span class="text-sm font-medium text-theme-secondary">WebSocket Debug</span>
              </div>
              <Icon
                name="ChevronRight"
                :size="16"
                class="text-theme-muted transition-transform duration-200"
                :class="{ 'rotate-90': wsDebugOpen }"
              />
            </button>

            <div v-if="wsDebugOpen" class="px-4 pb-4 border-t border-theme-primary pt-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-center justify-between p-3 rounded-lg bg-theme-secondary">
                  <span class="text-xs text-theme-tertiary">Active Connections</span>
                  <span class="text-sm font-medium text-theme-primary">{{ monitoringStore.wsConnectionCount }}</span>
                </div>
                <div class="flex items-center justify-between p-3 rounded-lg bg-theme-secondary">
                  <span class="text-xs text-theme-tertiary">Status</span>
                  <div class="flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="systemStore.wsConnected ? 'bg-success' : 'bg-theme-muted'"
                    ></span>
                    <span
                      class="text-sm font-medium"
                      :class="systemStore.wsConnected ? 'text-success' : 'text-theme-muted'"
                    >
                      {{ systemStore.wsConnected ? 'Connected' : 'Disconnected' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
