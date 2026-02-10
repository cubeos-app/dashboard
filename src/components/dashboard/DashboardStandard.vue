<script setup>
/**
 * DashboardStandard.vue — S13 Visual Upgrade v3 + Session 2/3
 *
 * Standard mode ("consumer mode") dashboard.
 * Session 3: All sections respect useDashboardConfig toggles.
 * Widget order is user-configurable. Quick actions filtered/reordered from config.
 * Adjacent vitals+network are grouped into a side-by-side row.
 *
 * Defaults match the pre-config behavior so nothing changes until the user customizes.
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import Icon from '@/components/ui/Icon.vue'
import ClockWidget from './ClockWidget.vue'
import SearchChatBar from './SearchChatBar.vue'
import AlertBanner from './AlertBanner.vue'
import StatusPill from './StatusPill.vue'
import SystemVitals from './SystemVitals.vue'
import NetworkWidget from './NetworkWidget.vue'
import DiskWidget from './DiskWidget.vue'
import SignalsWidget from './SignalsWidget.vue'
import AppLauncher from './AppLauncher.vue'
import DashboardSettingsModal from './DashboardSettingsModal.vue'

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()

const {
  showClock,
  showSearch,
  showStatusPill,
  showSystemVitals,
  showNetwork,
  showDisk,
  showSignals,
  showQuickActions,
  showAlerts,
  showFavorites,
  showRecent,
  showMyApps,
  quickActions: configQuickActions,
  widgetOrder,
  favoriteCols,
  myAppsRows,
} = useDashboardConfig()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

const searchBarRef = ref(null)
defineExpose({ searchBarRef })

// ─── Settings modal ──────────────────────────────────────────
const showSettings = ref(false)

// ─── Quick actions pool (full definitions) ───────────────────
// Action IDs must match the ACTIONS_POOL in DashboardSettingsModal.vue
const ACTIONS_POOL = {
  add_app:    { label: 'Add App',    icon: 'Plus',              color: 'bg-emerald-500/15 text-emerald-400', action: () => router.push('/apps?tab=store') },
  network:    { label: 'Network',    icon: 'Wifi',              color: 'bg-indigo-500/15 text-indigo-400',   action: () => router.push('/network') },
  storage:    { label: 'Storage',    icon: 'HardDrive',         color: 'bg-amber-500/15 text-amber-400',     action: () => router.push('/storage') },
  ask_cubeos: { label: 'Ask CubeOS', icon: 'MessageSquare',     color: 'bg-violet-500/15 text-violet-400',   action: () => emit('open-chat') },
  system:     { label: 'System',     icon: 'Settings2',         color: 'bg-cyan-500/15 text-cyan-400',       action: () => router.push('/system') },
  settings:   { label: 'Settings',   icon: 'SlidersHorizontal', color: 'bg-rose-500/15 text-rose-400',       action: () => router.push('/settings') },
  monitoring: { label: 'Monitoring', icon: 'BarChart3',         color: 'bg-teal-500/15 text-teal-400',       action: () => router.push('/system?tab=monitoring') },
  logs:       { label: 'Logs',       icon: 'ScrollText',        color: 'bg-slate-500/15 text-slate-400',     action: () => router.push('/system?tab=logs') },
  docs:       { label: 'Docs',       icon: 'BookOpen',          color: 'bg-sky-500/15 text-sky-400',         action: () => router.push('/docs') },
  vpn:        { label: 'VPN',        icon: 'Shield',            color: 'bg-purple-500/15 text-purple-400',   action: () => router.push('/network?tab=vpn') },
}

/** Quick actions filtered and ordered by config */
const filteredQuickActions = computed(() => {
  return configQuickActions.value
    .map(id => ACTIONS_POOL[id] ? { id, ...ACTIONS_POOL[id] } : null)
    .filter(Boolean)
})

// ─── Ordered sections (groups adjacent vitals+network) ───────

