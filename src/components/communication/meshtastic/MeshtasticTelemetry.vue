<script setup>
/**
 * MeshtasticTelemetry.vue
 *
 * Telemetry charts sub-tab using SVG sparklines (useSVGChart composable).
 * Shows battery/voltage, channel utilization, temperature, humidity, pressure
 * time-series for a selected node and time range.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { buildPolyline, buildAreaPath, getHoverIndex } from '@/composables/useSVGChart'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  meshsatAvailable: { type: Boolean, default: false }
})

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const selectedNode = ref('')
const timeRange = ref('24h')
const loading = ref(false)
const telemetryData = ref([])

const chartWidth = 320
const chartHeight = 64

const TIME_RANGES = [
  { key: '1h', label: '1h', hours: 1 },
  { key: '6h', label: '6h', hours: 6 },
  { key: '24h', label: '24h', hours: 24 },
  { key: '7d', label: '7d', hours: 168 }
]

// ==========================================
// Computed
// ==========================================

const nodeOptions = computed(() => {
  const raw = props.meshsatAvailable
    ? communicationStore.meshsatNodes
    : communicationStore.meshtasticNodes
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.nodes || raw.items || [])
  return list.map(n => ({
    id: String(n.id ?? n.node_id ?? n.num ?? ''),
    name: n.name ?? n.long_name ?? n.short_name ?? String(n.id ?? '')
  }))
})

// Check which metrics have data
const hasBattery = computed(() =>
  telemetryData.value.some(t => t.battery !== null && t.battery !== undefined)
)
const hasVoltage = computed(() =>
  telemetryData.value.some(t => t.voltage !== null && t.voltage !== undefined)
)
const hasChannelUtil = computed(() =>
  telemetryData.value.some(t =>
    (t.channel_util !== null && t.channel_util !== undefined) ||
    (t.air_util_tx !== null && t.air_util_tx !== undefined)
  )
)
const hasTemperature = computed(() =>
  telemetryData.value.some(t => t.temperature !== null && t.temperature !== undefined)
)
const hasHumidity = computed(() =>
  telemetryData.value.some(t => t.humidity !== null && t.humidity !== undefined)
)
const hasPressure = computed(() =>
  telemetryData.value.some(t => t.pressure !== null && t.pressure !== undefined)
)

// Current (last) values
const currentBattery = computed(() => lastValue(t => t.battery))
const currentVoltage = computed(() => lastValue(t => t.voltage, 2))
const currentChannelUtil = computed(() => lastValue(t => t.channel_util))
const currentAirUtil = computed(() => lastValue(t => t.air_util_tx))
const currentTemperature = computed(() => lastValue(t => t.temperature, 1))
const currentHumidity = computed(() => lastValue(t => t.humidity))
const currentPressure = computed(() => lastValue(t => t.pressure, 1))

function lastValue(accessor, decimals = 0) {
  for (let i = telemetryData.value.length - 1; i >= 0; i--) {
    const v = accessor(telemetryData.value[i])
    if (v !== null && v !== undefined) return Number(v).toFixed(decimals)
  }
  return null
}

// ==========================================
// Chart data builders
// ==========================================

function batteryPoints() {
  return buildPolyline(telemetryData.value, t => t.battery ?? 0, chartWidth, chartHeight, 0, 100)
}

function voltagePoints() {
  const vals = telemetryData.value.map(t => Number(t.voltage ?? 0)).filter(v => v > 0)
  const min = vals.length ? Math.floor(Math.min(...vals) * 10) / 10 : 3.0
  const max = vals.length ? Math.ceil(Math.max(...vals) * 10) / 10 : 4.2
  return buildPolyline(telemetryData.value, t => t.voltage ?? min, chartWidth, chartHeight, min, max)
}

function channelUtilPoints() {
  return buildPolyline(telemetryData.value, t => t.channel_util ?? 0, chartWidth, chartHeight, 0, 100)
}

function airUtilPoints() {
  return buildPolyline(telemetryData.value, t => t.air_util_tx ?? 0, chartWidth, chartHeight, 0, 100)
}

function channelUtilArea() {
  return buildAreaPath(telemetryData.value, t => t.channel_util ?? 0, chartWidth, chartHeight, 0, 100)
}

function temperaturePoints() {
  const vals = telemetryData.value.map(t => Number(t.temperature ?? 0)).filter(v => v !== 0)
  const min = vals.length ? Math.floor(Math.min(...vals)) - 2 : -10
  const max = vals.length ? Math.ceil(Math.max(...vals)) + 2 : 50
  return buildPolyline(telemetryData.value, t => t.temperature ?? min, chartWidth, chartHeight, min, max)
}

function humidityPoints() {
  return buildPolyline(telemetryData.value, t => t.humidity ?? 0, chartWidth, chartHeight, 0, 100)
}

function pressurePoints() {
  const vals = telemetryData.value.map(t => Number(t.pressure ?? 0)).filter(v => v > 0)
  const min = vals.length ? Math.floor(Math.min(...vals)) - 5 : 950
  const max = vals.length ? Math.ceil(Math.max(...vals)) + 5 : 1050
  return buildPolyline(telemetryData.value, t => t.pressure ?? min, chartWidth, chartHeight, min, max)
}

// ==========================================
// Hover tooltip
// ==========================================

const hoveredIdx = ref(null)
const hoveredChart = ref(null)

function onChartHover(e, chart) {
  hoveredIdx.value = getHoverIndex(e, telemetryData.value.length)
  hoveredChart.value = chart
}

function onChartLeave() {
  hoveredIdx.value = null
  hoveredChart.value = null
}

const tooltipData = computed(() => {
  if (hoveredIdx.value === null) return null
  const point = telemetryData.value[hoveredIdx.value]
  if (!point) return null

  const ts = point.timestamp ?? point.time
  let timeStr = ''
  if (ts) {
    try {
      const t = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts
      timeStr = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { /* ignore */ }
  }

  const padding = 2
  const w = chartWidth - padding * 2
  const x = padding + (hoveredIdx.value / Math.max(1, telemetryData.value.length - 1)) * w

  return { point, timeStr, x }
})

