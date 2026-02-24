<script setup>
/**
 * WiFiClientTransition.vue — Phase 6b / T6b-11
 *
 * Full-page overlay shown when switching to wifi_client mode.
 * Displays progress steps (stopping AP → connecting → verifying)
 * and warns the user about AP teardown.
 *
 * Polls /network/status every 3s to detect mode change.
 * If the switch fails and reverts to offline_hotspot, shows failure state.
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  ssid: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'success', 'failed'])

const networkStore = useNetworkStore()

// State
const phase = ref('switching') // 'switching' | 'success' | 'failed'
const elapsedSeconds = ref(0)
const newIP = ref('')
const canDismiss = ref(false)

// Steps shown during transition
const steps = [
  { id: 'stop_ap', label: 'Stopping Access Point' },
  { id: 'connect', label: 'Connecting to WiFi' },
  { id: 'verify', label: 'Verifying connectivity' },
  { id: 'persist', label: 'Saving configuration' }
]

const activeStepIndex = computed(() => {
  if (phase.value === 'success') return steps.length
  if (phase.value === 'failed') return -1
  // Estimate step from elapsed time
  if (elapsedSeconds.value < 3) return 0
  if (elapsedSeconds.value < 20) return 1
  if (elapsedSeconds.value < 30) return 2
  return 3
})

// Timers
let pollInterval = null
let elapsedInterval = null
let dismissTimeout = null

function startPolling() {
  elapsedSeconds.value = 0
  phase.value = 'switching'
  canDismiss.value = false

  // Elapsed timer
  elapsedInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)

  // Allow dismiss after 10 seconds
  dismissTimeout = setTimeout(() => {
    canDismiss.value = true
  }, 10000)

  // Poll network status every 3 seconds
  pollInterval = setInterval(async () => {
    try {
      await networkStore.fetchStatus(true)
      const mode = networkStore.currentMode

      if (mode === NETWORK_MODES.WIFI_CLIENT) {
        // Success
        phase.value = 'success'
        canDismiss.value = true
        newIP.value = networkStore.status?.ip || ''
        stopPolling()
        emit('success')
      } else if (mode === NETWORK_MODES.OFFLINE_HOTSPOT && elapsedSeconds.value > 5) {
        // Reverted to offline_hotspot (switch failed)
        phase.value = 'failed'
        canDismiss.value = true
        stopPolling()
        emit('failed')
      }
    } catch {
      // API may be temporarily unreachable during switch
    }
  }, 3000)
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval)
  if (elapsedInterval) clearInterval(elapsedInterval)
  if (dismissTimeout) clearTimeout(dismissTimeout)
  pollInterval = null
  elapsedInterval = null
  dismissTimeout = null
}

function dismiss() {
  if (!canDismiss.value) return
  stopPolling()
  emit('close')
}

// Start polling when shown
watch(() => props.show, (val) => {
  if (val) {
    startPolling()
  } else {
    stopPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <div class="w-full max-w-md rounded-xl bg-theme-card border border-theme-primary p-6 shadow-2xl">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
              <Icon name="Wifi" :size="20" class="text-accent" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-theme-primary">
                <template v-if="phase === 'switching'">Switching to WiFi Client</template>
                <template v-else-if="phase === 'success'">Connected</template>
                <template v-else>Connection Failed</template>
              </h2>
              <p v-if="ssid" class="text-sm text-theme-secondary">{{ ssid }}</p>
            </div>
          </div>

          <!-- Switching phase -->
          <template v-if="phase === 'switching'">
            <!-- Warning banner -->
            <div class="flex items-start gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20">
              <Icon name="AlertTriangle" :size="16" class="text-warning shrink-0 mt-0.5" />
              <p class="text-sm text-theme-secondary">
                The CubeOS Access Point will be turned off. After switching, connect to your home WiFi and access the dashboard at <span class="font-mono font-medium text-theme-primary">cubeos.local</span>
              </p>
            </div>

            <!-- Progress steps -->
            <div class="space-y-3 mb-4">
              <div
                v-for="(step, i) in steps"
                :key="step.id"
                class="flex items-center gap-3"
              >
                <!-- Step indicator -->
                <div class="flex items-center justify-center w-6 h-6 shrink-0">
                  <template v-if="i < activeStepIndex">
                    <Icon name="Check" :size="16" class="text-success" />
                  </template>
                  <template v-else-if="i === activeStepIndex">
                    <Icon name="Loader2" :size="16" class="text-accent animate-spin" />
                  </template>
                  <template v-else>
                    <div class="w-2 h-2 rounded-full bg-theme-tertiary" />
                  </template>
                </div>
                <span
                  class="text-sm"
                  :class="i <= activeStepIndex ? 'text-theme-primary' : 'text-theme-muted'"
                >
                  {{ step.label }}
                </span>
              </div>
            </div>

            <!-- Elapsed timer -->
            <p class="text-xs text-theme-muted text-center">
              {{ elapsedSeconds }}s elapsed
            </p>
          </template>

          <!-- Success phase -->
          <template v-else-if="phase === 'success'">
            <div class="flex flex-col items-center gap-3 py-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
                <Icon name="Check" :size="24" class="text-success" />
              </div>
              <p class="text-sm text-theme-secondary text-center">
                Dashboard available at
                <span class="font-mono font-medium text-theme-primary">cubeos.local</span>
                <template v-if="newIP">
                  <br />(IP: <span class="font-mono">{{ newIP }}</span>)
                </template>
              </p>
            </div>
          </template>

          <!-- Failed phase -->
          <template v-else>
            <div class="flex flex-col items-center gap-3 py-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-full bg-error/10">
                <Icon name="X" :size="24" class="text-error" />
              </div>
              <p class="text-sm text-theme-secondary text-center">
                Connection failed. Reverted to Offline Hotspot.
                <br />Reconnect to the CubeOS WiFi network.
              </p>
            </div>
          </template>

          <!-- Dismiss button -->
          <div class="mt-4 flex justify-center">
            <button
              v-if="canDismiss"
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              :class="phase === 'success'
                ? 'bg-accent text-on-accent hover:bg-accent-hover'
                : 'bg-theme-secondary text-theme-primary hover:bg-theme-tertiary'"
              @click="dismiss"
            >
              {{ phase === 'success' ? 'Done' : 'Close' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
