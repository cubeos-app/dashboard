<script setup>
/**
 * I2CPanel.vue
 *
 * Sprint 7 Group 3: I2C bus scanner and device reader.
 * Lists available I2C buses, scans for connected devices, and reads
 * device register data. Includes a known-device lookup table for
 * friendly names (BME280, DS3231, etc.).
 *
 * Lazy-loaded by HardwareView via defineAsyncComponent.
 * Store: useHardwareStore — fetchI2CBuses, scanI2CBus, readI2CDevice
 */
import { ref, computed, onMounted } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const hardwareStore = useHardwareStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const error = ref(null)
const scanLoading = ref({})      // { [busId]: boolean }
const scanResults = ref({})      // { [busId]: device[] }
const selectedDevice = ref(null) // { bus, addr, data, loading }
const deviceLoading = ref(false)
const deviceData = ref(null)

// ==========================================
// Known I2C device addresses
// ==========================================

const knownDevices = {
  '0x20': 'PCF8574 GPIO Expander',
  '0x27': 'LCD Display',
  '0x36': 'MAX17040 Fuel Gauge',
  '0x40': 'INA219 Power Monitor',
  '0x41': 'INA219 (alt addr)',
  '0x48': 'TMP102 / ADS1115',
  '0x50': 'AT24C32 EEPROM',
  '0x57': 'MAX30102 Pulse Oximeter',
  '0x68': 'DS3231 RTC / MPU6050',
  '0x69': 'MPU6050 (alt addr)',
  '0x76': 'BME280 / BMP280',
  '0x77': 'BME280 / BMP280 (alt)'
}

// ==========================================
// Data
// ==========================================

const buses = computed(() => {
  const data = hardwareStore.i2cBuses
  if (!data) return []
  return Array.isArray(data) ? data : (data.buses || [])
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    await hardwareStore.fetchI2CBuses({ signal: signal() })
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
})

// ==========================================
// Actions
// ==========================================

async function scanBus(bus) {
  const busId = bus.bus ?? bus.id ?? bus.number ?? bus
  scanLoading.value = { ...scanLoading.value, [busId]: true }
  try {
    const result = await hardwareStore.scanI2CBus(busId, { signal: signal() })
    if (result) {
      const devices = Array.isArray(result) ? result : (result.devices || [])
      scanResults.value = { ...scanResults.value, [busId]: devices }
    }
  } catch {
    // Store sets error
  } finally {
    scanLoading.value = { ...scanLoading.value, [busId]: false }
  }
}

async function readDevice(busId, addr) {
  selectedDevice.value = { bus: busId, addr }
  deviceLoading.value = true
  deviceData.value = null
  try {
    const result = await hardwareStore.readI2CDevice(busId, addr)
    deviceData.value = result
  } catch {
    // Store sets error
  } finally {
    deviceLoading.value = false
  }
}

function closeDeviceDetail() {
  selectedDevice.value = null
  deviceData.value = null
}

// ==========================================
// Helpers
// ==========================================

function busLabel(bus) {
  if (bus.path) return bus.path
  const id = bus.bus ?? bus.id ?? bus.number ?? bus
  return `i2c-${id}`
}

function busId(bus) {
  return bus.bus ?? bus.id ?? bus.number ?? bus
}

function deviceAddr(device) {
  const addr = device.address ?? device.addr ?? ''
  // Normalise to 0xNN format
  if (typeof addr === 'number') return `0x${addr.toString(16).padStart(2, '0')}`
  return String(addr)
}

function deviceName(device) {
  const addr = deviceAddr(device)
  return device.name || device.description || knownDevices[addr] || null
}

function formatDeviceData(data) {
  if (!data) return null
  // If it has a data/registers field, format as hex
  const raw = data.data || data.registers || data.bytes || data
  if (Array.isArray(raw)) {
    return raw.map(b => (typeof b === 'number' ? b.toString(16).padStart(2, '0') : b)).join(' ')
  }
  if (typeof raw === 'string') return raw
  return JSON.stringify(raw, null, 2)
}
</script>

