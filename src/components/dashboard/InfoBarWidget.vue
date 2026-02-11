<script setup>
/**
 * InfoBarWidget.vue — Session 9
 *
 * Standalone Info Bar widget extracted from DashboardAdvanced.vue.
 * Displays a compact horizontal summary of system status:
 *   running/total containers, healthy count, stacks/compose breakdown,
 *   network mode, WiFi clients, WS status, uptime, battery, hostname.
 *
 * Self-contained — reads from stores directly, no props needed.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAppsStore, DEPLOY_MODES } from '@/stores/apps'
import { useMonitoringStore } from '@/stores/monitoring'
import { useNetworkStore } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'

const systemStore = useSystemStore()
const appsStore = useAppsStore()
const monitoringStore = useMonitoringStore()
const networkStore = useNetworkStore()

const runningCount = computed(() => appsStore.runningCount)
const totalCount = computed(() => appsStore.appCount)
const healthyCount = computed(() => appsStore.healthyCount)

const allApps = computed(() => appsStore.apps || [])
const swarmStacks = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.STACK).length)
const composeServices = computed(() => allApps.value.filter(a => a.deploy_mode === DEPLOY_MODES.COMPOSE).length)

const networkMode = computed(() => networkStore.currentMode || 'unknown')
const networkModeLabel = computed(() => {
  const labels = { offline: 'Offline', online_eth: 'Ethernet', online_wifi: 'WiFi Client' }
  return labels[networkMode.value] || 'Unknown'
})

const wsConnected = computed(() => systemStore.wsConnected)
const wsConnections = computed(() => monitoringStore.wsConnectionCount)
</script>

<template>
  <div class="rounded-xl border border-theme-primary bg-theme-card p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
    <div class="flex items-center gap-2">
      <Icon name="Activity" :size="14" class="text-success" />
      <span class="text-theme-secondary">
        <strong class="text-theme-primary">{{ runningCount }}</strong>/{{ totalCount }} running
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Icon name="HeartPulse" :size="14" class="text-success" />
      <span class="text-theme-secondary">
        <strong class="text-theme-primary">{{ healthyCount }}</strong> healthy
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Icon name="Layers" :size="14" class="text-accent" />
      <span class="text-theme-secondary">
        {{ swarmStacks }} stacks, {{ composeServices }} compose
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Icon name="Globe" :size="14" class="text-accent" />
      <span class="text-theme-secondary">{{ networkModeLabel }}</span>
    </div>
    <div v-if="systemStore.wifiClients !== null" class="flex items-center gap-2">
      <Icon name="Users" :size="14" class="text-theme-tertiary" />
      <span class="text-theme-secondary">{{ systemStore.wifiClients }} clients</span>
    </div>
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
    <div class="flex items-center gap-2">
      <Icon name="Clock" :size="14" class="text-theme-tertiary" />
      <span class="text-theme-secondary">{{ systemStore.uptime.uptime_human }}</span>
    </div>
    <div v-if="systemStore.batteryAvailable" class="flex items-center gap-2">
      <Icon
        :name="systemStore.isCharging ? 'BatteryCharging' : 'Battery'"
        :size="14"
        :class="systemStore.batteryPercent > 20 ? 'text-success' : 'text-error'"
      />
      <span class="text-theme-secondary">{{ systemStore.batteryPercent }}%</span>
    </div>
    <div class="flex items-center gap-2 ml-auto">
      <Icon name="Server" :size="14" class="text-theme-muted" />
      <span class="text-theme-muted font-mono">
        {{ systemStore.hostname }}
        <template v-if="systemStore.piModel"> &middot; {{ systemStore.piModel }}</template>
      </span>
    </div>
  </div>
</template>