const orderedSections = computed(() => {
  const order = widgetOrder.value
  const result = []
  let i = 0
  while (i < order.length) {
    const key = order[i]
    const next = order[i + 1]
    // Group adjacent vitals+network into a side-by-side row
    if ((key === 'vitals' && next === 'network') || (key === 'network' && next === 'vitals')) {
      result.push({ id: `${key}-${next}`, type: 'widgets-row', items: [key, next] })
      i += 2
    } else {
      result.push({ id: key, type: key })
      i++
    }
  }
  return result
})

// ─── Grid cols class for quick actions ───────────────────────
const quickActionsGridCols = computed(() => {
  const count = filteredQuickActions.value.length
  if (count <= 3) return 'grid-cols-3'
  if (count <= 4) return 'grid-cols-2 sm:grid-cols-4'
  if (count <= 6) return 'grid-cols-3 sm:grid-cols-6'
  return 'grid-cols-4 sm:grid-cols-8'
})

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

    <!-- Ordered sections from widget_order config -->
    <template v-for="section in orderedSections" :key="section.id">

      <!-- ═══ Clock ═══ -->
      <ClockWidget v-if="section.type === 'clock' && showClock" />

      <!-- ═══ Search + Chat bar ═══ -->
      <template v-if="section.type === 'search'">
        <SearchChatBar
          v-if="showSearch"
          ref="searchBarRef"
          @open-app="(app) => emit('open-app', app)"
          @open-chat="emit('open-chat')"
        />
        <!-- Alert banner follows search (not in widget_order, has own toggle) -->
        <AlertBanner v-if="showAlerts" />
      </template>

      <!-- ═══ Status pill ═══ -->
      <StatusPill v-if="section.type === 'status' && showStatusPill" />

      <!-- ═══ Widgets row (vitals + network side-by-side) ═══ -->
      <div
        v-if="section.type === 'widgets-row' && (showSystemVitals || showNetwork)"
        class="grid grid-cols-1 lg:grid-cols-2 gap-4 dash-stagger"
      >
        <template v-for="w in section.items" :key="w">
          <SystemVitals v-if="w === 'vitals' && showSystemVitals" />
          <NetworkWidget v-if="w === 'network' && showNetwork" />
        </template>
      </div>

      <!-- ═══ Individual vitals (not adjacent to network) ═══ -->
      <div v-if="section.type === 'vitals' && showSystemVitals" class="dash-stagger">
        <SystemVitals />
      </div>

      <!-- ═══ Individual network (not adjacent to vitals) ═══ -->
      <div v-if="section.type === 'network' && showNetwork" class="dash-stagger">
        <NetworkWidget />
      </div>

      <!-- ═══ Disk + Signals row (below vitals/network) ═══ -->
      <div
        v-if="section.type === 'disk-signals' && (showDisk || showSignals)"
        class="grid grid-cols-1 lg:grid-cols-2 gap-4 dash-stagger"
      >
        <DiskWidget v-if="showDisk" />
        <SignalsWidget v-if="showSignals" />
      </div>

      <!-- ═══ Quick Actions ═══ -->
      <div v-if="section.type === 'actions' && showQuickActions && filteredQuickActions.length > 0" class="dash-stagger">
        <div
          :class="cardBase()"
          class="rounded-2xl p-4"
        >
          <div class="grid gap-2" :class="quickActionsGridCols">
            <button
              v-for="qa in filteredQuickActions"
              :key="qa.id"
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

      <!-- ═══ App Launcher ═══ -->
      <AppLauncher
        v-if="section.type === 'launcher'"
        :show-favorites="showFavorites"
        :show-recent="showRecent"
        :show-my-apps="showMyApps"
        :my-apps-rows="myAppsRows"
        :favorite-cols="favoriteCols"
        @open-app="(app) => emit('open-app', app)"
        @toggle-favorite="(name) => emit('toggle-favorite', name)"
      />

    </template>

    <!-- Settings modal -->
    <DashboardSettingsModal
      :show="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>
