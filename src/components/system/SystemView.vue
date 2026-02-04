<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/client'

const systemStore = useSystemStore()
const authStore = useAuthStore()

const showChangePassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

// Power/UPS status
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

async function fetchPowerStatus() {
  try {
    powerStatus.value = await api.get('/power/status')
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
  powerInterval = setInterval(fetchPowerStatus, 10000) // Update UPS status every 10s
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
  if (powerInterval) clearInterval(powerInterval)
})

// Power status computed classes
const batteryLevelClass = computed(() => {
  const pct = powerStatus.value?.battery_percent || 0
  if (pct < 10) return 'text-red-500'
  if (pct < 20) return 'text-yellow-500'
  return 'text-gray-900 dark:text-white'
})

const batteryBarClass = computed(() => {
  const pct = powerStatus.value?.battery_percent || 0
  if (pct < 10) return 'bg-red-500'
  if (pct < 20) return 'bg-yellow-500'
  if (pct < 50) return 'bg-yellow-400'
  return 'bg-green-500'
})

const statusTextClass = computed(() => {
  const status = powerStatus.value?.status
  if (status === 'critical' || status === 'low') return 'text-red-600 dark:text-red-400'
  if (status === 'discharging') return 'text-yellow-600 dark:text-yellow-400'
  if (status === 'charging') return 'text-blue-600 dark:text-blue-400'
  return 'text-green-600 dark:text-green-400'
})

