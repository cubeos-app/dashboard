<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api/client'

// State
const loading = ref(false)
const logs = ref([])
const error = ref(null)

// Filters
const activeTab = ref('system')
const selectedUnit = ref('')
const selectedContainer = ref('')
const searchQuery = ref('')
const logLevel = ref('all')
const lineCount = ref(100)

// Available options
const units = ref([])
const containers = ref([])

const tabs = [
  { id: 'system', label: 'System Logs' },
  { id: 'container', label: 'Container Logs' },
  { id: 'kernel', label: 'Kernel' },
  { id: 'errors', label: 'Errors' }
]

const logLevels = [
  { value: 'all', label: 'All Levels' },
  { value: '0', label: 'Emergency' },
  { value: '1', label: 'Alert' },
  { value: '2', label: 'Critical' },
  { value: '3', label: 'Error' },
  { value: '4', label: 'Warning' },
  { value: '5', label: 'Notice' },
  { value: '6', label: 'Info' },
  { value: '7', label: 'Debug' }
]

// Fetch log units and containers
async function fetchOptions() {
  try {
    const [unitsResp, servicesResp] = await Promise.all([
      api.get('/logs/units').catch(() => ({ units: [] })),
      api.get('/services').catch(() => ({ services: [] }))
    ])
    
    units.value = unitsResp.units || []
    // Services response is { services: [...], total, running } - extract the array
    const services = servicesResp?.services || []
    containers.value = services
      .filter(s => s.state === 'running' || s.state === 'Running' || s.status?.includes('Up'))
      .map(s => s.name)
  } catch (e) {
    console.error('Failed to fetch options:', e)
  }
}

// Fetch logs
async function fetchLogs() {
  loading.value = true
  error.value = null
  
  try {
    let endpoint = '/logs/journal'
    let params = { lines: lineCount.value }
    
    if (searchQuery.value) {
      params.grep = searchQuery.value
    }
    
    if (logLevel.value !== 'all') {
      params.priority = logLevel.value
    }
    
    switch (activeTab.value) {
      case 'system':
        if (selectedUnit.value) {
          params.unit = selectedUnit.value
        }
        break
      case 'container':
        if (selectedContainer.value) {
          endpoint = `/logs/container/${selectedContainer.value}`
        } else {
          logs.value = []
          loading.value = false
          return
        }
        break
      case 'kernel':
        endpoint = '/logs/kernel'
        break
      case 'errors':
        endpoint = '/logs/errors'
        params.hours = 24
        break
    }
    
    const response = await api.get(endpoint, params)
    // Handle different response formats
    if (activeTab.value === 'container') {
      // Container logs return { container: "name", entries: [...], count: N }
      const entries = response.entries || []
      logs.value = entries.map((line, idx) => {
        // Parse Docker log format: "2026-01-28T20:35:23.683854292Z message"
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*(.*)$/)
        return {
          timestamp: match ? match[1] : '',
          message: match ? match[2] : line,
          container: selectedContainer.value
        }
      })
    } else if (activeTab.value === 'kernel') {
      // Kernel logs return { entries: [...strings] }
      const entries = response.entries || []
      logs.value = entries.map(line => {
        // Parse dmesg format: "[timestamp] message" or "timestamp message"
        const match = line.match(/^\[?\s*(\d+\.?\d*)\]?\s*(.*)$/) || line.match(/^(\S+\s+\d+\s+\d+:\d+:\d+)\s+\S+\s+kernel:\s*(.*)$/)
        return {
          timestamp: match ? match[1] : '',
          message: match ? match[2] : line,
          level: line.toLowerCase().includes('error') ? 'err' : 
                 line.toLowerCase().includes('warn') ? 'warn' : 'info'
        }
      })
    } else {
      logs.value = response.entries || []
    }
  } catch (e) {
    error.value = e.message
    logs.value = []
  } finally {
    loading.value = false
  }
}

// Auto-refresh
let refreshInterval = null
const autoRefresh = ref(false)

watch(autoRefresh, (val) => {
  if (val) {
    refreshInterval = setInterval(fetchLogs, 5000)
  } else {
    if (refreshInterval) clearInterval(refreshInterval)
  }
})

// Watchers for filter changes
watch([activeTab, selectedUnit, selectedContainer, logLevel, lineCount], () => {
  fetchLogs()
})

