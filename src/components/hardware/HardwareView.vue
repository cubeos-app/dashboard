<script setup>
/**
 * HardwareView.vue
 *
 * Sprint 7 Group 2: Main hardware management page.
 * Tabbed layout with Overview, GPIO, I2C, Sensors, RTC/Watchdog, HAL Services.
 *
 * Overview + HAL Services tabs built here.
 * GPIO / I2C / Sensors panels lazy-loaded from G3.
 * RTC / Watchdog panels lazy-loaded from G4.
 *
 * Uses hardwareStore (G1) for HAL data and systemStore for existing
 * battery/eeprom/temperature to avoid duplication.
 */
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useSystemStore } from '@/stores/system'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

// Lazy tab panels — G3/G4 will create these files
const GPIOPanel = defineAsyncComponent(() => import('./GPIOPanel.vue'))
const I2CPanel = defineAsyncComponent(() => import('./I2CPanel.vue'))
const SensorsPanel = defineAsyncComponent(() => import('./SensorsPanel.vue'))
const RTCPanel = defineAsyncComponent(() => import('./RTCPanel.vue'))
const WatchdogPanel = defineAsyncComponent(() => import('./WatchdogPanel.vue'))

const hardwareStore = useHardwareStore()
const systemStore = useSystemStore()
const { signal } = useAbortOnUnmount()

// ==========================================
// Tabs
// ==========================================

const tabs = [
  { id: 'overview', name: 'Overview', icon: 'Monitor' },
  { id: 'gpio', name: 'GPIO', icon: 'ToggleRight' },
  { id: 'i2c', name: 'I2C', icon: 'Cable' },
  { id: 'sensors', name: 'Sensors', icon: 'Thermometer' },
  { id: 'rtc-watchdog', name: 'RTC / Watchdog', icon: 'Clock' },
  { id: 'services', name: 'HAL Services', icon: 'Server' }
]

const activeTab = ref('overview')
const refreshing = ref(false)
const bootConfigCopied = ref(false)
let bootConfigCopiedTimeout = null

// ==========================================
// Computed helpers
// ==========================================

/** Throttle: true if any flag is currently active */
const isThrottled = computed(() => {
  const t = hardwareStore.throttle
  if (!t) return false
  return t.under_voltage || t.arm_frequency_capped || t.currently_throttled || t.temperature_limit
})

/** Format uptime for header display */
const uptimeDisplay = computed(() => {
  const u = hardwareStore.uptime
  if (!u) return null
  if (u.uptime_human) return u.uptime_human
  if (u.uptime_seconds) {
    const s = u.uptime_seconds
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }
  return null
})

/** Battery bar color class */
const batteryColorClass = computed(() => {
  const pct = systemStore.batteryPercent
  if (pct === null) return 'bg-accent'
  if (pct > 60) return 'bg-success'
  if (pct >= 20) return 'bg-warning'
  return 'bg-error'
})

/** Charging state — read from hardwareStore (same source as write) to avoid stale UI */
const isCharging = computed(() => {
  // Prefer hardwareStore.powerStatus (where setCharging writes to)
  if (hardwareStore.powerStatus?.charging !== undefined) return hardwareStore.powerStatus.charging
  if (hardwareStore.ups?.charging !== undefined) return hardwareStore.ups.charging
  // Fallback to systemStore
  return systemStore.isCharging
})

/** Throttle flags as a structured list for rendering */
const throttleFlags = computed(() => {
  const t = hardwareStore.throttle
  if (!t) return []
  return [
    { key: 'under_voltage', label: 'Under-voltage', current: t.under_voltage, occurred: t.under_voltage_occurred ?? t.under_voltage },
    { key: 'arm_frequency_capped', label: 'Freq. capped', current: t.arm_frequency_capped, occurred: t.arm_frequency_capped_occurred ?? t.arm_frequency_capped },
    { key: 'currently_throttled', label: 'Throttled', current: t.currently_throttled, occurred: t.currently_throttled_occurred ?? t.currently_throttled },
    { key: 'temperature_limit', label: 'Temp. limit', current: t.temperature_limit, occurred: t.temperature_limit_occurred ?? t.temperature_limit }
  ]
})

/** Boot config text — could be string or object with content key */
const bootConfigText = computed(() => {
  const bc = hardwareStore.bootConfig
  if (!bc) return null
  if (typeof bc === 'string') return bc
  if (bc.content) return bc.content
  if (bc.config) return bc.config
  return JSON.stringify(bc, null, 2)
})

// ==========================================
// HAL Services
// ==========================================

const halServiceNames = ['cubeos-hal', 'hostapd', 'pihole', 'wireguard', 'openvpn']
const serviceActionLoading = ref({})

