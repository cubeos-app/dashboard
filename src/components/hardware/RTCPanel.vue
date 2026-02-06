<script setup>
/**
 * RTCPanel.vue
 *
 * Sprint 7 Group 4: Real-Time Clock management panel.
 * Displays RTC status, current time, sync to system time,
 * and wake alarm set/clear controls.
 *
 * Lazy-loaded by HardwareView via defineAsyncComponent.
 * Renders side-by-side with WatchdogPanel in a lg:grid-cols-2 container.
 *
 * Store: useHardwareStore — fetchRTC, syncRTC, setWakeAlarm, clearWakeAlarm
 */
import { ref, computed, onMounted } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const hardwareStore = useHardwareStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const error = ref(null)
const syncLoading = ref(false)
const setAlarmLoading = ref(false)
const clearAlarmLoading = ref(false)

// Wake alarm input — local datetime string for <input type="datetime-local">
const wakeAlarmInput = ref('')

// ==========================================
// Data
// ==========================================

const rtcData = computed(() => hardwareStore.rtc)

const rtcDetected = computed(() => {
  if (!rtcData.value) return false
  if (rtcData.value.detected === false) return false
  return true
})

const rtcTime = computed(() => {
  if (!rtcData.value) return null
  return rtcData.value.time || rtcData.value.rtc_time || rtcData.value.datetime || null
})

const systemTime = computed(() => {
  if (!rtcData.value) return null
  return rtcData.value.system_time || rtcData.value.sys_time || null
})

const driftSeconds = computed(() => {
  if (!rtcData.value) return null
  if (rtcData.value.drift !== undefined) return rtcData.value.drift
  if (rtcData.value.drift_seconds !== undefined) return rtcData.value.drift_seconds
  return null
})

const wakeAlarm = computed(() => {
  if (!rtcData.value) return null
  return rtcData.value.wake_alarm || rtcData.value.alarm || null
})

const wakeAlarmEnabled = computed(() => {
  if (!wakeAlarm.value) return false
  if (typeof wakeAlarm.value === 'object') {
    return wakeAlarm.value.enabled === true || wakeAlarm.value.set === true
  }
  return !!wakeAlarm.value
})

const wakeAlarmTime = computed(() => {
  if (!wakeAlarm.value) return null
  if (typeof wakeAlarm.value === 'object') {
    return wakeAlarm.value.time || wakeAlarm.value.datetime || null
  }
  return wakeAlarm.value
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    await hardwareStore.fetchRTC({ signal: signal() })
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
})

// ==========================================
// Actions
// ==========================================

