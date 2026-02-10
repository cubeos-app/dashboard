<script setup>
/**
 * DiskWidget.vue — Session 4
 *
 * Compact disk usage card for Standard dashboard.
 * Shows per-partition usage bars (root /, data /cubeos/data, USB/NFS mounts).
 * Falls back to a single aggregate bar from systemStore when partition
 * endpoint is unavailable.
 *
 * Clicking navigates to /storage.
 * Matches SystemVitals glassmorphism pattern.
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useMountsStore } from '@/stores/mounts'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const storageHal = useStorageHalStore()
const mountsStore = useMountsStore()
const { isActive: wallpaperActive } = useWallpaper()

// Animate bars on mount
const mounted = ref(false)
const partitions = ref(null)

onMounted(async () => {
  requestAnimationFrame(() => { mounted.value = true })
  // Try fetching per-partition data from HAL
  try {
    const data = await import('@/api/client').then(m => m.default.get('/hal/storage/partitions'))
    if (data && Array.isArray(data) && data.length > 0) {
      partitions.value = data
    }
  } catch {
    // Endpoint not available yet — fall back to aggregate data
    partitions.value = null
  }
})

// ─── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1000) return `${(gb / 1024).toFixed(1)} TB`
  if (gb >= 10) return `${gb.toFixed(0)} GB`
  return `${gb.toFixed(1)} GB`
}

function gradientFor(percent) {
  const v = percent ?? 0
  if (v >= 95) return 'from-red-500 to-red-400'
  if (v >= 85) return 'from-orange-500 to-red-500'
  if (v >= 70) return 'from-amber-400 to-orange-500'
  return 'from-cyan-400 to-emerald-400'
}

function partitionIcon(mount) {
  if (mount === '/' || mount === '/boot') return 'HardDrive'
  if (mount?.startsWith('/mnt') || mount?.startsWith('/media')) return 'Usb'
  if (mount?.includes('nfs') || mount?.includes('smb') || mount?.includes('cifs')) return 'Network'
  return 'Database'
}

function partitionLabel(mount) {
  if (mount === '/') return 'Root /'
  if (mount === '/cubeos/data' || mount === '/data') return 'Data'
  if (mount === '/boot' || mount === '/boot/firmware') return 'Boot'
  // Show last path segment for long paths
  const parts = mount?.split('/').filter(Boolean) ?? []
  return parts.length > 0 ? parts[parts.length - 1] : mount
}

// ─── Partition list (HAL or fallback) ─────────────────────────

const diskRows = computed(() => {
  // If HAL partitions endpoint returned data, use it
  if (partitions.value && partitions.value.length > 0) {
    return partitions.value.map(p => ({
      key: p.mountpoint || p.mount || p.device,
      icon: partitionIcon(p.mountpoint || p.mount),
      label: partitionLabel(p.mountpoint || p.mount),
      percent: p.percent ?? (p.used && p.total ? Math.round((p.used / p.total) * 100) : 0),
      subtitle: `${formatBytes(p.used)} / ${formatBytes(p.total)}`,
      gradient: gradientFor(p.percent ?? 0),
    }))
  }

  // Fallback: single bar from systemStore
  const stats = systemStore.stats
  if (!stats?.disk_total) return []

  return [{
    key: 'root',
    icon: 'HardDrive',
    label: 'Root /',
    percent: systemStore.diskUsage,
    subtitle: systemStore.diskFormatted,
    gradient: gradientFor(systemStore.diskUsage),
  }]
})

// ─── Overall usage badge ──────────────────────────────────────

const totalUsagePercent = computed(() => {
  if (partitions.value && partitions.value.length > 0) {
    const totalUsed = partitions.value.reduce((s, p) => s + (p.used || 0), 0)
    const totalSize = partitions.value.reduce((s, p) => s + (p.total || 0), 0)
    return totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0
  }
  return systemStore.diskUsage ?? 0
})

const usageBadge = computed(() => {
  const p = totalUsagePercent.value
  return {
    value: p,
    color: p >= 90 ? 'text-error' : p >= 75 ? 'text-warning' : 'text-emerald-400',
    bgColor: p >= 90 ? 'bg-error/10' : p >= 75 ? 'bg-warning/10' : 'bg-emerald-500/10',
    borderColor: p >= 90 ? 'border-error/20' : p >= 75 ? 'border-warning/20' : 'border-emerald-500/20',
  }
})

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer h-full"
    @click="router.push('/storage')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Icon name="HardDrive" :size="14" class="text-amber-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Disk</span>
      </div>

      <!-- Total usage badge -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
        :class="[usageBadge.bgColor, usageBadge.borderColor]"
      >
        <span class="text-xs font-semibold tabular-nums" :class="usageBadge.color">
          {{ usageBadge.value }}% used
        </span>
      </div>
    </div>

    <!-- Partition bars -->
    <div v-if="diskRows.length > 0" class="space-y-3.5">
      <div
        v-for="(row, idx) in diskRows"
        :key="row.key"
        :style="{ animationDelay: `${idx * 80}ms` }"
      >
        <!-- Label row -->
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-1.5">
            <Icon :name="row.icon" :size="12" class="text-theme-muted" />
            <span class="text-xs text-theme-secondary">{{ row.label }}</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-xs font-semibold text-theme-primary tabular-nums">{{ row.percent }}</span>
            <span class="text-[10px] text-theme-muted">%</span>
            <span class="text-[10px] text-theme-muted ml-1">{{ row.subtitle }}</span>
          </div>
        </div>

        <!-- Bar track -->
        <div class="h-2 rounded-full bg-theme-tertiary overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
            :class="row.gradient"
            :style="{ width: mounted ? `${Math.max(2, row.percent)}%` : '0%' }"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex items-center justify-center py-4">
      <span class="text-xs text-theme-muted">No disk data available</span>
    </div>
  </button>
</template>
