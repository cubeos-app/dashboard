<script setup>
/**
 * SystemView.vue
 * 
 * System information, resource usage, backups, and power controls.
 * 
 * Fixes:
 * - Changed /power/status to /hardware/battery (HAL endpoint)
 * - Maps HAL battery response correctly (percentage vs battery_percent)
 * - Uses theme classes instead of hardcoded dark: classes
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const systemStore = useSystemStore()
const authStore = useAuthStore()

const showChangePassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

// Power/UPS status from HAL
const powerStatus = ref(null)

// Backup state
const backups = ref([])
const backupStats = ref(null)
const backupLoading = ref(false)
const backupCreating = ref(false)
const backupRestoring = ref(false)
const showCreateBackup = ref(false)
const newBackupType = ref('config')
const newBackupDescription = ref('')

let statsInterval = null
let powerInterval = null

/**
 * Fetch battery status from HAL /hardware/battery
 * HAL returns: available, percentage, is_charging, is_critical, is_low, ac_present, voltage
 * We map this to the format the UI expects
 */
async function fetchPowerStatus() {
  try {
    const data = await api.get('/hardware/battery')
    
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
    const data = await api.get('/backups')
    backups.value = data.backups || []
    backupStats.value = await api.get('/backups/stats')
  } catch (e) {
    console.error('Failed to fetch backups:', e)
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
    console.error('Failed to create backup:', e)
  } finally {
    backupCreating.value = false
  }
}

async function restoreBackup(backupId) {
  if (!confirm('Are you sure you want to restore this backup? This will overwrite current configuration.')) return
  
  backupRestoring.value = true
  try {
    await api.post(`/backups/${backupId}/restore`, { restart_services: true })
    alert('Backup restored successfully. Some services may need to be restarted.')
  } catch (e) {
    console.error('Failed to restore backup:', e)
    alert('Failed to restore backup: ' + e.message)
  } finally {
    backupRestoring.value = false
  }
}

async function deleteBackup(backupId) {
  if (!confirm('Are you sure you want to delete this backup?')) return
  
  try {
    await api.delete(`/backups/${backupId}`)
    await fetchBackups()
  } catch (e) {
    console.error('Failed to delete backup:', e)
  }
}

function downloadBackup(backupId) {
  window.open(`/api/v1/backups/${backupId}/download`, '_blank')
}

onMounted(async () => {
  await systemStore.fetchAll()
  await fetchPowerStatus()
  await fetchBackups()
  statsInterval = setInterval(() => systemStore.fetchStats(), 5000)
  powerInterval = setInterval(fetchPowerStatus, 10000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
  if (powerInterval) clearInterval(powerInterval)
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
  if (pct < 50) return 'bg-yellow-400'
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
    setTimeout(() => {
      showChangePassword.value = false
      passwordSuccess.value = false
    }, 2000)
  } else {
    passwordError.value = authStore.error || 'Failed to change password'
  }
}

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
      <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary flex items-center justify-between">
        <h2 class="font-semibold text-theme-primary">Backups</h2>
        <button
          @click="showCreateBackup = true"
          class="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-secondary transition-colors flex items-center gap-1.5"
        >
          <Icon name="Plus" :size="14" />
          Create Backup
        </button>
      </div>
      <div class="p-6">
        <!-- Stats -->
        <div v-if="backupStats" class="grid grid-cols-3 gap-4 mb-6">
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
            class="flex items-center justify-between p-3 rounded-lg bg-theme-tertiary"
          >
            <div>
              <p class="font-medium text-theme-primary text-sm">{{ backup.description || backup.type }}</p>
              <p class="text-xs text-theme-muted">{{ backup.created_at }} · {{ backup.size_human }}</p>
            </div>
            <div class="flex items-center gap-2">
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
