<script setup>
/**
 * DashboardStandard.vue — S13 Visual Upgrade v2
 *
 * Standard mode ("consumer mode") dashboard.
 * Composition:
 *   ClockWidget → SearchChatBar → AlertBanner → StatusPill
 *   → SystemVitals + Quick Actions (side by side on desktop)
 *   → AppLauncher (favorites, recent, my apps)
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import { useSystemStore } from '@/stores/system'
import Icon from '@/components/ui/Icon.vue'
import ClockWidget from './ClockWidget.vue'
import SearchChatBar from './SearchChatBar.vue'
import AlertBanner from './AlertBanner.vue'
import StatusPill from './StatusPill.vue'
import SystemVitals from './SystemVitals.vue'
import AppLauncher from './AppLauncher.vue'

const router = useRouter()
const systemStore = useSystemStore()
const { isActive: wallpaperActive } = useWallpaper()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

const searchBarRef = ref(null)
defineExpose({ searchBarRef })

// ─── Quick actions config ─────────────────────────────────────
const quickActions = [
  {
    label: 'Add App',
    subtitle: 'Browse the store',
    icon: 'Plus',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    action: () => router.push('/apps?tab=store')
  },
  {
    label: 'Network',
    subtitle: 'WiFi & connectivity',
    icon: 'Wifi',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
    action: () => router.push('/network')
  },
  {
    label: 'Ask CubeOS',
    subtitle: 'AI assistant',
    icon: 'MessageSquare',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    action: () => emit('open-chat')
  },
  {
    label: 'Storage',
    subtitle: 'Disks & backups',
    icon: 'HardDrive',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    action: () => router.push('/storage')
  }
]

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Clock -->
    <ClockWidget />

    <!-- Search + Chat bar -->
    <SearchChatBar
      ref="searchBarRef"
      @open-app="(app) => emit('open-app', app)"
      @open-chat="emit('open-chat')"
    />

    <!-- Alert banner (conditional) -->
    <AlertBanner />

    <!-- Status pill -->
    <StatusPill />

    <!-- System Vitals + Quick Actions — side by side on desktop -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 dash-stagger">
      <div class="lg:col-span-3">
        <SystemVitals />
      </div>

      <div class="lg:col-span-2">
        <div
          :class="cardBase()"
          class="rounded-2xl p-5 h-full"
        >
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-theme-tertiary flex items-center justify-center">
              <Icon name="Zap" :size="14" class="text-theme-secondary" />
            </div>
            <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Quick Actions</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <button
              v-for="(qa, idx) in quickActions"
              :key="qa.label"
              class="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200
                     hover:bg-theme-tertiary hover:-translate-y-px group"
              :style="{ animationDelay: `${idx * 50}ms` }"
              @click="qa.action()"
            >
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                :class="qa.iconBg"
              >
                <Icon :name="qa.icon" :size="18" :class="qa.iconColor" />
              </div>
              <div class="text-center">
                <span class="text-xs font-medium text-theme-primary block">{{ qa.label }}</span>
                <span class="text-[10px] text-theme-muted">{{ qa.subtitle }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- App launcher -->
    <AppLauncher
      @open-app="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />
  </div>
</template>
