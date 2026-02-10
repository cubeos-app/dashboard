<script setup>
/**
 * DashboardAdvanced.vue
 *
 * S03 — Advanced mode ("kung fu mode") dashboard view.
 * Includes everything from Standard PLUS:
 *   - Docker container grid with health details
 *   - WebSocket connection status
 *   - Swarm stack overview
 *   - Monitoring alerts feed
 *   - Network throughput info
 *   - Recent log errors
 *
 * Wires: GET /monitoring/alerts, GET /monitoring/history, GET /monitoring/websocket
 * (all already implemented in monitoring store)
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore, DEPLOY_MODES, HEALTH_STATUS } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useMonitoringStore } from '@/stores/monitoring'
import { useNetworkStore } from '@/stores/network'
import { safeGetItem } from '@/utils/storage'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import StatusCard from './StatusCard.vue'
import ServiceGrid from './ServiceGrid.vue'
import AlertsFeed from './AlertsFeed.vue'
import SwarmOverview from '@/components/swarm/SwarmOverview.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const monitoringStore = useMonitoringStore()
const networkStore = useNetworkStore()
const { signal } = useAbortOnUnmount()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

// System stats
const cpuUsage = computed(() => systemStore.cpuUsage)
const memoryUsage = computed(() => systemStore.memoryUsage)
const diskUsage = computed(() => systemStore.diskUsage)
const temperature = computed(() => systemStore.temperature)
const tempPercent = computed(() => {
  const t = temperature.value
  if (t === null || t === undefined) return 0
  return Math.min(100, Math.max(0, (t / 85) * 100))
})

// App stats
const runningCount = computed(() => appsStore.runningCount)
const totalCount = computed(() => appsStore.appCount)
const healthyCount = computed(() => appsStore.healthyCount)

// All apps for the full grid
const allApps = computed(() => appsStore.apps || [])
const coreApps = computed(() => appsStore.coreApps)
const userApps = computed(() => appsStore.userApps)

// Favorites
const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// Network
const networkMode = computed(() => networkStore.currentMode || 'unknown')
const networkModeLabel = computed(() => {
  const labels = { offline: 'Offline', online_eth: 'Ethernet', online_wifi: 'WiFi Client' }
  return labels[networkMode.value] || 'Unknown'
})

// WebSocket info
const wsConnected = computed(() => systemStore.wsConnected)
const wsConnections = computed(() => monitoringStore.wsConnectionCount)

// Monitoring
const alerts = computed(() => monitoringStore.alerts)
const alertCount = computed(() => monitoringStore.alertCount)

// Deploy mode stats
const swarmStacks = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.STACK).length)
const composeServices = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.COMPOSE).length)

// Lifecycle — fetch monitoring data (Advanced-specific)
onMounted(async () => {
  const s = signal()
  await Promise.all([
    monitoringStore.fetchAlerts({ signal: s }),
    monitoringStore.fetchWebSocketInfo({ signal: s }),
    monitoringStore.fetchHistory({ period: '1h' })
  ])
})

// Navigation helpers
function goToMonitoring() { router.push('/system?tab=monitoring') }
function goToLogs() { router.push('/system?tab=logs') }
function goToAppStore() { router.push('/appstore') }
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Status Gauges + Summary Row -->
    <section class="animate-fade-in">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="CPU" :value="cpuUsage" unit="%" icon="Cpu" />
        <StatusCard
          label="Memory"
          :value="memoryUsage"
          unit="%"
          icon="MemoryStick"
          :subtitle="systemStore.memoryFormatted"
        />
        <StatusCard
          label="Disk"
          :value="diskUsage"
          unit="%"
          icon="HardDrive"
          :subtitle="systemStore.diskFormatted"
        />
        <StatusCard
          label="Temp"
          :value="temperature"
          unit="°C"
          icon="Thermometer"
          :percent="tempPercent"
          :thresholds="{ warning: 65, critical: 80 }"
        />
      </div>
    </section>

    <!-- System Info Bar -->
    <section class="animate-fade-in">
      <div class="rounded-xl border border-theme-primary bg-theme-card p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <!-- Services -->
        <div class="flex items-center gap-2">
          <Icon name="Activity" :size="14" class="text-success" />
          <span class="text-theme-secondary">
            <strong class="text-theme-primary">{{ runningCount }}</strong>/{{ totalCount }} running
          </span>
        </div>

        <!-- Healthy -->
        <div class="flex items-center gap-2">
          <Icon name="HeartPulse" :size="14" class="text-success" />
          <span class="text-theme-secondary">
            <strong class="text-theme-primary">{{ healthyCount }}</strong> healthy
          </span>
        </div>

        <!-- Deploy modes -->
        <div class="flex items-center gap-2">
          <Icon name="Layers" :size="14" class="text-accent" />
          <span class="text-theme-secondary">
            {{ swarmStacks }} stacks, {{ composeServices }} compose
          </span>
        </div>

        <!-- Network -->
        <div class="flex items-center gap-2">
          <Icon name="Globe" :size="14" class="text-accent" />
          <span class="text-theme-secondary">{{ networkModeLabel }}</span>
        </div>

        <!-- WiFi Clients -->
        <div v-if="systemStore.wifiClients !== null" class="flex items-center gap-2">
          <Icon name="Users" :size="14" class="text-theme-tertiary" />
          <span class="text-theme-secondary">{{ systemStore.wifiClients }} clients</span>
        </div>

        <!-- WebSocket status -->
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full"
            :class="wsConnected ? 'bg-success animate-pulse-status' : 'bg-error'"
          ></span>
          <span class="text-theme-secondary">
            WS {{ wsConnected ? 'connected' : 'disconnected' }}
            <template v-if="wsConnections > 0">({{ wsConnections }})</template>
          </span>
        </div>

        <!-- Uptime -->
        <div class="flex items-center gap-2">
          <Icon name="Clock" :size="14" class="text-theme-tertiary" />
          <span class="text-theme-secondary">{{ systemStore.uptime.uptime_human }}</span>
        </div>

        <!-- Battery -->
        <div v-if="systemStore.batteryAvailable" class="flex items-center gap-2">
          <Icon
            :name="systemStore.isCharging ? 'BatteryCharging' : 'Battery'"
            :size="14"
            :class="systemStore.batteryPercent > 20 ? 'text-success' : 'text-error'"
          />
          <span class="text-theme-secondary">{{ systemStore.batteryPercent }}%</span>
        </div>

        <!-- Hostname + Pi model -->
        <div class="flex items-center gap-2 ml-auto">
          <Icon name="Server" :size="14" class="text-theme-muted" />
          <span class="text-theme-muted font-mono">
            {{ systemStore.hostname }}
            <template v-if="systemStore.piModel"> &middot; {{ systemStore.piModel }}</template>
          </span>
        </div>
      </div>
    </section>

    <!-- Main Grid: Swarm + Alerts side by side -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Swarm Overview (2 cols) -->
      <section class="lg:col-span-2 animate-fade-in">
        <SwarmOverview />
      </section>

      <!-- Alerts Feed (1 col) -->
      <section class="animate-fade-in">
        <AlertsFeed
          :alerts="alerts"
          :loading="monitoringStore.loading"
          :limit="6"
        />
      </section>
    </div>

    <!-- Favorites (if any) -->
    <section v-if="favoriteApps.length > 0" class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Star" :size="12" class="text-warning" />
        Favorites
      </h2>
      <div class="rounded-xl border border-theme-primary bg-theme-card p-4">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <button
            v-for="app in favoriteApps"
            :key="app.name"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            @click="emit('open-app', app)"
          >
            <Icon :name="appsStore.getAppIcon(app)" :size="16" class="text-accent" />
            <span class="text-sm text-theme-primary truncate">{{ appsStore.getDisplayName(app) }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Core Apps Grid (detailed mode) -->
    <ServiceGrid
      :apps="coreApps"
      :loading="appsStore.loading"
      :detailed="true"
      title="Core Services"
      title-icon="Box"
      @open="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />

    <!-- User Apps Grid (if any) -->
    <ServiceGrid
      v-if="userApps.length > 0"
      :apps="userApps"
      :detailed="true"
      title="User Applications"
      title-icon="Package"
      @open="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />

    <!-- Quick Links Row -->
    <section class="animate-fade-in">
      <div class="flex flex-wrap gap-2">
        <button
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
          @click="goToMonitoring"
        >
          <Icon name="BarChart3" :size="14" class="text-accent" />
          Monitoring
          <span
            v-if="alertCount > 0"
            class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-error-muted text-error"
          >
            {{ alertCount }}
          </span>
        </button>

        <button
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
          @click="goToLogs"
        >
          <Icon name="ScrollText" :size="14" class="text-accent" />
          Logs
        </button>

        <button
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
          @click="goToAppStore"
        >
          <Icon name="Download" :size="14" class="text-accent" />
          App Store
        </button>

        <button
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-primary bg-theme-card hover:border-accent/40 text-xs text-theme-secondary transition-all"
          @click="emit('open-chat')"
        >
          <Icon name="MessageSquare" :size="14" class="text-accent" />
          Ask CubeOS
        </button>
      </div>
    </section>
  </div>
</template>
