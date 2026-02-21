<script setup>
/**
 * SwarmOverview.vue
 * 
 * Dashboard widget displaying Docker Swarm cluster health at a glance.
 * Shows service counts, health breakdown, and deploy mode distribution.
 * 
 * Sprint 4: S4-03
 */

import { computed } from 'vue'
import { useAppsStore, APP_TYPES, DEPLOY_MODES, HEALTH_STATUS } from '@/stores/apps'
import Icon from '@/components/ui/Icon.vue'

const appsStore = useAppsStore()

// No lifecycle polling — parent view (DashboardView) handles centralized polling

// Computed stats
const totalApps = computed(() => appsStore.apps.length)
const runningApps = computed(() => appsStore.runningCount)

// Health breakdown
const healthStats = computed(() => {
  const apps = appsStore.apps
  return {
    healthy: apps.filter(a => appsStore.isHealthy(a)).length,
    unhealthy: apps.filter(a => a.status?.health === HEALTH_STATUS.UNHEALTHY).length,
    starting: apps.filter(a => a.status?.health === HEALTH_STATUS.STARTING).length,
    stopped: apps.filter(a => !a.status?.running).length
  }
})

// Deploy mode breakdown
const deployStats = computed(() => {
  const apps = appsStore.apps
  return {
    stacks: apps.filter(a => a.deploy_mode === DEPLOY_MODES.STACK).length,
    compose: apps.filter(a => a.deploy_mode === DEPLOY_MODES.COMPOSE).length
  }
})

// Type breakdown
const typeStats = computed(() => {
  const apps = appsStore.apps
  return {
    system: apps.filter(a => a.type === APP_TYPES.SYSTEM).length,
    platform: apps.filter(a => a.type === APP_TYPES.PLATFORM).length,
    network: apps.filter(a => a.type === APP_TYPES.NETWORK).length,
    ai: apps.filter(a => a.type === APP_TYPES.AI).length,
    user: apps.filter(a => a.type === APP_TYPES.USER).length
  }
})

// Overall health percentage
const healthPercentage = computed(() => {
  if (totalApps.value === 0) return 0
  return Math.round((healthStats.value.healthy / totalApps.value) * 100)
})

// Health status color
const healthColor = computed(() => {
  const pct = healthPercentage.value
  if (pct >= 90) return 'text-success'
  if (pct >= 70) return 'text-warning'
  return 'text-error'
})

const healthBgColor = computed(() => {
  const pct = healthPercentage.value
  if (pct >= 90) return 'bg-success'
  if (pct >= 70) return 'bg-warning'
  return 'bg-error'
})


</script>

