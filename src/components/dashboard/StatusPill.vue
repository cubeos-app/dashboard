<script setup>
/**
 * StatusPill.vue — S13 Visual Upgrade
 *
 * Enhanced status bar for Standard dashboard.
 * Shows: health status, running apps, connected devices, network mode, uptime.
 * Subtle gradient background that shifts color based on system health.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useNetworkStore } from '@/stores/network'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const networkStore = useNetworkStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Thresholds ──────────────────────────────────────────────────
const THRESHOLDS = {
  temp: { warning: 70, critical: 80 },
  disk: { warning: 85, critical: 95 },
  memory: { warning: 90, critical: 95 }
}

const temp = computed(() => systemStore.temperature ?? 0)
const disk = computed(() => systemStore.diskUsage ?? 0)
const memory = computed(() => systemStore.memoryUsage ?? 0)
const runningCount = computed(() => appsStore.runningCount)
const wifiClients = computed(() => systemStore.wifiClients)
const uptimeHuman = computed(() => systemStore.uptime?.uptime_human || null)

const networkModeLabel = computed(() => {
  const mode = networkStore.currentMode
  const labels = { offline: 'Offline', online_eth: 'Online', online_wifi: 'WiFi' }
  return labels[mode] || 'Unknown'
})

const networkModeIcon = computed(() => {
  const mode = networkStore.currentMode
  if (mode === 'offline') return 'WifiOff'
  if (mode === 'online_wifi') return 'Wifi'
  return 'Globe'
})

// ─── Health computation ──────────────────────────────────────────
const status = computed(() => {
  if (temp.value > THRESHOLDS.temp.critical) return 'critical'
  if (disk.value > THRESHOLDS.disk.critical) return 'critical'
  if (memory.value > THRESHOLDS.memory.critical) return 'critical'
  if (temp.value > THRESHOLDS.temp.warning) return 'warning'
  if (disk.value > THRESHOLDS.disk.warning) return 'warning'
  if (memory.value > THRESHOLDS.memory.warning) return 'warning'
  return 'healthy'
})

const dotClass = computed(() => ({
  'bg-success': status.value === 'healthy',
  'bg-warning': status.value === 'warning',
  'bg-error': status.value === 'critical'
}))

const pillBg = computed(() => {
  if (wallpaperActive.value) return 'bg-white/[0.03] border border-white/[0.06]'
  if (status.value === 'critical') return 'bg-error/[0.06] border border-error/20'
  if (status.value === 'warning') return 'bg-warning/[0.04] border border-warning/15'
  return 'bg-theme-card border border-theme-primary'
})

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div class="dash-stagger">
    <!-- Main status bar -->
    <button
      :class="pillBg"
      class="w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl text-left transition-all hover:shadow-md group"
      @click="router.push('/system')"
    >
      <!-- Health dot with pulse -->
      <span class="relative shrink-0">
        <span class="w-2 h-2 rounded-full block" :class="dotClass" />
        <span
          v-if="status === 'healthy'"
          class="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-30 bg-success"
        />
      </span>

      <!-- Status chips -->
      <div class="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
        <!-- Health label -->
        <span class="text-xs text-theme-secondary whitespace-nowrap">
          {{ status === 'healthy' ? 'All systems go' : status === 'warning' ? 'Attention needed' : 'Critical issue' }}
        </span>

        <span class="text-theme-muted text-[10px]">|</span>

        <!-- Running apps -->
        <span class="flex items-center gap-1 text-xs text-theme-muted whitespace-nowrap">
          <Icon name="Box" :size="11" />
          {{ runningCount }} running
        </span>

        <!-- Connected devices -->
        <span v-if="wifiClients !== null" class="flex items-center gap-1 text-xs text-theme-muted whitespace-nowrap">
          <Icon name="Smartphone" :size="11" />
          {{ wifiClients }} device{{ wifiClients !== 1 ? 's' : '' }}
        </span>

        <!-- Network mode -->
        <span class="flex items-center gap-1 text-xs text-theme-muted whitespace-nowrap">
          <Icon :name="networkModeIcon" :size="11" />
          {{ networkModeLabel }}
        </span>

        <!-- Uptime -->
        <span v-if="uptimeHuman" class="flex items-center gap-1 text-xs text-theme-muted whitespace-nowrap">
          <Icon name="Clock" :size="11" />
          {{ uptimeHuman }}
        </span>
      </div>

      <!-- Chevron -->
      <Icon name="ChevronRight" :size="14" class="text-theme-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