// Initial load
onMounted(() => {
  fetchOptions()
  fetchLogs()
})

// Helpers
function formatTimestamp(ts) {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    return date.toLocaleString()
  } catch {
    return ts
  }
}

function levelClass(level) {
  if (!level) return 'text-gray-500'
  const l = level.toString().toLowerCase()
  if (l.includes('err') || l.includes('crit') || l.includes('alert') || l.includes('emerg') || l === '0' || l === '1' || l === '2' || l === '3') {
    return 'text-red-500'
  }
  if (l.includes('warn') || l === '4') {
    return 'text-yellow-500'
  }
  if (l.includes('notice') || l === '5') {
    return 'text-blue-500'
  }
  return 'text-gray-500'
}

function levelBadgeClass(level) {
  if (!level) return 'bg-gray-100 text-gray-600'
  const l = level.toString().toLowerCase()
  if (l.includes('err') || l.includes('crit') || l.includes('alert') || l.includes('emerg') || l === '0' || l === '1' || l === '2' || l === '3') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (l.includes('warn') || l === '4') {
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
  if (l.includes('notice') || l === '5') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (l.includes('info') || l === '6') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

function downloadLogs() {
  const content = logs.value.map(l => `${l.timestamp} [${l.priority || l.level || ''}] ${l.unit || l.container || ''}: ${l.message}`).join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cubeos-logs-${activeTab.value}-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">System Logs</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">View and search system and container logs</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input type="checkbox" v-model="autoRefresh" class="rounded border-gray-300 dark:border-gray-600">
          Auto-refresh
        </label>
        <button 
          @click="fetchLogs" 
          :disabled="loading"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button 
          @click="downloadLogs"
          :disabled="logs.length === 0"
          class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50"
        >
          Download
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex gap-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="activeTab === tab.id 
            ? 'border-teal-500 text-teal-500 dark:text-teal-400' 
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4">
      <!-- Unit selector (for system logs) -->
      <div v-if="activeTab === 'system'" class="flex-1 min-w-[200px]">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Unit</label>
        <select v-model="selectedUnit" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">All Services</option>
          <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </div>

      <!-- Container selector (for container logs) -->
      <div v-if="activeTab === 'container'" class="flex-1 min-w-[200px]">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Container</label>
        <select v-model="selectedContainer" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">Select a container...</option>
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- Log level -->
      <div v-if="activeTab !== 'container'" class="min-w-[150px]">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
        <select v-model="logLevel" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option v-for="level in logLevels" :key="level.value" :value="level.value">{{ level.label }}</option>
        </select>
      </div>

      <!-- Line count -->
      <div class="min-w-[120px]">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lines</label>
        <select v-model="lineCount" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
          <option :value="1000">1000</option>
        </select>
      </div>

      <!-- Search -->
      <div class="flex-1 min-w-[200px]">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
        <div class="relative">
          <input 
            v-model="searchQuery"
            @keyup.enter="fetchLogs"
            type="text" 
            placeholder="Search logs..."
            class="w-full px-3 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
          <svg class="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Logs display -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span class="text-sm text-gray-500">{{ logs.length }} log entries</span>
        <span v-if="loading" class="text-sm text-gray-500">Loading...</span>
      </div>
      
      <div class="max-h-[600px] overflow-y-auto font-mono text-sm">
        <div v-if="logs.length === 0 && !loading" class="p-8 text-center text-gray-500">
          <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No log entries found</p>
          <p v-if="activeTab === 'container' && !selectedContainer" class="text-sm mt-1">
            Select a container to view its logs
          </p>
        </div>
        
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/50">
          <div v-for="(log, idx) in logs" :key="idx" class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30">
            <div class="flex items-start gap-3">
              <!-- Timestamp -->
              <span class="text-gray-400 text-xs whitespace-nowrap">
                {{ formatTimestamp(log.timestamp) }}
              </span>
              
              <!-- Level badge -->
              <span v-if="log.priority || log.level" 
                    class="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                    :class="levelBadgeClass(log.priority || log.level)">
                {{ log.priority || log.level }}
              </span>
              
              <!-- Unit/container -->
              <span v-if="log.unit || log.container" class="text-blue-500 text-xs whitespace-nowrap">
                {{ log.unit || log.container }}
              </span>
              
              <!-- Message -->
              <span class="text-gray-700 dark:text-gray-300 break-all">
                {{ log.message }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
