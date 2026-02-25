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
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

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

      <ResponsiveTable
        v-else
        :columns="[
          { key: 'name', label: 'Device' },
          { key: 'model', label: 'Model' },
          { key: 'size', label: 'Size' },
          { key: 'type', label: 'Type' },
          { key: 'mount', label: 'Mount' },
          { key: 'health', label: 'Health' }
        ]"
        :rows="storageHalStore.devices"
        :row-key="(row) => row.name || row.device"
        v-model:expanded-key="expandedDevice"
        compact
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-2">
            <Icon :name="deviceTypeIcon(row.type)" :size="16" class="text-accent" />
            <span class="text-theme-primary font-medium">{{ row.name || row.device }}</span>
          </div>
        </template>
        <template #cell-model="{ row }">
          <span class="text-theme-secondary">{{ row.model || '-' }}</span>
        </template>
        <template #cell-size="{ row }">
          <span class="text-theme-secondary">{{ row.size || row.capacity || '-' }}</span>
        </template>
        <template #cell-type="{ row }">
          <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-secondary uppercase">
            {{ row.type || row.tran || '-' }}
          </span>
        </template>
        <template #cell-mount="{ row }">
          <span class="text-theme-muted text-xs">{{ row.mountpoint || row.mount || '-' }}</span>
        </template>
        <template #cell-health="{ row }">
          <DeviceHealth :device="row.name || row.device" :inline="true" />
        </template>
        <template #row-expand="{ row }">
          <div class="p-4 bg-theme-tertiary/20 space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="p-3 bg-theme-secondary/50 rounded-lg">
                <p class="text-xs text-theme-muted mb-1">Serial</p>
                <p class="text-xs font-mono text-theme-primary truncate">{{ row.serial || '-' }}</p>
              </div>
              <div class="p-3 bg-theme-secondary/50 rounded-lg">
                <p class="text-xs text-theme-muted mb-1">Firmware</p>
                <p class="text-xs font-mono text-theme-primary">{{ row.firmware || row.rev || '-' }}</p>
              </div>
              <div class="p-3 bg-theme-secondary/50 rounded-lg">
                <p class="text-xs text-theme-muted mb-1">Transport</p>
                <p class="text-xs text-theme-primary">{{ row.tran || row.transport || '-' }}</p>
              </div>
              <div class="p-3 bg-theme-secondary/50 rounded-lg">
                <p class="text-xs text-theme-muted mb-1">Filesystem</p>
                <p class="text-xs text-theme-primary">{{ row.fstype || '-' }}</p>
              </div>
            </div>
            <DeviceHealth :device="row.name || row.device" />
          </div>
        </template>
      </ResponsiveTable>
  </div>
</template>
