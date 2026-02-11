<script setup>
/**
 * NetworkThroughputWidget.vue
 *
 * Live bandwidth graph per network interface.
 * Fetches cumulative byte counters from GET /network/traffic every 3s,
 * computes rates client-side by diffing consecutive samples,
 * and accumulates history for the area chart (last ~60 samples = ~3 min).
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNetworkStore } from '@/stores/network'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const networkStore = useNetworkStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── State ────────────────────────────────────────────────────
const selectedIface = ref(null)
const pollTimer = ref(null)
const chartWidth = 280
const chartHeight = 56
const POLL_INTERVAL = 3000 // 3 seconds
const MAX_HISTORY = 60    // ~3 min of samples

// Previous sample for rate calculation
let prevSample = null    // { timestamp, counters: { eth0: {rx, tx}, wlan0: {rx, tx} } }
let prevTimestamp = null

// Per-interface rate history: { eth0: [{rx, tx, ts}, ...], wlan0: [...] }
const rateHistory = ref({})
// Current rates per interface
const currentRates = ref({})  // { eth0: {rx, tx}, wlan0: {rx, tx} }

// ─── Available interfaces ─────────────────────────────────────
const interfaces = computed(() => {
  return Object.keys(currentRates.value).sort()
})

// Auto-select first interface if none selected
function ensureSelection() {
  const ifaces = interfaces.value
  if (ifaces.length > 0 && (!selectedIface.value || !ifaces.includes(selectedIface.value))) {
    // Prefer wlan0 (AP where clients connect) over eth0 (uplink)
    selectedIface.value = ifaces.find(i => i === 'wlan0') ||
                          ifaces.find(i => i === 'eth0') ||
                          ifaces.find(i => !i.startsWith('docker') && !i.startsWith('veth') && i !== 'lo') ||
                          ifaces[0]
  }
}

// ─── Parse API response into flat counters map ────────────────
function parseTrafficResponse(response) {
  if (!response) return {}

  const counters = {}

  // Format: { stats: [{interface: "eth0", rx_bytes: N, tx_bytes: N}, ...] }
  if (Array.isArray(response.stats)) {
    for (const s of response.stats) {
      const name = s.interface || s.name
      if (!name || name === 'lo') continue
      // Skip Docker/veth virtual interfaces
      if (name.startsWith('docker') || name.startsWith('veth') || name.startsWith('br-')) continue
      counters[name] = { rx: s.rx_bytes || 0, tx: s.tx_bytes || 0 }
    }
    return counters
  }

  // Format: { interfaces: { eth0: {rx_bytes: N, ...}, ... } }
  if (response.interfaces && typeof response.interfaces === 'object') {
    for (const [name, data] of Object.entries(response.interfaces)) {
      if (name === 'lo') continue
      if (name.startsWith('docker') || name.startsWith('veth') || name.startsWith('br-')) continue
      counters[name] = { rx: data.rx_bytes || 0, tx: data.tx_bytes || 0 }
    }
    return counters
  }

  return counters
}

// ─── Fetch and compute rates ──────────────────────────────────
async function fetchAndCompute() {
  const response = await networkStore.fetchTraffic()
  if (!response) return

  const now = Date.now()
  const counters = parseTrafficResponse(response)

  if (prevSample && prevTimestamp) {
    const dt = (now - prevTimestamp) / 1000 // seconds
    if (dt > 0 && dt < 30) { // Sanity check: skip if gap too large (e.g. tab was backgrounded)
      const newRates = {}
      const newHistory = { ...rateHistory.value }

      for (const [name, curr] of Object.entries(counters)) {
        const prev = prevSample[name]
        if (!prev) continue

        // Handle counter wrap (unlikely with int64 but be safe)
        const rxDelta = curr.rx >= prev.rx ? curr.rx - prev.rx : curr.rx
        const txDelta = curr.tx >= prev.tx ? curr.tx - prev.tx : curr.tx

        const rxRate = Math.round(rxDelta / dt)
        const txRate = Math.round(txDelta / dt)

        newRates[name] = { rx: rxRate, tx: txRate }

        // Append to history
        if (!newHistory[name]) newHistory[name] = []
        newHistory[name] = [...newHistory[name].slice(-(MAX_HISTORY - 1)), { rx: rxRate, tx: txRate, ts: now }]
      }

      currentRates.value = newRates
      rateHistory.value = newHistory
      ensureSelection()
    }
  } else {
    // First sample: just initialize interface list with zero rates
    const initRates = {}
    for (const name of Object.keys(counters)) {
      initRates[name] = { rx: 0, tx: 0 }
    }
    currentRates.value = initRates
    ensureSelection()
  }

  prevSample = counters
  prevTimestamp = now
}

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

const selectedRates = computed(() => currentRates.value[selectedIface.value] || { rx: 0, tx: 0 })
const rxFormatted = computed(() => formatRate(selectedRates.value.rx))
const txFormatted = computed(() => formatRate(selectedRates.value.tx))

// ─── History for selected interface ───────────────────────────
const historyData = computed(() => rateHistory.value[selectedIface.value] || [])
const hasHistory = computed(() => historyData.value.length > 1)

// ─── Chart building ───────────────────────────────────────────
function buildAreaPath(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  let maxVal = 0
  for (const p of data) {
    const rx = p.rx || 0
    const tx = p.tx || 0
    if (rx > maxVal) maxVal = rx
    if (tx > maxVal) maxVal = tx
  }
  if (maxVal === 0) maxVal = 1

  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  let path = `M ${padding},${padding + h}`
  data.forEach((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, accessor(point))
    const y = padding + h - (val / maxVal) * h
    path += ` L ${x.toFixed(1)},${y.toFixed(1)}`
  })
  path += ` L ${padding + w},${padding + h} Z`
  return path
}

function buildLine(accessor) {
  const data = historyData.value
  if (data.length < 2) return ''

  let maxVal = 0
  for (const p of data) {
    const rx = p.rx || 0
    const tx = p.tx || 0
    if (rx > maxVal) maxVal = rx
    if (tx > maxVal) maxVal = tx
  }
  if (maxVal === 0) maxVal = 1

  const padding = 2
  const w = chartWidth - padding * 2
  const h = chartHeight - padding * 2

  return data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const val = Math.max(0, accessor(point))
    const y = padding + h - (val / maxVal) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const rxArea = computed(() => buildAreaPath(p => p.rx || 0))
const txArea = computed(() => buildAreaPath(p => p.tx || 0))
const rxLine = computed(() => buildLine(p => p.rx || 0))
const txLine = computed(() => buildLine(p => p.tx || 0))

// ─── Interface switching ──────────────────────────────────────
function switchInterface(iface) {
  selectedIface.value = iface
}

// ─── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  await fetchAndCompute()
  pollTimer.value = setInterval(fetchAndCompute, POLL_INTERVAL)
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
      <div v-if="interfaces.length > 1" class="flex gap-1" @click.stop>
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
      <span v-else-if="selectedIface" class="text-[10px] text-theme-muted">{{ selectedIface }}</span>
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

      <!-- Waiting for first rate calculation -->
      <div
        v-else
        class="w-full h-14 flex items-center justify-center text-[10px] text-theme-muted"
      >
        {{ interfaces.length > 0 ? 'Building chart...' : 'Collecting traffic data...' }}
      </div>
    </div>
  </button>
</template>