const statusDotClass = computed(() => {
  const status = powerStatus.value?.status
  if (status === 'critical' || status === 'low') return 'bg-red-500'
  if (status === 'discharging') return 'bg-yellow-500'
  if (status === 'charging') return 'bg-blue-500 animate-pulse'
  return 'bg-green-500'
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
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">System</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">System information and settings</p>
    </div>

    <!-- System Info Card -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h2 class="font-semibold text-gray-900 dark:text-white">System Information</h2>
      </div>
      <div class="p-6">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-gray-500 dark:text-gray-400">Hostname</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ systemStore.hostname }}</dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500 dark:text-gray-400">Uptime</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ systemStore.uptime }}</dd>
          </div>
          <div v-if="systemStore.info?.platform">
            <dt class="text-sm text-gray-500 dark:text-gray-400">Platform</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ systemStore.info.platform }}</dd>
          </div>
          <div v-if="systemStore.info?.kernel">
            <dt class="text-sm text-gray-500 dark:text-gray-400">Kernel</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ systemStore.info.kernel }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Resource Usage -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h2 class="font-semibold text-gray-900 dark:text-white">Resource Usage</h2>
      </div>
      <div class="p-6 space-y-6">
        <!-- CPU -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">CPU</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ systemStore.cpuUsage }}%</span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-teal-500 transition-all duration-500"
              :style="{ width: `${systemStore.cpuUsage}%` }"
            ></div>
          </div>
        </div>

        <!-- Memory -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Memory</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ systemStore.memoryFormatted }} ({{ systemStore.memoryUsage }}%)
            </span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-purple-500 transition-all duration-500"
              :style="{ width: `${systemStore.memoryUsage}%` }"
            ></div>
          </div>
        </div>

        <!-- Disk -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Disk</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ systemStore.diskFormatted }} ({{ systemStore.diskUsage }}%)
            </span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full transition-all duration-500"
              :class="systemStore.diskUsage > 90 ? 'bg-red-500' : 'bg-green-500'"
              :style="{ width: `${systemStore.diskUsage}%` }"
            ></div>
          </div>
        </div>

        <!-- Temperature -->
        <div v-if="systemStore.temperature">
          <div class="flex justify-between mb-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Temperature</span>
            <span 
              class="text-sm font-medium"
              :class="systemStore.temperature > 70 ? 'text-red-500' : 'text-gray-900 dark:text-white'"
            >
              {{ systemStore.temperature }}°C
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Account Settings -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h2 class="font-semibold text-gray-900 dark:text-white">Account</h2>
      </div>
      <div class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ authStore.username }}</p>
            <p class="text-sm text-gray-500">{{ authStore.isAdmin ? 'Administrator' : 'User' }}</p>
          </div>
          <button
            @click="showChangePassword = !showChangePassword"
            class="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Change Password
          </button>
        </div>

        <!-- Change password form -->
        <div v-if="showChangePassword" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <form @submit.prevent="handleChangePassword" class="space-y-4 max-w-md">
            <div v-if="passwordError" class="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {{ passwordError }}
            </div>
            <div v-if="passwordSuccess" class="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
              Password changed successfully!
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
              <input
                v-model="currentPassword"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <input
                v-model="newPassword"
                type="password"
                required
                minlength="8"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div class="flex gap-2">
              <button
                type="submit"
                :disabled="authStore.loading"
                class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50"
              >
                {{ authStore.loading ? 'Saving...' : 'Save Password' }}
              </button>
              <button
                type="button"
                @click="showChangePassword = false"
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Power Controls -->
    <div v-if="authStore.isAdmin" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h2 class="font-semibold text-gray-900 dark:text-white">Power</h2>
      </div>
      <div class="p-6">
        <!-- UPS Status -->
        <div v-if="powerStatus" class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">UPS Battery Status</h3>
          
          <div v-if="powerStatus.available" class="space-y-4">
            <!-- Battery level bar -->
            <div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">Battery Level</span>
                <span class="text-sm font-medium" :class="batteryLevelClass">
                  {{ Math.round(powerStatus.battery_percent || 0) }}%
                </span>
              </div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-500 rounded-full"
                  :class="batteryBarClass"
                  :style="{ width: `${powerStatus.battery_percent || 0}%` }"
                ></div>
              </div>
            </div>
            
            <!-- Status info grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p class="text-gray-500 dark:text-gray-400">Status</p>
                <p class="font-medium flex items-center gap-1.5" :class="statusTextClass">
                  <span class="w-2 h-2 rounded-full" :class="statusDotClass"></span>
                  {{ formatPowerStatus(powerStatus.status) }}
                </p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400">Voltage</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ powerStatus.battery_voltage ? powerStatus.battery_voltage.toFixed(2) + 'V' : 'N/A' }}
                </p>
              </div>
              <div v-if="powerStatus.time_remaining">
                <p class="text-gray-500 dark:text-gray-400">Time Remaining</p>
                <p class="font-medium text-gray-900 dark:text-white">{{ powerStatus.time_remaining }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400">Cells</p>
                <p class="font-medium text-gray-900 dark:text-white">{{ powerStatus.cell_count || 4 }}x 18650</p>
              </div>
            </div>
            
            <!-- Power source indicator -->
            <div class="flex items-center gap-2 mt-2">
              <svg v-if="powerStatus.power_good" class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <svg v-else class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm" :class="powerStatus.power_good ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
                {{ powerStatus.power_good ? 'AC Power Connected' : 'Running on Battery' }}
              </span>
            </div>
          </div>
          
          <div v-else class="text-center py-4 text-gray-500">
            <svg class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p>UPS not detected</p>
            <p class="text-xs mt-1">Geekworm X1202 UPS HAT required</p>
          </div>
        </div>
        
        <!-- Backup Section -->
        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Backups</h3>
            <button
              @click="showCreateBackup = true"
              class="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-500 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Backup
            </button>
          </div>
          
          <!-- Backup Stats -->
          <div v-if="backupStats" class="grid grid-cols-2 gap-4 mb-4">
            <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Total Backups</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ backupStats.total_backups || 0 }}</p>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Total Size</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ backupStats.total_size_human || '0 B' }}</p>
            </div>
          </div>
          
          <!-- Backup List -->
          <div v-if="backupLoading" class="text-center py-8 text-gray-500">
            Loading backups...
          </div>
          <div v-else-if="backups.length === 0" class="text-center py-8 text-gray-500">
            <svg class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p>No backups yet</p>
            <p class="text-xs mt-1">Create your first backup to protect your configuration</p>
          </div>
          <div v-else class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="backup in backups"
              :key="backup.id"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 dark:text-white text-sm truncate">{{ backup.id }}</span>
                  <span class="px-2 py-0.5 text-xs rounded-full" :class="{
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': backup.type === 'config',
                    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300': backup.type === 'full',
                    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300': backup.type === 'database'
                  }">{{ backup.type }}</span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">{{ backup.size_human }} - {{ new Date(backup.created_at).toLocaleString() }}</p>
              </div>
              <div class="flex items-center gap-1 ml-2">
                <button
                  @click="downloadBackup(backup.id)"
                  class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                  title="Download"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  @click="restoreBackup(backup.id)"
                  :disabled="backupRestoring"
                  class="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg disabled:opacity-50"
                  title="Restore"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  @click="deleteBackup(backup.id)"
                  class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  title="Delete"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Create Backup Modal -->
        <div v-if="showCreateBackup" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreateBackup = false">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Backup</h3>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Type</label>
                <select v-model="newBackupType" class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 dark:text-white">
                  <option value="config">Configuration Only</option>
                  <option value="full">Full Backup</option>
                  <option value="database">Database Only</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">
                  {{ newBackupType === 'config' ? 'Includes settings, preferences, and network configuration' : 
                     newBackupType === 'full' ? 'Includes all data and configuration' : 
                     'Includes only the CubeOS database' }}
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                <input
                  v-model="newBackupDescription"
                  type="text"
                  placeholder="e.g., Before network changes"
                  class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6">
              <button
                @click="showCreateBackup = false"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                @click="createBackup"
                :disabled="backupCreating"
                class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50 flex items-center gap-2"
              >
                <svg v-if="backupCreating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ backupCreating ? 'Creating...' : 'Create Backup' }}
              </button>
            </div>
          </div>
        </div>
        
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 mt-6">
          These actions will affect the entire system. Make sure all important work is saved.
        </p>
        <div class="flex gap-4">
          <button
            @click="handleReboot"
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reboot
          </button>
          <button
            @click="handleShutdown"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            Shutdown
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
