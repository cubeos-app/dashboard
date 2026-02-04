<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'

// Tabs
const activeTab = ref('overview')
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'health', label: 'Disk Health' },
  { id: 'shares', label: 'SMB Shares' }
]

// State
const loading = ref(true)
const disks = ref([])
const dockerUsage = ref(null)
const dataDirectories = ref([])
const serviceDataTotal = ref(0)
const diskHealth = ref([])
const smbStatus = ref(null)
const smbShares = ref([])
const error = ref(null)

// Actions state
const cleanupLoading = ref(false)

// SMB Share Modal
const showShareModal = ref(false)
const shareModalMode = ref('create')
const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  browseable: true,
  read_only: false,
  guest_ok: true
})
const shareLoading = ref(false)

// Fetch all storage data
async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const [stats, dockerInfo, health, smb, shares] = await Promise.all([
      api.get('/system/stats'),
      api.get('/docker/disk-usage').catch(() => null),
      api.get('/storage/health').catch(() => ({ disks: [] })),
      api.get('/smb/status').catch(() => null),
      api.get('/smb/shares').catch(() => ({ shares: [] }))
    ])
    
    disks.value = [{
      device: '/dev/mmcblk0p2',
      mountpoint: '/',
      fstype: 'ext4',
      total_bytes: stats.disk_total || 0,
      used_bytes: stats.disk_used || 0,
      free_bytes: stats.disk_free || 0,
      percent_used: stats.disk_percent || 0
    }]
    
    if (dockerInfo) {
      dockerUsage.value = {
        images_size: dockerInfo.images_size,
        containers_size: dockerInfo.containers_size,
        volumes_size: dockerInfo.volumes_size,
        build_cache_size: dockerInfo.build_cache_size,
        total_size: dockerInfo.total_size,
        images_count: dockerInfo.images_count,
        containers_count: dockerInfo.containers_count,
        volumes_count: dockerInfo.volumes_count
      }
    }
    
    diskHealth.value = health?.disks || []
    smbStatus.value = smb
    smbShares.value = shares?.shares || []
    
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function dockerPrune() {
  if (!confirm('This will remove unused Docker images, containers, and volumes. Continue?')) return
  cleanupLoading.value = true
  try {
    await api.post('/docker/prune')
    await fetchAll()
  } catch (e) {
    error.value = e.message
  } finally {
    cleanupLoading.value = false
  }
}

function openCreateShare() {
  shareModalMode.value = 'create'
  shareForm.value = { name: '', path: '/cubeos/shares/', comment: '', browseable: true, read_only: false, guest_ok: true }
  showShareModal.value = true
}

function openEditShare(share) {
  shareModalMode.value = 'edit'
  shareForm.value = { ...share }
  showShareModal.value = true
}

async function saveShare() {
  if (!shareForm.value.name || !shareForm.value.path) { alert('Name and path are required'); return }
  shareLoading.value = true
  try {
    if (shareModalMode.value === 'create') {
      await api.post('/smb/shares', shareForm.value)
    } else {
      await api.put(`/smb/shares/${shareForm.value.name}`, shareForm.value)
    }
    showShareModal.value = false
    await fetchAll()
  } catch (e) {
    alert('Failed to save share: ' + e.message)
  } finally {
    shareLoading.value = false
  }
}

async function deleteShare(name) {
  if (!confirm(`Delete share "${name}"? The shared folder will NOT be deleted.`)) return
  try {
    await api.delete(`/smb/shares/${name}`)
    await fetchAll()
  } catch (e) {
    alert('Failed to delete share: ' + e.message)
  }
}

onMounted(fetchAll)

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
  return `${bytes.toFixed(1)} ${units[i]}`
}

function usageColor(percent) {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 75) return 'bg-yellow-500'
  return 'bg-green-500'
}

function usageTextColor(percent) {
  if (percent >= 90) return 'text-red-500'
  if (percent >= 75) return 'text-yellow-500'
  return 'text-green-500'
}

function healthColor(status) {
  if (status === 'PASSED') return 'text-green-500'
  if (status === 'FAILED') return 'text-red-500'
  if (status === 'N/A') return 'text-gray-400'
  return 'text-yellow-500'
}

function healthBgColor(status) {
  if (status === 'PASSED') return 'bg-green-100 dark:bg-green-900/30'
  if (status === 'FAILED') return 'bg-red-100 dark:bg-red-900/30'
  if (status === 'N/A') return 'bg-gray-100 dark:bg-gray-700'
  return 'bg-yellow-100 dark:bg-yellow-900/30'
}

