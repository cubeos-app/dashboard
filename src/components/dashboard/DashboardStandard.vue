<script setup>
/**
 * DashboardStandard.vue — Session A Grid Overhaul
 *
 * Standard mode ("consumer mode") dashboard.
 * Session A: Replaced flat widget_order + orderedSections with a row-based
 * grid layout from useDashboardConfig.gridLayout. Each row renders as a
 * grid grid-cols-1 lg:grid-cols-2 container. Single-item rows span full
 * width. Two-item rows sit side-by-side.
 *
 * All widgets are rendered via a switch template keyed by widget ID.
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
  gridLayout,
  isWidgetVisible,
  favoriteCols,
  myAppsRows,
} = useDashboardConfig()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

const searchBarRef = ref(null)
defineExpose({ searchBarRef })

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

// ─── Grid rows (visibility-filtered) ────────────────────────

/**
 * Grid rows with hidden widgets stripped. Each entry has:
 *   - row: original widget IDs
 *   - visible: widget IDs that passed visibility check
 *   - hasSearch: whether this row contains the search widget (for AlertBanner)
 */
const gridRows = computed(() => {
  return gridLayout.value
    .map(entry => ({
      row: entry.row,
      visible: entry.row.filter(id => isWidgetVisible(id)),
      hasSearch: entry.row.includes('search') && isWidgetVisible('search'),
    }))
    .filter(entry => entry.visible.length > 0)
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

// ─── Empty state detection ─────────────────────────────────────
const isAllHidden = computed(() => gridRows.value.length === 0)
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto relative">
    <!-- Empty state when all widgets hidden -->
    <div
      v-if="isAllHidden"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <div class="w-16 h-16 rounded-2xl bg-theme-tertiary flex items-center justify-center mb-4">
        <Icon name="LayoutDashboard" :size="28" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-medium text-theme-secondary mb-2">Dashboard is empty</h3>
      <p class="text-sm text-theme-muted max-w-xs">
        All widgets are hidden. Open settings to add widgets back to your dashboard.
      </p>
    </div>

    <!-- Grid rows from grid_layout config -->
    <template v-for="(entry, rowIdx) in gridRows" :key="rowIdx">
      <!-- Row container: 1-col on mobile, 2-col on lg+ -->
      <div
        class="grid grid-cols-1 gap-4 dash-stagger"
        :class="entry.visible.length > 1 ? 'lg:grid-cols-2' : ''"
      >
        <template v-for="widgetId in entry.visible" :key="widgetId">

          <!-- ═══ Clock ═══ -->
          <ClockWidget
            v-if="widgetId === 'clock'"
            :card="true"
          />

          <!-- ═══ Search + Chat bar ═══ -->
          <SearchChatBar
            v-if="widgetId === 'search'"
            ref="searchBarRef"
            @open-app="(app) => emit('open-app', app)"
            @open-chat="emit('open-chat')"
          />

          <!-- ═══ Status pill ═══ -->
          <StatusPill v-if="widgetId === 'status'" />

          <!-- ═══ System Vitals ═══ -->
          <SystemVitals v-if="widgetId === 'vitals'" />

          <!-- ═══ Network ═══ -->
          <NetworkWidget v-if="widgetId === 'network'" />

          <!-- ═══ Disk ═══ -->
          <DiskWidget v-if="widgetId === 'disk'" />

          <!-- ═══ Signals ═══ -->
          <SignalsWidget v-if="widgetId === 'signals'" />

          <!-- ═══ Quick Actions ═══ -->
          <div v-if="widgetId === 'actions' && filteredQuickActions.length > 0">
            <div
              :class="cardBase()"
              class="rounded-2xl p-4 h-full"
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
          <div
            v-if="widgetId === 'launcher'"
            :class="entry.visible.length === 1 ? '' : ''"
          >
            <AppLauncher
              :show-favorites="showFavorites"
              :show-recent="showRecent"
              :show-my-apps="showMyApps"
              :my-apps-rows="myAppsRows"
              :favorite-cols="favoriteCols"
              @open-app="(app) => emit('open-app', app)"
              @toggle-favorite="(name) => emit('toggle-favorite', name)"
            />
          </div>

        </template>
      </div>

      <!-- Alert banner follows the row that contains search (not in grid, always full-width) -->
      <AlertBanner v-if="entry.hasSearch && showAlerts" />
    </template>
  </div>
</template>
