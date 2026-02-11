<script setup>
/**
 * StorageOverviewTab.vue — S07 Component
 *
 * Standard: disk usage bars, health status (green/yellow/red), backup last-run
 * Advanced: + Docker storage with cleanup, per-partition details, mount list
 *
 * Props (from StoragePage):
 *   - loading: Boolean
 *   - dockerUsage: Object|null
 *   - lastBackup: Object|null
 *
 * Emits:
 *   - refresh: trigger parent data reload
 *   - navigate-tab: switch to another tab
 */
import { computed } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useStorageStore } from '@/stores/storage'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import api from '@/api/client'
import { ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  loading: Boolean,
  dockerUsage: Object,
  lastBackup: Object
})

const emit = defineEmits(['refresh', 'navigate-tab'])

const storageHalStore = useStorageHalStore()
const storageStore = useStorageStore()
const { isAdvanced } = useMode()

const cleanupLoading = ref(false)

// ─── Computed ───────────────────────────────────────────────

const overviewDisks = computed(() => {
  // Use the HAL store's filtered list (only /dev/* backed filesystems)
  if (storageHalStore.realFilesystems?.length) {
    return storageHalStore.realFilesystems
  }
  if (storageStore.overview?.disks?.length) {
    return storageStore.overview.disks
  }
  return []
})

const healthDisks = computed(() => {
  if (storageStore.health?.disks?.length) return storageStore.health.disks
  if (Array.isArray(storageStore.health)) return storageStore.health
  return []
})

const storageMounts = computed(() => storageStore.mounts || [])

// ─── Actions ────────────────────────────────────────────────

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
    emit('refresh')
  } catch (e) {
    // handled by parent
  } finally {
    cleanupLoading.value = false
  }
}

// ─── Helpers ────────────────────────────────────────────────

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

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="space-y-6">
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

      <!-- Backup Status Card -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center"
              :class="lastBackup ? 'bg-success-muted' : 'bg-warning-muted'"
            >
              <Icon name="Archive" :size="20" :class="lastBackup ? 'text-success' : 'text-warning'" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Backups</h3>
              <p class="text-sm text-theme-muted">
                Last backup: {{ formatTimeAgo(lastBackup?.created_at) }}
              </p>
            </div>
          </div>
        </div>
        <div v-if="lastBackup" class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-xs text-theme-muted block">Type</span>
            <span class="text-theme-primary capitalize">{{ lastBackup.type }}</span>
          </div>
          <div>
            <span class="text-xs text-theme-muted block">Size</span>
            <span class="text-theme-primary">{{ lastBackup.size_human || formatBytes(lastBackup.size_bytes) }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-theme-muted">
          No backups created yet.
        </div>
        <button
          @click="emit('navigate-tab', 'backups')"
          class="mt-4 w-full px-4 py-2 text-sm text-accent border border-accent/30 rounded-lg hover:bg-accent-muted transition-colors text-center"
        >
          {{ lastBackup ? 'Manage Backups' : 'Create First Backup' }}
        </button>
      </div>
    </div>

    <!-- Per-disk cards (Advanced) -->
    <div v-if="isAdvanced && overviewDisks.length > 0" class="space-y-4">
      <h2 class="text-lg font-semibold text-theme-primary">Partitions</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="disk in overviewDisks"
          :key="disk.mountpoint || disk.device"
          class="bg-theme-card rounded-xl border border-theme-primary p-6"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Icon :name="deviceTypeIcon(disk.filesystem)" :size="20" class="text-accent" />
              </div>
              <div>
                <h3 class="font-semibold text-theme-primary">{{ disk.mountpoint || disk.device }}</h3>
                <p class="text-sm text-theme-muted">{{ disk.filesystem || disk.device }}</p>
              </div>
            </div>
            <span
              v-if="(disk.use_percent ?? disk.percent_used) != null"
              :class="usageTextColor(disk.use_percent ?? disk.percent_used)"
              class="text-lg font-bold"
            >{{ Number(disk.use_percent ?? disk.percent_used).toFixed(0) }}%</span>
          </div>
          <div v-if="(disk.use_percent ?? disk.percent_used) != null" class="h-3 bg-theme-tertiary rounded-full overflow-hidden mb-3">
            <div :class="usageColor(disk.use_percent ?? disk.percent_used)" class="h-full transition-all" :style="{ width: (disk.use_percent ?? disk.percent_used) + '%' }"></div>
          </div>
          <div class="flex justify-between text-xs text-theme-muted">
            <span>Used: {{ disk.used_human || formatBytes(disk.used || disk.used_bytes) }}</span>
            <span>Free: {{ disk.avail_human || formatBytes(disk.available || disk.free_bytes) }}</span>
            <span>Total: {{ disk.size_human || formatBytes(disk.size || disk.total_bytes) }}</span>
          </div>
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
          @click="isAdvanced ? emit('navigate-tab', 'devices') : null"
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

    <!-- Docker Storage (Advanced) -->
    <div v-if="isAdvanced && dockerUsage" class="bg-theme-card rounded-xl border border-theme-primary p-6">
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

    <!-- Storage Mounts (Advanced) -->
    <div v-if="isAdvanced && storageMounts.length > 0" class="bg-theme-card rounded-xl border border-theme-primary p-6">
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

    <!-- Loading placeholder -->
    <div v-if="loading && !storageHalStore.usage" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading storage data...</span>
    </div>
  </div>
</template>
