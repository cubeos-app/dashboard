<script setup>
/**
 * DeviceHealth.vue
 *
 * Sprint 3 G2: Reusable component for displaying S.M.A.R.T. health data
 * for a specific storage device. Fetches data from HAL storage endpoint.
 *
 * Props:
 *   - device: String (device path, e.g. '/dev/sda')
 *   - inline: Boolean (compact mode for embedding in device rows)
 *
 * Stores used:
 *   - useStorageHalStore → fetchDeviceSMART(device)
 *   - useStorageStore → fetchDeviceHealth(device)
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useStorageStore } from '@/stores/storage'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const props = defineProps({
  device: {
    type: String,
    required: true
  },
  inline: {
    type: Boolean,
    default: false
  }
})

const storageHalStore = useStorageHalStore()
const storageStore = useStorageStore()

const loading = ref(false)
const error = ref(null)
const smartData = ref(null)
const healthData = ref(null)

// Fetch SMART + health data
// In inline mode, skip the SMART call to avoid N+1 API storm
// (2 calls × N devices when rendered in a list)
async function fetchHealth() {
  if (!props.device) return
  loading.value = true
  error.value = null
  try {
    if (props.inline) {
      // Inline mode: single lightweight call only
      healthData.value = await storageStore.fetchDeviceHealth(props.device)
    } else {
      // Full mode: parallel fetch of both datasets
      const [smart, health] = await Promise.all([
        storageHalStore.fetchDeviceSMART(props.device),
        storageStore.fetchDeviceHealth(props.device)
      ])
      smartData.value = smart
      healthData.value = health
    }
  } catch (e) {
    error.value = e.message || 'Failed to fetch health data'
  } finally {
    loading.value = false
  }
}

// Re-fetch when device changes
watch(() => props.device, () => {
  fetchHealth()
})

onMounted(fetchHealth)

// Overall health status
const overallHealth = computed(() => {
  if (smartData.value?.health) return smartData.value.health
  if (healthData.value?.health) return healthData.value.health
  if (healthData.value?.status) return healthData.value.status
  return null
})

// Key metrics extracted from SMART
const temperature = computed(() => {
  return smartData.value?.temperature
    || findAttrRaw('Temperature_Celsius')
    || findAttrRaw('Airflow_Temperature_Cel')
    || null
})

const powerOnHours = computed(() => {
  return smartData.value?.power_on_hours
    || findAttrRaw('Power_On_Hours')
    || null
})

const powerCycles = computed(() => {
  return smartData.value?.power_cycles
    || findAttrRaw('Power_Cycle_Count')
    || null
})

const reallocatedSectors = computed(() => {
  return findAttrRaw('Reallocated_Sector_Ct') || 0
})

const attributes = computed(() => {
  return smartData.value?.attributes || healthData.value?.attributes || []
})

const warnings = computed(() => {
  const w = []
  if (smartData.value?.warnings) return smartData.value.warnings
  if (healthData.value?.warnings) return healthData.value.warnings
  // Derive warnings from attributes
  for (const attr of attributes.value) {
    if (attr.failing || (attr.value > 0 && attr.threshold > 0 && attr.value <= attr.threshold)) {
      w.push(`${attr.name}: value ${attr.value} at or below threshold ${attr.threshold}`)
    }
  }
  if (reallocatedSectors.value > 0) {
    w.push(`${reallocatedSectors.value} reallocated sectors detected`)
  }
  return w
})

// Helper: find raw value from attributes by name
function findAttrRaw(name) {
  const attr = attributes.value.find(a => a.name === name || a.attribute === name)
  if (!attr) return null
  return attr.raw_value ?? attr.raw ?? attr.value ?? null
}

// Status color helpers
function healthStatusClass(status) {
  if (!status) return 'text-theme-muted'
  const s = String(status).toUpperCase()
  if (s === 'PASSED' || s === 'OK' || s === 'HEALTHY') return 'text-success'
  if (s === 'FAILED' || s === 'FAILING') return 'text-error'
  return 'text-warning'
}

function healthBgClass(status) {
  if (!status) return 'bg-theme-tertiary'
  const s = String(status).toUpperCase()
  if (s === 'PASSED' || s === 'OK' || s === 'HEALTHY') return 'bg-success-muted'
  if (s === 'FAILED' || s === 'FAILING') return 'bg-error-muted'
  return 'bg-warning-muted'
}

function healthIcon(status) {
  if (!status) return 'HelpCircle'
  const s = String(status).toUpperCase()
  if (s === 'PASSED' || s === 'OK' || s === 'HEALTHY') return 'CheckCircle'
  if (s === 'FAILED' || s === 'FAILING') return 'XCircle'
  return 'AlertCircle'
}

function attrStatusClass(attr) {
  if (attr.failing) return 'bg-error-muted'
  if (attr.value > 0 && attr.threshold > 0 && attr.value <= attr.threshold + 10) return 'bg-warning-muted'
  return ''
}

function attrValueClass(attr) {
  if (attr.failing || (attr.value > 0 && attr.threshold > 0 && attr.value <= attr.threshold)) return 'text-error'
  if (attr.value > 0 && attr.threshold > 0 && attr.value <= attr.threshold + 10) return 'text-warning'
  return 'text-theme-secondary'
}

function formatHours(hours) {
  if (!hours && hours !== 0) return '-'
  const h = Number(hours)
  if (isNaN(h)) return String(hours)
  const days = Math.floor(h / 24)
  const years = Math.floor(days / 365)
  if (years > 0) return `${years}y ${days % 365}d`
  if (days > 0) return `${days}d ${h % 24}h`
  return `${h}h`
}

function formatTemp(temp) {
  if (!temp && temp !== 0) return '-'
  const t = Number(temp)
  if (isNaN(t)) return String(temp)
  return `${t}°C`
}

function tempClass(temp) {
  if (!temp) return 'text-theme-primary'
  const t = Number(temp)
  if (t > 60) return 'text-error'
  if (t > 50) return 'text-warning'
  return 'text-theme-primary'
}
</script>

<template>
  <!-- Inline (compact) mode for embedding in table rows -->
  <div v-if="inline" class="flex items-center gap-2">
    <template v-if="loading">
      <Icon name="Loader2" :size="14" class="animate-spin text-theme-muted" />
      <span class="text-xs text-theme-muted">Loading...</span>
    </template>
    <template v-else-if="overallHealth">
      <span :class="healthStatusClass(overallHealth)" class="text-xs font-semibold uppercase">
        {{ overallHealth }}
      </span>
      <span v-if="temperature" class="text-xs text-theme-muted" :class="tempClass(temperature)">
        {{ formatTemp(temperature) }}
      </span>
    </template>
    <template v-else>
      <span class="text-xs text-theme-muted">N/A</span>
    </template>
  </div>

  <!-- Full display mode -->
  <div v-else class="space-y-4">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading health data...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-error-muted border border-error rounded-lg p-4">
      <div class="flex items-center gap-2">
        <Icon name="AlertTriangle" :size="16" class="text-error" />
        <p class="text-sm text-error">{{ error }}</p>
      </div>
      <button @click="fetchHealth" class="mt-2 text-xs text-accent hover:underline" aria-label="Retry loading health data">Retry</button>
    </div>

    <!-- No data -->
    <div v-else-if="!smartData && !healthData" class="text-center py-8">
      <Icon name="HardDrive" :size="32" class="mx-auto text-theme-muted mb-3" />
      <p class="text-sm text-theme-muted">No S.M.A.R.T. data available for this device.</p>
      <p class="text-xs text-theme-muted mt-1">The device may not support S.M.A.R.T. monitoring.</p>
    </div>

    <!-- Health data -->
    <template v-else>
      <!-- Status badge + refresh -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="healthBgClass(overallHealth)">
            <Icon :name="healthIcon(overallHealth)" :size="20" :class="healthStatusClass(overallHealth)" />
          </div>
          <div>
            <p class="text-sm font-semibold text-theme-primary">S.M.A.R.T. Health</p>
            <p :class="healthStatusClass(overallHealth)" class="text-sm font-bold uppercase">
              {{ overallHealth || 'Unknown' }}
            </p>
          </div>
        </div>
        <button
          @click="fetchHealth"
          :disabled="loading"
          class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
          title="Refresh health data"
          aria-label="Refresh health data"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': loading }" />
        </button>
      </div>

      <!-- Key metrics cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Temperature</p>
          <p class="font-semibold" :class="tempClass(temperature)">{{ formatTemp(temperature) }}</p>
        </div>
        <div class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Power On Time</p>
          <p class="font-semibold text-theme-primary">{{ formatHours(powerOnHours) }}</p>
        </div>
        <div class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Power Cycles</p>
          <p class="font-semibold text-theme-primary">{{ powerCycles ?? '-' }}</p>
        </div>
        <div class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Reallocated Sectors</p>
          <p class="font-semibold" :class="reallocatedSectors > 0 ? 'text-warning' : 'text-theme-primary'">
            {{ reallocatedSectors }}
          </p>
        </div>
      </div>

      <!-- Warnings -->
      <div v-if="warnings.length > 0" class="space-y-2">
        <div
          v-for="(warning, idx) in warnings"
          :key="idx"
          class="flex items-center gap-2 p-3 bg-warning-muted border border-warning rounded-lg"
        >
          <Icon name="AlertTriangle" :size="16" class="text-warning flex-shrink-0" />
          <p class="text-sm text-warning">{{ warning }}</p>
        </div>
      </div>

      <!-- SMART attributes table -->
      <div v-if="attributes.length > 0">
        <details class="group">
          <summary class="cursor-pointer text-sm text-theme-muted hover:text-theme-primary flex items-center gap-1" aria-label="Show S.M.A.R.T. attributes">
            <Icon name="ChevronRight" :size="14" class="transform group-open:rotate-90 transition-transform" />
            Show {{ attributes.length }} S.M.A.R.T. attributes
          </summary>

          <div class="mt-3">
            <ResponsiveTable
              :columns="[
                { key: 'id', label: 'ID' },
                { key: 'name', label: 'Attribute' },
                { key: 'value', label: 'Value' },
                { key: 'worst', label: 'Worst' },
                { key: 'threshold', label: 'Thresh' },
                { key: 'raw_value', label: 'Raw' },
                { key: 'status', label: 'Status' }
              ]"
              :rows="attributes"
              row-key="id"
              :row-class="(row) => attrStatusClass(row)"
              compact
            >
              <template #cell-id="{ row }">
                <span class="text-theme-muted">{{ row.id }}</span>
              </template>
              <template #cell-name="{ row }">
                <span class="text-theme-primary">{{ row.name || row.attribute }}</span>
              </template>
              <template #cell-value="{ row }">
                <span :class="attrValueClass(row)">{{ row.value }}</span>
              </template>
              <template #cell-worst="{ row }">
                <span class="text-theme-muted">{{ row.worst }}</span>
              </template>
              <template #cell-threshold="{ row }">
                <span class="text-theme-muted">{{ row.threshold }}</span>
              </template>
              <template #cell-raw_value="{ row }">
                <span class="text-theme-muted font-mono">{{ row.raw_value ?? row.raw ?? '-' }}</span>
              </template>
              <template #cell-status="{ row }">
                <span
                  v-if="row.failing"
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-error-muted text-error"
                >FAIL</span>
                <span
                  v-else-if="row.value > 0 && row.threshold > 0 && row.value <= row.threshold + 10"
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-warning-muted text-warning"
                >WARN</span>
                <span
                  v-else
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-success-muted text-success"
                >OK</span>
              </template>
            </ResponsiveTable>
          </div>
        </details>
      </div>
    </template>
  </div>
</template>
