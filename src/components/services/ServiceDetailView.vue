<script setup>
import { ref, onMounted, computed } from 'vue'
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
const isRunning = computed(() => service.value?.state === 'running')

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
  if (!confirm(`Are you sure you want to ${action} ${displayName.value}?`)) return
  
  actionLoading.value = true
  try {
    if (action === 'start') await servicesStore.startService(serviceName.value)
    else if (action === 'stop') await servicesStore.stopService(serviceName.value)
    else if (action === 'restart') await servicesStore.restartService(serviceName.value)
    
    await fetchService()
    await fetchStats()
  } finally {
    actionLoading.value = false
  }
}

onMounted(async () => {
  await fetchService()
  if (isRunning.value) {
    await Promise.all([fetchLogs(), fetchStats()])
  }
})
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
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ displayName }}</h1>
        <p class="text-gray-500 dark:text-gray-400">{{ serviceName }}</p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
      <div class="animate-spin w-8 h-8 border-4 border-cube-600 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-4 text-gray-500">Loading service...</p>
    </div>

    <template v-else-if="service">
      <!-- Status & Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <span 
              class="w-3 h-3 rounded-full"
              :class="isRunning ? 'bg-green-400 status-dot-online' : 'bg-gray-400'"
            ></span>
            <span class="font-medium text-gray-900 dark:text-white">
              {{ isRunning ? 'Running' : 'Stopped' }}
            </span>
            <span v-if="service.health_status" class="text-sm text-gray-500">
              ({{ service.health_status }})
            </span>
          </div>

          <div class="flex gap-2">
            <button
              v-if="!isRunning"
              @click="handleAction('start')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              Start
            </button>
            <button
              v-if="isRunning"
              @click="handleAction('stop')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
            <button
              v-if="isRunning"
              @click="handleAction('restart')"
              :disabled="actionLoading"
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restart
            </button>
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
                ? 'border-cube-600 text-cube-600 dark:text-cube-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            Overview
          </button>
          <button
            @click="activeTab = 'logs'; fetchLogs()"
            :class="[
              'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'logs'
                ? 'border-cube-600 text-cube-600 dark:text-cube-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            Logs
          </button>
        </nav>
      </div>

      <!-- Overview tab -->
      <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Container info -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Container Info</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Image</dt>
              <dd class="font-mono text-gray-900 dark:text-white">{{ service.image }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Container ID</dt>
              <dd class="font-mono text-gray-900 dark:text-white">{{ service.id?.substring(0, 12) }}</dd>
            </div>
            <div v-if="service.started_at" class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Started</dt>
              <dd class="text-gray-900 dark:text-white">{{ new Date(service.started_at).toLocaleString() }}</dd>
            </div>
            <div v-if="service.compose_file" class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Compose File</dt>
              <dd class="font-mono text-xs text-gray-900 dark:text-white truncate max-w-48">{{ service.compose_file }}</dd>
            </div>
          </dl>
        </div>

        <!-- Resource usage -->
        <div v-if="stats" class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Resource Usage</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">CPU</dt>
              <dd class="text-gray-900 dark:text-white">{{ stats.cpu_percent?.toFixed(2) }}%</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500 dark:text-gray-400">Memory</dt>
              <dd class="text-gray-900 dark:text-white">
                {{ (stats.memory_usage / 1024 / 1024).toFixed(1) }} MB
              </dd>
            </div>
          </dl>
        </div>

        <!-- Ports -->
        <div v-if="service.ports?.length > 0" class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Ports</h3>
          <div class="space-y-2">
            <div 
              v-for="port in service.ports" 
              :key="`${port.public_port}-${port.private_port}`"
              class="flex items-center gap-2 text-sm"
            >
              <span class="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {{ port.public_port || '—' }}
              </span>
              <span class="text-gray-400">→</span>
              <span class="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {{ port.private_port }}
              </span>
              <span class="text-gray-500 text-xs">({{ port.type }})</span>
            </div>
          </div>
        </div>

        <!-- Labels -->
        <div v-if="service.labels && Object.keys(service.labels).length > 0" class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Labels</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div 
              v-for="(value, key) in service.labels" 
              :key="key"
              class="text-xs"
            >
              <span class="font-mono text-gray-500">{{ key }}</span>
              <span class="text-gray-400">=</span>
              <span class="font-mono text-gray-900 dark:text-white break-all">{{ value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs tab -->
      <div v-if="activeTab === 'logs'" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-medium text-gray-900 dark:text-white">Container Logs</h3>
          <button 
            @click="fetchLogs"
            :disabled="logsLoading"
            class="text-sm text-cube-600 dark:text-cube-400 hover:underline disabled:opacity-50"
          >
            {{ logsLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
        <pre class="p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto max-h-96 whitespace-pre-wrap">{{ logs || 'No logs available' }}</pre>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500">Service not found</p>
      <button 
        @click="router.push('/services')"
        class="mt-4 px-4 py-2 bg-cube-600 text-white rounded-lg hover:bg-cube-700"
      >
        Back to Services
      </button>
    </div>
  </div>
</template>
