<script setup>
/**
 * SystemView.vue
 * 
 * System information, resource usage, backups, and power controls.
 * 
 * Sprint 6 G2:
 * - Added Quick Backup button (one-click, no modal)
 * - Added expandable Backup Detail panel (accordion, lazy-loaded)
 * 
 * Fixes:
 * - Changed /power/status to /hardware/battery (HAL endpoint)
 * - Maps HAL battery response correctly (percentage vs battery_percent)
 * - Uses theme classes instead of hardcoded dark: classes
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const systemStore = useSystemStore()
const authStore = useAuthStore()
const { signal } = useAbortOnUnmount()

const showChangePassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

// Confirmation dialog state — removed: store's reboot()/shutdown() already call confirm()

// Power/UPS status from HAL
const powerStatus = ref(null)

// Backup state
const backups = ref([])
const backupStats = ref(null)
const backupLoading = ref(false)
const backupCreating = ref(false)
const backupRestoring = ref(false)
const backupRestoreMessage = ref(null)  // { type: 'success' | 'error', text: string }
const showCreateBackup = ref(false)
const newBackupType = ref('config')
const newBackupDescription = ref('')

// Sprint 6 G2: Quick backup state
const quickBackupLoading = ref(false)
const quickBackupSuccess = ref(false)
let quickBackupTimeout = null
let passwordSuccessTimeout = null

// Sprint 6 G2: Backup detail state (accordion pattern — max 1 open)
const expandedBackupId = ref(null)
const backupDetailCache = ref({})    // { [id]: detailData }
const backupDetailLoading = ref(null) // id currently loading

// Note: systemStore stats are updated in real-time via WebSocket in App.vue
// (with HTTP polling fallback). Only powerInterval is needed here (unique to system page).
let powerInterval = null

/**
 * Fetch battery status from HAL /hardware/battery
 * HAL returns: available, percentage, is_charging, is_critical, is_low, ac_present, voltage
 * We map this to the format the UI expects
 */
async function fetchPowerStatus() {
  try {
    const data = await api.get('/hardware/battery', {}, { signal: signal() })
    if (data === null) return // Aborted
    
    // Map HAL response to UI expected format
    let status = 'unknown'
    if (data.is_critical) status = 'critical'
    else if (data.is_low) status = 'low'
    else if (data.is_charging) status = 'charging'
    else if (data.ac_present) status = 'plugged_in'
    else if (data.available) status = 'discharging'
    else status = 'unavailable'
    
    powerStatus.value = {
      available: data.available ?? false,
      battery_percent: data.percentage ?? 0,  // Map percentage → battery_percent for UI
      status: status,
      is_charging: data.is_charging ?? false,
      ac_present: data.ac_present ?? false,
      voltage: data.voltage ?? 0
    }
  } catch (e) {
    powerStatus.value = { available: false, error: e.message }
  }
}

async function fetchBackups() {
  backupLoading.value = true
  try {
    const s = signal()
    const data = await api.get('/backups', {}, { signal: s })
    if (data === null) return // Aborted
    backups.value = data.backups || []
    backupStats.value = await api.get('/backups/stats', {}, { signal: s })
  } catch (e) {
    // Backups fetch failed
  } finally {
    backupLoading.value = false
  }
}

async function createBackup() {
  backupCreating.value = true
  try {
    await api.post('/backups', {
      type: newBackupType.value,
      description: newBackupDescription.value,
      compress: true
    })
    showCreateBackup.value = false
    newBackupDescription.value = ''
    await fetchBackups()
  } catch (e) {
    // Backup creation failed
  } finally {
    backupCreating.value = false
  }
}

/**
 * Sprint 6 G2: Quick backup — one-click, no modal
 * Uses default type 'config' for fast operation
 */
