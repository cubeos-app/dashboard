<script setup>
/**
 * SensorsPanel.vue
 *
 * Sprint 7 Group 3: Sensor readings panel.
 * Displays BME280 temperature/humidity/pressure card (conditional on detection),
 * 1-Wire device list with individual reading capability, and auto-refresh toggle.
 *
 * Lazy-loaded by HardwareView via defineAsyncComponent.
 * Store: useHardwareStore — fetchSensors, fetchBME280, fetch1Wire, read1Wire
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const hardwareStore = useHardwareStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const error = ref(null)
const autoRefresh = ref(false)
const refreshTimer = ref(null)
const oneWireReadings = ref({})   // { [deviceId]: { value, loading, error } }

const AUTO_REFRESH_INTERVAL = 5000 // 5 seconds

// ==========================================
// Data
// ==========================================

const bme280 = computed(() => hardwareStore.bme280)

const bme280Available = computed(() => {
  const b = bme280.value
  if (!b) return false
  if (b.available === false) return false
  if (b.error) return false
  // If we got real data fields, it's available
  return b.temperature !== undefined || b.humidity !== undefined || b.pressure !== undefined
})

const oneWireDevices = computed(() => {
  const data = hardwareStore.oneWireDevices
  if (!data) return []
  return Array.isArray(data) ? data : (data.devices || [])
})

const sensorsSummary = computed(() => {
  const data = hardwareStore.sensors
  if (!data) return []
  return Array.isArray(data) ? data : (data.sensors || [])
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    await Promise.all([
      hardwareStore.fetchSensors({ signal: s }),
      hardwareStore.fetchBME280({ signal: s }),
      hardwareStore.fetch1Wire({ signal: s })
    ])
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }

  // Pause auto-refresh when tab is hidden, resume when visible
  visibilityHandler = () => {
    if (document.hidden) {
      if (autoRefresh.value) stopAutoRefresh()
    } else {
      if (autoRefresh.value) startAutoRefresh()
    }
  }
  document.addEventListener('visibilitychange', visibilityHandler)
})

let visibilityHandler = null

onUnmounted(() => {
  stopAutoRefresh()
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
  }
})

// ==========================================
// Auto-refresh
// ==========================================

watch(autoRefresh, (enabled) => {
  if (enabled) startAutoRefresh()
  else stopAutoRefresh()
})

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer.value = setInterval(async () => {
    try {
      const s = signal()
      await Promise.all([
        hardwareStore.fetchBME280({ signal: s }),
        hardwareStore.fetch1Wire({ signal: s })
      ])
    } catch {
      // Silently handle — next tick retries
    }
  }, AUTO_REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// ==========================================
// Actions
// ==========================================

async function refreshAll() {
  try {
    const s = signal()
    await Promise.all([
      hardwareStore.fetchSensors({ signal: s }),
      hardwareStore.fetchBME280({ signal: s }),
      hardwareStore.fetch1Wire({ signal: s })
    ])
  } catch {
    // Store sets error
  }
}

async function readOneWireDevice(device) {
  const id = device.id || device.device_id || device.address
  oneWireReadings.value = {
    ...oneWireReadings.value,
    [id]: { value: null, loading: true, error: null }
  }
  try {
    const result = await hardwareStore.read1Wire(id)
    oneWireReadings.value = {
      ...oneWireReadings.value,
      [id]: { value: result, loading: false, error: null }
    }
  } catch (e) {
    oneWireReadings.value = {
      ...oneWireReadings.value,
      [id]: { value: null, loading: false, error: e.message }
    }
  }
}

// ==========================================
// Helpers
// ==========================================

function tempColor(temp) {
  if (temp === null || temp === undefined) return 'text-theme-primary'
  if (temp > 40) return 'text-error'
  if (temp > 30) return 'text-warning'
  return 'text-theme-primary'
}

function humidityWidth(pct) {
  return Math.max(0, Math.min(100, pct ?? 0)) + '%'
}

function oneWireDeviceId(device) {
  return device.id || device.device_id || device.address || ''
}

function oneWireDeviceType(device) {
  return device.type || device.family || ''
}

function formatOneWireReading(reading) {
  if (!reading || !reading.value) return null
  const v = reading.value
  if (v.temperature !== undefined) return `${v.temperature}°C`
  if (v.value !== undefined) return String(v.value)
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}
</script>

<template>
  <div class="space-y-6">

    <!-- Loading -->
    <div v-if="loading" class="py-8">
      <SkeletonLoader variant="card" :count="2" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-start gap-3">
      <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5" />
      <div>
        <h3 class="text-sm font-medium text-error">Failed to load sensor data</h3>
        <p class="mt-1 text-sm text-error">{{ error }}</p>
      </div>
    </div>

    <template v-else>

      <!-- Controls bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Auto-refresh toggle -->
          <label class="flex items-center gap-2 cursor-pointer">
            <button
              @click="autoRefresh = !autoRefresh"
              :class="[
                'relative w-9 h-5 rounded-full transition-colors',
                autoRefresh ? 'bg-accent' : 'bg-neutral-muted'
              ]"
              role="switch"
              :aria-checked="autoRefresh"
              aria-label="Toggle auto-refresh"
            >
              <span
                :class="[
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow',
                  autoRefresh ? 'translate-x-4' : 'translate-x-0'
                ]"
              />
            </button>
            <span class="text-sm text-theme-secondary">Auto-refresh (5s)</span>
          </label>
        </div>

        <button
          @click="refreshAll"
          aria-label="Refresh sensor data"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-muted text-theme-secondary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="RefreshCw" :size="12" class="inline-block mr-1" />
          Refresh
        </button>
      </div>

      <!-- ======================================== -->
      <!-- BME280 Card -->
      <!-- ======================================== -->
      <div v-if="bme280Available" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Thermometer" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">BME280</h2>
          <span class="text-xs text-theme-muted ml-auto">Temp / Humidity / Pressure</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Temperature -->
          <div class="bg-theme-tertiary rounded-lg p-4 text-center">
            <p class="text-xs text-theme-secondary mb-1">Temperature</p>
            <p :class="['text-2xl font-bold', tempColor(bme280.temperature)]">
              {{ bme280.temperature !== undefined ? bme280.temperature.toFixed(1) : '--' }}<span class="text-sm font-normal text-theme-secondary">°C</span>
            </p>
          </div>

          <!-- Humidity -->
          <div class="bg-theme-tertiary rounded-lg p-4">
            <p class="text-xs text-theme-secondary mb-1 text-center">Humidity</p>
            <p class="text-2xl font-bold text-theme-primary text-center mb-2">
              {{ bme280.humidity !== undefined ? bme280.humidity.toFixed(1) : '--' }}<span class="text-sm font-normal text-theme-secondary">%</span>
            </p>
            <div class="w-full h-1.5 bg-theme-primary rounded-full overflow-hidden">
              <div
                class="h-full bg-accent rounded-full transition-all duration-500"
                :style="{ width: humidityWidth(bme280.humidity) }"
              />
            </div>
          </div>

          <!-- Pressure -->
          <div class="bg-theme-tertiary rounded-lg p-4 text-center">
            <p class="text-xs text-theme-secondary mb-1">Pressure</p>
            <p class="text-2xl font-bold text-theme-primary">
              {{ bme280.pressure !== undefined ? bme280.pressure.toFixed(0) : '--' }}<span class="text-sm font-normal text-theme-secondary"> hPa</span>
            </p>
          </div>
        </div>
      </div>

      <!-- BME280 not detected -->
      <div v-else-if="bme280 === null || (bme280 && bme280.available === false)" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="Thermometer" :size="18" class="text-theme-muted" />
          <h2 class="text-lg font-semibold text-theme-muted">BME280</h2>
        </div>
        <p class="text-sm text-theme-muted">No BME280 sensor detected</p>
      </div>

      <!-- ======================================== -->
      <!-- Detected Sensors Summary -->
      <!-- ======================================== -->
      <div v-if="sensorsSummary.length" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Activity" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Detected Sensors</h2>
          <span class="ml-auto text-xs text-theme-muted">{{ sensorsSummary.length }} sensor{{ sensorsSummary.length !== 1 ? 's' : '' }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="sensor in sensorsSummary"
            :key="sensor.id || sensor.name || sensor.type"
            class="flex items-center gap-3 p-3 bg-theme-tertiary rounded-lg"
          >
            <Icon name="Cpu" :size="16" class="text-theme-secondary shrink-0" />
            <div class="min-w-0">
              <p class="text-sm font-medium text-theme-primary truncate">{{ sensor.name || sensor.type || 'Unknown' }}</p>
              <p v-if="sensor.interface || sensor.bus" class="text-xs text-theme-muted">{{ sensor.interface || sensor.bus }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- 1-Wire Devices -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center gap-2">
            <Icon name="Unplug" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">1-Wire Devices</h2>
            <span v-if="oneWireDevices.length" class="ml-auto text-xs text-theme-muted">
              {{ oneWireDevices.length }} device{{ oneWireDevices.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>

        <!-- Empty -->
        <div v-if="!oneWireDevices.length" class="px-5 py-8 text-center">
          <Icon name="Unplug" :size="28" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">No 1-Wire devices found</p>
        </div>

        <!-- Device list -->
        <div v-else class="divide-y divide-theme-primary">
          <div
            v-for="device in oneWireDevices"
            :key="oneWireDeviceId(device)"
            class="px-5 py-3"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <!-- Device info -->
              <div class="flex items-center gap-3 min-w-0">
                <Icon name="Cpu" :size="16" class="text-theme-secondary shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-mono font-medium text-theme-primary truncate">{{ oneWireDeviceId(device) }}</p>
                  <p v-if="oneWireDeviceType(device)" class="text-xs text-theme-muted">{{ oneWireDeviceType(device) }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3 ml-7 sm:ml-0">
                <!-- Reading display -->
                <div v-if="oneWireReadings[oneWireDeviceId(device)]" class="text-right">
                  <span v-if="oneWireReadings[oneWireDeviceId(device)].loading" class="flex items-center gap-1 text-xs text-theme-secondary">
                    <Icon name="Loader2" :size="12" class="animate-spin" />
                    Reading...
                  </span>
                  <span v-else-if="oneWireReadings[oneWireDeviceId(device)].error" class="text-xs text-error">
                    {{ oneWireReadings[oneWireDeviceId(device)].error }}
                  </span>
                  <span v-else-if="formatOneWireReading(oneWireReadings[oneWireDeviceId(device)])" class="text-sm font-semibold text-accent">
                    {{ formatOneWireReading(oneWireReadings[oneWireDeviceId(device)]) }}
                  </span>
                </div>

                <!-- Read button -->
                <button
                  @click="readOneWireDevice(device)"
                  :disabled="oneWireReadings[oneWireDeviceId(device)]?.loading"
                  :aria-label="'Read device ' + oneWireDeviceId(device)"
                  class="px-3 py-1 text-xs font-medium rounded-lg bg-neutral-muted text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50 shrink-0"
                >
                  Read
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No sensors at all -->
      <div v-if="!bme280Available && !sensorsSummary.length && !oneWireDevices.length && !loading" class="flex flex-col items-center justify-center py-8 text-center">
        <Icon name="Thermometer" :size="36" class="text-theme-muted mb-3" />
        <p class="text-sm text-theme-tertiary">No sensors detected</p>
        <p class="mt-1 text-xs text-theme-muted">Connect I2C or 1-Wire sensors and refresh</p>
      </div>
    </template>

    <!-- Store error -->
    <div v-if="hardwareStore.error && !error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <span class="text-sm text-error">{{ hardwareStore.error }}</span>
    </div>
  </div>
</template>
