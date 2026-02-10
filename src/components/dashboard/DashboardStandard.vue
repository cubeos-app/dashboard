<script setup>
/**
 * DashboardStandard.vue — S13 Visual Upgrade v3 + Session 2 Settings
 *
 * Standard mode ("consumer mode") dashboard.
 * Layout:
 *   ClockWidget → SearchChatBar → AlertBanner → StatusPill
 *   → SystemVitals + NetworkWidget (side by side on desktop)
 *   → Quick Actions (6-item strip, 3×2 on mobile, 6×1 on desktop)
 *   → AppLauncher (favorites, recent, my apps)
 *
 * Session 2: Added settings gear button (top-right) + DashboardSettingsModal.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'
import ClockWidget from './ClockWidget.vue'
import SearchChatBar from './SearchChatBar.vue'
import AlertBanner from './AlertBanner.vue'
import StatusPill from './StatusPill.vue'
import SystemVitals from './SystemVitals.vue'
import NetworkWidget from './NetworkWidget.vue'
import AppLauncher from './AppLauncher.vue'
import DashboardSettingsModal from './DashboardSettingsModal.vue'

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

const searchBarRef = ref(null)
defineExpose({ searchBarRef })

// ─── Settings modal ──────────────────────────────────────────
const showSettings = ref(false)

// ─── Quick actions config ─────────────────────────────────────
const quickActions = [
  {
    label: 'Add App',
    icon: 'Plus',
    color: 'bg-emerald-500/15 text-emerald-400',
    action: () => router.push('/apps?tab=store')
  },
  {
    label: 'Network',
    icon: 'Wifi',
    color: 'bg-indigo-500/15 text-indigo-400',
    action: () => router.push('/network')
  },
  {
    label: 'Storage',
    icon: 'HardDrive',
    color: 'bg-amber-500/15 text-amber-400',
    action: () => router.push('/storage')
  },
  {
    label: 'Ask CubeOS',
    icon: 'MessageSquare',
    color: 'bg-violet-500/15 text-violet-400',
    action: () => emit('open-chat')
  },
  {
    label: 'System',
    icon: 'Settings2',
    color: 'bg-cyan-500/15 text-cyan-400',
    action: () => router.push('/system')
  },
  {
    label: 'Settings',
    icon: 'SlidersHorizontal',
    color: 'bg-rose-500/15 text-rose-400',
    action: () => router.push('/settings')
  }
]

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto relative">
    <!-- Settings gear (top-right, subtle) -->
    <button
      class="absolute -top-1 right-0 w-8 h-8 rounded-lg flex items-center justify-center
             text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary/50 transition-colors z-10"
      aria-label="Dashboard settings"
      @click="showSettings = true"
    >
      <Icon name="Settings2" :size="18" :stroke-width="1.5" />
    </button>

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

    <!-- System Vitals + Network Widget — side by side on desktop -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 dash-stagger">
      <SystemVitals />
      <NetworkWidget />
    </div>

    <!-- Quick Actions — 6 items, horizontal strip -->
    <div class="dash-stagger">
      <div
        :class="cardBase()"
        class="rounded-2xl p-4"
      >
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <button
            v-for="qa in quickActions"
            :key="qa.label"
            class="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all duration-200
                   hover:bg-theme-tertiary hover:-translate-y-px group"
            @click="qa.action()"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
              :class="qa.color.split(' ')[0]"
            >
              <Icon :name="qa.icon" :size="18" :class="qa.color.split(' ')[1]" />
            </div>
            <span class="text-[11px] font-medium text-theme-secondary group-hover:text-theme-primary transition-colors">
              {{ qa.label }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- App launcher -->
    <AppLauncher
      @open-app="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />

    <!-- Settings modal -->
    <DashboardSettingsModal
      :show="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>
