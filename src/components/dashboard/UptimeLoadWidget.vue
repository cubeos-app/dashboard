<script setup>
/**
 * UptimeLoadWidget.vue — Session 3
 *
 * Compact widget showing system uptime and CPU/memory load sparklines.
 * Uses /monitoring/history endpoint (already fetched via monitoringStore).
 * Inline SVG polyline charts — no chart library dependency.
 *
 * Design: uptime text at top, then a 2-line sparkline (CPU in cyan, Memory
 * in indigo) rendered as SVG <polyline> elements. Period selector (1h/6h/24h).
 * Hover on chart shows tooltip with exact values.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useMonitoringStore } from '@/stores/monitoring'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const monitoringStore = useMonitoringStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── State ────────────────────────────────────────────────────
const period = ref('1h')
const hoveredIdx = ref(null)
const chartWidth = 280
const chartHeight = 60
const pollTimer = ref(null)

// ─── Uptime ───────────────────────────────────────────────────
const uptimeText = computed(() => systemStore.uptime.uptime_human || '—')

// ─── History data ─────────────────────────────────────────────
const historyData = computed(() => {
  const data = monitoringStore.history
  if (!Array.isArray(data) || data.length === 0) return []
  return data
})

const hasData = computed(() => historyData.value.length > 1)

// ─── Sparkline point generation ───────────────────────────────
function buildPoints(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  const points = data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, Math.min(100, accessor(point) ?? 0))
    const y = padding + h - (val / 100) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(' ')
}

const cpuPoints = computed(() => buildPoints(p =>
  p.cpu_percent ?? p.cpu?.percent ?? 0
))

const memoryPoints = computed(() => buildPoints(p =>
  p.memory_percent ?? p.memory?.percent ?? 0
))

// ─── Area fill path (for subtle background fill) ──────────────
function buildAreaPath(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  let path = `M ${padding},${padding + h}`
  data.forEach((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, Math.min(100, accessor(point) ?? 0))
    const y = padding + h - (val / 100) * h
    path += ` L ${x.toFixed(1)},${y.toFixed(1)}`
  })
  path += ` L ${padding + w},${padding + h} Z`

  return path
}

const cpuArea = computed(() => buildAreaPath(p =>
  p.cpu_percent ?? p.cpu?.percent ?? 0
))

const memoryArea = computed(() => buildAreaPath(p =>
  p.memory_percent ?? p.memory?.percent ?? 0
))

// ─── Tooltip data ─────────────────────────────────────────────
const tooltipData = computed(() => {
  if (hoveredIdx.value === null || !hasData.value) return null
  const point = historyData.value[hoveredIdx.value]
  if (!point) return null

  const cpu = Math.round(point.cpu_percent ?? point.cpu?.percent ?? 0)
  const mem = Math.round(point.memory_percent ?? point.memory?.percent ?? 0)
  const time = point.timestamp || point.time
  let timeStr = ''
  if (time) {
    try {
      const d = new Date(time)
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { /* ignore */ }
  }

  const padding = 2
  const w = chartWidth - padding * 2
  const x = padding + (hoveredIdx.value / (historyData.value.length - 1)) * w

  return { cpu, mem, timeStr, x }
})

// ─── Current values ───────────────────────────────────────────
const currentCpu = computed(() => systemStore.cpuUsage ?? 0)
const currentMem = computed(() => systemStore.memoryUsage ?? 0)

// ─── Period switching ─────────────────────────────────────────
async function setPeriod(p) {
  period.value = p
  await monitoringStore.fetchHistory({ period: p })
}

// ─── Chart interaction ────────────────────────────────────────
function onChartHover(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const ratio = x / rect.width
  const idx = Math.round(ratio * (historyData.value.length - 1))
  hoveredIdx.value = Math.max(0, Math.min(idx, historyData.value.length - 1))
}

function onChartLeave() {
  hoveredIdx.value = null
}

