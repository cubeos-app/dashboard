<script setup>
/**
 * AppHeader.vue
 *
 * S02 — Top header bar with system stats, mode toggle, and user actions.
 *
 * Changes from S01:
 *   - Removed mobile hamburger (MobileNav.vue handles mobile navigation)
 *   - Added ModeToggle (compact) for desktop/tablet
 *   - Added Ctrl+K search trigger placeholder
 *   - Responsive: stats hidden below lg, mode toggle hidden on mobile
 */
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import { useBreakpoint } from '@/composables/useBreakpoint'
import Icon from '@/components/ui/Icon.vue'
import ModeToggle from '@/components/ui/ModeToggle.vue'

const systemStore = useSystemStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()
const { isMobile } = useBreakpoint()
const router = useRouter()

// ─── Global Ctrl+K / Cmd+K shortcut ─────────────────────────────
function handleGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    // Dispatch custom event — DashboardView listens for this
    window.dispatchEvent(new CustomEvent('cubeos:focus-search'))
    // If not on dashboard, navigate there
    if (router.currentRoute.value.name !== 'dashboard') {
      router.push('/')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// ─── System Stats ─────────────────────────────────────────────────

const uptimeFormatted = computed(() => {
  const seconds = systemStore.info?.uptime_seconds || systemStore.uptime?.uptime_seconds || 0
  if (seconds === 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
})

const cpuPercent = computed(() => Math.round(systemStore.stats?.cpu_percent || 0))
const memPercent = computed(() => Math.round(systemStore.stats?.memory_percent || 0))
const diskPercent = computed(() => Math.round(systemStore.stats?.disk_percent || 0))
const temperature = computed(() => {
  const temp = systemStore.stats?.temperature_cpu || 0
  return Math.round(temp * 10) / 10
})

const batteryPercent = computed(() => {
  if (!systemStore.power?.available) return null
  const pct = systemStore.power?.battery_percent
  if (pct === null || pct === undefined || pct < 0) return null
  return Math.min(100, Math.max(0, Math.round(pct)))
})

const batteryCharging = computed(() => {
  return systemStore.power?.is_charging || systemStore.power?.charging || false
})

const wsConnected = computed(() => systemStore.wsConnected)
const hostname = computed(() => systemStore.hostname || 'CubeOS')
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-50 h-14 border-b glass border-theme-primary">
    <div class="flex items-center justify-between h-full px-4 lg:px-6">
      <!-- Left: Logo -->
      <div class="flex items-center gap-2.5">
        <router-link to="/" class="flex items-center gap-2.5">
          <img :src="brandingStore.brandLogo" :alt="brandingStore.brandName" class="w-9 h-9" />
          <span class="text-lg font-semibold tracking-tight text-theme-primary hidden sm:block">
            {{ brandingStore.brandNameFormatted.prefix }}<span class="text-accent">{{ brandingStore.brandNameFormatted.accent }}</span>
          </span>
        </router-link>
      </div>

      <!-- Center: System stats (desktop/wide only) -->
      <div class="hidden lg:flex items-center gap-0.5">
        <!-- Connection indicator -->
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

        <!-- Hostname badge -->
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs">
          <span class="text-theme-secondary font-medium">{{ hostname }}</span>
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
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
          :class="temperature > 80 ? 'text-error' : temperature > 70 ? 'text-warning' : 'text-theme-secondary'"
        >
          <Icon name="Thermometer" :size="13" class="text-theme-muted" />
          <span class="font-medium tabular-nums">{{ temperature }}°C</span>
        </div>

        <!-- Battery (if hardware present) -->
        <template v-if="batteryPercent !== null">
          <div class="w-px h-3 bg-theme-primary mx-1"></div>
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
            :class="batteryPercent < 20 ? 'text-error' : batteryPercent < 40 ? 'text-warning' : 'text-theme-secondary'"
          >
            <Icon :name="batteryCharging ? 'BatteryCharging' : 'Battery'" :size="13" class="text-theme-muted" />
            <span class="font-medium tabular-nums">{{ batteryPercent }}%</span>
          </div>
        </template>
      </div>

      <!-- Right: Mode toggle + actions -->
      <div class="flex items-center gap-1.5">
        <!-- Mode toggle (hidden on mobile — shown in NavDrawer instead) -->
        <div v-if="!isMobile" class="hidden md:block">
          <ModeToggle compact />
        </div>

        <div class="hidden md:block w-px h-4 bg-theme-primary mx-1"></div>

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
