<script setup>
/**
 * StorageView.vue — Sprint 3 G2 Rewrite + G3 Integration
 *
 * Full tab-based storage management view.
 *
 * Tabs:
 *   1. Overview   — Usage summary, health cards, Docker storage
 *   2. Devices    — Block device list with SMART detail expansion
 *   3. USB        — Full USB device management (USBDevices component)
 *   4. Network Mounts — Full SMB/NFS mount management (NetworkMounts component)
 *   5. SMB Shares — Samba share management with detail panel
 *
 * Stores:
 *   - useStorageHalStore  → HAL devices, usage, SMART data
 *   - useStorageStore     → Storage overview, health, mounts
 *   - useSMBStore         → SMB status, shares, CRUD
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useStorageStore } from '@/stores/storage'
import { useSMBStore } from '@/stores/smb'
import { confirm } from '@/utils/confirmDialog'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useFocusTrap } from '@/composables/useFocusTrap'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'
import DeviceHealth from '@/components/storage/DeviceHealth.vue'
import USBDevices from '@/components/storage/USBDevices.vue'
import NetworkMounts from '@/components/storage/NetworkMounts.vue'

const { signal } = useAbortOnUnmount()
const { trapFocus } = useFocusTrap()

const storageHalStore = useStorageHalStore()
const storageStore = useStorageStore()
const smbStore = useSMBStore()

// ==========================================
// Tabs
// ==========================================

const activeTab = ref('overview')
const tabs = computed(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'devices', label: 'Devices', badge: storageHalStore.deviceCount || null },
  { id: 'usb', label: 'USB', badge: storageHalStore.usbDeviceCount || null },
  { id: 'network-mounts', label: 'Network Mounts', badge: storageHalStore.networkMountCount || null },
  { id: 'smb', label: 'SMB Shares', badge: smbStore.shareCount || null }
])

// Track which tabs have been loaded (lazy loading)
const tabsLoaded = ref({ overview: false })

function onTabChange(tabId) {
  activeTab.value = tabId

  if (tabId === 'devices' && !tabsLoaded.value.devices) {
    tabsLoaded.value.devices = true
    storageHalStore.fetchDevices()
  }
  if (tabId === 'usb' && !tabsLoaded.value.usb) {
    tabsLoaded.value.usb = true
    storageHalStore.fetchUSBDevices()
    storageHalStore.fetchUSBStorage()
  }
  if (tabId === 'network-mounts' && !tabsLoaded.value['network-mounts']) {
    tabsLoaded.value['network-mounts'] = true
    storageHalStore.fetchNetworkMounts()
  }
  if (tabId === 'smb' && !tabsLoaded.value.smb) {
    tabsLoaded.value.smb = true
    smbStore.fetchAll()
  }
}

// ==========================================
// State
// ==========================================

const loading = ref(true)
const error = ref(null)

// Docker usage (fetched directly — not in a store)
const dockerUsage = ref(null)
const cleanupLoading = ref(false)

// Devices tab — expanded device
const expandedDevice = ref(null)

// SMB modal state
const showShareModal = ref(false)
const shareModalMode = ref('create')
const shareModalRef = ref(null)
const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  browseable: true,
  read_only: false,
  guest_ok: true
})
const shareLoading = ref(false)

// SMB detail expansion
const expandedShare = ref(null)
const shareDetailLoading = ref(false)

// Focus share modal when shown
watch(showShareModal, (visible) => {
  if (visible) nextTick(() => shareModalRef.value?.focus())
})

// ==========================================
// Data Fetching
// ==========================================

async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    const opts = { signal: s }
    // Parallel fetch of overview data
    const [, , dockerInfo] = await Promise.all([
      storageHalStore.fetchUsage(opts),
      storageStore.fetchAll(opts),
      api.get('/docker/disk-usage', {}, opts).catch(() => null)
    ])

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

    tabsLoaded.value.overview = true
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function dockerPrune() {
  if (!await confirm({
    title: 'Docker Cleanup',
    message: 'This will remove unused Docker images, containers, and volumes. Continue?',
    confirmText: 'Clean Up',
    variant: 'warning'
  })) return

  cleanupLoading.value = true
  try {
    await api.post('/docker/prune')
    // Re-fetch docker usage
    const dockerInfo = await api.get('/docker/disk-usage').catch(() => null)
    if (dockerInfo) dockerUsage.value = dockerInfo
  } catch (e) {
    error.value = e.message
  } finally {
    cleanupLoading.value = false
  }
}

// ==========================================
// Devices Tab
// ==========================================

function toggleDeviceExpand(device) {
  if (expandedDevice.value === device) {
    expandedDevice.value = null
  } else {
    expandedDevice.value = device
  }
}

// ==========================================
// SMB Tab Actions
// ==========================================

function openCreateShare() {
  shareModalMode.value = 'create'
  shareForm.value = {
    name: '',
    path: '/cubeos/shares/',
    comment: '',
    browseable: true,
    read_only: false,
    guest_ok: true
  }
  showShareModal.value = true
}

function openEditShare(share) {
  shareModalMode.value = 'edit'
  shareForm.value = { ...share }
  showShareModal.value = true
}

async function saveShare() {
  if (!shareForm.value.name || !shareForm.value.path) return
  shareLoading.value = true
  try {
    if (shareModalMode.value === 'create') {
      await smbStore.createShare(shareForm.value)
    } else {
      await smbStore.updateShare(shareForm.value.name, shareForm.value)
    }
    showShareModal.value = false
  } catch (e) {
    error.value = 'Failed to save share: ' + e.message
  } finally {
    shareLoading.value = false
  }
}

async function deleteShare(name) {
  if (!await confirm({
    title: 'Delete Share',
    message: `Delete share "${name}"? The shared folder will NOT be deleted.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  try {
    await smbStore.deleteShare(name)
    if (expandedShare.value === name) expandedShare.value = null
  } catch (e) {
    error.value = 'Failed to delete share: ' + e.message
  }
}

async function toggleShareDetail(name) {
  if (expandedShare.value === name) {
    expandedShare.value = null
    smbStore.clearSelectedShare()
    return
  }
  expandedShare.value = name
  shareDetailLoading.value = true
  try {
    await smbStore.fetchShareDetail(name)
  } catch (e) {
    // Detail fetch failed — still show the share row
  } finally {
    shareDetailLoading.value = false
  }
}

// ==========================================
// Helpers
// ==========================================

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = Number(bytes)
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

function usageColor(percent) {
  if (percent >= 90) return 'bg-error'
  if (percent >= 75) return 'bg-warning'
  return 'bg-success'
}

function usageTextColor(percent) {
  if (percent >= 90) return 'text-error'
  if (percent >= 75) return 'text-warning'
  return 'text-success'
}

function healthBadgeClass(status) {
  if (!status) return 'bg-theme-tertiary text-theme-muted'
  const s = String(status).toUpperCase()
  if (s === 'PASSED' || s === 'OK' || s === 'HEALTHY') return 'bg-success-muted text-success'
  if (s === 'FAILED' || s === 'FAILING') return 'bg-error-muted text-error'
  return 'bg-warning-muted text-warning'
}

function deviceTypeIcon(type) {
  if (!type) return 'HardDrive'
  const t = String(type).toLowerCase()
  if (t.includes('ssd') || t.includes('nvme')) return 'Cpu'
  if (t.includes('usb')) return 'Usb'
  if (t.includes('sd') || t.includes('mmc')) return 'CreditCard'
  return 'HardDrive'
}

// Compute disks for overview from store or HAL
const overviewDisks = computed(() => {
  // Prefer HAL usage data
  if (storageHalStore.usage?.filesystems?.length) {
    return storageHalStore.usage.filesystems
  }
  // Fallback to storage overview
  if (storageStore.overview?.disks?.length) {
    return storageStore.overview.disks
  }
  return []
})

// Compute health list
const healthDisks = computed(() => {
  if (storageStore.health?.disks?.length) return storageStore.health.disks
  if (Array.isArray(storageStore.health)) return storageStore.health
  return []
})

// Mounts list
const storageMounts = computed(() => storageStore.mounts || [])

// ==========================================
// Polling — only refresh active tab data
// ==========================================

let pollInterval = null

function pollActiveTab() {
  switch (activeTab.value) {
    case 'overview':
      fetchAll()
      break
    case 'devices':
      storageHalStore.fetchDevices()
      break
    case 'usb':
      storageHalStore.fetchUSBDevices()
      break
    case 'network-mounts':
      storageHalStore.fetchNetworkMounts()
      break
    case 'smb':
      smbStore.fetchAll()
      break
  }
}

onMounted(() => {
  fetchAll()
  pollInterval = setInterval(pollActiveTab, 15000)
})
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-theme-primary">Storage</h1>
        <p class="text-theme-tertiary mt-1">Manage disks, USB devices, network mounts, and file shares</p>
      </div>
      <button
        @click="fetchAll"
        :disabled="loading"
        class="p-2 bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 disabled:opacity-50"
        title="Refresh"
        aria-label="Refresh storage"
      >
        <Icon name="RefreshCw" :size="18" :class="{ 'animate-spin': loading }" class="text-theme-secondary" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary overflow-x-auto">
      <nav class="flex gap-1 sm:gap-4 min-w-max" role="tablist" aria-label="Storage sections">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="onTabChange(tab.id)"
          role="tab"
          :aria-selected="activeTab === tab.id"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.id
            ? 'border-[color:var(--accent-primary)] text-accent'
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          {{ tab.label }}
          <span
            v-if="tab.badge"
            class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
            :class="activeTab === tab.id ? 'bg-accent text-white' : 'bg-theme-tertiary text-theme-secondary'"
          >
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ error }}</p>
        <button @click="error = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- ==================== Overview Tab ==================== -->
    <div v-if="activeTab === 'overview'" class="space-y-6">

      <!-- Storage Usage Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- HAL Usage Summary -->
        <div v-if="storageHalStore.usage" class="bg-theme-card rounded-xl border border-theme-primary p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Icon name="Database" :size="20" class="text-accent" />
              </div>
              <div>
                <h3 class="font-semibold text-theme-primary">System Storage</h3>
                <p class="text-sm text-theme-muted">
                  {{ formatBytes(storageHalStore.usedSpace) }} of {{ formatBytes(storageHalStore.totalSpace) }}
                </p>
              </div>
            </div>
            <span :class="usageTextColor(storageHalStore.usagePercent)" class="text-lg font-bold">
              {{ storageHalStore.usagePercent }}%
            </span>
          </div>
          <div class="h-3 bg-theme-tertiary rounded-full overflow-hidden mb-3">
            <div
              :class="usageColor(storageHalStore.usagePercent)"
              class="h-full transition-all"
              :style="{ width: storageHalStore.usagePercent + '%' }"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-theme-muted">
            <span>Used: {{ formatBytes(storageHalStore.usedSpace) }}</span>
            <span>Free: {{ formatBytes(storageHalStore.freeSpace) }}</span>
          </div>
        </div>

        <!-- Per-disk cards from overview -->
        <div
          v-for="disk in overviewDisks"
          :key="disk.mountpoint || disk.device"
          class="bg-theme-card rounded-xl border border-theme-primary p-6"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Icon :name="deviceTypeIcon(disk.type || disk.fstype)" :size="20" class="text-accent" />
              </div>
              <div>
                <h3 class="font-semibold text-theme-primary">{{ disk.mountpoint || disk.device }}</h3>
                <p class="text-sm text-theme-muted">{{ disk.device }} · {{ disk.fstype || disk.type || 'unknown' }}</p>
              </div>
            </div>
            <span
              v-if="disk.percent_used != null"
              :class="usageTextColor(disk.percent_used)"
              class="text-lg font-bold"
            >{{ Number(disk.percent_used).toFixed(0) }}%</span>
          </div>
          <div v-if="disk.percent_used != null" class="h-3 bg-theme-tertiary rounded-full overflow-hidden mb-3">
            <div :class="usageColor(disk.percent_used)" class="h-full transition-all" :style="{ width: disk.percent_used + '%' }"></div>
          </div>
          <div class="flex justify-between text-xs text-theme-muted">
            <span>Used: {{ formatBytes(disk.used_bytes || disk.used) }}</span>
            <span>Free: {{ formatBytes(disk.free_bytes || disk.free) }}</span>
            <span>Total: {{ formatBytes(disk.total_bytes || disk.total) }}</span>
          </div>
        </div>
      </div>

      <!-- Health Quick Cards -->
      <div v-if="healthDisks.length > 0" class="space-y-4">
        <h2 class="text-lg font-semibold text-theme-primary">Disk Health</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="disk in healthDisks"
            :key="disk.device"
            class="bg-theme-card rounded-xl border border-theme-primary p-4 flex items-center gap-3 cursor-pointer hover:bg-theme-secondary/30 transition-colors"
            @click="onTabChange('devices')"
          >
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="healthBadgeClass(disk.health)">
              <Icon
                :name="disk.health === 'PASSED' ? 'CheckCircle' : disk.health === 'FAILED' ? 'XCircle' : 'AlertCircle'"
                :size="20"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-theme-primary truncate">{{ disk.model || disk.device }}</p>
              <p class="text-xs text-theme-muted truncate">{{ disk.device }} · {{ disk.type }} · {{ disk.capacity }}</p>
            </div>
            <span
              class="px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase"
              :class="healthBadgeClass(disk.health)"
            >{{ disk.health || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- Docker Storage -->
      <div v-if="dockerUsage" class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Icon name="Container" :size="20" class="text-accent" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Docker Storage</h3>
              <p class="text-sm text-theme-muted">{{ formatBytes(dockerUsage.total_size) }} total</p>
            </div>
          </div>
          <button
            @click="dockerPrune"
            :disabled="cleanupLoading"
            class="px-3 py-1.5 text-sm bg-error-muted text-error rounded-lg hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
            aria-label="Clean up Docker storage"
          >
            <Icon v-if="cleanupLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Trash2" :size="14" />
            {{ cleanupLoading ? 'Cleaning...' : 'Clean Up' }}
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-3 bg-theme-secondary/50 rounded-lg">
            <p class="text-xs text-theme-muted mb-1">Images ({{ dockerUsage.images_count }})</p>
            <p class="font-semibold text-theme-primary">{{ formatBytes(dockerUsage.images_size) }}</p>
          </div>
          <div class="p-3 bg-theme-secondary/50 rounded-lg">
            <p class="text-xs text-theme-muted mb-1">Containers ({{ dockerUsage.containers_count }})</p>
            <p class="font-semibold text-theme-primary">{{ formatBytes(dockerUsage.containers_size) }}</p>
          </div>
          <div class="p-3 bg-theme-secondary/50 rounded-lg">
            <p class="text-xs text-theme-muted mb-1">Volumes ({{ dockerUsage.volumes_count }})</p>
            <p class="font-semibold text-theme-primary">{{ formatBytes(dockerUsage.volumes_size) }}</p>
          </div>
          <div class="p-3 bg-theme-secondary/50 rounded-lg">
            <p class="text-xs text-theme-muted mb-1">Build Cache</p>
            <p class="font-semibold text-theme-primary">{{ formatBytes(dockerUsage.build_cache_size) }}</p>
          </div>
        </div>
      </div>

      <!-- Storage Mounts -->
      <div v-if="storageMounts.length > 0" class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
            <Icon name="FolderOpen" :size="20" class="text-accent" />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Mounts</h3>
            <p class="text-sm text-theme-muted">{{ storageMounts.length }} configured mount{{ storageMounts.length !== 1 ? 's' : '' }}</p>
          </div>
        </div>
        <div class="space-y-2">
          <div
            v-for="mount in storageMounts"
            :key="mount.id || mount.name"
            class="flex items-center justify-between p-3 rounded-lg hover:bg-theme-tertiary/50"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <Icon name="HardDrive" :size="14" class="text-theme-muted flex-shrink-0" />
              <div class="min-w-0">
                <p class="text-sm text-theme-primary truncate">{{ mount.mountpoint || mount.name }}</p>
                <p class="text-xs text-theme-muted truncate">{{ mount.device || mount.source || mount.type }}</p>
              </div>
            </div>
            <span
              class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
              :class="mount.active || mount.mounted ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
            >{{ mount.active || mount.mounted ? 'Mounted' : 'Unmounted' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Devices Tab ==================== -->
    <div v-if="activeTab === 'devices'" class="space-y-6">
      <!-- Loading -->
      <div v-if="storageHalStore.loading" class="flex items-center justify-center py-12">
        <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
        <span class="ml-3 text-theme-muted">Loading devices...</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="storageHalStore.devices.length === 0" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
        <Icon name="HardDrive" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h3 class="text-lg font-medium text-theme-primary mb-2">No Block Devices Found</h3>
        <p class="text-theme-muted">Block devices will appear here when detected by HAL.</p>
      </div>

      <!-- Device list — desktop table -->
      <div v-else class="hidden md:block">
        <div class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-theme-muted border-b border-theme-primary bg-theme-tertiary/30">
                <th class="py-3 px-4">Device</th>
                <th class="py-3 px-4">Model</th>
                <th class="py-3 px-4">Size</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Mount</th>
                <th class="py-3 px-4">Health</th>
                <th class="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="device in storageHalStore.devices" :key="device.name || device.device">
                <tr
                  class="border-b border-theme-primary/50 hover:bg-theme-tertiary/30 cursor-pointer transition-colors"
                  @click="toggleDeviceExpand(device.name || device.device)"
                >
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <Icon :name="deviceTypeIcon(device.type)" :size="16" class="text-accent" />
                      <span class="text-theme-primary font-medium">{{ device.name || device.device }}</span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-theme-secondary">{{ device.model || '-' }}</td>
                  <td class="py-3 px-4 text-theme-secondary">{{ device.size || device.capacity || '-' }}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-secondary uppercase">
                      {{ device.type || device.tran || '-' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-theme-muted text-xs">{{ device.mountpoint || device.mount || '-' }}</td>
                  <td class="py-3 px-4">
                    <DeviceHealth :device="device.name || device.device" :inline="true" />
                  </td>
                  <td class="py-3 px-4">
                    <Icon
                      name="ChevronDown"
                      :size="16"
                      class="text-theme-muted transition-transform"
                      :class="{ 'rotate-180': expandedDevice === (device.name || device.device) }"
                    />
                  </td>
                </tr>
                <!-- Expanded detail panel -->
                <tr v-if="expandedDevice === (device.name || device.device)">
                  <td colspan="7" class="p-4 bg-theme-tertiary/20">
                    <div class="space-y-4">
                      <!-- Device info grid -->
                      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div class="p-3 bg-theme-secondary/50 rounded-lg">
                          <p class="text-xs text-theme-muted mb-1">Serial</p>
                          <p class="text-xs font-mono text-theme-primary truncate">{{ device.serial || '-' }}</p>
                        </div>
                        <div class="p-3 bg-theme-secondary/50 rounded-lg">
                          <p class="text-xs text-theme-muted mb-1">Firmware</p>
                          <p class="text-xs font-mono text-theme-primary">{{ device.firmware || device.rev || '-' }}</p>
                        </div>
                        <div class="p-3 bg-theme-secondary/50 rounded-lg">
                          <p class="text-xs text-theme-muted mb-1">Transport</p>
                          <p class="text-xs text-theme-primary">{{ device.tran || device.transport || '-' }}</p>
                        </div>
                        <div class="p-3 bg-theme-secondary/50 rounded-lg">
                          <p class="text-xs text-theme-muted mb-1">Filesystem</p>
                          <p class="text-xs text-theme-primary">{{ device.fstype || '-' }}</p>
                        </div>
                      </div>
                      <!-- SMART Data -->
                      <DeviceHealth :device="device.name || device.device" />
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Device list — mobile cards -->
      <div v-if="storageHalStore.devices.length > 0" class="md:hidden space-y-3">
        <div
          v-for="device in storageHalStore.devices"
          :key="'m-' + (device.name || device.device)"
          class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
        >
          <div
            class="p-4 flex items-center gap-3 cursor-pointer"
            @click="toggleDeviceExpand(device.name || device.device)"
          >
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon :name="deviceTypeIcon(device.type)" :size="20" class="text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-theme-primary">{{ device.name || device.device }}</p>
              <p class="text-xs text-theme-muted truncate">{{ device.model || '-' }} · {{ device.size || device.capacity || '-' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <DeviceHealth :device="device.name || device.device" :inline="true" />
              <Icon
                name="ChevronDown"
                :size="16"
                class="text-theme-muted transition-transform flex-shrink-0"
                :class="{ 'rotate-180': expandedDevice === (device.name || device.device) }"
              />
            </div>
          </div>
          <!-- Mobile expanded -->
          <div v-if="expandedDevice === (device.name || device.device)" class="px-4 pb-4 border-t border-theme-primary/50">
            <div class="pt-4 space-y-3">
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span class="text-theme-muted block">Mount</span>
                  <span class="text-theme-primary">{{ device.mountpoint || device.mount || '-' }}</span>
                </div>
                <div>
                  <span class="text-theme-muted block">Type</span>
                  <span class="text-theme-primary">{{ device.type || device.tran || '-' }}</span>
                </div>
                <div>
                  <span class="text-theme-muted block">Serial</span>
                  <span class="text-theme-primary font-mono truncate block">{{ device.serial || '-' }}</span>
                </div>
                <div>
                  <span class="text-theme-muted block">Filesystem</span>
                  <span class="text-theme-primary">{{ device.fstype || '-' }}</span>
                </div>
              </div>
              <DeviceHealth :device="device.name || device.device" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== USB Tab ==================== -->
    <div v-if="activeTab === 'usb'" class="space-y-6">
      <USBDevices />
    </div>

    <!-- ==================== Network Mounts Tab ==================== -->
    <div v-if="activeTab === 'network-mounts'" class="space-y-6">
      <NetworkMounts />
    </div>

    <!-- ==================== SMB Shares Tab ==================== -->
    <div v-if="activeTab === 'smb'" class="space-y-6">

      <!-- SMB Status Card -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center"
              :class="smbStore.isRunning ? 'bg-success-muted' : 'bg-theme-tertiary'"
            >
              <Icon name="Server" :size="20"
                :class="smbStore.isRunning ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Samba File Server</h3>
              <p class="text-sm text-theme-muted">
                {{ smbStore.status?.installed ? (smbStore.isRunning ? 'Running' : 'Stopped') : 'Not installed' }}
                <span v-if="smbStore.status?.version"> · {{ smbStore.status.version }}</span>
              </p>
            </div>
          </div>
          <button
            @click="openCreateShare"
            :disabled="!smbStore.status?.installed"
            class="px-4 py-2 btn-accent rounded-lg hover:bg-[color:var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <Icon name="Plus" :size="16" />
            Add Share
          </button>
        </div>
      </div>

      <!-- Not installed warning -->
      <div v-if="smbStore.status && !smbStore.status.installed" class="bg-warning-muted border border-warning rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="AlertCircle" :size="16" class="text-warning" />
          <p class="text-sm font-medium text-warning">Samba is not installed</p>
        </div>
        <p class="text-sm text-theme-muted">Install Samba to create network file shares.</p>
        <code class="block mt-2 p-2 bg-code text-code rounded text-xs font-mono">apt install samba</code>
      </div>

      <!-- Shares list -->
      <div v-if="smbStore.shares.length > 0" class="space-y-3">
        <div
          v-for="share in smbStore.shares"
          :key="share.name"
          class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
        >
          <!-- Share header row -->
          <div class="p-4 flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0 cursor-pointer"
              @click="toggleShareDetail(share.name)"
            >
              <Icon name="FolderOpen" :size="20" class="text-accent" />
            </div>
            <div
              class="flex-1 min-w-0 cursor-pointer"
              @click="toggleShareDetail(share.name)"
            >
              <h4 class="font-medium text-theme-primary">{{ share.name }}</h4>
              <p class="text-sm text-theme-muted truncate">{{ share.path }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span v-if="share.read_only" class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-theme-tertiary text-theme-secondary rounded">Read Only</span>
              <span v-if="share.guest_ok" class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-success-muted text-success rounded">Guest</span>
              <button @click="openEditShare(share)" class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary" title="Edit share" :aria-label="'Edit share ' + share.name">
                <Icon name="Pencil" :size="14" />
              </button>
              <button @click="deleteShare(share.name)" class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted" title="Delete share" :aria-label="'Delete share ' + share.name">
                <Icon name="Trash2" :size="14" />
              </button>
              <button @click="toggleShareDetail(share.name)" class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg" :aria-label="'Toggle details for ' + share.name" :aria-expanded="expandedShare === share.name">
                <Icon
                  name="ChevronDown"
                  :size="14"
                  class="transition-transform"
                  :class="{ 'rotate-180': expandedShare === share.name }"
                />
              </button>
            </div>
          </div>

          <p v-if="share.comment && expandedShare !== share.name" class="px-4 pb-3 text-sm text-theme-muted -mt-1">{{ share.comment }}</p>

          <!-- Expanded detail panel -->
          <div v-if="expandedShare === share.name" class="px-4 pb-4 border-t border-theme-primary/50">
            <div v-if="shareDetailLoading" class="py-4 flex items-center justify-center">
              <Icon name="Loader2" :size="16" class="animate-spin text-theme-muted" />
              <span class="ml-2 text-sm text-theme-muted">Loading details...</span>
            </div>
            <div v-else class="pt-4">
              <p v-if="share.comment" class="text-sm text-theme-muted mb-3">{{ share.comment }}</p>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span class="text-xs text-theme-muted block">Path</span>
                  <span class="text-theme-primary font-mono text-xs">{{ smbStore.selectedShare?.path || share.path }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Browseable</span>
                  <span class="text-theme-primary">{{ (smbStore.selectedShare?.browseable ?? share.browseable) ? 'Yes' : 'No' }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Read Only</span>
                  <span class="text-theme-primary">{{ (smbStore.selectedShare?.read_only ?? share.read_only) ? 'Yes' : 'No' }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Guest Access</span>
                  <span class="text-theme-primary">{{ (smbStore.selectedShare?.guest_ok ?? share.guest_ok) ? 'Yes' : 'No' }}</span>
                </div>
                <div v-if="smbStore.selectedShare?.valid_users">
                  <span class="text-xs text-theme-muted block">Valid Users</span>
                  <span class="text-theme-primary">{{ smbStore.selectedShare.valid_users }}</span>
                </div>
                <div v-if="smbStore.selectedShare?.write_list">
                  <span class="text-xs text-theme-muted block">Write List</span>
                  <span class="text-theme-primary">{{ smbStore.selectedShare.write_list }}</span>
                </div>
              </div>
              <!-- Mobile badges that were hidden on sm -->
              <div class="flex gap-2 mt-3 sm:hidden">
                <span v-if="share.read_only" class="px-2 py-0.5 text-[10px] font-semibold bg-theme-tertiary text-theme-secondary rounded">Read Only</span>
                <span v-if="share.guest_ok" class="px-2 py-0.5 text-[10px] font-semibold bg-success-muted text-success rounded">Guest</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="smbStore.status?.installed && !smbStore.loading" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
        <Icon name="FolderOpen" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h3 class="text-lg font-medium text-theme-primary mb-2">No Shares Configured</h3>
        <p class="text-theme-muted mb-4">Create a network share to access files from other devices.</p>
        <button @click="openCreateShare" class="px-4 py-2 btn-accent rounded-lg text-sm">Create First Share</button>
      </div>
    </div>

    <!-- ==================== Share Modal ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showShareModal"
          ref="shareModalRef"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          :aria-label="shareModalMode === 'create' ? 'Create Share' : 'Edit Share'"
          tabindex="-1"
          @keydown.escape="showShareModal = false"
          @keydown="trapFocus"
        >
          <div class="absolute inset-0 bg-black/50" @click="showShareModal = false"></div>
          <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary">
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
              <h3 class="text-lg font-semibold text-theme-primary">
                {{ shareModalMode === 'create' ? 'Create Share' : 'Edit Share' }}
              </h3>
              <button @click="showShareModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
                <Icon name="X" :size="18" />
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Share Name</label>
                <input
                  v-model="shareForm.name"
                  type="text"
                  :disabled="shareModalMode === 'edit'"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent disabled:opacity-50"
                  placeholder="documents"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Folder Path</label>
                <input
                  v-model="shareForm.path"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="/cubeos/shares/documents"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
                <input
                  v-model="shareForm.comment"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="My documents"
                >
              </div>
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.guest_ok" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Allow guest access (no password)</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.read_only" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Read only</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.browseable" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Visible in network browser</span>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary">
              <button @click="showShareModal = false" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">
                Cancel
              </button>
              <button
                @click="saveShare"
                :disabled="shareLoading || !shareForm.name || !shareForm.path"
                class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon v-if="shareLoading" name="Loader2" :size="14" class="animate-spin" />
                {{ shareModalMode === 'create' ? 'Create' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
