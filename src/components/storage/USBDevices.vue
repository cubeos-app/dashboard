<script setup>
/**
 * USBDevices.vue — Sprint 3 G3
 *
 * Full USB device management component. Replaces G2 placeholder in StorageView USB tab.
 *
 * Features:
 *   - All USB devices list with class icons and expandable detail rows
 *   - Storage-specific USB devices with mount/unmount/eject actions
 *   - USB tree hierarchy view (collapsible)
 *   - Rescan and per-device reset
 *   - Per-device loading spinners
 *   - Responsive: desktop table → mobile card layout
 *
 * Stores:
 *   - useStorageHalStore → USB devices, storage, tree, mount/unmount/eject/reset/rescan
 */
import { ref, computed, onMounted } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const storageHalStore = useStorageHalStore()

// ==========================================
// State
// ==========================================

const viewMode = ref('all') // 'all' | 'storage' | 'tree'
const expandedDevice = ref(null)
const actionError = ref(null)
const treeLoading = ref(false)
const filterClass = ref(null)

// ==========================================
// Computed
// ==========================================

const allDevices = computed(() => storageHalStore.usbDevices || [])
const storageDevices = computed(() => storageHalStore.usbStorage || [])

const filteredDevices = computed(() => {
  if (!filterClass.value) return allDevices.value
  return allDevices.value.filter(d =>
    (d.class || d.type || '').toLowerCase() === filterClass.value
  )
})

const deviceClasses = computed(() => {
  const classes = new Set()
  for (const d of allDevices.value) {
    const cls = (d.class || d.type || '').toLowerCase()
    if (cls) classes.add(cls)
  }
  return Array.from(classes).sort()
})

const usbTree = computed(() => storageHalStore.usbTree)

// ==========================================
// Data Fetching
// ==========================================

async function refresh() {
  actionError.value = null
  await Promise.all([
    storageHalStore.fetchUSBDevices(),
    storageHalStore.fetchUSBStorage()
  ])
}

async function rescan() {
  actionError.value = null
  try {
    await storageHalStore.rescanUSB()
  } catch (e) {
    actionError.value = 'Rescan failed: ' + e.message
  }
}

async function loadTree() {
  treeLoading.value = true
  try {
    await storageHalStore.fetchUSBTree()
  } catch (e) {
    actionError.value = 'Failed to load USB tree: ' + e.message
  } finally {
    treeLoading.value = false
  }
}

function onViewChange(mode) {
  viewMode.value = mode
  if (mode === 'tree' && !usbTree.value) {
    loadTree()
  }
}

onMounted(refresh)

// ==========================================
// Device Actions
// ==========================================

async function mountDevice(device) {
  actionError.value = null
  try {
    await storageHalStore.mountUSB(device.device || device.path)
  } catch (e) {
    actionError.value = `Mount failed: ${e.message}`
  }
}

async function unmountDevice(device) {
  const name = device.device || device.path || 'this device'
  if (!await confirm({
    title: 'Unmount USB Device',
    message: `Unmount ${name}? Make sure no files are being accessed.`,
    confirmText: 'Unmount',
    variant: 'warning'
  })) return

  actionError.value = null
  try {
    await storageHalStore.unmountUSB(device.device || device.path)
  } catch (e) {
    actionError.value = `Unmount failed: ${e.message}`
  }
}

async function ejectDevice(device) {
  const name = device.product || device.name || device.device || 'this device'
  if (!await confirm({
    title: 'Eject USB Device',
    message: `Safely eject "${name}"? The device will be powered down and can be physically removed.`,
    confirmText: 'Eject',
    variant: 'danger'
  })) return

  actionError.value = null
  try {
    await storageHalStore.ejectUSB(device.device || device.path)
  } catch (e) {
    actionError.value = `Eject failed: ${e.message}`
  }
}

async function resetDevice(device) {
  const name = device.product || device.name || 'this device'
  if (!await confirm({
    title: 'Reset USB Device',
    message: `Reset "${name}"? This power-cycles the USB port. The device may momentarily disconnect.`,
    confirmText: 'Reset',
    variant: 'warning'
  })) return

  actionError.value = null
  try {
    await storageHalStore.resetUSBDevice(device.bus, device.device_num || device.port)
  } catch (e) {
    actionError.value = `Reset failed: ${e.message}`
  }
}

