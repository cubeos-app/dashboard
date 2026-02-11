<script setup>
/**
 * TrafficTab.vue — S06 Component
 *
 * Advanced only. Per-interface traffic statistics and history chart.
 * Extracted from NetworkView Traffic tab.
 *
 * Props: interfaces (filtered physical interfaces from parent)
 * Store: network.js (fetchTraffic, fetchTrafficHistory)
 * Emits: refresh
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNetworkStore } from '@/stores/network'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  interfaces: { type: Array, default: () => [] }
})

const emit = defineEmits(['refresh'])

const networkStore = useNetworkStore()
const { signal } = useAbortOnUnmount()

// ─── State ───────────────────────────────────────────────────
const selectedInterface = ref('')
const trafficHistory = ref([])
const currentStats = ref(null)

const physicalInterfaces = computed(() => {
  // Use props interfaces if available, otherwise derive from traffic stats
  const fromProps = props.interfaces.filter(i =>
    i.name && !i.name.startsWith('veth') && !i.name.startsWith('br-') && i.name !== 'lo'
  )
  if (fromProps.length > 0) return fromProps

  // Fallback: derive from traffic stats
  if (currentStats.value || lastStats.value) {
    const statsMap = lastStats.value || {}
    return Object.keys(statsMap)
      .filter(n => !n.startsWith('veth') && !n.startsWith('br-') && n !== 'lo')
      .map(n => ({ name: n, is_up: true }))
  }
  return []
})

// Track previous stats for rate calculation
const lastStats = ref({})
const lastFetchTime = ref(0)

// ─── Data Fetching ───────────────────────────────────────────
async function fetchTraffic() {
  try {
    const s = signal()
    const opts = { signal: s }
    const result = await networkStore.fetchTraffic(opts)
    const statsArray = result?.stats

    if (Array.isArray(statsArray) && statsArray.length > 0) {
      // Auto-select first physical interface if none selected
      if (!selectedInterface.value) {
        const physical = statsArray.find(s =>
          !s.interface.startsWith('veth') &&
          !s.interface.startsWith('br-') &&
          s.interface !== 'lo' &&
          s.interface !== 'docker0'
        )
        selectedInterface.value = physical?.interface || statsArray[0].interface
      }

      // Find current interface stats
      const raw = statsArray.find(s => s.interface === selectedInterface.value)
      if (raw) {
        // Calculate rates from delta between polls
        const now = Date.now()
        const prev = lastStats.value[selectedInterface.value]
        const elapsed = (now - lastFetchTime.value) / 1000 // seconds

        if (prev && elapsed > 0 && elapsed < 30) {
          raw.rx_rate_bps = Math.max(0, Math.round((raw.rx_bytes - prev.rx_bytes) / elapsed))
          raw.tx_rate_bps = Math.max(0, Math.round((raw.tx_bytes - prev.tx_bytes) / elapsed))
        }

        currentStats.value = raw

        // Store for next delta calculation
        const snapshot = {}
        statsArray.forEach(s => { snapshot[s.interface] = { rx_bytes: s.rx_bytes, tx_bytes: s.tx_bytes } })
        lastStats.value = snapshot
        lastFetchTime.value = now
      }
    }

    if (selectedInterface.value) {
      const history = await networkStore.fetchTrafficHistory(selectedInterface.value, { minutes: 60 }, opts)
      trafficHistory.value = history?.history || networkStore.trafficHistory || []
    }
  } catch (e) {
    // Traffic fetch failed silently
  }
}

// ─── Computed ────────────────────────────────────────────────
const normalizedHistory = computed(() => {
  const history = trafficHistory.value
  if (!history.length) return []

  const maxPoints = 60
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  const sampled = history.filter((_, i) => i % step === 0).slice(-maxPoints)

  const maxRate = Math.max(
    ...sampled.map(p => p.rx_rate_bps || 0),
    ...sampled.map(p => p.tx_rate_bps || 0),
    1
  )

  return sampled.map(point => ({
    ...point,
    rxHeight: Math.max(2, ((point.rx_rate_bps || 0) / maxRate) * 100),
    txHeight: Math.max(2, ((point.tx_rate_bps || 0) / maxRate) * 100)
  }))
})

const maxRxRate = computed(() =>
  Math.max(...trafficHistory.value.map(p => p.rx_rate_bps || 0), 0)
)
const maxTxRate = computed(() =>
  Math.max(...trafficHistory.value.map(p => p.tx_rate_bps || 0), 0)
)
const avgRxRate = computed(() => {
  const rates = trafficHistory.value.map(p => p.rx_rate_bps || 0).filter(r => r > 0)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
})
const avgTxRate = computed(() => {
  const rates = trafficHistory.value.map(p => p.tx_rate_bps || 0).filter(r => r > 0)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
})

// ─── Helpers ─────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(1)} ${units[i]}`
}

function formatRate(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let rate = bytesPerSec
  while (rate >= 1024 && i < units.length - 1) {
    rate /= 1024
    i++
  }
  return `${rate.toFixed(1)} ${units[i]}`
}

// ─── Polling ─────────────────────────────────────────────────
let trafficInterval = null

onMounted(() => {
  fetchTraffic()
  trafficInterval = setInterval(fetchTraffic, 5000)
})

onUnmounted(() => {
  if (trafficInterval) {
    clearInterval(trafficInterval)
    trafficInterval = null
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Interface Selector -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
      <div class="flex flex-wrap items-center gap-4">
        <label class="text-sm font-medium text-theme-secondary">Interface:</label>
        <select
          v-model="selectedInterface"
          @change="fetchTraffic"
          class="px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary"
          aria-label="Select network interface"
        >
          <option v-for="iface in physicalInterfaces" :key="iface.name" :value="iface.name">
            {{ iface.name }} ({{ iface.state || (iface.is_up === true ? 'up' : iface.is_up === false ? 'down' : 'unknown') }})
          </option>
        </select>
        <button
          @click="fetchTraffic"
          class="px-3 py-2 bg-theme-tertiary rounded-lg hover:bg-theme-tertiary text-sm"
          aria-label="Refresh traffic data"
        >Refresh</button>
      </div>
    </div>

    <!-- Current Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-success-muted flex items-center justify-center">
            <Icon name="ArrowDown" :size="20" class="text-success" />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Download</h3>
            <p class="text-sm text-theme-muted">Incoming traffic</p>
          </div>
        </div>
        <div class="text-3xl font-bold text-theme-primary">
          {{ formatBytes(currentStats?.rx_bytes || 0) }}
        </div>
        <div v-if="currentStats?.rx_rate_bps" class="text-sm text-success mt-1">
          {{ formatRate(currentStats.rx_rate_bps) }}/s
        </div>
      </div>

      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
            <Icon name="ArrowUp" :size="20" class="text-accent" />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Upload</h3>
            <p class="text-sm text-theme-muted">Outgoing traffic</p>
          </div>
        </div>
        <div class="text-3xl font-bold text-theme-primary">
          {{ formatBytes(currentStats?.tx_bytes || 0) }}
        </div>
        <div v-if="currentStats?.tx_rate_bps" class="text-sm text-accent mt-1">
          {{ formatRate(currentStats.tx_rate_bps) }}/s
        </div>
      </div>
    </div>

    <!-- Traffic History Chart -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
      <h3 class="font-semibold text-theme-primary mb-4">Traffic History (Last 60 minutes)</h3>

      <div v-if="trafficHistory.length > 0" class="space-y-4">
        <div class="h-48 flex items-end gap-0.5" role="img" aria-label="Traffic history bar chart showing download and upload rates over the last 60 minutes">
          <div
            v-for="(point, idx) in normalizedHistory"
            :key="idx"
            class="flex-1 flex flex-col justify-end gap-0.5"
            :title="`RX: ${formatRate(point.rx_rate_bps)}/s, TX: ${formatRate(point.tx_rate_bps)}/s`"
          >
            <div
              class="bg-success rounded-t transition-all"
              :style="{ height: `${point.rxHeight}%` }"
            ></div>
            <div
              class="bg-accent rounded-t transition-all"
              :style="{ height: `${point.txHeight}%` }"
            ></div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-6 text-sm">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-success rounded"></span>
            <span class="text-theme-tertiary">Download</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 bg-accent rounded"></span>
            <span class="text-theme-tertiary">Upload</span>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-theme-primary text-sm">
          <div>
            <p class="text-theme-muted">Max Download</p>
            <p class="font-medium text-theme-primary">{{ formatRate(maxRxRate) }}/s</p>
          </div>
          <div>
            <p class="text-theme-muted">Max Upload</p>
            <p class="font-medium text-theme-primary">{{ formatRate(maxTxRate) }}/s</p>
          </div>
          <div>
            <p class="text-theme-muted">Avg Download</p>
            <p class="font-medium text-theme-primary">{{ formatRate(avgRxRate) }}/s</p>
          </div>
          <div>
            <p class="text-theme-muted">Avg Upload</p>
            <p class="font-medium text-theme-primary">{{ formatRate(avgTxRate) }}/s</p>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-theme-muted">
        <Icon name="BarChart3" :size="48" class="mx-auto text-theme-muted mb-4" />
        <p>No traffic history available yet</p>
        <p class="text-sm mt-1">Data collection starts when the page loads</p>
      </div>
    </div>
  </div>
</template>
