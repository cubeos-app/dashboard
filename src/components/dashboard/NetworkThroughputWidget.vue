<script setup>
/**
 * NetworkThroughputWidget.vue — Session 3
 *
 * Live bandwidth graph per network interface.
 * Uses /network/traffic and /network/traffic/{iface}/history endpoints.
 * Shows: current TX/RX rates, mini area chart for recent history.
 *
 * Design: Card with interface selector (wlan0, eth0). Current rates as large
 * numbers (e.g., "↑ 2.4 MB/s ↓ 14.7 MB/s"). Below: filled area chart for
 * last hour, RX in blue area, TX in green area. SVG-based, no library.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNetworkStore } from '@/stores/network'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const networkStore = useNetworkStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── State ────────────────────────────────────────────────────
const selectedIface = ref('wlan0')
const pollTimer = ref(null)
const chartWidth = 280
const chartHeight = 56

// ─── Available interfaces ─────────────────────────────────────
const interfaces = computed(() => {
  const traffic = networkStore.trafficStats
  if (!traffic) return ['wlan0', 'eth0']

  // trafficStats could be { interfaces: [...] } or { wlan0: {...}, eth0: {...} }
  if (traffic.interfaces && Array.isArray(traffic.interfaces)) {
    return traffic.interfaces.map(i => i.name || i.interface).filter(Boolean)
  }
  // Object keys approach
  const keys = Object.keys(traffic).filter(k =>
    k !== 'timestamp' && k !== 'error' && typeof traffic[k] === 'object'
  )
  return keys.length > 0 ? keys : ['wlan0', 'eth0']
})

// ─── Current rates ────────────────────────────────────────────
const currentRates = computed(() => {
  const traffic = networkStore.trafficStats
  if (!traffic) return { rx: 0, tx: 0 }

  // Try array format first
  if (traffic.interfaces && Array.isArray(traffic.interfaces)) {
    const iface = traffic.interfaces.find(i =>
      (i.name || i.interface) === selectedIface.value
    )
    return {
      rx: iface?.rx_rate ?? iface?.rx_bytes_per_sec ?? 0,
      tx: iface?.tx_rate ?? iface?.tx_bytes_per_sec ?? 0,
    }
  }

  // Object format
  const iface = traffic[selectedIface.value]
  if (!iface) return { rx: 0, tx: 0 }
  return {
    rx: iface.rx_rate ?? iface.rx_bytes_per_sec ?? 0,
    tx: iface.tx_rate ?? iface.tx_bytes_per_sec ?? 0,
  }
})

// ─── Format bytes/sec ─────────────────────────────────────────
function formatRate(bytesPerSec) {
  if (bytesPerSec == null || bytesPerSec === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let val = bytesPerSec
  let unit = 0
  while (val >= 1024 && unit < units.length - 1) {
    val /= 1024
    unit++
  }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[unit]}`
}

const rxFormatted = computed(() => formatRate(currentRates.value.rx))
const txFormatted = computed(() => formatRate(currentRates.value.tx))

// ─── History data ─────────────────────────────────────────────
const historyData = computed(() => {
  const data = networkStore.trafficHistory
  if (!Array.isArray(data) || data.length === 0) return []
  return data
})

const hasHistory = computed(() => historyData.value.length > 1)

// ─── Chart building ───────────────────────────────────────────
function findMax(accessor) {
  let max = 0
  for (const point of historyData.value) {
    const val = accessor(point) ?? 0
    if (val > max) max = val
  }
  return max || 1 // Avoid division by zero
}

function buildAreaPath(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  const maxVal = Math.max(findMax(p => p.rx_rate ?? p.rx_bytes_per_sec ?? 0),
                           findMax(p => p.tx_rate ?? p.tx_bytes_per_sec ?? 0))
  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  let path = `M ${padding},${padding + h}`
  data.forEach((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, accessor(point) ?? 0)
    const y = padding + h - (val / maxVal) * h
    path += ` L ${x.toFixed(1)},${y.toFixed(1)}`
  })
  path += ` L ${padding + w},${padding + h} Z`
  return path
}

function buildLine(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  const maxVal = Math.max(findMax(p => p.rx_rate ?? p.rx_bytes_per_sec ?? 0),
                           findMax(p => p.tx_rate ?? p.tx_bytes_per_sec ?? 0))
  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  return data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, accessor(point) ?? 0)
    const y = padding + h - (val / maxVal) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const rxArea = computed(() => buildAreaPath(p => p.rx_rate ?? p.rx_bytes_per_sec ?? 0))
const txArea = computed(() => buildAreaPath(p => p.tx_rate ?? p.tx_bytes_per_sec ?? 0))
const rxLine = computed(() => buildLine(p => p.rx_rate ?? p.rx_bytes_per_sec ?? 0))
const txLine = computed(() => buildLine(p => p.tx_rate ?? p.tx_bytes_per_sec ?? 0))

// ─── Interface switching ──────────────────────────────────────
async function switchInterface(iface) {
  selectedIface.value = iface
  await networkStore.fetchTrafficHistory(iface, { minutes: 60 })
}

// ─── Polling ──────────────────────────────────────────────────
async function fetchData() {
  await Promise.all([
    networkStore.fetchTraffic(),
    networkStore.fetchTrafficHistory(selectedIface.value, { minutes: 60 }),
  ])
}

onMounted(async () => {
  await fetchData()
  pollTimer.value = setInterval(fetchData, 10000) // 10s refresh
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
    @click="router.push('/network?tab=traffic')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
          <Icon name="ArrowUpDown" :size="14" class="text-sky-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Traffic</span>
      </div>

      <!-- Interface selector -->
      <div class="flex gap-1" @click.stop>
        <button
          v-for="iface in interfaces"
          :key="iface"
          class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors"
          :class="selectedIface === iface
            ? 'bg-accent/15 text-accent'
            : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
          @click.stop="switchInterface(iface)"
        >
          {{ iface }}
        </button>
      </div>
    </div>

    <!-- Current rates -->
    <div class="flex items-center gap-4 mb-3">
      <div class="flex items-center gap-1.5">
        <Icon name="ArrowDown" :size="12" class="text-sky-400" />
        <span class="text-sm font-semibold text-theme-primary tabular-nums">{{ rxFormatted }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="ArrowUp" :size="12" class="text-emerald-400" />
        <span class="text-sm font-semibold text-theme-primary tabular-nums">{{ txFormatted }}</span>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 mb-2">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-0.5 rounded-full bg-sky-400"></span>
        <span class="text-[10px] text-theme-muted">RX (download)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-0.5 rounded-full bg-emerald-400"></span>
        <span class="text-[10px] text-theme-muted">TX (upload)</span>
      </div>
    </div>

    <!-- Area chart -->
    <div class="relative">
      <svg
        v-if="hasHistory"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        class="w-full h-14"
        preserveAspectRatio="none"
      >
        <!-- RX area fill -->
        <path :d="rxArea" fill="rgb(56, 189, 248)" fill-opacity="0.1" />
        <!-- TX area fill -->
        <path :d="txArea" fill="rgb(52, 211, 153)" fill-opacity="0.08" />

        <!-- RX line -->
        <polyline
          :points="rxLine"
          fill="none"
          stroke="rgb(56, 189, 248)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <!-- TX line -->
        <polyline
          :points="txLine"
          fill="none"
          stroke="rgb(52, 211, 153)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- No data placeholder -->
      <div
        v-else
        class="w-full h-14 flex items-center justify-center text-[10px] text-theme-muted"
      >
        Collecting traffic data...
      </div>
    </div>
  </button>
</template>
