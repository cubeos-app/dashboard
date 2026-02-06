<script setup>
/**
 * WatchdogPanel.vue
 *
 * Sprint 7 Group 4: Hardware watchdog management panel.
 * Displays watchdog status, enable/disable with timeout config,
 * and manual pet button for debugging.
 *
 * Pi hardware watchdog maximum timeout: 15 seconds.
 *
 * Lazy-loaded by HardwareView via defineAsyncComponent.
 * Renders side-by-side with RTCPanel in a lg:grid-cols-2 container.
 *
 * Store: useHardwareStore — fetchWatchdog, enableWatchdog, petWatchdog
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
const enableLoading = ref(false)
const disableLoading = ref(false)
const petLoading = ref(false)
const petSuccess = ref(false)

// Config input
const timeoutInput = ref(10)

// Pi hardware watchdog maximum timeout
const MAX_TIMEOUT = 15

// ==========================================
// Data
// ==========================================

const wdData = computed(() => hardwareStore.watchdog)

const isEnabled = computed(() => {
  if (!wdData.value) return false
  return wdData.value.enabled === true || wdData.value.active === true || wdData.value.running === true
})

const currentTimeout = computed(() => {
  if (!wdData.value) return null
  return wdData.value.timeout || wdData.value.timeout_seconds || null
})

const devicePath = computed(() => {
  if (!wdData.value) return null
  return wdData.value.device || wdData.value.path || null
})

const lastPet = computed(() => {
  if (!wdData.value) return null
  return wdData.value.last_pet || wdData.value.last_kick || null
})

const identity = computed(() => {
  if (!wdData.value) return null
  return wdData.value.identity || wdData.value.name || null
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    await hardwareStore.fetchWatchdog({ signal: signal() })
    // Initialise input from current timeout
    if (currentTimeout.value) {
      timeoutInput.value = Math.min(currentTimeout.value, MAX_TIMEOUT)
    }
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
})

// ==========================================
// Actions
// ==========================================

async function handleEnable() {
  const timeout = Math.max(1, Math.min(timeoutInput.value, MAX_TIMEOUT))

  const ok = await confirm({
    title: 'Enable Watchdog',
    message: `Enable the hardware watchdog with a ${timeout}s timeout. If the system becomes unresponsive for ${timeout} seconds, the Pi will automatically reboot.`,
    confirmText: 'Enable',
    variant: 'warning'
  })
  if (!ok) return

  enableLoading.value = true
  try {
    await hardwareStore.enableWatchdog({ enabled: true, timeout }, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    enableLoading.value = false
  }
}

async function handleDisable() {
  const ok = await confirm({
    title: 'Disable Watchdog',
    message: 'Disable the hardware watchdog? The system will no longer automatically reboot on hang.',
    confirmText: 'Disable',
    variant: 'danger'
  })
  if (!ok) return

  disableLoading.value = true
  try {
    await hardwareStore.enableWatchdog({ enabled: false }, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    disableLoading.value = false
  }
}

async function handlePet() {
  petLoading.value = true
  petSuccess.value = false
  try {
    await hardwareStore.petWatchdog({ signal: signal() })
    petSuccess.value = true
    setTimeout(() => { petSuccess.value = false }, 2000)
  } catch {
    // Store sets error
  } finally {
    petLoading.value = false
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
</script>

<template>
  <div class="bg-theme-card border border-theme-primary rounded-xl p-5 space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="ShieldCheck" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Watchdog</h2>
      </div>
      <span
        v-if="!loading && !error"
        :class="[
          'text-xs font-medium px-2 py-0.5 rounded-full',
          isEnabled ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-tertiary'
        ]"
      >
        {{ isEnabled ? 'Active' : 'Inactive' }}
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
        <h3 class="text-sm font-medium text-error">Failed to load watchdog data</h3>
        <p class="mt-1 text-sm text-error">{{ error }}</p>
      </div>
    </div>

    <!-- Watchdog Content -->
    <template v-else>

      <!-- Info banner -->
      <div class="bg-accent-muted border border-accent-subtle rounded-lg p-3 flex items-start gap-2">
        <Icon name="Info" :size="16" class="text-accent mt-0.5 shrink-0" />
        <p class="text-xs text-accent">
          Pi hardware watchdog max timeout is {{ MAX_TIMEOUT }}s. If the system fails to pet the watchdog within
          the timeout, it will automatically reboot.
        </p>
      </div>

      <!-- Status rows -->
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Status</span>
          <span
            :class="[
              'text-sm font-medium',
              isEnabled ? 'text-success' : 'text-theme-muted'
            ]"
          >
            {{ isEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>

        <div v-if="currentTimeout !== null" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Timeout</span>
          <span class="text-sm font-medium font-mono text-theme-primary">{{ currentTimeout }}s</span>
        </div>

        <div v-if="devicePath" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Device</span>
          <span class="text-sm font-medium font-mono text-theme-primary">{{ devicePath }}</span>
        </div>

        <div v-if="identity" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Identity</span>
          <span class="text-sm font-medium text-theme-primary">{{ identity }}</span>
        </div>

        <div v-if="lastPet" class="flex justify-between items-center">
          <span class="text-sm text-theme-secondary">Last Pet</span>
          <span class="text-sm font-medium font-mono text-theme-primary">{{ formatTime(lastPet) }}</span>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-theme-primary" />

      <!-- Configuration -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-theme-primary">Configuration</h3>

        <!-- Timeout input -->
        <div class="flex items-center gap-3">
          <label class="text-sm text-theme-secondary shrink-0">Timeout</label>
          <div class="flex items-center gap-2 flex-1">
            <input
              v-model.number="timeoutInput"
              type="range"
              :min="1"
              :max="MAX_TIMEOUT"
              step="1"
              class="flex-1 accent-[color:var(--accent-primary)]"
            />
            <span class="text-sm font-mono font-medium text-theme-primary w-8 text-right">{{ timeoutInput }}s</span>
          </div>
        </div>

        <!-- Enable / Disable buttons -->
        <div class="flex gap-2">
          <button
            v-if="!isEnabled"
            @click="handleEnable"
            :disabled="enableLoading"
            class="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-success-muted text-success hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            <Icon v-if="enableLoading" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5" />
            <Icon v-else name="ShieldCheck" :size="14" class="inline-block mr-1.5" />
            Enable Watchdog
          </button>

          <button
            v-if="isEnabled"
            @click="handleDisable"
            :disabled="disableLoading"
            class="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            <Icon v-if="disableLoading" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5" />
            <Icon v-else name="ShieldOff" :size="14" class="inline-block mr-1.5" />
            Disable Watchdog
          </button>

          <!-- Re-enable with new timeout when already enabled -->
          <button
            v-if="isEnabled && currentTimeout !== timeoutInput"
            @click="handleEnable"
            :disabled="enableLoading"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50 shrink-0"
          >
            <Icon v-if="enableLoading" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5" />
            Apply {{ timeoutInput }}s
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-theme-primary" />

      <!-- Manual pet (debug) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-theme-primary">Manual Pet</h3>
            <p class="text-xs text-theme-muted">Send a manual heartbeat to the watchdog (debug)</p>
          </div>
          <button
            @click="handlePet"
            :disabled="petLoading || !isEnabled"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
              petSuccess
                ? 'bg-success-muted text-success'
                : 'bg-accent-muted text-accent hover:bg-theme-tertiary'
            ]"
          >
            <Icon v-if="petLoading" name="Loader2" :size="14" class="inline-block animate-spin mr-1.5" />
            <Icon v-else-if="petSuccess" name="Check" :size="14" class="inline-block mr-1.5" />
            <Icon v-else name="Heart" :size="14" class="inline-block mr-1.5" />
            {{ petSuccess ? 'Petted!' : 'Pet Now' }}
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