async function handleQuickBackup() {
  quickBackupLoading.value = true
  quickBackupSuccess.value = false
  try {
    await systemStore.quickBackup('config')
    quickBackupSuccess.value = true
    await fetchBackups()
    if (quickBackupTimeout) clearTimeout(quickBackupTimeout)
    quickBackupTimeout = setTimeout(() => { quickBackupSuccess.value = false }, 2000)
  } catch (e) {
    // Error handled by store
  } finally {
    quickBackupLoading.value = false
  }
}

/**
 * Sprint 6 G2: Toggle backup detail panel (accordion)
 * Lazy loads detail on first expand, caches for subsequent toggles
 */
async function toggleBackupDetail(backupId) {
  // If already expanded, collapse
  if (expandedBackupId.value === backupId) {
    expandedBackupId.value = null
    return
  }

  // Expand this row (collapses any other)
  expandedBackupId.value = backupId

  // If already cached, no need to fetch
  if (backupDetailCache.value[backupId]) return

  // Lazy load detail
  backupDetailLoading.value = backupId
  try {
    const detail = await systemStore.getBackupDetail(backupId)
    if (detail) {
      backupDetailCache.value[backupId] = detail
    }
  } finally {
    backupDetailLoading.value = null
  }
}

async function restoreBackup(backupId) {
  if (!await confirm({
    title: 'Restore Backup',
    message: 'Are you sure you want to restore this backup? This will overwrite current configuration.',
    confirmText: 'Restore',
    variant: 'warning'
  })) return
  
  backupRestoring.value = true
  backupRestoreMessage.value = null
  try {
    await api.post(`/backups/${backupId}/restore`, { restart_services: true })
    backupRestoreMessage.value = { type: 'success', text: 'Backup restored successfully. Some services may need to be restarted.' }
  } catch (e) {
    backupRestoreMessage.value = { type: 'error', text: 'Failed to restore backup: ' + e.message }
  } finally {
    backupRestoring.value = false
  }
}

async function deleteBackup(backupId) {
  if (!await confirm({
    title: 'Delete Backup',
    message: 'Are you sure you want to delete this backup?',
    confirmText: 'Delete',
    variant: 'danger'
  })) return
  
  try {
    await api.delete(`/backups/${backupId}`)
    // Clear detail cache for deleted backup
    delete backupDetailCache.value[backupId]
    if (expandedBackupId.value === backupId) expandedBackupId.value = null
    await fetchBackups()
  } catch (e) {
    // Delete failed
  }
}

function downloadBackup(backupId) {
  window.open(`/api/v1/backups/${backupId}/download`, '_blank')
}

onMounted(async () => {
  await systemStore.fetchAll({ signal: signal() })
  await fetchPowerStatus()
  await fetchBackups()
  // Stats already polled by App.vue; only poll power (unique to this view)
  powerInterval = setInterval(fetchPowerStatus, 10000)
})

onUnmounted(() => {
  if (powerInterval) clearInterval(powerInterval)
  if (quickBackupTimeout) clearTimeout(quickBackupTimeout)
  if (passwordSuccessTimeout) clearTimeout(passwordSuccessTimeout)
})

// Power status computed classes - using theme colors
const batteryLevelClass = computed(() => {
  const pct = powerStatus.value?.battery_percent || 0
  if (pct < 10) return 'text-error'
  if (pct < 20) return 'text-warning'
  return 'text-theme-primary'
})

const batteryBarClass = computed(() => {
  const pct = powerStatus.value?.battery_percent || 0
  if (pct < 10) return 'bg-error'
  if (pct < 20) return 'bg-warning'
  if (pct < 50) return 'bg-warning'
  return 'bg-success'
})

const statusTextClass = computed(() => {
  const status = powerStatus.value?.status
  if (status === 'critical' || status === 'low') return 'text-error'
  if (status === 'discharging') return 'text-warning'
  if (status === 'charging') return 'text-accent'
  return 'text-success'
})