// ─── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  // Only fetch if no data yet (Advanced mode may have already fetched)
  if (monitoringStore.history.length === 0) {
    await monitoringStore.fetchHistory({ period: period.value })
  }
  // Poll every 30s
  pollTimer.value = setInterval(() => {
    monitoringStore.fetchHistory({ period: period.value })
  }, 30000)
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer"
    @click="router.push('/system?tab=monitoring')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center">
          <Icon name="Clock" :size="14" class="text-teal-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Uptime</span>
      </div>

      <!-- Period selector -->
      <div class="flex gap-1" @click.stop>
        <button
          v-for="p in ['1h', '6h', '24h']"
          :key="p"
          class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors"
          :class="period === p
            ? 'bg-accent/15 text-accent'
            : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
          @click.stop="setPeriod(p)"
        >
          {{ p }}
        </button>
      </div>
    </div>

    <!-- Uptime value -->
    <div class="flex items-baseline gap-2 mb-3">
      <span class="text-lg font-semibold text-theme-primary tabular-nums">{{ uptimeText }}</span>
    </div>

    <!-- Current values legend -->
    <div class="flex items-center gap-4 mb-2">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-0.5 rounded-full bg-cyan-400"></span>
        <span class="text-[10px] text-theme-muted">CPU</span>
        <span class="text-[10px] font-semibold text-theme-secondary tabular-nums">{{ currentCpu }}%</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-0.5 rounded-full bg-indigo-400"></span>
        <span class="text-[10px] text-theme-muted">Mem</span>
        <span class="text-[10px] font-semibold text-theme-secondary tabular-nums">{{ currentMem }}%</span>
      </div>
    </div>

    <!-- Sparkline chart -->
    <div
      class="relative"
      @mousemove="onChartHover"
      @mouseleave="onChartLeave"
    >
      <svg
        v-if="hasData"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        class="w-full h-16"
        preserveAspectRatio="none"
      >
        <!-- Grid lines -->
        <line x1="0" :y1="chartHeight * 0.25" :x2="chartWidth" :y2="chartHeight * 0.25"
              stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="4 4" />
        <line x1="0" :y1="chartHeight * 0.5" :x2="chartWidth" :y2="chartHeight * 0.5"
              stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="4 4" />
        <line x1="0" :y1="chartHeight * 0.75" :x2="chartWidth" :y2="chartHeight * 0.75"
              stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="4 4" />

        <!-- Memory area fill -->
        <path :d="memoryArea" fill="rgb(129, 140, 248)" fill-opacity="0.06" />
        <!-- CPU area fill -->
        <path :d="cpuArea" fill="rgb(34, 211, 238)" fill-opacity="0.06" />

        <!-- Memory line -->
        <polyline
          :points="memoryPoints"
          fill="none"
          stroke="rgb(129, 140, 248)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- CPU line -->
        <polyline
          :points="cpuPoints"
          fill="none"
          stroke="rgb(34, 211, 238)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />

        <!-- Hover line -->
        <line
          v-if="tooltipData"
          :x1="tooltipData.x"
          y1="0"
          :x2="tooltipData.x"
          :y2="chartHeight"
          stroke="currentColor"
          stroke-opacity="0.2"
          stroke-width="1"
          stroke-dasharray="2 2"
        />
      </svg>

      <!-- No data placeholder -->
      <div
        v-else
        class="w-full h-16 flex items-center justify-center text-[10px] text-theme-muted"
      >
        Collecting data...
      </div>

      <!-- Tooltip -->
      <div
        v-if="tooltipData"
        class="absolute -top-1 pointer-events-none px-2 py-1 rounded-md bg-theme-secondary border border-theme-primary shadow-lg text-[10px] whitespace-nowrap -translate-x-1/2 z-10"
        :style="{ left: `${(tooltipData.x / chartWidth) * 100}%` }"
      >
        <span v-if="tooltipData.timeStr" class="text-theme-muted">{{ tooltipData.timeStr }} · </span>
        <span class="text-cyan-400">CPU {{ tooltipData.cpu }}%</span>
        <span class="text-theme-muted mx-1">·</span>
        <span class="text-indigo-400">Mem {{ tooltipData.mem }}%</span>
      </div>
    </div>
  </button>
</template>