function formatHours(hours) {
  if (!hours) return '-'
  const days = Math.floor(hours / 24)
  const years = Math.floor(days / 365)
  if (years > 0) return `${years}y ${days % 365}d`
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h`
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Storage</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Manage disk space, health monitoring, and network shares</p>
      </div>
      <button @click="fetchAll" :disabled="loading" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
        <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex gap-4">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id"
          class="py-3 px-1 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id ? 'border-teal-500 text-teal-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'">
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Overview Tab -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="disk in disks" :key="disk.mountpoint" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-white">{{ disk.mountpoint }}</h3>
                <p class="text-sm text-gray-500">{{ disk.device }} · {{ disk.fstype }}</p>
              </div>
            </div>
            <span :class="usageTextColor(disk.percent_used)" class="text-lg font-bold">{{ disk.percent_used.toFixed(0) }}%</span>
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div :class="usageColor(disk.percent_used)" class="h-full transition-all" :style="{ width: disk.percent_used + '%' }"></div>
          </div>
          <div class="flex justify-between text-sm text-gray-500">
            <span>Used: {{ formatBytes(disk.used_bytes) }}</span>
            <span>Free: {{ formatBytes(disk.free_bytes) }}</span>
            <span>Total: {{ formatBytes(disk.total_bytes) }}</span>
          </div>
        </div>
      </div>

      <div v-if="dockerUsage" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">Docker Storage</h3>
              <p class="text-sm text-gray-500">{{ formatBytes(dockerUsage.total_size) }} total</p>
            </div>
          </div>
          <button @click="dockerPrune" :disabled="cleanupLoading" class="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50">
            {{ cleanupLoading ? 'Cleaning...' : 'Clean Up' }}
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Images ({{ dockerUsage.images_count }})</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatBytes(dockerUsage.images_size) }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Containers ({{ dockerUsage.containers_count }})</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatBytes(dockerUsage.containers_size) }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Volumes ({{ dockerUsage.volumes_count }})</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatBytes(dockerUsage.volumes_size) }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Build Cache</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatBytes(dockerUsage.build_cache_size) }}</p>
          </div>
        </div>
      </div>

      <div v-if="dataDirectories.length > 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Service Data</h3>
            <p class="text-sm text-gray-500">{{ formatBytes(serviceDataTotal) }} across {{ dataDirectories.length }} services</p>
          </div>
        </div>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <div v-for="dir in dataDirectories" :key="dir.name" class="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ dir.name }}</span>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatBytes(dir.size_bytes) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Disk Health Tab -->
    <div v-if="activeTab === 'health'" class="space-y-6">
      <div v-if="diskHealth.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Disks Found</h3>
        <p class="text-gray-500">S.M.A.R.T. monitoring requires smartmontools to be installed.</p>
        <p class="text-sm text-gray-400 mt-2">Run: <code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">apt install smartmontools</code></p>
      </div>
      
      <div v-for="disk in diskHealth" :key="disk.device" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg flex items-center justify-center" :class="healthBgColor(disk.health)">
              <svg class="w-6 h-6" :class="healthColor(disk.health)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="disk.health === 'PASSED'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path v-else-if="disk.health === 'FAILED'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">{{ disk.model || disk.device }}</h3>
              <p class="text-sm text-gray-500">{{ disk.device }} · {{ disk.type }} · {{ disk.capacity }}</p>
            </div>
          </div>
          <span :class="healthColor(disk.health)" class="text-lg font-bold">{{ disk.health }}</span>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Temperature</p>
            <p class="font-semibold text-gray-900 dark:text-white" :class="{ 'text-red-500': disk.temperature > 60 }">{{ disk.temperature ? disk.temperature + '°C' : '-' }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Power On Time</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ formatHours(disk.power_on_hours) }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Power Cycles</p>
            <p class="font-semibold text-gray-900 dark:text-white">{{ disk.power_cycles || '-' }}</p>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Serial</p>
            <p class="font-semibold text-gray-900 dark:text-white text-xs truncate">{{ disk.serial || '-' }}</p>
          </div>
        </div>
        
        <div v-if="disk.warnings && disk.warnings.length > 0" class="mb-4">
          <div v-for="warning in disk.warnings" :key="warning" class="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg mb-2 text-sm text-yellow-800 dark:text-yellow-200">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ warning }}
          </div>
        </div>
        
        <details v-if="disk.attributes && disk.attributes.length > 0" class="group">
          <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
            <svg class="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            Show {{ disk.attributes.length }} S.M.A.R.T. attributes
          </summary>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th class="py-2 px-2">ID</th>
                  <th class="py-2 px-2">Attribute</th>
                  <th class="py-2 px-2">Value</th>
                  <th class="py-2 px-2">Worst</th>
                  <th class="py-2 px-2">Thresh</th>
                  <th class="py-2 px-2">Raw</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="attr in disk.attributes" :key="attr.id" class="border-b border-gray-100 dark:border-gray-700/50" :class="{ 'bg-red-50 dark:bg-red-900/20': attr.failing }">
                  <td class="py-1.5 px-2 text-gray-500">{{ attr.id }}</td>
                  <td class="py-1.5 px-2 text-gray-900 dark:text-white">{{ attr.name }}</td>
                  <td class="py-1.5 px-2" :class="attr.value <= attr.threshold ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'">{{ attr.value }}</td>
                  <td class="py-1.5 px-2 text-gray-500">{{ attr.worst }}</td>
                  <td class="py-1.5 px-2 text-gray-500">{{ attr.threshold }}</td>
                  <td class="py-1.5 px-2 text-gray-500 font-mono">{{ attr.raw_value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>

    <!-- SMB Shares Tab -->
    <div v-if="activeTab === 'shares'" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="smbStatus?.running ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'">
              <svg class="w-5 h-5" :class="smbStatus?.running ? 'text-green-600 dark:text-green-400' : 'text-gray-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">Samba File Server</h3>
              <p class="text-sm text-gray-500">{{ smbStatus?.installed ? (smbStatus?.running ? 'Running' : 'Stopped') : 'Not installed' }}<span v-if="smbStatus?.version"> · {{ smbStatus.version }}</span></p>
            </div>
          </div>
          <button @click="openCreateShare" :disabled="!smbStatus?.installed" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            Add Share
          </button>
        </div>
      </div>

      <div v-if="smbStatus && !smbStatus.installed" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <p class="text-yellow-800 dark:text-yellow-200">Samba is not installed. Install it to create network shares:</p>
        <code class="block mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">apt install samba</code>
      </div>

      <div v-if="smbShares.length > 0" class="space-y-4">
        <div v-for="share in smbShares" :key="share.name" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">{{ share.name }}</h4>
                <p class="text-sm text-gray-500">{{ share.path }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="share.read_only" class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">Read Only</span>
              <span v-if="share.guest_ok" class="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">Guest OK</span>
              <button @click="openEditShare(share)" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button @click="deleteShare(share.name)" class="p-2 text-gray-400 hover:text-red-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
          <p v-if="share.comment" class="text-sm text-gray-500 mt-2">{{ share.comment }}</p>
        </div>
      </div>

      <div v-else-if="smbStatus?.installed" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Shares Configured</h3>
        <p class="text-gray-500 mb-4">Create a network share to access files from other devices.</p>
        <button @click="openCreateShare" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500">Create First Share</button>
      </div>
    </div>

    <!-- Share Modal -->
    <Teleport to="body">
      <div v-if="showShareModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showShareModal = false">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ shareModalMode === 'create' ? 'Create Share' : 'Edit Share' }}</h3>
            <button @click="showShareModal = false" class="p-1 text-gray-400 hover:text-gray-500 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Share Name</label>
              <input v-model="shareForm.name" type="text" :disabled="shareModalMode === 'edit'" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50" placeholder="documents">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder Path</label>
              <input v-model="shareForm.path" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="/cubeos/shares/documents">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <input v-model="shareForm.comment" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="My documents">
            </div>
            <div class="space-y-3">
              <label class="flex items-center gap-3">
                <input v-model="shareForm.guest_ok" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500">
                <span class="text-sm text-gray-700 dark:text-gray-300">Allow guest access (no password)</span>
              </label>
              <label class="flex items-center gap-3">
                <input v-model="shareForm.read_only" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500">
                <span class="text-sm text-gray-700 dark:text-gray-300">Read only</span>
              </label>
              <label class="flex items-center gap-3">
                <input v-model="shareForm.browseable" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500">
                <span class="text-sm text-gray-700 dark:text-gray-300">Visible in network browser</span>
              </label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button @click="showShareModal = false" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
            <button @click="saveShare" :disabled="shareLoading || !shareForm.name || !shareForm.path" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <svg v-if="shareLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              {{ shareModalMode === 'create' ? 'Create' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