function serviceStatus(name) {
  const svc = hardwareStore.halServices[name]
  if (!svc) return 'unknown'
  const state = (svc.status || svc.state || svc.active_state || '').toLowerCase()
  if (state === 'running' || state === 'active') return 'running'
  if (state === 'stopped' || state === 'inactive' || state === 'dead') return 'stopped'
  if (state === 'failed' || state === 'error') return 'error'
  return state || 'unknown'
}

function serviceStatusBadge(name) {
  const status = serviceStatus(name)
  const map = {
    running: { text: 'Running', bg: 'bg-success-muted', fg: 'text-success' },
    stopped: { text: 'Stopped', bg: 'bg-neutral-muted', fg: 'text-theme-tertiary' },
    error: { text: 'Error', bg: 'bg-error-muted', fg: 'text-error' },
    unknown: { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  }
  return map[status] || map.unknown
}

async function handleServiceAction(name, action) {
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1)

  if (action === 'stop' || action === 'restart') {
    const ok = await confirm({
      title: `${actionLabel} ${name}`,
      message: `Are you sure you want to ${action} the ${name} service?`,
      confirmText: actionLabel,
      variant: action === 'stop' ? 'danger' : 'warning'
    })
    if (!ok) return
  }

  serviceActionLoading.value = { ...serviceActionLoading.value, [`${name}-${action}`]: true }
  try {
    if (action === 'start') await hardwareStore.startHALService(name)
    else if (action === 'stop') await hardwareStore.stopHALService(name)
    else if (action === 'restart') await hardwareStore.restartHALService(name)
  } catch {
    // Store sets error
  } finally {
    serviceActionLoading.value = { ...serviceActionLoading.value, [`${name}-${action}`]: false }
  }
}

// ==========================================
// Data loading
// ==========================================

async function loadOverviewData() {
  const s = signal()
  await Promise.all([
    hardwareStore.fetchOverview({ signal: s }),
    hardwareStore.fetchPower({ signal: s }),
    hardwareStore.fetchThrottle({ signal: s }),
    hardwareStore.fetchUptime({ signal: s }),
    hardwareStore.fetchBootConfig({ signal: s }),
    hardwareStore.fetchUPS({ signal: s }),
    hardwareStore.fetchPowerStatus({ signal: s }),
    hardwareStore.fetchPowerMonitorStatus({ signal: s }),
    hardwareStore.fetchUPSConfig({ signal: s }),
    hardwareStore.fetchTemperatureZones({ signal: s, skipLoading: true })
  ])
}

async function loadServicesData() {
  const opts = { signal: signal() }
  await Promise.all(halServiceNames.map(name => hardwareStore.fetchHALService(name, opts)))
}

async function refresh() {
  refreshing.value = true
  try {
    await loadOverviewData()
    if (activeTab.value === 'services') {
      await loadServicesData()
    }
  } finally {
    refreshing.value = false
  }
}

async function copyBootConfig() {
  const text = bootConfigText.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for non-HTTPS / older browsers
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  bootConfigCopied.value = true
  if (bootConfigCopiedTimeout) clearTimeout(bootConfigCopiedTimeout)
  bootConfigCopiedTimeout = setTimeout(() => { bootConfigCopied.value = false }, 2000)
}

async function handleToggleCharging() {
  const enabling = !isCharging.value
  if (!await confirm({
    title: enabling ? 'Enable Charging' : 'Disable Charging',
    message: enabling
      ? 'Enable battery charging? Make sure the correct power source is connected.'
      : 'Disable battery charging? The system will run on battery power only.',
    confirmText: enabling ? 'Enable' : 'Disable',
    variant: 'warning'
  })) return
  hardwareStore.setCharging(enabling)
}

async function handleBatteryQuickStart() {
  if (!await confirm({
    title: 'Battery Quick Start',
    message: 'Run battery quick start? This will briefly pulse the charging circuit to initialize the battery.',
    confirmText: 'Quick Start',
    variant: 'warning'
  })) return
  hardwareStore.batteryQuickStart()
}

const powerMonitorToggling = ref(false)

async function handleTogglePowerMonitor() {
  const isRunning = hardwareStore.powerMonitor?.running
  const action = isRunning ? 'Stop' : 'Start'

  if (isRunning && !await confirm({
    title: 'Stop Power Monitor',
    message: 'Stop the power monitoring daemon? UPS status will no longer be tracked.',
    confirmText: 'Stop',
    variant: 'warning'
  })) return

  powerMonitorToggling.value = true
  try {
    if (isRunning) {
      await hardwareStore.stopPowerMonitor()
    } else {
      await hardwareStore.startPowerMonitor()
    }
  } catch {
    // Store sets error
  } finally {
    powerMonitorToggling.value = false
  }
}