// ==========================================
// Helpers
// ==========================================

function toggleExpand(deviceKey) {
  expandedDevice.value = expandedDevice.value === deviceKey ? null : deviceKey
}

function deviceKey(device) {
  return device.device || device.path || `${device.bus}:${device.port}`
}

function isDeviceLoading(device) {
  const key = device.device || device.path || `${device.bus}:${device.device_num || device.port}`
  return storageHalStore.isUSBDeviceLoading(key)
    || storageHalStore.isUSBDeviceLoading(`${device.bus}:${device.device_num || device.port}`)
}

function isStorageDevice(device) {
  const cls = (device.class || device.type || '').toLowerCase()
  return cls === 'storage' || cls === 'mass_storage' || cls === 'mass storage'
}

function isMounted(device) {
  return !!(device.mounted || device.mountpoint)
}

function classIcon(cls) {
  if (!cls) return 'Usb'
  const c = String(cls).toLowerCase()
  if (c === 'storage' || c === 'mass_storage' || c === 'mass storage') return 'HardDrive'
  if (c === 'hub') return 'GitBranch'
  if (c.includes('audio') || c.includes('sound')) return 'Volume2'
  if (c.includes('video') || c.includes('camera')) return 'Camera'
  if (c.includes('hid') || c.includes('input')) return 'Mouse'
  if (c.includes('network') || c.includes('wireless') || c.includes('wifi')) return 'Wifi'
  if (c.includes('printer')) return 'Printer'
  if (c.includes('serial') || c.includes('comm')) return 'Cable'
  return 'Usb'
}

function classBadgeClass(cls) {
  if (!cls) return 'bg-theme-tertiary text-theme-secondary'
  const c = String(cls).toLowerCase()
  if (c === 'storage' || c === 'mass_storage' || c === 'mass storage') return 'bg-accent-muted text-accent'
  if (c === 'hub') return 'bg-theme-tertiary text-theme-secondary'
  return 'bg-theme-tertiary text-theme-secondary'
}

