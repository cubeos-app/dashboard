<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServicesStore } from '@/stores/services'
import api from '@/api/client'

const route = useRoute()
const router = useRouter()
const servicesStore = useServicesStore()

const service = ref(null)
const logs = ref('')
const stats = ref(null)
const loading = ref(true)
const logsLoading = ref(false)
const actionLoading = ref(false)
const activeTab = ref('overview')

const serviceName = computed(() => route.params.name)
const displayName = computed(() => servicesStore.getServiceName(serviceName.value))
const iconName = computed(() => servicesStore.getServiceIcon(serviceName.value))
const isRunning = computed(() => service.value?.state === 'running')
const isCore = computed(() => service.value?.is_core)

// Get service URL via FQDN (no direct port access)
const serviceUrl = computed(() => {
  if (!service.value) return null
  return servicesStore.getServiceUrl(service.value)
})

// Check if service has a web UI
const hasWebUI = computed(() => {
  return servicesStore.hasWebUI(serviceName.value)
})

async function fetchService() {
  try {
    service.value = await api.getService(serviceName.value)
  } catch (e) {
    console.error('Failed to fetch service:', e)
  } finally {
    loading.value = false
  }
}

async function fetchLogs() {
  logsLoading.value = true
  try {
    const data = await api.getServiceLogs(serviceName.value, 200)
    logs.value = data.logs || 'No logs available'
  } catch (e) {
    logs.value = 'Failed to fetch logs: ' + e.message
  } finally {
    logsLoading.value = false
  }
}

async function fetchStats() {
  try {
    stats.value = await api.getServiceStats(serviceName.value)
  } catch (e) {
    console.error('Failed to fetch stats:', e)
  }
}

async function handleAction(action) {
  if (!confirm(\`Are you sure you want to \${action} \${displayName.value}?\`)) return
  
  actionLoading.value = true
  try {
    if (action === 'start') await servicesStore.startService(serviceName.value)
    else if (action === 'stop') await servicesStore.stopService(serviceName.value)
    else if (action === 'restart') await servicesStore.restartService(serviceName.value)
    
    await fetchService()
    if (isRunning.value) await fetchStats()
  } finally {
    actionLoading.value = false
  }
}

let refreshInterval = null
onMounted(async () => {
  await fetchService()
  if (isRunning.value) {
    await Promise.all([fetchLogs(), fetchStats()])
  }
  refreshInterval = setInterval(async () => {
    if (isRunning.value) await fetchStats()
  }, 10000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return \`\${bytes.toFixed(1)} \${units[i]}\`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Back button & header -->
    <div class="flex items-center gap-4">
      <button 
        @click="router.push('/services')"
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <span class="text-2xl">{{ iconName }}</span>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ displayName }}</h1>
          <p class="text-gray-500 dark:text-gray-400">{{ serviceName }}</p>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-4 text-gray-500">Loading service...</p>
    </div>

    <template v-else-if="service">
      <!-- Status & Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span 
                class="w-3 h-3 rounded-full"
                :class="isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'"
              ></span>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ isRunning ? 'Running' : 'Stopped' }}
              </span>
            </div>
            <span v-if="service.health_status" class="text-sm px-2 py-0.5 rounded-full"
                  :class="service.health_status === 'healthy' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'">
              {{ service.health_status }}
            </span>
            <span v-if="isCore" class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Core Service
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-if="!isRunning && !isCore"
              @click="handleAction('start')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              Start
            </button>
            <button
              v-if="isRunning && !isCore"
              @click="handleAction('stop')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              Stop
            </button>
            <button
              v-if="isRunning"
              @click="handleAction('restart')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              Restart
            </button>
            
            <!-- Open in browser - uses FQDN via NPM, NOT direct port -->
            <a
              v-if="isRunning && hasWebUI && serviceUrl"
              :href="serviceUrl"
              target="_blank"
              class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open
            </a>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex gap-4">
          <button
            @click="activeTab = 'overview'"
            :class="[
              'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'overview'
                ? 'border-teal-500 text-teal-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            ]"
          >
            Overview
          </button>
          <button
            @click="activeTab = 'logs'; fetchLogs()"
            :class="[
              'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'logs'
                ? 'border-teal-500 text-teal-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            ]"
          >
            Logs
          </button>
        </nav>
      </div>

      <!-- Overview tab content -->
      <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Container Info</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">Image</dt>
              <dd class="font-mono text-gray-900 dark:text-white truncate max-w-48">{{ service.image }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Container ID</dt>
              <dd class="font-mono text-gray-900 dark:text-white">{{ service.id?.substring(0, 12) }}</dd>
            </div>
          </dl>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Resource Usage</h3>
          <dl v-if="stats" class="space-y-4">
            <div>
              <div class="flex justify-between mb-1">
                <dt class="text-gray-500 text-sm">CPU</dt>
                <dd class="text-gray-900 dark:text-white text-sm font-medium">{{ stats.cpu_percent?.toFixed(2) }}%</dd>
              </div>
              <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500" :style="{ width: \`\${Math.min(stats.cpu_percent || 0, 100)}%\` }"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <dt class="text-gray-500 text-sm">Memory</dt>
                <dd class="text-gray-900 dark:text-white text-sm font-medium">
                  {{ formatBytes(stats.memory_usage) }} / {{ formatBytes(stats.memory_limit) }}
                </dd>
              </div>
              <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full bg-purple-500" :style="{ width: \`\${stats.memory_percent || 0}%\` }"></div>
              </div>
            </div>
          </dl>
          <p v-else class="text-gray-500 text-sm">
            {{ isRunning ? 'Loading stats...' : 'Start service to view stats' }}
          </p>
        </div>
      </div>

      <!-- Logs tab -->
      <div v-if="activeTab === 'logs'" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-medium text-gray-900 dark:text-white">Container Logs</h3>
          <button 
            @click="fetchLogs"
            :disabled="logsLoading"
            class="text-sm text-teal-500 hover:underline disabled:opacity-50"
          >
            {{ logsLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
        <pre class="p-4 text-xs font-mono overflow-x-auto max-h-[500px] whitespace-pre-wrap bg-gray-900 text-gray-100">{{ logs || 'No logs available' }}</pre>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500">Service not found</p>
      <button 
        @click="router.push('/services')"
        class="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500"
      >
        Back to Services
      </button>
    </div>
  </div>
</template>