// ==========================================
// Actions
// ==========================================

async function fetchTelemetry() {
  if (!props.meshsatAvailable || !selectedNode.value) {
    telemetryData.value = []
    return
  }

  loading.value = true
  try {
    const rangeConfig = TIME_RANGES.find(r => r.key === timeRange.value)
    const since = new Date(Date.now() - (rangeConfig?.hours ?? 24) * 3600 * 1000).toISOString()
    const params = { node: selectedNode.value, since, limit: 500 }
    const data = await communicationStore.fetchMeshsatTelemetry(params, { signal: signal() })
    if (data) {
      const list = Array.isArray(data) ? data : (data.telemetry || data.items || [])
      telemetryData.value = list
    }
  } finally {
    loading.value = false
  }
}

// ==========================================
// Watchers
// ==========================================

watch([selectedNode, timeRange], () => {
  fetchTelemetry()
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  if (props.meshsatAvailable) {
    await communicationStore.fetchMeshsatNodes({ signal: signal() })
  }
  if (nodeOptions.value.length && !selectedNode.value) {
    selectedNode.value = nodeOptions.value[0].id
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex flex-col sm:flex-row gap-3">
      <select
        v-model="selectedNode"
        class="px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="" disabled>Select Node</option>
        <option v-for="n in nodeOptions" :key="n.id" :value="n.id">
          {{ n.name }}
        </option>
      </select>

      <div class="flex gap-1">
        <button
          v-for="r in TIME_RANGES"
          :key="r.key"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          :class="timeRange === r.key
            ? 'bg-accent/15 text-accent'
            : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
          @click="timeRange = r.key"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <!-- No MeshSat -->
    <div v-if="!meshsatAvailable" class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
      <Icon name="Activity" :size="32" class="text-theme-muted mx-auto mb-2" />
      <p class="text-sm text-theme-secondary">Telemetry charts require MeshSat</p>
      <p class="text-xs text-theme-muted mt-1">
        Install and enable the MeshSat coreapp for persistent telemetry data
      </p>
    </div>

    <!-- No node selected -->
    <div v-else-if="!selectedNode" class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
      <Icon name="Activity" :size="32" class="text-theme-muted mx-auto mb-2" />
      <p class="text-sm text-theme-secondary">Select a node to view telemetry</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
      <Icon name="Loader2" :size="24" class="text-accent mx-auto mb-2 animate-spin" />
      <p class="text-sm text-theme-muted">Loading telemetry...</p>
    </div>

    <!-- No data -->
    <div v-else-if="!telemetryData.length" class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
      <Icon name="Activity" :size="32" class="text-theme-muted mx-auto mb-2" />
      <p class="text-sm text-theme-secondary">No Telemetry Data</p>
      <p class="text-xs text-theme-muted mt-1">
        No telemetry recorded for this node in the selected time range
      </p>
    </div>

    <!-- Chart cards -->
    <template v-else>
      <!-- Battery & Voltage -->
      <div v-if="hasBattery || hasVoltage" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Icon name="Battery" :size="16" class="text-emerald-400" />
            <span class="text-sm font-semibold text-theme-primary">Battery & Voltage</span>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span v-if="currentBattery !== null" class="text-emerald-400 font-medium tabular-nums">
              {{ currentBattery }}%
            </span>
            <span v-if="currentVoltage !== null" class="text-cyan-400 font-medium tabular-nums">
              {{ currentVoltage }}V
            </span>
          </div>
        </div>
        <div
          class="relative"
          @mousemove="(e) => onChartHover(e, 'battery')"
          @mouseleave="onChartLeave"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full h-16"
            preserveAspectRatio="none"
          >
            <line x1="0" :y1="chartHeight * 0.5" :x2="chartWidth" :y2="chartHeight * 0.5"
                  stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="4 4" />
            <polyline
              v-if="hasBattery"
              :points="batteryPoints()"
              fill="none" stroke="rgb(52, 211, 153)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <polyline
              v-if="hasVoltage"
              :points="voltagePoints()"
              fill="none" stroke="rgb(34, 211, 238)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <line
              v-if="tooltipData && hoveredChart === 'battery'"
              :x1="tooltipData.x" y1="0" :x2="tooltipData.x" :y2="chartHeight"
              stroke="currentColor" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 2"
            />
          </svg>
          <div
            v-if="tooltipData && hoveredChart === 'battery'"
            class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
            :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
          >
            <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
            <span v-if="tooltipData.point.battery != null" class="text-emerald-400">{{ Math.round(tooltipData.point.battery) }}%</span>
            <span v-if="tooltipData.point.voltage != null" class="text-cyan-400 ml-1">{{ Number(tooltipData.point.voltage).toFixed(2) }}V</span>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-2">
          <div v-if="hasBattery" class="flex items-center gap-1.5">
            <span class="w-2 h-0.5 rounded-full bg-emerald-400"></span>
            <span class="text-[10px] text-theme-muted">Battery</span>
          </div>
          <div v-if="hasVoltage" class="flex items-center gap-1.5">
            <span class="w-2 h-0.5 rounded-full bg-cyan-400"></span>
            <span class="text-[10px] text-theme-muted">Voltage</span>
          </div>
        </div>
      </div>

      <!-- Channel Utilization -->
      <div v-if="hasChannelUtil" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Icon name="Radio" :size="16" class="text-purple-400" />
            <span class="text-sm font-semibold text-theme-primary">Channel Utilization</span>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span v-if="currentChannelUtil !== null" class="text-purple-400 font-medium tabular-nums">
              Ch: {{ currentChannelUtil }}%
            </span>
            <span v-if="currentAirUtil !== null" class="text-indigo-400 font-medium tabular-nums">
              Air: {{ currentAirUtil }}%
            </span>
          </div>
        </div>
        <div
          class="relative"
          @mousemove="(e) => onChartHover(e, 'channel')"
          @mouseleave="onChartLeave"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full h-16"
            preserveAspectRatio="none"
          >
            <path :d="channelUtilArea()" fill="rgb(168, 85, 247)" fill-opacity="0.06" />
            <polyline
              :points="channelUtilPoints()"
              fill="none" stroke="rgb(168, 85, 247)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <polyline
              :points="airUtilPoints()"
              fill="none" stroke="rgb(129, 140, 248)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <line
              v-if="tooltipData && hoveredChart === 'channel'"
              :x1="tooltipData.x" y1="0" :x2="tooltipData.x" :y2="chartHeight"
              stroke="currentColor" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 2"
            />
          </svg>
          <div
            v-if="tooltipData && hoveredChart === 'channel'"
            class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
            :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
          >
            <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
            <span v-if="tooltipData.point.channel_util != null" class="text-purple-400">Ch: {{ Number(tooltipData.point.channel_util).toFixed(1) }}%</span>
            <span v-if="tooltipData.point.air_util_tx != null" class="text-indigo-400 ml-1">Air: {{ Number(tooltipData.point.air_util_tx).toFixed(1) }}%</span>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-2">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-0.5 rounded-full bg-purple-400"></span>
            <span class="text-[10px] text-theme-muted">Channel Util</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-0.5 rounded-full bg-indigo-400"></span>
            <span class="text-[10px] text-theme-muted">Air Util TX</span>
          </div>
        </div>
      </div>

      <!-- Temperature -->
      <div v-if="hasTemperature" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Icon name="Thermometer" :size="16" class="text-orange-400" />
            <span class="text-sm font-semibold text-theme-primary">Temperature</span>
          </div>
          <span v-if="currentTemperature !== null" class="text-xs text-orange-400 font-medium tabular-nums">
            {{ currentTemperature }}°C
          </span>
        </div>
        <div
          class="relative"
          @mousemove="(e) => onChartHover(e, 'temp')"
          @mouseleave="onChartLeave"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full h-16"
            preserveAspectRatio="none"
          >
            <polyline
              :points="temperaturePoints()"
              fill="none" stroke="rgb(251, 146, 60)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <line
              v-if="tooltipData && hoveredChart === 'temp'"
              :x1="tooltipData.x" y1="0" :x2="tooltipData.x" :y2="chartHeight"
              stroke="currentColor" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 2"
            />
          </svg>
          <div
            v-if="tooltipData && hoveredChart === 'temp'"
            class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
            :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
          >
            <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
            <span v-if="tooltipData.point.temperature != null" class="text-orange-400">{{ Number(tooltipData.point.temperature).toFixed(1) }}°C</span>
          </div>
        </div>
      </div>

      <!-- Humidity -->
      <div v-if="hasHumidity" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Icon name="Droplets" :size="16" class="text-blue-400" />
            <span class="text-sm font-semibold text-theme-primary">Humidity</span>
          </div>
          <span v-if="currentHumidity !== null" class="text-xs text-blue-400 font-medium tabular-nums">
            {{ currentHumidity }}%
          </span>
        </div>
        <div
          class="relative"
          @mousemove="(e) => onChartHover(e, 'humidity')"
          @mouseleave="onChartLeave"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full h-16"
            preserveAspectRatio="none"
          >
            <polyline
              :points="humidityPoints()"
              fill="none" stroke="rgb(96, 165, 250)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <line
              v-if="tooltipData && hoveredChart === 'humidity'"
              :x1="tooltipData.x" y1="0" :x2="tooltipData.x" :y2="chartHeight"
              stroke="currentColor" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 2"
            />
          </svg>
          <div
            v-if="tooltipData && hoveredChart === 'humidity'"
            class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
            :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
          >
            <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
            <span v-if="tooltipData.point.humidity != null" class="text-blue-400">{{ Math.round(tooltipData.point.humidity) }}%</span>
          </div>
        </div>
      </div>

      <!-- Pressure -->
      <div v-if="hasPressure" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Icon name="Gauge" :size="16" class="text-teal-400" />
            <span class="text-sm font-semibold text-theme-primary">Barometric Pressure</span>
          </div>
          <span v-if="currentPressure !== null" class="text-xs text-teal-400 font-medium tabular-nums">
            {{ currentPressure }} hPa
          </span>
        </div>
        <div
          class="relative"
          @mousemove="(e) => onChartHover(e, 'pressure')"
          @mouseleave="onChartLeave"
        >
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full h-16"
            preserveAspectRatio="none"
          >
            <polyline
              :points="pressurePoints()"
              fill="none" stroke="rgb(45, 212, 191)" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
            />
            <line
              v-if="tooltipData && hoveredChart === 'pressure'"
              :x1="tooltipData.x" y1="0" :x2="tooltipData.x" :y2="chartHeight"
              stroke="currentColor" stroke-opacity="0.2" stroke-width="1" stroke-dasharray="2 2"
            />
          </svg>
          <div
            v-if="tooltipData && hoveredChart === 'pressure'"
            class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
            :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
          >
            <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
            <span v-if="tooltipData.point.pressure != null" class="text-teal-400">{{ Number(tooltipData.point.pressure).toFixed(1) }} hPa</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