function formatSize(bytes) {
  return storageHalStore.formatBytes(bytes)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with view toggle + actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-theme-primary">
          USB Devices
          <span class="text-sm font-normal text-theme-muted ml-2">
            {{ allDevices.length }} device{{ allDevices.length !== 1 ? 's' : '' }}
            <template v-if="storageDevices.length > 0">
              · {{ storageDevices.length }} storage
            </template>
          </span>
        </h2>
      </div>
      <div class="flex items-center gap-2">
        <!-- View mode toggle -->
        <div class="flex rounded-lg overflow-hidden border border-theme-primary" role="tablist" aria-label="USB device views">
          <button
            v-for="mode in [{ id: 'all', label: 'All' }, { id: 'storage', label: 'Storage' }, { id: 'tree', label: 'Tree' }]"
            :key="mode.id"
            @click="onViewChange(mode.id)"
            role="tab"
            :aria-selected="viewMode === mode.id"
            :aria-label="'View ' + mode.label + ' devices'"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === mode.id
              ? 'bg-accent text-white'
              : 'text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary'"
          >{{ mode.label }}</button>
        </div>
        <!-- Rescan -->
        <button
          @click="rescan"
          :disabled="storageHalStore.loading"
          class="px-3 py-1.5 text-sm bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 flex items-center gap-1.5 disabled:opacity-50"
          aria-label="Rescan USB bus"
        >
          <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': storageHalStore.loading }" />
          Rescan
        </button>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="storageHalStore.loading && allDevices.length === 0" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading USB devices...</span>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="allDevices.length === 0 && storageDevices.length === 0"
      class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center"
    >
      <Icon name="Usb" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No USB Devices</h3>
      <p class="text-theme-muted mb-4">Connect a USB device to manage it here.</p>
      <button
        @click="rescan"
        :disabled="storageHalStore.loading"
        class="px-4 py-2 btn-accent rounded-lg text-sm flex items-center gap-2 mx-auto"
      >
        <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': storageHalStore.loading }" />
        Rescan USB Bus
      </button>
    </div>

    <!-- ==================== All Devices View ==================== -->
    <template v-else-if="viewMode === 'all'">
      <!-- Class filter -->
      <div v-if="deviceClasses.length > 1" class="flex flex-wrap gap-2">
        <button
          @click="filterClass = null"
          class="px-2.5 py-1 text-xs rounded-lg transition-colors"
          :class="filterClass === null ? 'bg-accent text-white' : 'bg-theme-tertiary text-theme-muted hover:text-theme-primary'"
          aria-label="Show all device classes"
        >All</button>
        <button
          v-for="cls in deviceClasses"
          :key="cls"
          @click="filterClass = filterClass === cls ? null : cls"
          class="px-2.5 py-1 text-xs rounded-lg transition-colors capitalize"
          :class="filterClass === cls ? 'bg-accent text-white' : 'bg-theme-tertiary text-theme-muted hover:text-theme-primary'"
          :aria-label="'Filter by ' + cls"
        >{{ cls }}</button>
      </div>

      <!-- Desktop table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-theme-muted border-b border-theme-primary text-xs">
              <th class="py-2 px-3">Device</th>
              <th class="py-2 px-3">Vendor</th>
              <th class="py-2 px-3">Class</th>
              <th class="py-2 px-3">Bus</th>
              <th class="py-2 px-3">Status</th>
              <th class="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="device in filteredDevices" :key="deviceKey(device)">
              <tr
                class="border-b border-theme-primary/50 hover:bg-theme-card cursor-pointer transition-colors"
                @click="toggleExpand(deviceKey(device))"
              >
                <td class="py-3 px-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :class="isStorageDevice(device) ? 'bg-accent-muted' : 'bg-theme-tertiary'"
                    >
                      <Icon :name="classIcon(device.class || device.type)" :size="16"
                        :class="isStorageDevice(device) ? 'text-accent' : 'text-theme-muted'"
                      />
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-theme-primary truncate">
                        {{ device.product || device.name || device.description || 'USB Device' }}
                      </p>
                      <p v-if="device.device || device.path" class="text-xs text-theme-muted font-mono truncate">
                        {{ device.device || device.path }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-3 text-theme-secondary text-xs truncate max-w-[140px]">
                  {{ device.vendor || device.manufacturer || '-' }}
                </td>
                <td class="py-3 px-3">
                  <span
                    class="px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize"
                    :class="classBadgeClass(device.class || device.type)"
                  >{{ device.class || device.type || 'device' }}</span>
                </td>
                <td class="py-3 px-3 text-theme-muted text-xs font-mono">
                  {{ device.bus || '-' }}{{ device.port ? ':' + device.port : '' }}
                </td>
                <td class="py-3 px-3">
                  <span v-if="isMounted(device)" class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-success-muted text-success">Mounted</span>
                  <span v-else-if="isStorageDevice(device)" class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-theme-tertiary text-theme-muted">Not Mounted</span>
                </td>
                <td class="py-3 px-3 text-right" @click.stop>
                  <div class="flex items-center justify-end gap-1">
                    <template v-if="isDeviceLoading(device)">
                      <Icon name="Loader2" :size="14" class="animate-spin text-theme-muted" />
                    </template>
                    <template v-else-if="isStorageDevice(device)">
                      <button
                        v-if="!isMounted(device)"
                        @click="mountDevice(device)"
                        class="p-1.5 text-theme-muted hover:text-success rounded-lg hover:bg-success-muted"
                        title="Mount"
                        :aria-label="'Mount ' + (device.product || device.name || device.device || 'device')"
                      >
                        <Icon name="FolderInput" :size="14" />
                      </button>
                      <button
                        v-if="isMounted(device)"
                        @click="unmountDevice(device)"
                        class="p-1.5 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted"
                        title="Unmount"
                        :aria-label="'Unmount ' + (device.product || device.name || device.device || 'device')"
                      >
                        <Icon name="FolderOutput" :size="14" />
                      </button>
                      <button
                        @click="ejectDevice(device)"
                        class="p-1.5 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted"
                        title="Eject"
                        :aria-label="'Eject ' + (device.product || device.name || device.device || 'device')"
                      >
                        <Icon name="Eject" :size="14" />
                      </button>
                    </template>
                    <button
                      v-if="device.bus"
                      @click="resetDevice(device)"
                      class="p-1.5 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary"
                      title="Reset USB port"
                      :aria-label="'Reset ' + (device.product || device.name || device.device || 'device')"
                    >
                      <Icon name="RotateCcw" :size="14" />
                    </button>
                    <Icon
                      name="ChevronDown"
                      :size="14"
                      class="text-theme-muted transition-transform ml-1"
                      :class="{ 'rotate-180': expandedDevice === deviceKey(device) }"
                    />
                  </div>
                </td>
              </tr>

              <!-- Expanded detail row -->
              <tr v-if="expandedDevice === deviceKey(device)">
                <td colspan="6" class="px-3 pb-4 pt-2">
                  <div class="bg-theme-secondary/30 rounded-lg p-4">
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div v-if="device.vendor_id || device.product_id">
                        <span class="text-xs text-theme-muted block">ID</span>
                        <span class="text-theme-primary font-mono text-xs">
                          {{ device.vendor_id || '----' }}:{{ device.product_id || '----' }}
                        </span>
                      </div>
                      <div v-if="device.serial">
                        <span class="text-xs text-theme-muted block">Serial</span>
                        <span class="text-theme-primary font-mono text-xs truncate block">{{ device.serial }}</span>
                      </div>
                      <div v-if="device.speed">
                        <span class="text-xs text-theme-muted block">Speed</span>
                        <span class="text-theme-primary text-xs">{{ device.speed }}</span>
                      </div>
                      <div v-if="device.driver">
                        <span class="text-xs text-theme-muted block">Driver</span>
                        <span class="text-theme-primary text-xs">{{ device.driver }}</span>
                      </div>
                      <div v-if="device.mountpoint">
                        <span class="text-xs text-theme-muted block">Mount Point</span>
                        <span class="text-theme-primary font-mono text-xs">{{ device.mountpoint }}</span>
                      </div>
                      <div v-if="device.filesystem">
                        <span class="text-xs text-theme-muted block">Filesystem</span>
                        <span class="text-theme-primary text-xs">{{ device.filesystem }}</span>
                      </div>
                      <div v-if="device.size">
                        <span class="text-xs text-theme-muted block">Size</span>
                        <span class="text-theme-primary text-xs">{{ formatSize(device.size) }}</span>
                      </div>
                      <div v-if="device.label">
                        <span class="text-xs text-theme-muted block">Label</span>
                        <span class="text-theme-primary text-xs">{{ device.label }}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Mobile card layout -->
      <div class="md:hidden space-y-3">
        <div
          v-for="device in filteredDevices"
          :key="'m-' + deviceKey(device)"
          class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
        >
          <!-- Device header -->
          <div class="p-4 flex items-center gap-3" @click="toggleExpand(deviceKey(device))">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              :class="isStorageDevice(device) ? 'bg-accent-muted' : 'bg-theme-tertiary'"
            >
              <Icon :name="classIcon(device.class || device.type)" :size="20"
                :class="isStorageDevice(device) ? 'text-accent' : 'text-theme-muted'"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-theme-primary truncate">
                {{ device.product || device.name || device.description || 'USB Device' }}
              </p>
              <p class="text-xs text-theme-muted truncate">
                {{ device.vendor || device.manufacturer || '' }}
                <span v-if="device.bus"> · Bus {{ device.bus }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span
                class="px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize"
                :class="classBadgeClass(device.class || device.type)"
              >{{ device.class || device.type || 'device' }}</span>
              <Icon
                name="ChevronDown"
                :size="14"
                class="text-theme-muted transition-transform"
                :class="{ 'rotate-180': expandedDevice === deviceKey(device) }"
              />
            </div>
          </div>

          <!-- Expanded detail + actions -->
          <div v-if="expandedDevice === deviceKey(device)" class="px-4 pb-4 border-t border-theme-primary/50">
            <div class="pt-3 grid grid-cols-2 gap-3 text-sm">
              <div v-if="device.device || device.path">
                <span class="text-xs text-theme-muted block">Device</span>
                <span class="text-theme-primary font-mono text-xs">{{ device.device || device.path }}</span>
              </div>
              <div v-if="device.vendor_id || device.product_id">
                <span class="text-xs text-theme-muted block">ID</span>
                <span class="text-theme-primary font-mono text-xs">{{ device.vendor_id || '----' }}:{{ device.product_id || '----' }}</span>
              </div>
              <div v-if="device.serial">
                <span class="text-xs text-theme-muted block">Serial</span>
                <span class="text-theme-primary font-mono text-xs truncate block">{{ device.serial }}</span>
              </div>
              <div v-if="device.speed">
                <span class="text-xs text-theme-muted block">Speed</span>
                <span class="text-theme-primary text-xs">{{ device.speed }}</span>
              </div>
              <div v-if="device.mountpoint">
                <span class="text-xs text-theme-muted block">Mount Point</span>
                <span class="text-theme-primary font-mono text-xs">{{ device.mountpoint }}</span>
              </div>
              <div v-if="device.size">
                <span class="text-xs text-theme-muted block">Size</span>
                <span class="text-theme-primary text-xs">{{ formatSize(device.size) }}</span>
              </div>
            </div>

            <!-- Mounted status -->
            <div v-if="isStorageDevice(device)" class="mt-3 flex items-center gap-2">
              <span
                class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                :class="isMounted(device) ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
              >{{ isMounted(device) ? 'Mounted' : 'Not Mounted' }}</span>
            </div>

            <!-- Action buttons -->
            <div class="mt-3 flex flex-wrap gap-2">
              <template v-if="isDeviceLoading(device)">
                <span class="flex items-center gap-2 text-sm text-theme-muted">
                  <Icon name="Loader2" :size="14" class="animate-spin" />
                  Working...
                </span>
              </template>
              <template v-else>
                <button
                  v-if="isStorageDevice(device) && !isMounted(device)"
                  @click.stop="mountDevice(device)"
                  class="px-3 py-1.5 text-xs bg-success-muted text-success rounded-lg hover:bg-success/20 flex items-center gap-1.5"
                  :aria-label="'Mount ' + (device.product || device.name || device.device || 'device')"
                >
                  <Icon name="FolderInput" :size="12" />
                  Mount
                </button>
                <button
                  v-if="isStorageDevice(device) && isMounted(device)"
                  @click.stop="unmountDevice(device)"
                  class="px-3 py-1.5 text-xs bg-warning-muted text-warning rounded-lg hover:bg-warning/20 flex items-center gap-1.5"
                  :aria-label="'Unmount ' + (device.product || device.name || device.device || 'device')"
                >
                  <Icon name="FolderOutput" :size="12" />
                  Unmount
                </button>
                <button
                  v-if="isStorageDevice(device)"
                  @click.stop="ejectDevice(device)"
                  class="px-3 py-1.5 text-xs bg-error-muted text-error rounded-lg hover:bg-error/20 flex items-center gap-1.5"
                  :aria-label="'Eject ' + (device.product || device.name || device.device || 'device')"
                >
                  <Icon name="Eject" :size="12" />
                  Eject
                </button>
                <button
                  v-if="device.bus"
                  @click.stop="resetDevice(device)"
                  class="px-3 py-1.5 text-xs bg-theme-tertiary text-theme-secondary rounded-lg hover:bg-theme-secondary/50 flex items-center gap-1.5"
                  :aria-label="'Reset ' + (device.product || device.name || device.device || 'device')"
                >
                  <Icon name="RotateCcw" :size="12" />
                  Reset
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== Storage Devices View ==================== -->
    <template v-else-if="viewMode === 'storage'">
      <div v-if="storageDevices.length === 0" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
        <Icon name="HardDrive" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h3 class="text-lg font-medium text-theme-primary mb-2">No USB Storage Devices</h3>
        <p class="text-theme-muted">No USB drives or flash storage detected.</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="device in storageDevices"
          :key="deviceKey(device)"
          class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
        >
          <div class="p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon name="HardDrive" :size="20" class="text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-theme-primary truncate">
                  {{ device.product || device.name || device.label || 'USB Storage' }}
                </p>
                <span
                  class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                  :class="isMounted(device) ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
                >{{ isMounted(device) ? 'Mounted' : 'Not Mounted' }}</span>
              </div>
              <p class="text-xs text-theme-muted truncate">
                {{ device.device || device.path || '' }}
                <span v-if="device.filesystem"> · {{ device.filesystem }}</span>
                <span v-if="device.size"> · {{ formatSize(device.size) }}</span>
              </p>
              <p v-if="device.mountpoint" class="text-xs text-theme-muted font-mono mt-0.5">
                {{ device.mountpoint }}
              </p>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0" @click.stop>
              <template v-if="isDeviceLoading(device)">
                <Icon name="Loader2" :size="14" class="animate-spin text-theme-muted" />
              </template>
              <template v-else>
                <button
                  v-if="!isMounted(device)"
                  @click="mountDevice(device)"
                  class="p-2 text-theme-muted hover:text-success rounded-lg hover:bg-success-muted"
                  title="Mount"
                  :aria-label="'Mount ' + (device.product || device.name || device.label || 'USB Storage')"
                >
                  <Icon name="FolderInput" :size="16" />
                </button>
                <button
                  v-if="isMounted(device)"
                  @click="unmountDevice(device)"
                  class="p-2 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted"
                  title="Unmount"
                  :aria-label="'Unmount ' + (device.product || device.name || device.label || 'USB Storage')"
                >
                  <Icon name="FolderOutput" :size="16" />
                </button>
                <button
                  @click="ejectDevice(device)"
                  class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted"
                  title="Safely eject"
                  :aria-label="'Eject ' + (device.product || device.name || device.label || 'USB Storage')"
                >
                  <Icon name="Eject" :size="16" />
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== Tree View ==================== -->
    <template v-else-if="viewMode === 'tree'">
      <div v-if="treeLoading" class="flex items-center justify-center py-12">
        <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
        <span class="ml-3 text-theme-muted">Loading USB tree...</span>
      </div>

      <div v-else-if="!usbTree" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
        <Icon name="GitBranch" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h3 class="text-lg font-medium text-theme-primary mb-2">USB Tree Unavailable</h3>
        <p class="text-theme-muted mb-4">Could not retrieve the USB device hierarchy.</p>
        <button @click="loadTree" class="px-4 py-2 btn-accent rounded-lg text-sm">Retry</button>
      </div>

      <div v-else class="bg-theme-card rounded-xl border border-theme-primary p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-theme-primary flex items-center gap-2">
            <Icon name="GitBranch" :size="16" class="text-accent" />
            USB Device Hierarchy
          </h3>
          <button
            @click="loadTree"
            :disabled="treeLoading"
            class="p-1.5 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
            title="Refresh tree"
            aria-label="Refresh USB tree"
          >
            <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': treeLoading }" />
          </button>
        </div>

        <!-- Tree output as pre-formatted text -->
        <div v-if="typeof usbTree === 'string'" class="font-mono text-xs text-theme-secondary whitespace-pre overflow-x-auto max-h-96 overflow-y-auto">{{ usbTree }}</div>

        <!-- Tree output as structured data -->
        <div v-else-if="Array.isArray(usbTree)" class="space-y-1">
          <div
            v-for="(node, idx) in usbTree"
            :key="idx"
            class="font-mono text-xs"
            :style="{ paddingLeft: (node.level || 0) * 16 + 'px' }"
          >
            <span class="text-theme-muted">{{ node.bus ? `Bus ${node.bus}` : '' }}</span>
            <span class="text-accent ml-1">{{ node.vendor_id || '' }}:{{ node.product_id || '' }}</span>
            <span class="text-theme-primary ml-2">{{ node.product || node.description || '' }}</span>
            <span v-if="node.driver" class="text-theme-muted ml-2">[{{ node.driver }}]</span>
          </div>
        </div>

        <!-- Tree as object (e.g. { tree: "..." }) -->
        <div v-else-if="usbTree.tree || usbTree.output" class="font-mono text-xs text-theme-secondary whitespace-pre overflow-x-auto max-h-96 overflow-y-auto">{{ usbTree.tree || usbTree.output }}</div>

        <!-- Fallback: JSON dump -->
        <pre v-else class="font-mono text-xs text-theme-secondary whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">{{ JSON.stringify(usbTree, null, 2) }}</pre>
      </div>
    </template>
  </div>
</template>
