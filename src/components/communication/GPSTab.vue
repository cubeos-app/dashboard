<script setup>
/**
 * GPSTab.vue
 *
 * Sprint 8 Group 3: GPS device management panel.
 * Displays GPS device selector, fix status card (type/satellites/HDOP),
 * position display (monospace lat/lon/alt), and auto-refresh toggle.
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore — fetchGPSDevices, fetchGPSStatus, fetchGPSPosition
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useMode } from '@/composables/useMode'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()
const { isAdvanced } = useMode()

const loading = ref(true)
const selectedPort = ref(null)
const autoRefresh = ref(false)
let autoRefreshTimer = null

// ==========================================
// Computed — device list
// ==========================================

const deviceList = computed(() => {
  const raw = communicationStore.gpsDevices
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
  return list.map(d => ({
    port: d.port ?? d.device ?? d.path ?? d.id ?? 'unknown',
    name: d.name ?? d.label ?? d.model ?? d.port ?? 'GPS Device',
    _raw: d
  }))
})

/** Currently active device port */
const activePort = computed(() => {
  if (selectedPort.value) return selectedPort.value
  return deviceList.value.length > 0 ? deviceList.value[0].port : null
})

// ==========================================
// Computed — GPS status (fix, satellites)
// ==========================================

const status = computed(() => {
  const port = activePort.value
  if (!port) return null
  const s = communicationStore.gpsStatuses[port]
  if (!s) return null

  // Fix type: Swagger has `has_fix` (boolean) and `fix_quality` (string like "3D Fix")
  // Legacy: `fix`/`fix_type`/`mode` as numeric 1=NoFix, 2=2D, 3=3D
  const fixRaw = s.fix_quality ?? s.fix ?? s.fix_type ?? s.mode ?? null
  let fixType = 'No Fix'
  let fixValue = 0
  if (fixRaw !== null && fixRaw !== undefined) {
    const str = String(fixRaw).toLowerCase()
    if (str === '3d fix' || str === '3d') { fixType = '3D Fix'; fixValue = 3 }
    else if (str === '2d fix' || str === '2d') { fixType = '2D Fix'; fixValue = 2 }
    else {
      const n = Number(fixRaw)
      if (n === 3) { fixType = '3D Fix'; fixValue = 3 }
      else if (n === 2) { fixType = '2D Fix'; fixValue = 2 }
      else { fixType = 'No Fix'; fixValue = n }
    }
  } else if (typeof s.has_fix === 'boolean') {
    // Fallback: has_fix boolean without quality detail
    fixType = s.has_fix ? '2D Fix' : 'No Fix'
    fixValue = s.has_fix ? 2 : 0
  }

  const satsUsed = s.satellites_used ?? s.sats_used ?? s.satellites ?? s.sats ?? null
  const satsVisible = s.satellites_visible ?? s.sats_visible ?? s.satellites_in_view ?? null
  const hdop = s.hdop ?? s.horizontal_accuracy ?? null

  return { fixType, fixValue, satsUsed, satsVisible, hdop, _raw: s }
})

