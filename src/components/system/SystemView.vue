<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'

const systemStore = useSystemStore()
const authStore = useAuthStore()

const showChangePassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)

let statsInterval = null

onMounted(async () => {
  await systemStore.fetchAll()
  statsInterval = setInterval(() => systemStore.fetchStats(), 5000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
})

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
              class="h-full bg-cube-500 transition-all duration-500"
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
                class="px-4 py-2 bg-cube-600 text-white rounded-lg hover:bg-cube-700 disabled:opacity-50"
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
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