// ==========================================
// UPS Configuration (Batch 3)
// ==========================================

const upsModelNames = {
  x1202: 'Geekworm X1202',
  x728: 'Geekworm X728',
  pisugar3: 'PiSugar 3',
  none: 'None (disable monitoring)'
}

const upsModels = ['x1202', 'x728', 'pisugar3', 'none']
const selectedUPSModel = ref('')
const upsDetecting = ref(false)
const upsChanging = ref(false) // true when user clicked "Change UPS" — forces State A

/** True when UPS is configured and not "none" */
const upsIsActive = computed(() => {
  const cfg = hardwareStore.upsConfig
  return cfg?.configured && cfg?.configured_model && cfg.configured_model !== 'none'
})

/** True when UPS is explicitly configured as "none" */
const upsIsDisabled = computed(() => {
  const cfg = hardwareStore.upsConfig
  return cfg?.configured && cfg?.configured_model === 'none'
})

/** True when UPS has never been configured */
const upsNotConfigured = computed(() => {
  const cfg = hardwareStore.upsConfig
  return !cfg?.configured
})

/** Pi model mismatch warning */
const upsPiMismatchWarning = computed(() => {
  const det = hardwareStore.upsDetection
  if (!det || !selectedUPSModel.value || selectedUPSModel.value === 'none') return null
  // X1202 is designed for Pi 5, X728 for Pi 4/3
  const model = selectedUPSModel.value
  const pi = det.pi_model
  if (model === 'x1202' && pi && pi < 5) return `The Geekworm X1202 is designed for Raspberry Pi 5, but this device is a Pi ${pi}.`
  if (model === 'x728' && pi && pi >= 5) return `The Geekworm X728 is designed for Raspberry Pi 3/4, but this device is a Pi ${pi}.`
  return null
})

async function handleDetectUPS() {
  upsDetecting.value = true
  try {
    const result = await hardwareStore.detectUPSHAT()
    if (result?.suggested_model) {
      selectedUPSModel.value = result.suggested_model
    }
  } catch {
    // Store sets error
  } finally {
    upsDetecting.value = false
  }
}

async function handleApplyUPSConfig() {
  const model = selectedUPSModel.value
  if (!model) return

  const label = upsModelNames[model] || model
  const action = model === 'none' ? 'disable UPS monitoring' : `configure ${label} as your UPS`
  const warning = upsPiMismatchWarning.value

  if (!await confirm({
    title: model === 'none' ? 'Disable UPS Monitoring' : 'Configure UPS',
    message: `Are you sure you want to ${action}?`
      + (warning ? `\n\nWarning: ${warning}` : '')
      + (model !== 'none' ? '\n\nThe power monitoring driver will be activated immediately.' : ''),
    confirmText: model === 'none' ? 'Disable' : 'Apply',
    variant: model === 'none' ? 'danger' : 'warning'
  })) return

  try {
    await hardwareStore.setUPSConfig(model)
    upsChanging.value = false
    // Refresh battery/power data after config change
    const s = signal()
    await Promise.all([
      hardwareStore.fetchPower({ signal: s }),
      hardwareStore.fetchUPS({ signal: s }),
      hardwareStore.fetchPowerMonitorStatus({ signal: s })
    ])
  } catch {
    // Store sets error
  }
}

async function handleChangeUPS() {
  // Switch to config form (State A) with current model pre-selected
  selectedUPSModel.value = hardwareStore.upsConfig?.configured_model || ''
  upsChanging.value = true
  await handleDetectUPS()
}

// Track which tabs have been auto-loaded
const tabsLoaded = ref({ overview: true })

function onTabChange(tabId) {
  activeTab.value = tabId
  // Load tab data on first visit (lazy loading)
  if (!tabsLoaded.value[tabId]) {
    tabsLoaded.value[tabId] = true
    if (tabId === 'services') loadServicesData()
    // GPIO, I2C, Sensors, RTC/Watchdog panels fetch their own data
    // on mount, so just marking as loaded is sufficient
  }
}

onMounted(() => {
  loadOverviewData()
})

onUnmounted(() => {
  if (bootConfigCopiedTimeout) clearTimeout(bootConfigCopiedTimeout)
})
</script>

