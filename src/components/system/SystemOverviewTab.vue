<script setup>
/**
 * SystemOverviewTab.vue — S08 Component
 *
 * Standard mode: hostname, OS info, Pi model, uptime, temperature,
 * resource usage, power status, reboot/shutdown, support bundle, account.
 *
 * Advanced mode: + boot config, EEPROM, throttle status.
 *
 * Receives shared data from SystemPage via props.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useHardwareStore } from '@/stores/hardware'
import { useAuthStore } from '@/stores/auth'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'
import PowerCard from './PowerCard.vue'

const props = defineProps({
  loading: Boolean,
  powerStatus: Object
})

const emit = defineEmits(['refresh', 'navigate-tab'])

const systemStore = useSystemStore()
const hardwareStore = useHardwareStore()
const authStore = useAuthStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

// ─── Account ────────────────────────────────────────────────
const showChangePassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)
let passwordSuccessTimeout = null

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
    return
  }

  const success = await authStore.changePassword(currentPassword.value, newPassword.value)
  if (success) {
    passwordSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    if (passwordSuccessTimeout) clearTimeout(passwordSuccessTimeout)
    passwordSuccessTimeout = setTimeout(() => {
      showChangePassword.value = false
      passwordSuccess.value = false
    }, 2000)
  } else {
    passwordError.value = authStore.error || 'Failed to change password'
  }
}

// ─── Power Actions ──────────────────────────────────────────
async function handleReboot() {
  await systemStore.reboot()
}

async function handleShutdown() {
  await systemStore.shutdown()
}

// ─── Support Bundle ─────────────────────────────────────────
const supportBundleLoading = ref(false)

function downloadSupportBundle() {
  supportBundleLoading.value = true
  try {
    const token = api.accessToken ? `?token=${api.accessToken}` : ''
    window.open(`/api/v1/support/bundle.zip${token}`, '_blank')
  } finally {
    setTimeout(() => { supportBundleLoading.value = false }, 1000)
  }
}

// ─── Advanced: Boot Config, Throttle ────────────────────────
const bootConfigCopied = ref(false)
let bootConfigCopiedTimeout = null

const bootConfigText = computed(() => {
  const bc = hardwareStore.bootConfig
  if (!bc) return null
  if (typeof bc === 'string') return bc
  if (bc.content) return bc.content
  if (bc.config) return bc.config
  return JSON.stringify(bc, null, 2)
})

const isThrottled = computed(() => {
  const t = hardwareStore.throttle
  if (!t) return false
  return t.under_voltage || t.arm_frequency_capped || t.currently_throttled || t.temperature_limit
})

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

async function copyBootConfig() {
  const text = bootConfigText.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
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

// ─── Computed ───────────────────────────────────────────────
const uptimeDisplay = computed(() => {
  return systemStore.info?.uptime_human || systemStore.uptime?.uptime_human || '—'
})

// ─── Advanced Data Loading ──────────────────────────────────
onMounted(async () => {
  if (isAdvanced.value) {
    const s = signal()
    await Promise.all([
      hardwareStore.fetchThrottle({ signal: s }),
      hardwareStore.fetchBootConfig({ signal: s })
    ]).catch(() => {})
  }
})

onUnmounted(() => {
  if (passwordSuccessTimeout) clearTimeout(passwordSuccessTimeout)
  if (bootConfigCopiedTimeout) clearTimeout(bootConfigCopiedTimeout)
})
</script>

<template>
  <div class="space-y-6">
    <!-- System Info Card -->
    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <h2 class="font-semibold text-theme-primary">System Information</h2>
      </div>
      <div class="p-6">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-theme-tertiary">Hostname</dt>
            <dd class="font-medium text-theme-primary">{{ systemStore.hostname }}</dd>
          </div>
          <div>
            <dt class="text-sm text-theme-tertiary">Uptime</dt>
            <dd class="font-medium text-theme-primary">{{ uptimeDisplay }}</dd>
          </div>
          <div v-if="systemStore.info?.os_name">
            <dt class="text-sm text-theme-tertiary">Platform</dt>
            <dd class="font-medium text-theme-primary">{{ systemStore.info.os_name }}</dd>
          </div>
          <div v-if="systemStore.info?.kernel">
            <dt class="text-sm text-theme-tertiary">Kernel</dt>
            <dd class="font-medium text-theme-primary">{{ systemStore.info.kernel }}</dd>
          </div>
          <div v-if="systemStore.piModel">
            <dt class="text-sm text-theme-tertiary">Hardware</dt>
            <dd class="font-medium text-theme-primary">{{ systemStore.piModel }}</dd>
          </div>
          <div v-if="systemStore.piSerial">
            <dt class="text-sm text-theme-tertiary">Serial</dt>
            <dd class="font-medium text-theme-primary font-mono text-xs">{{ systemStore.piSerial }}</dd>
          </div>
        </dl>

        <!-- Support Bundle -->
        <div class="mt-5 pt-4 border-t border-theme-primary flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-theme-primary">Support Bundle</p>
            <p class="text-xs text-theme-muted mt-0.5">Download diagnostic data for troubleshooting</p>
          </div>
          <button
            @click="downloadSupportBundle"
            :disabled="supportBundleLoading"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-50 flex items-center gap-2"
            aria-label="Download support bundle"
          >
            <Icon v-if="supportBundleLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Download" :size="14" />
            Download Bundle
          </button>
        </div>
      </div>
    </div>

    <!-- Resource Usage -->
    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-theme-primary">Resource Usage</h2>
          <button
            v-if="isAdvanced"
            @click="emit('navigate-tab', 'monitoring')"
            class="text-xs text-accent hover:underline"
          >
            Detailed Monitoring
          </button>
        </div>
      </div>
      <div class="p-6 space-y-6">
        <!-- CPU -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-theme-secondary">CPU</span>
            <span class="text-sm font-medium text-theme-primary">{{ systemStore.cpuUsage }}%</span>
          </div>
          <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
            <div
              class="h-full bg-accent transition-all duration-500"
              :style="{ width: `${systemStore.cpuUsage}%` }"
            />
          </div>
        </div>

        <!-- Memory -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-theme-secondary">Memory</span>
            <span class="text-sm font-medium text-theme-primary">{{ systemStore.memoryUsage }}%</span>
          </div>
          <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
            <div
              class="h-full bg-accent transition-all duration-500"
              :style="{ width: `${systemStore.memoryUsage}%` }"
            />
          </div>
          <p class="text-xs text-theme-muted mt-1">{{ systemStore.memoryFormatted }}</p>
        </div>

        <!-- Disk -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-theme-secondary">Disk</span>
            <span class="text-sm font-medium text-theme-primary">{{ systemStore.diskUsage }}%</span>
          </div>
          <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="systemStore.diskUsage > 90 ? 'bg-error' : systemStore.diskUsage > 80 ? 'bg-warning' : 'bg-accent'"
              :style="{ width: `${systemStore.diskUsage}%` }"
            />
          </div>
          <p class="text-xs text-theme-muted mt-1">{{ systemStore.diskFormatted }}</p>
        </div>

        <!-- Temperature -->
        <div v-if="systemStore.temperature">
          <div class="flex justify-between mb-2">
            <span class="text-sm text-theme-secondary">CPU Temperature</span>
            <span class="text-sm font-medium" :class="systemStore.temperature > 80 ? 'text-error' : systemStore.temperature > 70 ? 'text-warning' : 'text-theme-primary'">
              {{ systemStore.temperature }}°C
            </span>
          </div>
          <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="systemStore.temperature > 80 ? 'bg-error' : systemStore.temperature > 70 ? 'bg-warning' : 'bg-accent'"
              :style="{ width: `${Math.min(systemStore.temperature, 100)}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Power Card -->
    <PowerCard :power-status="powerStatus" />

    <!-- Power Controls -->
    <div v-if="authStore.isAdmin" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <h2 class="font-semibold text-theme-primary">Power Controls</h2>
      </div>
      <div class="p-6">
        <div class="flex flex-wrap gap-3">
          <button
            @click="handleReboot"
            aria-label="Reboot system"
            class="px-4 py-2 bg-warning text-on-accent rounded-lg hover:bg-warning/90 transition-colors flex items-center gap-2"
          >
            <Icon name="RotateCw" :size="16" />
            Reboot
          </button>
          <button
            @click="handleShutdown"
            aria-label="Shut down system"
            class="px-4 py-2 bg-error text-on-accent rounded-lg hover:bg-error/90 transition-colors flex items-center gap-2"
          >
            <Icon name="Power" :size="16" />
            Shutdown
          </button>
        </div>
      </div>
    </div>

    <!-- Account Settings -->
    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <h2 class="font-semibold text-theme-primary">Account</h2>
      </div>
      <div class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-theme-primary">{{ authStore.username || 'admin' }}</p>
            <p class="text-sm text-theme-tertiary">{{ authStore.isAdmin ? 'Administrator' : 'User' }}</p>
          </div>
          <button
            @click="showChangePassword = !showChangePassword"
            class="px-4 py-2 text-sm bg-theme-tertiary text-theme-secondary rounded-lg hover:bg-theme-elevated transition-colors"
          >
            Change Password
          </button>
        </div>

        <!-- Change password form -->
        <div v-if="showChangePassword" class="mt-6 pt-6 border-t border-theme-primary">
          <form @submit.prevent="handleChangePassword" class="space-y-4 max-w-md">
            <div v-if="passwordError" class="p-3 bg-error-muted border border-error/20 text-error rounded-lg text-sm">
              {{ passwordError }}
            </div>
            <div v-if="passwordSuccess" class="p-3 bg-success-muted border border-success/20 text-success rounded-lg text-sm">
              Password changed successfully!
            </div>
            <div>
              <label for="current-password" class="block text-sm font-medium text-theme-secondary mb-1">Current Password</label>
              <input
                id="current-password"
                v-model="currentPassword"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label for="new-password" class="block text-sm font-medium text-theme-secondary mb-1">New Password</label>
              <input
                id="new-password"
                v-model="newPassword"
                type="password"
                required
                minlength="8"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label for="confirm-password" class="block text-sm font-medium text-theme-secondary mb-1">Confirm New Password</label>
              <input
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div class="flex gap-2">
              <button
                type="submit"
                :disabled="authStore.loading"
                class="px-4 py-2 bg-accent text-on-accent rounded-lg hover:bg-accent-secondary disabled:opacity-50 transition-colors"
              >
                {{ authStore.loading ? 'Saving...' : 'Save Password' }}
              </button>
              <button
                type="button"
                @click="showChangePassword = false"
                class="px-4 py-2 bg-theme-tertiary text-theme-secondary rounded-lg hover:bg-theme-elevated transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ═══════════ Advanced-only sections ═══════════ -->

    <!-- Throttle Status (Advanced) -->
    <div v-if="isAdvanced && hardwareStore.throttle" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="Gauge" :size="18" :class="isThrottled ? 'text-error' : 'text-accent'" />
          <h2 class="font-semibold text-theme-primary">Throttle Status</h2>
        </div>
        <span
          :class="[
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isThrottled ? 'bg-error-muted text-error' : 'bg-success-muted text-success'
          ]"
        >
          {{ isThrottled ? 'Throttling Active' : 'All Clear' }}
        </span>
      </div>
      <div class="p-6">
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
    </div>

    <!-- Boot Configuration (Advanced) -->
    <div v-if="isAdvanced" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="FileCode" :size="18" class="text-accent" />
          <h2 class="font-semibold text-theme-primary">Boot Configuration</h2>
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
      <div class="p-6">
        <div v-if="bootConfigText" class="bg-code rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto">
          <pre class="text-xs text-code font-mono whitespace-pre leading-relaxed">{{ bootConfigText }}</pre>
        </div>
        <p v-else class="text-sm text-theme-muted">Boot configuration not available</p>
      </div>
    </div>
  </div>
</template>