const statusDotClass = computed(() => {
  const status = powerStatus.value?.status
  if (status === 'critical' || status === 'low') return 'bg-error'
  if (status === 'discharging') return 'bg-warning'
  if (status === 'charging') return 'bg-accent animate-pulse'
  return 'bg-success'
})

function formatPowerStatus(status) {
  const labels = {
    'charging': 'Charging',
    'discharging': 'Discharging',
    'full': 'Full',
    'plugged_in': 'Plugged In',
    'critical': 'Critical',
    'low': 'Low Battery',
    'unavailable': 'Unavailable'
  }
  return labels[status] || status || 'Unknown'
}

/** Format a timestamp for display in detail panel */
function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

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

// Power actions — store's reboot()/shutdown() already show confirm dialogs
async function handleReboot() {
  await systemStore.reboot()
}

async function handleShutdown() {
  await systemStore.shutdown()
}

// Uptime display
const uptimeDisplay = computed(() => {
  return systemStore.info?.uptime_human || systemStore.uptime?.uptime_human || '—'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-theme-primary">System</h1>
      <p class="text-theme-tertiary mt-1">System information and settings</p>
    </div>

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
      </div>
    </div>

    <!-- Resource Usage -->
    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <h2 class="font-semibold text-theme-primary">Resource Usage</h2>
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
            ></div>
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
            ></div>
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
            ></div>
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
            ></div>
          </div>
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
              <label class="block text-sm font-medium text-theme-secondary mb-1">Current Password</label>
              <input
                v-model="currentPassword"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">New Password</label>
              <input
                v-model="newPassword"
                type="password"
                required
                minlength="8"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Confirm New Password</label>
              <input
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
                class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-secondary disabled:opacity-50 transition-colors"
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

    <!-- Power Controls -->
    <div v-if="authStore.isAdmin" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
        <h2 class="font-semibold text-theme-primary">Power</h2>
      </div>
      <div class="p-6">
        <!-- UPS Status -->
        <div v-if="powerStatus?.available" class="mb-6 pb-6 border-b border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-4">
            <Icon name="Battery" :size="16" class="inline mr-1" />
            UPS Battery Status
          </h3>
          
          <div class="space-y-4">
            <!-- Battery level bar -->
            <div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-theme-tertiary">Battery Level</span>
                <span class="text-sm font-medium" :class="batteryLevelClass">
                  {{ Math.round(powerStatus.battery_percent || 0) }}%
                </span>
              </div>
              <div class="h-3 bg-theme-tertiary rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-500 rounded-full"
                  :class="batteryBarClass"
                  :style="{ width: `${powerStatus.battery_percent || 0}%` }"
                ></div>
              </div>
            </div>
            
            <!-- Status -->
            <div class="flex items-center justify-between">
              <span class="text-sm text-theme-tertiary">Status</span>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="statusDotClass"></span>
                <span class="text-sm font-medium" :class="statusTextClass">
                  {{ formatPowerStatus(powerStatus.status) }}
                </span>
              </div>
            </div>
            
            <!-- Voltage -->
            <div v-if="powerStatus.voltage" class="flex items-center justify-between">
              <span class="text-sm text-theme-tertiary">Voltage</span>
              <span class="text-sm font-medium text-theme-primary">{{ powerStatus.voltage.toFixed(2) }}V</span>
            </div>
          </div>
        </div>
        
        <div v-else-if="powerStatus && !powerStatus.available" class="mb-6 pb-6 border-b border-theme-primary">
          <p class="text-sm text-theme-muted">No UPS/battery hardware detected</p>
        </div>

        <!-- Power buttons -->
        <div class="flex flex-wrap gap-3">
          <button
            @click="handleReboot"
            class="px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors flex items-center gap-2"
          >
            <Icon name="RotateCw" :size="16" />
            Reboot
          </button>
          <button
            @click="handleShutdown"
            class="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors flex items-center gap-2"
          >
            <Icon name="Power" :size="16" />
            Shutdown
          </button>
        </div>
      </div>
    </div>

    <!-- Backups -->
    <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-theme-primary">Backups</h2>
        <div class="flex items-center gap-2">
          <!-- Quick Backup button (Sprint 6 G2) -->
          <button
            @click="handleQuickBackup"
            :disabled="quickBackupLoading"
            class="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors"
            :class="quickBackupSuccess
              ? 'bg-success text-white'
              : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-elevated'"
          >
            <Icon v-if="quickBackupLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="quickBackupSuccess" name="Check" :size="14" />
            <Icon v-else name="Zap" :size="14" />
            <span class="hidden sm:inline">{{ quickBackupSuccess ? 'Done' : 'Quick Backup' }}</span>
          </button>
          <!-- Create Backup button -->
          <button
            @click="showCreateBackup = true"
            class="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-secondary transition-colors flex items-center gap-1.5"
          >
            <Icon name="Plus" :size="14" />
            Create Backup
          </button>
        </div>
      </div>
      <div class="p-6">
        <!-- Stats -->
        <div v-if="backupStats" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-xs text-theme-muted">Total Backups</p>
            <p class="text-lg font-semibold text-theme-primary">{{ backupStats.total_count || 0 }}</p>
          </div>
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-xs text-theme-muted">Total Size</p>
            <p class="text-lg font-semibold text-theme-primary">{{ backupStats.total_size_human || '0 B' }}</p>
          </div>
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-xs text-theme-muted">Last Backup</p>
            <p class="text-lg font-semibold text-theme-primary">{{ backupStats.last_backup ? 'Recent' : 'Never' }}</p>
          </div>
        </div>

        <!-- Backup restore feedback (replaces native alert) -->
        <div
          v-if="backupRestoreMessage"
          class="p-3 rounded-lg flex items-center gap-2"
          :class="backupRestoreMessage.type === 'success' ? 'bg-success-muted text-success' : 'bg-error-muted text-error'"
        >
          <Icon :name="backupRestoreMessage.type === 'success' ? 'CheckCircle' : 'AlertTriangle'" :size="16" />
          <span class="text-sm flex-1">{{ backupRestoreMessage.text }}</span>
          <button @click="backupRestoreMessage = null" class="p-1 hover:opacity-75">
            <Icon name="X" :size="14" />
          </button>
        </div>

        <!-- Backup list -->
        <div v-if="backupLoading" class="text-center py-8">
          <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <div v-else-if="backups.length === 0" class="text-center py-8 text-theme-muted">
          <Icon name="Database" :size="32" class="mx-auto mb-2 opacity-50" />
          <p>No backups yet</p>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="backup in backups"
            :key="backup.id"
            class="rounded-lg bg-theme-tertiary overflow-hidden"
          >
            <!-- Backup row (clickable to expand) -->
            <div
              class="flex items-center justify-between p-3 cursor-pointer hover:bg-theme-elevated/50 transition-colors"
              @click="toggleBackupDetail(backup.id)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Icon
                  name="ChevronRight"
                  :size="14"
                  class="text-theme-muted flex-shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-90': expandedBackupId === backup.id }"
                />
                <div class="min-w-0">
                  <p class="font-medium text-theme-primary text-sm truncate">{{ backup.description || backup.type }}</p>
                  <p class="text-xs text-theme-muted">{{ backup.created_at }} · {{ backup.size_human }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
                <button
                  @click="downloadBackup(backup.id)"
                  class="p-1.5 text-theme-secondary hover:text-accent rounded transition-colors"
                  title="Download"
                >
                  <Icon name="Download" :size="16" />
                </button>
                <button
                  @click="restoreBackup(backup.id)"
                  :disabled="backupRestoring"
                  class="p-1.5 text-theme-secondary hover:text-warning rounded transition-colors disabled:opacity-50"
                  title="Restore"
                >
                  <Icon name="RotateCcw" :size="16" />
                </button>
                <button
                  @click="deleteBackup(backup.id)"
                  class="p-1.5 text-theme-secondary hover:text-error rounded transition-colors"
                  title="Delete"
                >
                  <Icon name="Trash2" :size="16" />
                </button>
              </div>
            </div>

            <!-- Expandable Detail Panel (Sprint 6 G2) -->
            <div
              v-show="expandedBackupId === backup.id"
              class="border-t border-theme-primary transition-all duration-200"
            >
              <!-- Loading skeleton -->
              <div v-if="backupDetailLoading === backup.id" class="p-4 space-y-3">
                <div class="h-3 w-1/3 bg-theme-elevated rounded animate-pulse"></div>
                <div class="h-3 w-2/3 bg-theme-elevated rounded animate-pulse"></div>
                <div class="h-3 w-1/2 bg-theme-elevated rounded animate-pulse"></div>
              </div>

              <!-- Detail content -->
              <div v-else-if="backupDetailCache[backup.id]" class="p-4">
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div v-if="backupDetailCache[backup.id].filename">
                    <dt class="text-xs text-theme-muted">Filename</dt>
                    <dd class="text-sm text-theme-primary font-mono truncate">{{ backupDetailCache[backup.id].filename }}</dd>
                  </div>
                  <div v-if="backupDetailCache[backup.id].type">
                    <dt class="text-xs text-theme-muted">Type</dt>
                    <dd class="text-sm text-theme-primary capitalize">{{ backupDetailCache[backup.id].type }}</dd>
                  </div>
                  <div v-if="backupDetailCache[backup.id].size_human">
                    <dt class="text-xs text-theme-muted">Size</dt>
                    <dd class="text-sm text-theme-primary">{{ backupDetailCache[backup.id].size_human }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-theme-muted">Compressed</dt>
                    <dd class="text-sm text-theme-primary">{{ backupDetailCache[backup.id].compressed ? 'Yes' : 'No' }}</dd>
                  </div>
                  <div v-if="backupDetailCache[backup.id].created_at" class="sm:col-span-2">
                    <dt class="text-xs text-theme-muted">Created</dt>
                    <dd class="text-sm text-theme-primary">{{ formatDate(backupDetailCache[backup.id].created_at) }}</dd>
                  </div>
                  <div v-if="backupDetailCache[backup.id].includes?.length" class="sm:col-span-2">
                    <dt class="text-xs text-theme-muted mb-1">Includes</dt>
                    <dd class="flex flex-wrap gap-1">
                      <span
                        v-for="item in backupDetailCache[backup.id].includes"
                        :key="item"
                        class="inline-block px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent"
                      >
                        {{ item }}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <!-- Error fallback -->
              <div v-else class="p-4">
                <p class="text-xs text-theme-muted">Unable to load backup details</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Backup Modal -->
    <Teleport to="body">
      <div v-if="showCreateBackup" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showCreateBackup = false">
        <div class="bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary">
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
            <h3 class="text-lg font-semibold text-theme-primary">Create Backup</h3>
            <button @click="showCreateBackup = false" class="p-1 text-theme-muted hover:text-theme-primary rounded-lg">
              <Icon name="X" :size="20" />
            </button>
          </div>
          
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-2">Backup Type</label>
              <select 
                v-model="newBackupType"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
              >
                <option value="config">Configuration Only</option>
                <option value="full">Full Backup</option>
                <option value="data">Data Only</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-2">Description (optional)</label>
              <input 
                v-model="newBackupDescription"
                type="text"
                placeholder="e.g., Before update"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary">
            <button 
              @click="showCreateBackup = false"
              class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="createBackup"
              :disabled="backupCreating"
              class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-secondary disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <Icon v-if="backupCreating" name="Loader2" :size="16" class="animate-spin" />
              {{ backupCreating ? 'Creating...' : 'Create Backup' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