<template>
  <div class="space-y-4">

    <!-- Loading -->
    <div v-if="loading" class="py-8">
      <SkeletonLoader variant="card" :count="2" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-start gap-3">
      <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5" />
      <div>
        <h3 class="text-sm font-medium text-error">Failed to load I2C buses</h3>
        <p class="mt-1 text-sm text-error">{{ error }}</p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!buses.length" class="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="Cable" :size="36" class="text-theme-muted mb-3" />
      <p class="text-sm text-theme-tertiary">No I2C buses detected</p>
      <p class="mt-1 text-xs text-theme-muted">Ensure I2C is enabled in boot configuration</p>
    </div>

    <!-- Bus list -->
    <template v-else>
      <div
        v-for="bus in buses"
        :key="busId(bus)"
        class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden"
      >
        <!-- Bus header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center gap-3">
            <Icon name="Cable" :size="18" class="text-accent" />
            <div>
              <span class="text-sm font-medium font-mono text-theme-primary">{{ busLabel(bus) }}</span>
              <span v-if="scanResults[busId(bus)]" class="ml-2 text-xs text-theme-secondary">
                {{ scanResults[busId(bus)].length }} device{{ scanResults[busId(bus)].length !== 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <button
            @click="scanBus(bus)"
            :disabled="scanLoading[busId(bus)]"
            :aria-label="'Scan ' + busLabel(bus)"
            class="px-4 py-1.5 text-xs font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            <Icon v-if="scanLoading[busId(bus)]" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
            <Icon v-else name="Search" :size="12" class="inline-block mr-1" />
            Scan
          </button>
        </div>

        <!-- Scan results -->
        <div v-if="scanLoading[busId(bus)]" class="px-5 py-6">
          <div class="flex items-center gap-2 text-sm text-theme-secondary">
            <Icon name="Loader2" :size="14" class="animate-spin" />
            <span>Scanning bus for devices...</span>
          </div>
        </div>

        <div v-else-if="scanResults[busId(bus)]">
          <!-- No devices found -->
          <div v-if="!scanResults[busId(bus)].length" class="px-5 py-6 text-center">
            <p class="text-sm text-theme-muted">No devices found on this bus</p>
          </div>

          <!-- Device table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-theme-primary">
                  <th class="px-5 py-2.5 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Address</th>
                  <th class="px-5 py-2.5 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Device</th>
                  <th class="px-5 py-2.5 text-right text-xs font-medium text-theme-secondary uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-theme-primary">
                <tr
                  v-for="device in scanResults[busId(bus)]"
                  :key="deviceAddr(device)"
                  class="hover:bg-theme-tertiary transition-colors"
                >
                  <td class="px-5 py-3">
                    <span class="text-sm font-mono font-medium text-accent">{{ deviceAddr(device) }}</span>
                  </td>
                  <td class="px-5 py-3">
                    <span v-if="deviceName(device)" class="text-sm text-theme-primary">{{ deviceName(device) }}</span>
                    <span v-else class="text-sm text-theme-muted italic">Unknown device</span>
                  </td>
                  <td class="px-5 py-3 text-right">
                    <button
                      @click="readDevice(busId(bus), deviceAddr(device))"
                      :aria-label="'Read device at ' + deviceAddr(device)"
                      class="px-3 py-1 text-xs font-medium rounded-lg bg-neutral-muted text-theme-secondary hover:bg-theme-tertiary transition-colors"
                    >
                      Read
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Hint when no scan done yet -->
        <div v-else class="px-5 py-6 text-center">
          <p class="text-sm text-theme-muted">Click Scan to discover connected devices</p>
        </div>
      </div>
    </template>

    <!-- Device detail overlay -->
    <div v-if="selectedDevice" class="bg-theme-card border border-theme-primary rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Icon name="Cpu" :size="18" class="text-accent" />
          <h3 class="text-sm font-semibold text-theme-primary">
            Device {{ selectedDevice.addr }}
            <span v-if="knownDevices[selectedDevice.addr]" class="font-normal text-theme-secondary">
              — {{ knownDevices[selectedDevice.addr] }}
            </span>
          </h3>
        </div>
        <button
          @click="closeDeviceDetail"
          class="p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          aria-label="Close device detail"
        >
          <Icon name="X" :size="16" />
        </button>
      </div>

      <div v-if="deviceLoading" class="flex items-center gap-2 text-sm text-theme-secondary py-4">
        <Icon name="Loader2" :size="14" class="animate-spin" />
        <span>Reading device registers...</span>
      </div>

      <div v-else-if="deviceData" class="bg-code rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto">
        <pre class="text-xs text-code font-mono whitespace-pre leading-relaxed">{{ formatDeviceData(deviceData) }}</pre>
      </div>

      <p v-else class="text-sm text-theme-muted py-4">No data returned from device</p>
    </div>

    <!-- Store error -->
    <div v-if="hardwareStore.error && !error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <span class="text-sm text-error">{{ hardwareStore.error }}</span>
    </div>
  </div>
</template>
