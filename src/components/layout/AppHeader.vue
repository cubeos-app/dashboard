<script setup>
/**
 * AppHeader.vue
 * 
 * Top navigation header with system stats display.
 * 
 * Fixes:
 * - Uptime calculated from uptime_seconds in systemStore.info
 * - Battery only shows when HAL reports available: true
 * - Temperature and other stats from systemStore.stats
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['toggle-sidebar'])
const systemStore = useSystemStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()

// Format uptime from seconds
const uptimeFormatted = computed(() => {
  // Try uptime from info first, then from uptime object
  const seconds = systemStore.info?.uptime_seconds || systemStore.uptime?.uptime_seconds || 0
  
  if (seconds === 0) return '—'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
})

// Stats from /system/stats endpoint
const cpuPercent = computed(() => Math.round(systemStore.stats?.cpu_percent || 0))
const memPercent = computed(() => Math.round(systemStore.stats?.memory_percent || 0))
const diskPercent = computed(() => Math.round(systemStore.stats?.disk_percent || 0))
const temperature = computed(() => {
  const temp = systemStore.stats?.temperature_cpu || 0
  return Math.round(temp * 10) / 10
})

/**
 * Battery - only show if HAL reports battery hardware is available
 * The power computed in systemStore returns:
 * - available: boolean
 * - battery_percent: number (0-100)
 * - is_charging: boolean
 */
const batteryPercent = computed(() => {
  // Must have power data and battery must be available
  if (!systemStore.power?.available) return null
  const pct = systemStore.power?.battery_percent
  // Must be a valid number >= 0
  if (pct === null || pct === undefined || pct < 0) return null
  return Math.round(pct)
})

const batteryCharging = computed(() => {
  return systemStore.power?.is_charging || systemStore.power?.charging || false
})

// WebSocket connection status for the live indicator
const wsConnected = computed(() => systemStore.wsConnected)
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 h-14 border-b glass border-theme-primary">
    <div class="flex items-center justify-between h-full px-4 lg:px-6">
      <!-- Left: Menu + Logo -->
      <div class="flex items-center gap-3">
        <!-- Mobile menu button -->
        <button
          @click="$emit('toggle-sidebar')"
          aria-label="Toggle navigation menu"
          class="lg:hidden p-2 -ml-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="Menu" :size="20" />
        </button>

        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2.5">
          <img :src="brandingStore.brandLogo" :alt="brandingStore.brandName" class="w-9 h-9" />
          <span class="text-lg font-semibold tracking-tight text-theme-primary hidden sm:block">
            {{ brandingStore.brandNameFormatted.prefix }}<span class="text-accent">{{ brandingStore.brandNameFormatted.accent }}</span>
          </span>
        </router-link>
      </div>

      <!-- Center: System stats (desktop only) -->
      <div class="hidden lg:flex items-center gap-0.5">
        <!-- Connection mode indicator -->
        <div 
          class="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
          :title="wsConnected ? 'Real-time WebSocket connection' : 'Polling (HTTP fallback)'"
        >
          <span 
            class="w-1.5 h-1.5 rounded-full"
            :class="wsConnected ? 'bg-success animate-pulse' : 'bg-warning'"
          ></span>
          <span class="text-theme-muted font-medium">{{ wsConnected ? 'LIVE' : 'POLL' }}</span>
        </div>

        <div class="w-px h-3 bg-theme-primary mx-1"></div>

        <!-- Uptime -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-theme-secondary text-xs">
          <Icon name="Clock" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ uptimeFormatted }}</span>
        </div>

        <div class="w-px h-3 bg-theme-primary mx-1"></div>

        <!-- CPU -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-theme-secondary text-xs">
          <Icon name="Cpu" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ cpuPercent }}%</span>
        </div>

        <!-- Memory -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-theme-secondary text-xs">
          <Icon name="MemoryStick" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ memPercent }}%</span>
        </div>

        <!-- Disk -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-theme-secondary text-xs">
          <Icon name="HardDrive" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ diskPercent }}%</span>
        </div>

        <div class="w-px h-3 bg-theme-primary mx-1"></div>

        <!-- Temperature -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
             :class="temperature > 80 ? 'text-error' : temperature > 70 ? 'text-warning' : 'text-theme-secondary'">
          <Icon name="Thermometer" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ temperature }}°C</span>
        </div>

        <!-- Battery (only if hardware present) -->
        <template v-if="batteryPercent !== null">
          <div class="w-px h-3 bg-theme-primary mx-1"></div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
               :class="batteryPercent < 20 ? 'text-error' : batteryPercent < 40 ? 'text-warning' : 'text-theme-secondary'">
            <Icon :name="batteryCharging ? 'BatteryCharging' : 'Battery'" :size="13" class="text-theme-muted" />
            <span class="font-medium tabular-nums">{{ batteryPercent }}%</span>
          </div>
        </template>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1.5">
        <!-- Theme indicator -->
        <div class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-theme-muted text-xs">
          <div 
            class="w-2.5 h-2.5 rounded-full"
            :style="{ backgroundColor: themeStore.currentTheme.preview.accent }"
          ></div>
          <span>{{ themeStore.currentTheme.name }}</span>
        </div>

        <!-- Settings -->
        <router-link
          to="/settings"
          aria-label="Settings"
          class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="Settings" :size="18" />
        </router-link>

        <!-- User menu -->
        <router-link
          to="/settings"
          aria-label="User menu"
          class="flex items-center gap-2 pl-2 ml-1 border-l border-theme-primary"
        >
          <div class="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-theme-tertiary transition-colors">
            <div class="w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center">
              <span class="text-xs font-semibold text-accent">{{ (authStore.username || 'A').charAt(0).toUpperCase() }}</span>
            </div>
            <span class="hidden sm:block text-sm font-medium text-theme-primary">{{ authStore.username || 'admin' }}</span>
          </div>
        </router-link>
      </div>
    </div>
  </header>
</template>