<template>
  <div class="bg-theme-secondary rounded-xl border border-theme-primary p-5">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <Icon name="Container" :size="20" class="text-accent" />
        <h2 class="text-base font-semibold text-theme-primary">Swarm Overview</h2>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :class="healthBgColor"></span>
        <span class="text-xs font-medium" :class="healthColor">{{ healthPercentage }}% Healthy</span>
      </div>
    </div>
    
    <!-- Main Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <!-- Running Services -->
      <div class="bg-theme-tertiary rounded-lg p-3">
        <div class="flex items-center gap-2 mb-1">
          <Icon name="Play" :size="14" class="text-success" />
          <span class="text-xs text-theme-secondary">Running</span>
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-2xl font-bold text-theme-primary">{{ runningApps }}</span>
          <span class="text-xs text-theme-muted">/ {{ totalApps }}</span>
        </div>
      </div>
      
      <!-- Healthy -->
      <div class="bg-theme-tertiary rounded-lg p-3">
        <div class="flex items-center gap-2 mb-1">
          <Icon name="HeartPulse" :size="14" class="text-success" />
          <span class="text-xs text-theme-secondary">Healthy</span>
        </div>
        <span class="text-2xl font-bold text-success">{{ healthStats.healthy }}</span>
      </div>
      
      <!-- Unhealthy / Issues -->
      <div class="bg-theme-tertiary rounded-lg p-3">
        <div class="flex items-center gap-2 mb-1">
          <Icon name="AlertTriangle" :size="14" class="text-error" />
          <span class="text-xs text-theme-secondary">Issues</span>
        </div>
        <span class="text-2xl font-bold" :class="healthStats.unhealthy > 0 ? 'text-error' : 'text-theme-muted'">
          {{ healthStats.unhealthy }}
        </span>
      </div>
      
      <!-- Starting -->
      <div class="bg-theme-tertiary rounded-lg p-3">
        <div class="flex items-center gap-2 mb-1">
          <Icon name="Loader2" :size="14" class="text-warning" />
          <span class="text-xs text-theme-secondary">Starting</span>
        </div>
        <span class="text-2xl font-bold" :class="healthStats.starting > 0 ? 'text-warning' : 'text-theme-muted'">
          {{ healthStats.starting }}
        </span>
      </div>
    </div>
    
    <!-- Deploy Mode & Type Breakdown -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Deploy Modes -->
      <div>
        <h3 class="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Deploy Mode</h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="Layers" :size="12" class="text-accent" />
              <span class="text-xs text-theme-secondary">Swarm Stacks</span>
            </div>
            <span class="text-xs font-medium text-theme-primary">{{ deployStats.stacks }}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="FileCode" :size="12" class="text-accent-secondary" />
              <span class="text-xs text-theme-secondary">Compose</span>
            </div>
            <span class="text-xs font-medium text-theme-primary">{{ deployStats.compose }}</span>
          </div>
        </div>
      </div>
      
      <!-- Service Types -->
      <div>
        <h3 class="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Service Types</h3>
        <div class="space-y-1.5">
          <div v-if="typeStats.system > 0" class="flex items-center justify-between">
            <span class="text-xs text-theme-secondary">System</span>
            <span class="text-xs font-medium text-theme-primary">{{ typeStats.system }}</span>
          </div>
          <div v-if="typeStats.platform > 0" class="flex items-center justify-between">
            <span class="text-xs text-theme-secondary">Platform</span>
            <span class="text-xs font-medium text-theme-primary">{{ typeStats.platform }}</span>
          </div>
          <div v-if="typeStats.ai > 0" class="flex items-center justify-between">
            <span class="text-xs text-theme-secondary">AI/ML</span>
            <span class="text-xs font-medium text-theme-primary">{{ typeStats.ai }}</span>
          </div>
          <div v-if="typeStats.network > 0" class="flex items-center justify-between">
            <span class="text-xs text-theme-secondary">Network</span>
            <span class="text-xs font-medium text-theme-primary">{{ typeStats.network }}</span>
          </div>
          <div v-if="typeStats.user > 0" class="flex items-center justify-between">
            <span class="text-xs text-theme-secondary">User Apps</span>
            <span class="text-xs font-medium text-theme-primary">{{ typeStats.user }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Health Bar -->
    <div class="mt-4 pt-4 border-t border-theme-primary">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-theme-muted">Cluster Health</span>
        <span class="text-xs text-theme-secondary">{{ runningApps }} of {{ totalApps }} apps operational</span>
      </div>
      <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden flex">
        <div 
          v-if="healthStats.healthy > 0 && totalApps > 0"
          class="h-full bg-success transition-all duration-300"
          :style="{ width: `${(healthStats.healthy / totalApps) * 100}%` }"
        ></div>
        <div 
          v-if="healthStats.starting > 0 && totalApps > 0"
          class="h-full bg-warning transition-all duration-300"
          :style="{ width: `${(healthStats.starting / totalApps) * 100}%` }"
        ></div>
        <div 
          v-if="healthStats.unhealthy > 0 && totalApps > 0"
          class="h-full bg-error transition-all duration-300"
          :style="{ width: `${(healthStats.unhealthy / totalApps) * 100}%` }"
        ></div>
        <div 
          v-if="healthStats.stopped > 0 && totalApps > 0"
          class="h-full bg-neutral transition-all duration-300"
          :style="{ width: `${(healthStats.stopped / totalApps) * 100}%` }"
        ></div>
      </div>
      <div class="flex items-center gap-4 mt-2">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-success"></span>
          <span class="text-[10px] text-theme-muted">Healthy</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-warning"></span>
          <span class="text-[10px] text-theme-muted">Starting</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-error"></span>
          <span class="text-[10px] text-theme-muted">Issues</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-neutral"></span>
          <span class="text-[10px] text-theme-muted">Stopped</span>
        </div>
      </div>
    </div>
  </div>
</template>
