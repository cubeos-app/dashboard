<script setup>
/**
 * DashboardStandard.vue — Session C: Drag-and-Drop Edit Mode
 *
 * Standard mode ("consumer mode") dashboard.
 * Session A: Row-based grid layout from useDashboardConfig.gridLayout.
 * Session B: Widgets wrapped in WidgetWrapper for per-widget opacity.
 * Session C: When isEditing=true, widgets become draggable with drop zones
 *   between rows and beside single-widget rows.
 *
 * HTML5 Drag and Drop API — no library dependency.
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
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
import WidgetWrapper from './WidgetWrapper.vue'

const props = defineProps({
  isEditing: { type: Boolean, default: false },
})

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()
const { handleDrop, dragWidgetId } = useDashboardEdit()

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

// ─── Drop zone state ──────────────────────────────────────────────
// Tracks which drop zone is currently highlighted
const activeDropZone = ref(null) // e.g. "before-0", "after-2", "left-1", "right-1"

function dropZoneId(position, rowIdx) {
  return `${position}-${rowIdx}`
}

function onDragOver(e, position, rowIdx) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  activeDropZone.value = dropZoneId(position, rowIdx)
}

function onDragLeave(e, position, rowIdx) {
  // Only deactivate if we're actually leaving (not entering a child)
  if (activeDropZone.value === dropZoneId(position, rowIdx)) {
    activeDropZone.value = null
  }
}

function onDrop(e, position, rowIdx) {
  e.preventDefault()
  activeDropZone.value = null
  handleDrop(rowIdx, position)
}

function isDropActive(position, rowIdx) {
  return activeDropZone.value === dropZoneId(position, rowIdx)
}

// ─── Quick actions pool (full definitions) ───────────────────
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

const filteredQuickActions = computed(() => {
  return configQuickActions.value
    .map(id => ACTIONS_POOL[id] ? { id, ...ACTIONS_POOL[id] } : null)
    .filter(Boolean)
})

// ─── Grid rows (visibility-filtered) ────────────────────────

const gridRows = computed(() => {
  return gridLayout.value
    .map(entry => ({
      row: entry.row,
      visible: entry.row.filter(id => isWidgetVisible(id)),
      hasSearch: entry.row.includes('search') && isWidgetVisible('search'),
    }))
    .filter(entry => entry.visible.length > 0)
})

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

const isAllHidden = computed(() => gridRows.value.length === 0)
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto relative">
    <!-- Edit mode banner -->
    <div
      v-if="isEditing"
      class="text-center py-2 text-xs text-theme-muted select-none animate-fade-in"
    >
      Drag widgets to rearrange. Drop beside a widget to pair them.
    </div>

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
      <!-- Drop zone BEFORE this row (insert as new row) -->
      <div
        v-if="isEditing && dragWidgetId"
        class="drop-zone-row"
        :class="isDropActive('before', rowIdx) ? 'drop-zone-active' : 'drop-zone-idle'"
        @dragover.prevent="onDragOver($event, 'before', rowIdx)"
        @dragleave="onDragLeave($event, 'before', rowIdx)"
        @drop="onDrop($event, 'before', rowIdx)"
      >
        <div class="drop-zone-indicator">
          <Icon name="Plus" :size="12" />
        </div>
      </div>

      <!-- Row container: 1-col on mobile, 2-col on lg+ -->
      <div
        class="grid grid-cols-1 gap-4 dash-stagger"
        :class="entry.visible.length > 1 ? 'lg:grid-cols-2' : ''"
      >
        <!-- Side drop zone: LEFT (only for single-widget rows in edit mode) -->
        <div
          v-if="isEditing && dragWidgetId && entry.visible.length === 1"
          class="hidden lg:flex drop-zone-side"
          :class="isDropActive('left', rowIdx) ? 'drop-zone-active' : 'drop-zone-idle'"
          @dragover.prevent="onDragOver($event, 'left', rowIdx)"
          @dragleave="onDragLeave($event, 'left', rowIdx)"
          @drop="onDrop($event, 'left', rowIdx)"
        >
          <div class="drop-zone-indicator">
            <Icon name="Plus" :size="14" />
          </div>
        </div>

        <template v-for="widgetId in entry.visible" :key="widgetId">

          <!-- ═══ Clock ═══ -->
          <WidgetWrapper v-if="widgetId === 'clock'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <ClockWidget :card="true" />
          </WidgetWrapper>

          <!-- ═══ Search + Chat bar ═══ -->
          <WidgetWrapper v-if="widgetId === 'search'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <SearchChatBar
              ref="searchBarRef"
              @open-app="(app) => emit('open-app', app)"
              @open-chat="emit('open-chat')"
            />
          </WidgetWrapper>

          <!-- ═══ Status pill ═══ -->
          <WidgetWrapper v-if="widgetId === 'status'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <StatusPill />
          </WidgetWrapper>

          <!-- ═══ System Vitals ═══ -->
          <WidgetWrapper v-if="widgetId === 'vitals'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <SystemVitals />
          </WidgetWrapper>

          <!-- ═══ Network ═══ -->
          <WidgetWrapper v-if="widgetId === 'network'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <NetworkWidget />
          </WidgetWrapper>

          <!-- ═══ Disk ═══ -->
          <WidgetWrapper v-if="widgetId === 'disk'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <DiskWidget />
          </WidgetWrapper>

          <!-- ═══ Signals ═══ -->
          <WidgetWrapper v-if="widgetId === 'signals'" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <SignalsWidget />
          </WidgetWrapper>

          <!-- ═══ Quick Actions ═══ -->
          <WidgetWrapper v-if="widgetId === 'actions' && filteredQuickActions.length > 0" :widget-id="widgetId" :editing="isEditing" :row-idx="rowIdx">
            <div>
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
          </WidgetWrapper>

          <!-- ═══ App Launcher ═══ -->
          <WidgetWrapper
            v-if="widgetId === 'launcher'"
            :widget-id="widgetId"
            :editing="isEditing"
            :row-idx="rowIdx"
          >
            <div>
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
          </WidgetWrapper>

        </template>

        <!-- Side drop zone: RIGHT (only for single-widget rows in edit mode) -->
        <div
          v-if="isEditing && dragWidgetId && entry.visible.length === 1"
          class="hidden lg:flex drop-zone-side"
          :class="isDropActive('right', rowIdx) ? 'drop-zone-active' : 'drop-zone-idle'"
          @dragover.prevent="onDragOver($event, 'right', rowIdx)"
          @dragleave="onDragLeave($event, 'right', rowIdx)"
          @drop="onDrop($event, 'right', rowIdx)"
        >
          <div class="drop-zone-indicator">
            <Icon name="Plus" :size="14" />
          </div>
        </div>
      </div>

      <!-- Alert banner follows the row that contains search (not in grid, always full-width) -->
      <AlertBanner v-if="entry.hasSearch && showAlerts" />
    </template>

    <!-- Drop zone AFTER last row (append as new row) -->
    <div
      v-if="isEditing && dragWidgetId && gridRows.length > 0"
      class="drop-zone-row"
      :class="isDropActive('after', gridRows.length - 1) ? 'drop-zone-active' : 'drop-zone-idle'"
      @dragover.prevent="onDragOver($event, 'after', gridRows.length - 1)"
      @dragleave="onDragLeave($event, 'after', gridRows.length - 1)"
      @drop="onDrop($event, 'after', gridRows.length - 1)"
    >
      <div class="drop-zone-indicator">
        <Icon name="Plus" :size="12" />
        <span class="text-[10px]">Drop here</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Drop zone styles ──────────────────────────────────────── */

.drop-zone-row {
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin: -0.25rem 0;
}

.drop-zone-side {
  min-height: 4rem;
  border-radius: 1rem;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.drop-zone-idle {
  border: 2px dashed var(--border-primary, rgba(255,255,255,0.08));
  opacity: 0.4;
}

.drop-zone-idle:hover {
  opacity: 0.7;
}

.drop-zone-active {
  border: 2px dashed var(--accent, #6366f1);
  background-color: rgba(99, 102, 241, 0.08);
  opacity: 1;
}

.drop-zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-muted, rgba(255,255,255,0.4));
  pointer-events: none;
}

.drop-zone-active .drop-zone-indicator {
  color: var(--accent, #6366f1);
}

/* Fade in animation for edit UI */
.animate-fade-in {
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
