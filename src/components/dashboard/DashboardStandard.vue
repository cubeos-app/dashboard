<script setup>
/**
 * DashboardStandard.vue
 *
 * S03 — Standard mode ("iPad mode") dashboard view.
 * Shows: status gauge rings, favorite apps, service grid with status pills,
 * quick actions (reboot, app store). Clean, opinionated, consumer-friendly.
 *
 * Data comes from parent DashboardView via stores (no direct fetch here).
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useNetworkStore } from '@/stores/network'
import { useWallpaper } from '@/composables/useWallpaper'
import { safeGetItem } from '@/utils/storage'
import Icon from '@/components/ui/Icon.vue'
import StatusCard from './StatusCard.vue'
import ServiceGrid from './ServiceGrid.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const networkStore = useNetworkStore()
const { panelClass, isActive: wallpaperActive } = useWallpaper()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

// System stats
const cpuUsage = computed(() => systemStore.cpuUsage)
const memoryUsage = computed(() => systemStore.memoryUsage)
const diskUsage = computed(() => systemStore.diskUsage)
const temperature = computed(() => systemStore.temperature)
const tempPercent = computed(() => {
  // Map temperature to a 0-100 scale (0°C = 0%, 85°C = 100%)
  const t = temperature.value
  if (t === null || t === undefined) return 0
  return Math.min(100, Math.max(0, (t / 85) * 100))
})

// App stats
const runningCount = computed(() => appsStore.runningCount)
const totalCount = computed(() => appsStore.appCount)

// Favorites
const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// Recently used
const recentApps = computed(() => {
  const names = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(names)) return []
  return names
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 6)
})

// Core apps for the grid
const coreApps = computed(() => appsStore.coreApps)

// Network info
const networkMode = computed(() => networkStore.currentMode || 'unknown')
const networkModeLabel = computed(() => {
  const labels = { offline: 'Offline', online_eth: 'Ethernet', online_wifi: 'WiFi' }
  return labels[networkMode.value] || 'Unknown'
})

// Quick actions
function goToApps() { router.push('/apps') }
function goToAppStore() { router.push('/appstore') }
function goToNetwork() { router.push('/network') }

// Card class helper
function cardClass() {
  return wallpaperActive.value ? `glass rounded-2xl` : 'rounded-2xl border border-theme-primary bg-theme-card'
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Status Gauges -->
    <section class="animate-fade-in">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard
          label="CPU"
          :value="cpuUsage"
          unit="%"
          icon="Cpu"
          :class="wallpaperActive ? 'glass' : ''"
        />
        <StatusCard
          label="Memory"
          :value="memoryUsage"
          unit="%"
          icon="MemoryStick"
          :subtitle="systemStore.memoryFormatted"
          :class="wallpaperActive ? 'glass' : ''"
        />
        <StatusCard
          label="Disk"
          :value="diskUsage"
          unit="%"
          icon="HardDrive"
          :subtitle="systemStore.diskFormatted"
          :class="wallpaperActive ? 'glass' : ''"
        />
        <StatusCard
          label="Temp"
          :value="temperature"
          unit="°C"
          icon="Thermometer"
          :percent="tempPercent"
          :thresholds="{ warning: 65, critical: 80 }"
          :class="wallpaperActive ? 'glass' : ''"
        />
      </div>
    </section>

    <!-- Quick Info Bar -->
    <section class="animate-fade-in">
      <div :class="cardClass()" class="p-4 flex flex-wrap items-center gap-4 text-xs">
        <!-- Services status -->
        <div class="flex items-center gap-2">
          <Icon name="Activity" :size="14" class="text-success" />
          <span class="text-theme-secondary">
            <strong class="text-theme-primary">{{ runningCount }}</strong> of {{ totalCount }} services running
          </span>
        </div>

        <!-- Network mode -->
        <div class="flex items-center gap-2">
          <Icon name="Globe" :size="14" class="text-accent" />
          <span class="text-theme-secondary">{{ networkModeLabel }}</span>
        </div>

        <!-- Uptime -->
        <div class="flex items-center gap-2">
          <Icon name="Clock" :size="14" class="text-theme-tertiary" />
          <span class="text-theme-secondary">Up {{ systemStore.uptime.uptime_human }}</span>
        </div>

        <!-- Battery (if available) -->
        <div v-if="systemStore.batteryAvailable" class="flex items-center gap-2">
          <Icon
            :name="systemStore.isCharging ? 'BatteryCharging' : 'Battery'"
            :size="14"
            :class="systemStore.batteryPercent > 20 ? 'text-success' : 'text-error'"
          />
          <span class="text-theme-secondary">{{ systemStore.batteryPercent }}%</span>
        </div>

        <!-- Hostname -->
        <div class="flex items-center gap-2 ml-auto">
          <Icon name="Server" :size="14" class="text-theme-muted" />
          <span class="text-theme-muted font-mono">{{ systemStore.hostname }}</span>
        </div>
      </div>
    </section>

    <!-- Favorites -->
    <section v-if="favoriteApps.length > 0" class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Star" :size="12" class="text-warning" />
        Favorites
      </h2>
      <div :class="cardClass()" class="p-4">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <button
            v-for="app in favoriteApps"
            :key="app.name"
            class="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            @click="emit('open-app', app)"
          >
            <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
              <Icon :name="appsStore.getAppIcon(app)" :size="16" class="text-accent" />
            </div>
            <div class="min-w-0">
              <span class="text-sm text-theme-primary truncate block">{{ appsStore.getDisplayName(app) }}</span>
              <span
                class="text-[10px]"
                :class="{
                  'text-success': app.status?.health === 'healthy' || app.status?.health === 'running',
                  'text-error': app.status?.health === 'unhealthy',
                  'text-theme-muted': !app.status?.health || app.status?.health === 'stopped'
                }"
              >
                {{ app.status?.running ? 'Running' : 'Stopped' }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </section>

    <!-- Recently Used -->
    <section v-if="recentApps.length > 0 && favoriteApps.length === 0" class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Clock" :size="12" />
        Recently Used
      </h2>
      <div :class="cardClass()" class="p-4">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            v-for="app in recentApps"
            :key="app.name"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            @click="emit('open-app', app)"
          >
            <Icon :name="appsStore.getAppIcon(app)" :size="16" class="text-theme-secondary" />
            <span class="text-sm text-theme-primary truncate">{{ appsStore.getDisplayName(app) }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Service Grid -->
    <ServiceGrid
      :apps="coreApps"
      :loading="appsStore.loading"
      title="Services"
      title-icon="Box"
      @open="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />

    <!-- Quick Actions -->
    <section class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Zap" :size="12" class="text-accent" />
        Quick Actions
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          :class="cardClass()"
          class="p-4 text-left hover:border-accent/40 transition-all group"
          @click="goToAppStore"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="Download" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">App Store</span>
              <span class="text-xs text-theme-muted">Install new apps</span>
            </div>
          </div>
        </button>

        <button
          :class="cardClass()"
          class="p-4 text-left hover:border-accent/40 transition-all group"
          @click="goToNetwork"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="Wifi" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">Network</span>
              <span class="text-xs text-theme-muted">WiFi and connectivity</span>
            </div>
          </div>
        </button>

        <button
          :class="cardClass()"
          class="p-4 text-left hover:border-accent/40 transition-all group"
          @click="emit('open-chat')"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="MessageSquare" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">Ask CubeOS</span>
              <span class="text-xs text-theme-muted">AI assistant</span>
            </div>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>