<template>
  <div class="min-h-screen bg-theme-primary">
    <!-- Header -->
    <div class="bg-theme-secondary border-b border-theme-primary">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-theme-primary">Hardware</h1>
              <!-- Throttle indicator dot -->
              <span
                v-if="hardwareStore.throttle"
                :class="[
                  'w-2.5 h-2.5 rounded-full',
                  isThrottled ? 'bg-error animate-pulse' : 'bg-success'
                ]"
                :title="isThrottled ? 'Throttling active' : 'No throttling'"
              />
            </div>
            <p class="mt-1 text-sm text-theme-secondary">
              <template v-if="systemStore.piModel">{{ systemStore.piModel }}</template>
              <template v-if="systemStore.piModel && uptimeDisplay"> · </template>
              <template v-if="uptimeDisplay">Up {{ uptimeDisplay }}</template>
              <template v-if="!systemStore.piModel && !uptimeDisplay">Hardware monitoring and management</template>
            </p>
          </div>

          <!-- Header actions -->
          <div class="flex items-center gap-3">
            <!-- Quick stats (desktop) -->
            <div v-if="systemStore.temperature !== null" class="hidden sm:flex items-center gap-2 text-sm text-theme-secondary">
              <Icon name="Thermometer" :size="14" />
              <span>{{ Number(systemStore.temperature).toFixed(1) }}°C</span>
            </div>
            <div v-if="systemStore.batteryPercent !== null" class="hidden sm:flex items-center gap-2 text-sm text-theme-secondary">
              <Icon name="Battery" :size="14" />
              <span>{{ systemStore.batteryPercent }}%</span>
            </div>

            <!-- Refresh -->
            <button
              @click="refresh"
              :disabled="refreshing"
              class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Refresh"
              aria-label="Refresh hardware data"
            >
              <Icon name="RefreshCw" :size="18" :class="{ 'animate-spin': refreshing }" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="border-b border-theme-primary overflow-x-auto">
        <nav class="-mb-px flex space-x-8" role="tablist" aria-label="Hardware tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="onTabChange(tab.id)"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-secondary hover:text-theme-primary hover:border-theme-tertiary',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
            ]"
          >
            <Icon :name="tab.icon" :size="16" />
            <span>{{ tab.name }}</span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      <!-- Global loading -->
      <div v-if="hardwareStore.loading && !hardwareStore.overview" class="py-8">
        <SkeletonLoader variant="stats" />
        <div class="mt-6">
          <SkeletonLoader variant="card" :count="2" />
        </div>
      </div>

      <!-- Global error -->
      <div v-else-if="hardwareStore.error && !hardwareStore.overview" class="bg-error-muted border border-error rounded-lg p-4">
        <div class="flex items-start gap-3">
          <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5" />
          <div>
            <h3 class="text-sm font-medium text-error">Error loading hardware data</h3>
            <p class="mt-1 text-sm text-error">{{ hardwareStore.error }}</p>
          </div>
        </div>
      </div>

      <template v-else>
        <!-- Error banner (visible even when data exists from previous load) -->
        <div v-if="hardwareStore.error && hardwareStore.overview" class="mb-4 bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
          <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5 shrink-0" />
          <span class="text-sm text-error">{{ hardwareStore.error }}</span>
        </div>
        <!-- ======================================== -->
        <!-- OVERVIEW TAB -->
        <!-- ======================================== -->
        <div v-if="activeTab === 'overview'" class="space-y-6">

          <!-- Hardware Overview Card -->
          <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
            <div class="flex items-center gap-2 mb-4">
              <Icon name="Cpu" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Hardware Overview</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Left column: Board info -->
              <div class="space-y-3">
                <div v-if="systemStore.piModel" class="flex justify-between">
                  <span class="text-sm text-theme-secondary">Model</span>
                  <span class="text-sm font-medium text-theme-primary">{{ systemStore.piModel }}</span>
                </div>
                <div v-if="systemStore.piSerial" class="flex justify-between">
                  <span class="text-sm text-theme-secondary">Serial</span>
                  <span class="text-sm font-mono text-theme-primary">{{ systemStore.piSerial }}</span>
                </div>
                <div v-if="systemStore.piRevision" class="flex justify-between">
                  <span class="text-sm text-theme-secondary">Revision</span>
                  <span class="text-sm font-mono text-theme-primary">{{ systemStore.piRevision }}</span>
                </div>
                <div v-if="systemStore.temperature !== null" class="flex justify-between">
                  <span class="text-sm text-theme-secondary">CPU Temp</span>
                  <span class="text-sm font-medium" :class="systemStore.temperature > 80 ? 'text-error' : systemStore.temperature > 65 ? 'text-warning' : 'text-theme-primary'">
                    {{ Number(systemStore.temperature).toFixed(1) }}°C
                  </span>
                </div>
              </div>

              <!-- Right column: HAL overview data -->
              <div class="space-y-3">
                <template v-if="hardwareStore.overview">
                  <div v-if="hardwareStore.overview.board" class="flex justify-between">
                    <span class="text-sm text-theme-secondary">Board</span>
                    <span class="text-sm font-medium text-theme-primary">{{ hardwareStore.overview.board }}</span>
                  </div>
                  <div v-if="hardwareStore.overview.soc" class="flex justify-between">
                    <span class="text-sm text-theme-secondary">SoC</span>
                    <span class="text-sm font-medium text-theme-primary">{{ hardwareStore.overview.soc }}</span>
                  </div>
                  <div v-if="hardwareStore.overview.memory" class="flex justify-between">
                    <span class="text-sm text-theme-secondary">Memory</span>
                    <span class="text-sm font-medium text-theme-primary">{{ hardwareStore.overview.memory }}</span>
                  </div>
                  <div v-if="hardwareStore.overview.firmware" class="flex justify-between">
                    <span class="text-sm text-theme-secondary">Firmware</span>
                    <span class="text-sm font-mono text-theme-primary truncate max-w-[200px]" :title="hardwareStore.overview.firmware">{{ hardwareStore.overview.firmware }}</span>
                  </div>
                </template>
                <div v-if="uptimeDisplay" class="flex justify-between">
                  <span class="text-sm text-theme-secondary">Uptime</span>
                  <span class="text-sm font-medium text-theme-primary">{{ uptimeDisplay }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Power / Battery Card -->
          <div v-if="hardwareStore.temperatureZones && hardwareStore.temperatureZones.length > 0" class="bg-theme-card border border-theme-primary rounded-xl p-5">
            <div class="flex items-center gap-2 mb-4">
              <Icon name="Thermometer" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Thermal Zones</h2>
            </div>
            <div class="space-y-3">
              <div v-for="zone in hardwareStore.temperatureZones" :key="zone.name || zone.type" class="flex items-center justify-between">
                <span class="text-sm text-theme-secondary">{{ zone.name || zone.type }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium" :class="zone.temp_c > 80 ? 'text-error' : zone.temp_c > 65 ? 'text-warning' : 'text-theme-primary'">
                    {{ zone.temp_c?.toFixed(1) || zone.temp_c }}°C
                  </span>
                  <span v-if="zone.critical_c" class="text-xs text-theme-muted">/ {{ zone.critical_c }}°C</span>
                </div>
              </div>
            </div>
          </div>

          <!-- UPS Configuration Card (Batch 3 — States A/B/C) -->
          <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
            <div class="flex items-center gap-2 mb-4">
              <Icon name="Zap" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">UPS / Power</h2>
              <!-- Config status badge -->
              <span
                v-if="hardwareStore.upsConfig"
                :class="[
                  'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
                  upsIsActive ? 'bg-success-muted text-success'
                    : upsIsDisabled ? 'bg-neutral-muted text-theme-tertiary'
                    : 'bg-warning-muted text-warning'
                ]"
              >
                {{ upsIsActive ? 'Active' : upsIsDisabled ? 'Disabled' : 'Not Configured' }}
              </span>
            </div>

            <!-- ──────────────── STATE A: Not Configured / Changing ──────────────── -->
            <div v-if="upsChanging || upsNotConfigured || (!upsIsActive && !upsIsDisabled)" class="space-y-4">
              <!-- Detection prompt -->
              <div class="bg-theme-tertiary rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <Icon name="AlertTriangle" :size="18" class="text-warning mt-0.5 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-theme-primary">
                      {{ upsChanging ? 'Change UPS configuration' : 'No UPS configured' }}
                    </p>
                    <p class="text-xs text-theme-secondary mt-1">
                      {{ upsChanging
                        ? 'Run detection or select a different model below.'
                        : 'CubeOS can monitor battery status if you have a supported UPS HAT. Run detection to identify your hardware, or select a model manually.' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Detect button -->
              <button
                @click="handleDetectUPS"
                :disabled="upsDetecting"
                class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
              >
                <Icon v-if="upsDetecting" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5 -mt-0.5" />
                <Icon v-else name="Search" :size="14" class="inline-block mr-1.5 -mt-0.5" />
                {{ upsDetecting ? 'Detecting...' : 'Detect UPS Hardware' }}
              </button>

              <!-- Detection results -->
              <div v-if="hardwareStore.upsDetection" class="space-y-3">
                <div class="bg-theme-tertiary rounded-lg p-4 space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-theme-secondary">Detected</span>
                    <span class="font-medium text-theme-primary">
                      {{ hardwareStore.upsDetection.suggested_name || 'Unknown' }}
                    </span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-theme-secondary">Confidence</span>
                    <span
                      :class="[
                        'font-medium',
                        hardwareStore.upsDetection.confidence === 'high' ? 'text-success' : 'text-warning'
                      ]"
                    >
                      {{ hardwareStore.upsDetection.confidence === 'high' ? 'High' : 'Low' }}
                    </span>
                  </div>
                  <div v-if="hardwareStore.upsDetection.pi_model" class="flex justify-between text-sm">
                    <span class="text-theme-secondary">Pi Model</span>
                    <span class="font-medium text-theme-primary">Pi {{ hardwareStore.upsDetection.pi_model }}</span>
                  </div>
                  <div v-if="hardwareStore.upsDetection.i2c_devices_found?.length" class="flex justify-between text-sm">
                    <span class="text-theme-secondary">I2C Devices</span>
                    <span class="font-mono text-xs text-theme-primary">{{ hardwareStore.upsDetection.i2c_devices_found.join(', ') }}</span>
                  </div>
                  <div v-if="hardwareStore.upsDetection.details" class="text-xs text-theme-muted pt-1 border-t border-theme-primary">
                    {{ hardwareStore.upsDetection.details }}
                  </div>
                </div>

                <!-- Low confidence warning -->
                <div
                  v-if="hardwareStore.upsDetection.confidence !== 'high' && hardwareStore.upsDetection.warning"
                  class="flex items-start gap-2 p-3 rounded-lg bg-warning-muted border border-warning-subtle"
                >
                  <Icon name="AlertTriangle" :size="14" class="text-warning mt-0.5 shrink-0" />
                  <span class="text-xs text-warning">{{ hardwareStore.upsDetection.warning }}</span>
                </div>
              </div>

              <!-- Model selector -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-theme-secondary">UPS Model</label>
                <select
                  v-model="selectedUPSModel"
                  class="w-full px-3 py-2 text-sm rounded-lg bg-theme-tertiary border border-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  <option value="" disabled>Select a model...</option>
                  <option v-for="m in upsModels" :key="m" :value="m">
                    {{ upsModelNames[m] || m }}
                  </option>
                </select>
              </div>

              <!-- Pi mismatch warning -->
              <div
                v-if="upsPiMismatchWarning"
                class="flex items-start gap-2 p-3 rounded-lg bg-warning-muted border border-warning-subtle"
              >
                <Icon name="AlertTriangle" :size="14" class="text-warning mt-0.5 shrink-0" />
                <span class="text-xs text-warning">{{ upsPiMismatchWarning }}</span>
              </div>

              <!-- Apply + Cancel buttons -->
              <div class="flex gap-3">
                <button
                  v-if="upsChanging"
                  @click="upsChanging = false"
                  class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleApplyUPSConfig"
                  :disabled="!selectedUPSModel || hardwareStore.upsConfiguring"
                  class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  :class="selectedUPSModel === 'none'
                    ? 'bg-theme-tertiary text-theme-secondary hover:bg-theme-secondary'
                    : 'bg-accent text-on-accent hover:bg-accent-hover'"
                >
                  <Icon v-if="hardwareStore.upsConfiguring" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5 -mt-0.5" />
                  {{ hardwareStore.upsConfiguring ? 'Applying...' : (selectedUPSModel === 'none' ? 'Disable Monitoring' : 'Apply Configuration') }}
                </button>
              </div>
            </div>

            <!-- ──────────────── STATE B: Configured + Active ──────────────── -->
            <div v-else-if="upsIsActive" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Left: Battery + status -->
                <div class="space-y-4">
                  <!-- Battery bar -->
                  <div v-if="systemStore.batteryPercent !== null">
                    <div class="flex justify-between text-sm mb-1.5">
                      <span class="text-theme-secondary">Battery</span>
                      <span class="font-medium text-theme-primary">{{ systemStore.batteryPercent }}%</span>
                    </div>
                    <div class="w-full h-2.5 bg-theme-tertiary rounded-full overflow-hidden">
                      <div
                        :class="['h-full rounded-full transition-all duration-500', batteryColorClass]"
                        :style="{ width: systemStore.batteryPercent + '%' }"
                      />
                    </div>
                  </div>

                  <!-- Charging toggle -->
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-theme-secondary">Charging</span>
                    <button
                      @click="handleToggleCharging()"
                      role="switch"
                      :aria-checked="isCharging"
                      aria-label="Toggle charging"
                      :class="[
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        isCharging ? 'bg-success' : 'bg-theme-tertiary'
                      ]"
                    >
                      <span
                        :class="[
                          'inline-block h-4 w-4 rounded-full bg-theme-primary transition-transform',
                          isCharging ? 'translate-x-6' : 'translate-x-1'
                        ]"
                      />
                    </button>
                  </div>

                  <!-- Quick start button -->
                  <button
                    @click="handleBatteryQuickStart()"
                    class="w-full px-3 py-2 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors"
                  >
                    <Icon name="Zap" :size="14" class="inline-block mr-1.5 -mt-0.5" />
                    Battery Quick Start
                  </button>
                </div>

                <!-- Right: Power info + monitor status -->
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-theme-secondary">UPS Model</span>
                    <span class="text-sm font-medium text-theme-primary">
                      {{ upsModelNames[hardwareStore.upsConfig?.configured_model] || hardwareStore.upsConfig?.configured_model }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-theme-secondary">Monitor</span>
                    <span
                      :class="[
                        'text-sm font-medium',
                        hardwareStore.upsConfig?.monitor_running ? 'text-success' : 'text-warning'
                      ]"
                    >
                      {{ hardwareStore.upsConfig?.monitor_running ? 'Running' : 'Stopped' }}
                    </span>
                  </div>
                  <template v-if="hardwareStore.power">
                    <div v-if="hardwareStore.power.ac_present !== undefined" class="flex justify-between">
                      <span class="text-sm text-theme-secondary">AC Present</span>
                      <span :class="['text-sm font-medium', hardwareStore.power.ac_present ? 'text-success' : 'text-warning']">
                        {{ hardwareStore.power.ac_present ? 'Yes' : 'No' }}
                      </span>
                    </div>
                    <div v-if="hardwareStore.power.voltage" class="flex justify-between">
                      <span class="text-sm text-theme-secondary">Voltage</span>
                      <span class="text-sm font-medium text-theme-primary">{{ hardwareStore.power.voltage }}V</span>
                    </div>
                  </template>
                  <template v-if="hardwareStore.powerStatus">
                    <div v-if="hardwareStore.powerStatus.source" class="flex justify-between">
                      <span class="text-sm text-theme-secondary">Source</span>
                      <span class="text-sm font-medium text-theme-primary">{{ hardwareStore.powerStatus.source }}</span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Power monitor toggle + Change UPS button -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-theme-primary">
                <div class="flex items-center justify-between flex-1">
                  <span class="text-sm text-theme-secondary">Power Monitoring</span>
                  <button
                    @click="handleTogglePowerMonitor"
                    :disabled="powerMonitorToggling"
                    role="switch"
                    :aria-checked="hardwareStore.powerMonitor?.running"
                    aria-label="Toggle power monitor"
                    :class="[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
                      hardwareStore.powerMonitor?.running ? 'bg-success' : 'bg-theme-tertiary'
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-4 w-4 rounded-full bg-theme-primary transition-transform',
                        hardwareStore.powerMonitor?.running ? 'translate-x-6' : 'translate-x-1'
                      ]"
                    />
                  </button>
                </div>
                <button
                  @click="handleChangeUPS"
                  :disabled="upsDetecting"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
                >
                  <Icon name="Settings2" :size="14" class="inline-block mr-1.5 -mt-0.5" />
                  Change UPS
                </button>
              </div>
            </div>

            <!-- ──────────────── STATE C: Configured as "none" ──────────────── -->
            <div v-else-if="upsIsDisabled" class="space-y-4">
              <div class="bg-theme-tertiary rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <Icon name="ShieldCheck" :size="18" class="text-theme-muted mt-0.5 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-theme-primary">UPS monitoring disabled</p>
                    <p class="text-xs text-theme-secondary mt-1">
                      Power monitoring is turned off. If you have installed a UPS HAT, you can re-detect and configure it below.
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  @click="handleChangeUPS"
                  :disabled="upsDetecting"
                  class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon v-if="upsDetecting" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5 -mt-0.5" />
                  <Icon v-else name="Search" :size="14" class="inline-block mr-1.5 -mt-0.5" />
                  Re-detect UPS
                </button>
              </div>
            </div>
          </div>

          <!-- Throttle Status -->
          <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
            <div class="flex items-center gap-2 mb-4">
              <Icon name="Gauge" :size="18" :class="isThrottled ? 'text-error' : 'text-accent'" />
              <h2 class="text-lg font-semibold text-theme-primary">Throttle Status</h2>
              <span
                v-if="hardwareStore.throttle"
                :class="[
                  'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
                  isThrottled ? 'bg-error-muted text-error' : 'bg-success-muted text-success'
                ]"
              >
                {{ isThrottled ? 'Throttling Active' : 'All Clear' }}
              </span>
            </div>

            <div v-if="throttleFlags.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="flag in throttleFlags"
                :key="flag.key"
                :class="[
                  'flex items-center justify-between p-3 rounded-lg border',
                  flag.current
                    ? 'bg-error-muted border-error-subtle'
                    : flag.occurred
                      ? 'bg-warning-muted border-warning-subtle'
                      : 'bg-theme-tertiary border-theme-primary'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      flag.current ? 'bg-error animate-pulse' : flag.occurred ? 'bg-warning' : 'bg-success'
                    ]"
                  />
                  <span class="text-sm font-medium text-theme-primary">{{ flag.label }}</span>
                </div>
                <span
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    flag.current
                      ? 'bg-error-muted text-error'
                      : flag.occurred
                        ? 'bg-warning-muted text-warning'
                        : 'bg-success-muted text-success'
                  ]"
                >
                  {{ flag.current ? 'Active' : flag.occurred ? 'Occurred' : 'OK' }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-theme-muted">No throttle data available</p>
          </div>

          <!-- Boot Config -->
          <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <Icon name="FileCode" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Boot Configuration</h2>
              </div>
              <button
                v-if="bootConfigText"
                @click="copyBootConfig"
                class="p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                :title="bootConfigCopied ? 'Copied!' : 'Copy to clipboard'"
                :aria-label="bootConfigCopied ? 'Boot configuration copied' : 'Copy boot configuration to clipboard'"
              >
                <Icon :name="bootConfigCopied ? 'Check' : 'Copy'" :size="16" :class="bootConfigCopied ? 'text-success' : ''" />
              </button>
            </div>

            <div v-if="bootConfigText" class="bg-code rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto">
              <pre class="text-xs text-code font-mono whitespace-pre leading-relaxed">{{ bootConfigText }}</pre>
            </div>
            <p v-else class="text-sm text-theme-muted">Boot configuration not available</p>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- GPIO TAB (G3) -->
        <!-- ======================================== -->
        <GPIOPanel v-else-if="activeTab === 'gpio'" />

        <!-- ======================================== -->
        <!-- I2C TAB (G3) -->
        <!-- ======================================== -->
        <I2CPanel v-else-if="activeTab === 'i2c'" />

        <!-- ======================================== -->
        <!-- SENSORS TAB (G3) -->
        <!-- ======================================== -->
        <SensorsPanel v-else-if="activeTab === 'sensors'" />

        <!-- ======================================== -->
        <!-- RTC / WATCHDOG TAB (G4) -->
        <!-- ======================================== -->
        <div v-else-if="activeTab === 'rtc-watchdog'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RTCPanel />
          <WatchdogPanel />
        </div>

        <!-- ======================================== -->
        <!-- HAL SERVICES TAB -->
        <!-- ======================================== -->
        <div v-else-if="activeTab === 'services'" class="space-y-4">
          <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
            <div class="px-5 py-4 border-b border-theme-primary">
              <div class="flex items-center gap-2">
                <Icon name="Server" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">HAL Services</h2>
              </div>
              <p class="mt-1 text-sm text-theme-secondary">Manage hardware abstraction layer services</p>
            </div>

            <!-- Service rows -->
            <div class="divide-y divide-theme-primary">
              <div
                v-for="name in halServiceNames"
                :key="name"
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
              >
                <!-- Service name + status -->
                <div class="flex items-center gap-3">
                  <Icon name="Box" :size="16" class="text-theme-secondary" />
                  <span class="text-sm font-medium font-mono text-theme-primary">{{ name }}</span>
                  <span
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      serviceStatusBadge(name).bg,
                      serviceStatusBadge(name).fg
                    ]"
                  >
                    {{ serviceStatusBadge(name).text }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 ml-7 sm:ml-0">
                  <button
                    v-if="serviceStatus(name) !== 'running'"
                    @click="handleServiceAction(name, 'start')"
                    :disabled="serviceActionLoading[`${name}-start`]"
                    :aria-label="'Start ' + name"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-success-muted text-success hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                  >
                    <Icon v-if="serviceActionLoading[`${name}-start`]" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
                    Start
                  </button>
                  <button
                    v-if="serviceStatus(name) === 'running'"
                    @click="handleServiceAction(name, 'stop')"
                    :disabled="serviceActionLoading[`${name}-stop`]"
                    :aria-label="'Stop ' + name"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                  >
                    <Icon v-if="serviceActionLoading[`${name}-stop`]" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
                    Stop
                  </button>
                  <button
                    @click="handleServiceAction(name, 'restart')"
                    :disabled="serviceActionLoading[`${name}-restart`]"
                    :aria-label="'Restart ' + name"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                  >
                    <Icon v-if="serviceActionLoading[`${name}-restart`]" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
                    Restart
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Store error display -->
          <div v-if="hardwareStore.error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
            <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
            <span class="text-sm text-error">{{ hardwareStore.error }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
