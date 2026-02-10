<script setup>
/**
 * DevicesTab.vue — S07 Component (Advanced only)
 *
 * Full block device list with SMART data expansion.
 * Refactored from StorageView.vue devices tab section.
 *
 * Self-managed — uses stores directly.
 * Responsive: desktop table → mobile card layout.
 */
import { ref, onMounted } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import Icon from '@/components/ui/Icon.vue'
import DeviceHealth from '@/components/storage/DeviceHealth.vue'

const storageHalStore = useStorageHalStore()

// ─── State ──────────────────────────────────────────────────

const expandedDevice = ref(null)

// ─── Data Fetching ──────────────────────────────────────────

async function fetchDevices() {
  await storageHalStore.fetchDevices()
}

onMounted(() => {
  if (!storageHalStore.devices.length) fetchDevices()
})

// ─── Helpers ────────────────────────────────────────────────

function toggleDeviceExpand(device) {
  expandedDevice.value = expandedDevice.value === device ? null : device
}

function deviceTypeIcon(type) {
  if (!type) return 'HardDrive'
  const t = String(type).toLowerCase()
  if (t.includes('ssd') || t.includes('nvme')) return 'Cpu'
  if (t.includes('usb')) return 'Usb'
  if (t.includes('sd') || t.includes('mmc')) return 'CreditCard'
  return 'HardDrive'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="storageHalStore.loading" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading devices...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="storageHalStore.devices.length === 0" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="HardDrive" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Block Devices Found</h3>
      <p class="text-theme-muted mb-4">Block devices will appear here when detected by HAL.</p>
      <button @click="fetchDevices" class="px-4 py-2 btn-accent rounded-lg text-sm">Retry</button>
    </div>

    <template v-else>
      <!-- Desktop table -->
      <div class="hidden md:block">
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
                      <DeviceHealth :device="device.name || device.device" />
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden space-y-3">
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
    </template>
  </div>
</template>