const fixBadge = computed(() => {
  if (!status.value) return { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  const map = {
    '3D Fix': { text: '3D Fix', bg: 'bg-success-muted', fg: 'text-success' },
    '2D Fix': { text: '2D Fix', bg: 'bg-warning-muted', fg: 'text-warning' },
    'No Fix': { text: 'No Fix', bg: 'bg-error-muted', fg: 'text-error' }
  }
  return map[status.value.fixType] || map['No Fix']
})

// ==========================================
// Computed — GPS position
// ==========================================

const position = computed(() => {
  const port = activePort.value
  if (!port) return null
  const p = communicationStore.gpsPositions[port]
  if (!p) return null

  return {
    lat: p.lat ?? p.latitude ?? null,
    lon: p.lon ?? p.lng ?? p.longitude ?? null,
    alt: p.alt ?? p.altitude ?? p.elevation ?? null,
    speed: p.speed ?? p.velocity ?? null,
    heading: p.heading ?? p.course ?? p.track ?? null,
    timestamp: p.timestamp ?? p.time ?? p.updated_at ?? null
  }
})

const hasPosition = computed(() => {
  return position.value && position.value.lat !== null && position.value.lon !== null
})

// ==========================================
// Format helpers
// ==========================================

function formatCoord(value, type) {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (isNaN(num)) return String(value)
  const dir = type === 'lat' ? (num >= 0 ? 'N' : 'S') : (num >= 0 ? 'E' : 'W')
  return `${Math.abs(num).toFixed(6)}° ${dir}`
}

function formatAlt(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)} m`
}

function formatSpeed(value) {
  if (value === null || value === undefined) return null
  return `${Number(value).toFixed(1)} m/s`
}

function formatHeading(value) {
  if (value === null || value === undefined) return null
  return `${Number(value).toFixed(1)}°`
}

function formatTimestamp(value) {
  if (!value) return null
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(value)
  }
}

// ==========================================
// Actions
// ==========================================

async function fetchDeviceData(port) {
  if (!port) return
  try {
    await Promise.all([
      communicationStore.fetchGPSStatus(port, { signal: signal() }),
      communicationStore.fetchGPSPosition(port, { signal: signal() })
    ])
  } catch {
    // Store sets error
  }
}

function selectDevice(port) {
  selectedPort.value = port
  fetchDeviceData(port)
}

// ==========================================
// Auto-refresh
// ==========================================

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    const port = activePort.value
    if (port) {
      communicationStore.fetchGPSPosition(port, { signal: signal() })
    }
  }, 2000)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

watch(activePort, () => {
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    await communicationStore.fetchGPSDevices({ signal: signal() })
    const port = activePort.value
    if (port) {
      await fetchDeviceData(port)
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !communicationStore.gpsDevices">
      <SkeletonLoader variant="card" :count="2" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Empty state — no GPS device detected -->
      <!-- ======================================== -->
      <div
        v-if="!deviceList.length"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="MapPin" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No GPS Device Detected</p>
        <p class="text-sm text-theme-muted">
          Connect a USB GPS receiver (e.g., u-blox) to enable position tracking and satellite info.
        </p>
      </div>

      <template v-else>
        <!-- ======================================== -->
        <!-- Device Selector (Advanced, multiple GPS) -->
        <!-- ======================================== -->
        <div
          v-if="isAdvanced && deviceList.length > 1"
          class="bg-theme-card border border-theme-primary rounded-xl p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <Icon name="MapPin" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">GPS Devices</h2>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent">
              {{ deviceList.length }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="device in deviceList"
              :key="device.port"
              @click="selectDevice(device.port)"
              :aria-label="'Select GPS device ' + device.name"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors border',
                activePort === device.port
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-theme-primary bg-theme-secondary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'
              ]"
            >
              <span>{{ device.name }}</span>
              <span class="ml-1.5 text-xs font-mono opacity-70">{{ device.port }}</span>
            </button>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Status Card — Fix Type, Satellites, HDOP -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  status?.fixValue >= 2 ? 'bg-success-muted' : 'bg-neutral-muted'
                ]"
              >
                <Icon
                  name="MapPin"
                  :size="20"
                  :class="status?.fixValue >= 2 ? 'text-success' : 'text-theme-muted'"
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-theme-primary">GPS Status</h2>
                  <span
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      fixBadge.bg,
                      fixBadge.fg
                    ]"
                  >
                    {{ fixBadge.text }}
                  </span>
                </div>
                <div class="flex items-center gap-4 mt-0.5 flex-wrap">
                  <span v-if="deviceList.length === 1" class="text-sm text-theme-secondary">
                    {{ deviceList[0].name }}
                  </span>
                  <span v-if="status?.satsUsed !== null" class="text-sm text-theme-muted">
                    <template v-if="status.satsVisible !== null">
                      {{ status.satsUsed }}/{{ status.satsVisible }} satellites
                    </template>
                    <template v-else>
                      {{ status.satsUsed }} satellites
                    </template>
                  </span>
                  <span v-if="status?.hdop !== null" class="text-sm text-theme-muted">
                    HDOP: {{ Number(status.hdop).toFixed(1) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Auto-refresh toggle (Advanced) -->
            <button
              v-if="isAdvanced"
              @click="toggleAutoRefresh"
              role="switch"
              :aria-checked="autoRefresh"
              aria-label="Toggle auto-refresh"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                autoRefresh
                  ? 'bg-accent text-on-accent hover:bg-accent-hover'
                  : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
              ]"
            >
              <Icon
                :name="autoRefresh ? 'Pause' : 'Play'"
                :size="14"
                class="inline-block mr-1.5"
              />
              {{ autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off' }}
            </button>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Position Display -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon name="Navigation" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Position</h2>
              </div>
              <span
                v-if="position?.timestamp"
                class="text-xs text-theme-muted"
              >
                {{ formatTimestamp(position.timestamp) }}
              </span>
            </div>
          </div>

          <!-- No position data -->
          <div v-if="!hasPosition" class="p-8 text-center">
            <Icon name="MapPinOff" :size="32" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-secondary">No Position Data</p>
            <p class="text-xs text-theme-muted mt-1">
              {{ status?.fixValue >= 1 ? 'Waiting for satellite fix — ensure clear sky view' : 'GPS device has no fix yet' }}
            </p>
          </div>

          <!-- Position data -->
          <div v-else class="p-5">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Latitude -->
              <div class="bg-theme-secondary rounded-lg p-4">
                <p class="text-xs text-theme-muted uppercase tracking-wider mb-1">Latitude</p>
                <p class="text-lg font-mono font-semibold text-theme-primary">
                  {{ formatCoord(position.lat, 'lat') }}
                </p>
              </div>

              <!-- Longitude -->
              <div class="bg-theme-secondary rounded-lg p-4">
                <p class="text-xs text-theme-muted uppercase tracking-wider mb-1">Longitude</p>
                <p class="text-lg font-mono font-semibold text-theme-primary">
                  {{ formatCoord(position.lon, 'lon') }}
                </p>
              </div>

              <!-- Altitude -->
              <div class="bg-theme-secondary rounded-lg p-4">
                <p class="text-xs text-theme-muted uppercase tracking-wider mb-1">Altitude</p>
                <p class="text-lg font-mono font-semibold text-theme-primary">
                  {{ formatAlt(position.alt) }}
                </p>
              </div>
            </div>

            <!-- Speed / Heading row (Advanced) -->
            <div
              v-if="isAdvanced && (formatSpeed(position.speed) || formatHeading(position.heading))"
              class="flex items-center gap-6 mt-4 pt-4 border-t border-theme-primary"
            >
              <div v-if="formatSpeed(position.speed)" class="flex items-center gap-2">
                <Icon name="Gauge" :size="14" class="text-theme-muted" />
                <span class="text-sm text-theme-secondary">Speed:</span>
                <span class="text-sm font-mono text-theme-primary">{{ formatSpeed(position.speed) }}</span>
              </div>
              <div v-if="formatHeading(position.heading)" class="flex items-center gap-2">
                <Icon name="Compass" :size="14" class="text-theme-muted" />
                <span class="text-sm text-theme-secondary">Heading:</span>
                <span class="text-sm font-mono text-theme-primary">{{ formatHeading(position.heading) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