async function handleSync() {
  const ok = await confirm({
    title: 'Sync RTC',
    message: 'Synchronize the RTC clock to the current system time. This will overwrite the RTC time.',
    confirmText: 'Sync Now',
    variant: 'info'
  })
  if (!ok) return

  syncLoading.value = true
  try {
    await hardwareStore.syncRTC({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    syncLoading.value = false
  }
}

async function handleSetAlarm() {
  if (!wakeAlarmInput.value) return

  const dt = new Date(wakeAlarmInput.value)
  if (isNaN(dt.getTime())) return

  const ok = await confirm({
    title: 'Set Wake Alarm',
    message: `Set wake alarm for ${dt.toLocaleString()}? The system will power on at this time.`,
    confirmText: 'Set Alarm',
    variant: 'info'
  })
  if (!ok) return

  setAlarmLoading.value = true
  try {
    await hardwareStore.setWakeAlarm(dt.toISOString())
    wakeAlarmInput.value = ''
  } catch {
    // Store sets error
  } finally {
    setAlarmLoading.value = false
  }
}

async function handleClearAlarm() {
  const ok = await confirm({
    title: 'Clear Wake Alarm',
    message: 'Remove the scheduled wake alarm? The system will not auto-power on.',
    confirmText: 'Clear Alarm',
    variant: 'warning'
  })
  if (!ok) return

  clearAlarmLoading.value = true
  try {
    await hardwareStore.clearWakeAlarm()
  } catch {
    // Store sets error
  } finally {
    clearAlarmLoading.value = false
  }
}

// ==========================================
// Helpers
// ==========================================

function formatTime(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function formatDrift(seconds) {
  if (seconds === null || seconds === undefined) return null
  const abs = Math.abs(seconds)
  if (abs < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (abs < 60) return `${seconds.toFixed(1)}s`
  return `${(seconds / 60).toFixed(1)}min`
}
</script>

<template>
  <div class="bg-theme-card border border-theme-primary rounded-xl p-5 space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="Clock" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Real-Time Clock</h2>
      </div>
      <span
        v-if="!loading && rtcDetected"
        class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-muted text-success"
      >
        Detected
      </span>
      <span
        v-else-if="!loading && !error"
        class="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-muted text-theme-tertiary"
      >
        Not Detected
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-6">
      <SkeletonLoader variant="card" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <div>
        <h3 class="text-sm font-medium text-error">Failed to load RTC data</h3>
        <p class="mt-1 text-sm text-error">{{ error }}</p>
      </div>
    </div>

    <!-- Empty state (no RTC detected) -->
    <div v-else-if="!rtcDetected" class="flex flex-col items-center justify-center py-10 text-center">
      <Icon name="Clock" :size="36" class="text-theme-muted mb-3" />
      <p class="text-sm text-theme-tertiary">No RTC module detected</p>
      <p class="text-xs text-theme-muted mt-1">Connect a DS3231 or similar RTC to the I2C bus</p>
    </div>

    <!-- RTC Content -->
    <template v-else>

      <!-- Time display -->
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">RTC Time</span>
          <span class="text-sm font-medium font-mono text-theme-primary">{{ formatTime(rtcTime) }}</span>
        </div>
        <div v-if="systemTime" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">System Time</span>
          <span class="text-sm font-medium font-mono text-theme-primary">{{ formatTime(systemTime) }}</span>
        </div>
        <div v-if="driftSeconds !== null" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Drift</span>
          <span
            :class="[
              'text-sm font-medium font-mono',
              Math.abs(driftSeconds) > 5 ? 'text-warning' : 'text-success'
            ]"
          >
            {{ formatDrift(driftSeconds) }}
          </span>
        </div>
      </div>

      <!-- Sync button -->
      <button
        @click="handleSync"
        :disabled="syncLoading"
        class="w-full px-4 py-2 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
      >
        <Icon v-if="syncLoading" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5" />
        <Icon v-else name="RefreshCw" :size="14" class="inline-block mr-1.5" />
        Sync RTC to System Time
      </button>

      <!-- Divider -->
      <div class="border-t border-theme-primary" />

      <!-- Wake Alarm Section -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <Icon name="AlarmClock" :size="16" class="text-theme-secondary" />
          <h3 class="text-sm font-semibold text-theme-primary">Wake Alarm</h3>
        </div>

        <!-- Current alarm status -->
        <div class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Status</span>
          <span
            :class="[
              'text-xs font-medium px-2 py-0.5 rounded-full',
              wakeAlarmEnabled ? 'bg-accent-muted text-accent' : 'bg-neutral-muted text-theme-tertiary'
            ]"
          >
            {{ wakeAlarmEnabled ? 'Set' : 'Not Set' }}
          </span>
        </div>

        <div v-if="wakeAlarmEnabled && wakeAlarmTime" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Wake At</span>
          <span class="text-sm font-medium font-mono text-accent">{{ formatTime(wakeAlarmTime) }}</span>
        </div>

        <!-- Clear alarm (if active) -->
        <button
          v-if="wakeAlarmEnabled"
          @click="handleClearAlarm"
          :disabled="clearAlarmLoading"
          class="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        >
          <Icon v-if="clearAlarmLoading" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
          Clear Wake Alarm
        </button>

        <!-- Set alarm -->
        <div class="flex gap-2">
          <input
            v-model="wakeAlarmInput"
            type="datetime-local"
            class="flex-1 px-3 py-1.5 text-sm rounded-lg border border-theme-primary bg-theme-input text-theme-primary"
          />
          <button
            @click="handleSetAlarm"
            :disabled="setAlarmLoading || !wakeAlarmInput"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50 shrink-0"
          >
            <Icon v-if="setAlarmLoading" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
            Set
          </button>
        </div>
      </div>
    </template>

    <!-- Store error -->
    <div v-if="hardwareStore.error && !error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <span class="text-sm text-error">{{ hardwareStore.error }}</span>
    </div>
  </div>
</template>
