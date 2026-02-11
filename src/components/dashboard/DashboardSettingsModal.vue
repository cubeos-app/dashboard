<script setup>
/**
 * DashboardSettingsModal.vue — Session 1, Session 9
 *
 * Slide-over settings panel for dashboard customization.
 * Detects Standard vs Advanced mode via useDashboardConfig and shows
 * the appropriate settings for each mode.
 *
 * SESSION 9: Unified widget toggle list driven by WIDGET_REGISTRY.
 * Both modes now use the same widgetToggles computed (v-for loop) instead
 * of separate hardcoded SettingsToggle entries. Appearance section shows
 * all placed widgets (not just disk+signals). Layout/Quick Actions/App
 * Settings sections added to Advanced mode for full parity.
 *
 * Standard: Clock & Date, Widgets, Quick Actions, App Launcher, Appearance, Refresh Rate, Layout
 * Advanced: Widgets, Appearance, Refresh Rate, Quick Actions, App Settings, Layout
 */
import { ref, computed, watch, nextTick, defineComponent, h } from 'vue'
import { useDashboardConfig, WIDGET_REGISTRY, ALL_WIDGET_IDS, REFRESH_INTERVAL_OPTIONS } from '@/composables/useDashboardConfig'
import { useDashboardResize } from '@/composables/useDashboardResize'
import { useWidgetWebSocket } from '@/composables/useWidgetWebSocket'
import { useDashboardPresets, BUILT_IN_PRESETS } from '@/composables/useDashboardPresets'

// ─── Inline toggle component (render function, used only by this modal) ──
const SettingsToggle = defineComponent({
  name: 'SettingsToggle',
  props: {
    label: { type: String, required: true },
    active: { type: Boolean, required: true },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'flex items-center justify-between py-1' }, [
        h('span', { class: 'text-sm text-theme-secondary' }, props.label),
        h('button', {
          class: [
            'relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0',
            props.active ? 'bg-accent' : 'bg-theme-tertiary border border-theme-primary'
          ],
          role: 'switch',
          'aria-checked': String(props.active),
          'aria-label': `Toggle ${props.label}`,
          onClick: () => emit('toggle'),
        }, [
          h('span', {
            class: [
              'absolute top-0.5 w-[18px] h-[18px] rounded-full transition-transform duration-200 shadow-sm',
              props.active
                ? 'translate-x-[22px] bg-on-accent'
                : 'translate-x-0.5 bg-theme-muted'
            ]
          })
        ])
      ])
  }
})
import { useFocusTrap } from '@/composables/useFocusTrap'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true }
})

const emit = defineEmits(['close', 'open-presets'])

const { trapFocus } = useFocusTrap()
const config = useDashboardConfig()
const resize = useDashboardResize()
const wsInfo = useWidgetWebSocket()
const presets = useDashboardPresets()

const panelRef = ref(null)

/** Whether we're editing Advanced or Standard config */
const isAdvancedMode = computed(() => config.modeKey.value === 'advanced')

// Collapsible section states
const refreshRateOpen = ref(false)

// Auto-focus panel on open
watch(() => props.show, (visible) => {
  if (visible) nextTick(() => panelRef.value?.focus())
})

// ─── Date format options with live preview ──────────────────
const DATE_FORMATS = [
  { id: 'long',   label: 'Long' },
  { id: 'medium', label: 'Medium' },
  { id: 'short',  label: 'Short' },
  { id: 'iso',    label: 'ISO' },
  { id: 'us',     label: 'US' },
  { id: 'eu',     label: 'EU' },
]

function formatDatePreview(fmt) {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const monShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = now.getDate()
  const m = now.getMonth()
  const y = now.getFullYear()
  const dw = now.getDay()
  const pad = (n) => String(n).padStart(2, '0')

  switch (fmt) {
    case 'long':   return `${days[dw]}, ${months[m]} ${d}, ${y}`
    case 'medium': return `${days[dw]}, ${d} ${months[m]}, ${y}`
    case 'short':  return `${dayShort[dw]} ${d}-${monShort[m]}-${y}`
    case 'iso':    return `${y}-${pad(m + 1)}-${pad(d)}`
    case 'us':     return `${pad(m + 1)}/${pad(d)}/${y}`
    case 'eu':     return `${pad(d)}/${pad(m + 1)}/${y}`
    default:       return `${days[dw]}, ${months[m]} ${d}, ${y}`
  }
}

// ─── Quick Actions pool ─────────────────────────────────────
const ACTIONS_POOL = [
  { id: 'add_app',    label: 'Add App',    icon: 'Plus' },
  { id: 'network',    label: 'Network',    icon: 'Wifi' },
  { id: 'storage',    label: 'Storage',    icon: 'HardDrive' },
  { id: 'ask_cubeos', label: 'Ask CubeOS', icon: 'MessageSquare' },
  { id: 'system',     label: 'System',     icon: 'Settings2' },
  { id: 'settings',   label: 'Settings',   icon: 'SlidersHorizontal' },
  { id: 'monitoring', label: 'Monitoring', icon: 'BarChart3' },
  { id: 'logs',       label: 'Logs',       icon: 'ScrollText' },
  { id: 'docs',       label: 'Docs',       icon: 'BookOpen' },
  { id: 'vpn',        label: 'VPN',        icon: 'Shield' },
]

const enabledActions = computed(() => config.quickActions.value)

const availableActions = computed(() =>
  ACTIONS_POOL.filter(a => !enabledActions.value.includes(a.id))
)

function getActionMeta(id) {
  return ACTIONS_POOL.find(a => a.id === id) || { id, label: id, icon: 'Box' }
}

function moveAction(index, direction) {
  const list = [...enabledActions.value]
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= list.length) return
  ;[list[index], list[newIndex]] = [list[newIndex], list[index]]
  config.updateConfig('quick_actions', list)
}

function removeAction(id) {
  config.updateConfig('quick_actions', enabledActions.value.filter(a => a !== id))
}

function addAction(id) {
  if (enabledActions.value.length >= 8) return
  config.updateConfig('quick_actions', [...enabledActions.value, id])
}

// ─── Grid Layout manipulation (Session A) ───────────────────

/** Widget label helper */
function widgetLabel(id) {
  return WIDGET_REGISTRY[id]?.label || id
}

/** Widget icon helper */
function widgetIcon(id) {
  return WIDGET_REGISTRY[id]?.icon || 'Box'
}

// ─── Unified Widget Toggle Map (Session 9) ──────────────────
// Maps each widget ID to its preferences key + reactive getter.
// Used by the widgetToggles computed to drive a single v-for loop.
const WIDGET_TOGGLE_MAP = {
  clock:               { key: 'show_clock',               get: () => config.showClock.value },
  search:              { key: 'show_search',              get: () => config.showSearch.value },
  status:              { key: 'show_status_pill',         get: () => config.showStatusPill.value },
  infobar:             { key: 'show_info_bar',            get: () => config.showInfoBar.value },
  alerts:              { key: 'show_alerts',              get: () => config.showAlerts.value },
  vitals:              { key: 'show_system_vitals',       get: () => config.showSystemVitals.value },
  cpu_gauge:           { key: 'show_cpu_gauge',           get: () => config.showCpuGauge.value },
  memory_gauge:        { key: 'show_memory_gauge',        get: () => config.showMemoryGauge.value },
  disk_gauge:          { key: 'show_disk_gauge',          get: () => config.showDiskGauge.value },
  temp_gauge:          { key: 'show_temp_gauge',          get: () => config.showTempGauge.value },
  network:             { key: 'show_network_widget',      get: () => config.showNetwork.value },
  disk:                { key: 'show_disk_widget',         get: () => config.showDisk.value },
  signals:             { key: 'show_signals_widget',      get: () => config.showSignals.value },
  uptime_load:         { key: 'show_uptime_load',         get: () => config.showUptimeLoad.value },
  network_throughput:  { key: 'show_network_throughput',  get: () => config.showNetworkThroughput.value },
  recent_logs:         { key: 'show_recent_logs',         get: () => config.showRecentLogs.value },
  battery:             { key: 'show_battery',             get: () => config.showBattery.value },
  swarm:               { key: 'show_swarm',               get: () => config.showSwarm.value },
  core_services:       { key: 'show_core_services',       get: () => config.showCoreServices.value },
  favorites:           { key: 'show_favorites',           get: () => config.showFavorites.value },
  recent_apps:         { key: 'show_recent',              get: () => config.showRecent.value },
  my_apps:             { key: 'show_my_apps',             get: () => config.showMyApps.value },
  actions:             { key: 'show_quick_actions',       get: () => config.showQuickActions.value },
}

/**
 * Unified widget toggle list driven by WIDGET_REGISTRY.
 * Both Standard and Advanced modes use this same computed.
 * Ordered by category for clean UX.
 */
const WIDGET_TOGGLE_ORDER = [
  // Display
  'clock', 'search', 'status', 'infobar',
  // Monitoring
  'vitals', 'cpu_gauge', 'memory_gauge', 'disk_gauge', 'temp_gauge',
  'network', 'disk', 'signals',
  // Data
  'uptime_load', 'network_throughput', 'recent_logs', 'battery',
  // Infrastructure
  'swarm', 'core_services', 'alerts',
  // Apps & Actions
  'favorites', 'recent_apps', 'my_apps', 'actions',
]

const widgetToggles = computed(() => {
  return WIDGET_TOGGLE_ORDER
    .filter(id => WIDGET_TOGGLE_MAP[id])
    .map(id => ({
      id,
      label: WIDGET_REGISTRY[id]?.label || id,
      icon: WIDGET_REGISTRY[id]?.icon || 'Box',
      active: WIDGET_TOGGLE_MAP[id].get(),
      key: WIDGET_TOGGLE_MAP[id].key,
    }))
})

/** Current grid layout as a mutable copy */
function getLayoutCopy() {
  return config.gridLayout.value.map(entry => ({ row: [...entry.row] }))
}

/** Move a row up or down */
function moveRow(index, direction) {
  const rows = getLayoutCopy()
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= rows.length) return
  ;[rows[index], rows[newIndex]] = [rows[newIndex], rows[index]]
  config.updateGridLayout(rows)
}

/** Split a 2-widget row into two single-widget rows */
function splitRow(index) {
  const rows = getLayoutCopy()
  const entry = rows[index]
  if (!entry || entry.row.length < 2) return
  const [a, b] = entry.row
  rows.splice(index, 1, { row: [a] }, { row: [b] })
  config.updateGridLayout(rows)
}

/** Merge this row with the next row (both must have 1 widget) */
function mergeWithNext(index) {
  const rows = getLayoutCopy()
  const current = rows[index]
  const next = rows[index + 1]
  if (!current || !next) return
  if (current.row.length + next.row.length > 2) return
  rows.splice(index, 2, { row: [...current.row, ...next.row] })
  config.updateGridLayout(rows)
}

/** Remove a widget from a row. If row becomes empty, remove the row. */
function removeWidgetFromGrid(rowIdx, widgetId) {
  const rows = getLayoutCopy()
  const entry = rows[rowIdx]
  if (!entry) return
  entry.row = entry.row.filter(id => id !== widgetId)
  if (entry.row.length === 0) {
    rows.splice(rowIdx, 1)
  }
  config.updateGridLayout(rows)
}

/** Add an unplaced widget to an existing row (max 2 per row) */
function addWidgetToRow(rowIdx, widgetId) {
  const rows = getLayoutCopy()
  const entry = rows[rowIdx]
  if (!entry || entry.row.length >= 2) return
  entry.row.push(widgetId)
  config.updateGridLayout(rows)
}

/** Add a widget as a new row at the end */
function addWidgetAsNewRow(widgetId) {
  const rows = getLayoutCopy()
  rows.push({ row: [widgetId] })
  config.updateGridLayout(rows)
}

/** Whether a row can merge with the next */
function canMerge(index) {
  const rows = config.gridLayout.value
  const current = rows[index]
  const next = rows[index + 1]
  if (!current || !next) return false
  return current.row.length === 1 && next.row.length === 1
}

/** Whether a row can accept another widget */
function canAddToRow(index) {
  const rows = config.gridLayout.value
  return rows[index]?.row.length === 1
}

// ─── Toggle helper ──────────────────────────────────────────
function toggle(key, currentValue) {
  config.updateConfig(key, !currentValue)
}

// ─── Reset ──────────────────────────────────────────────────
async function handleReset() {
  if (!await confirm({
    title: 'Reset Dashboard Settings',
    message: `This will reset all ${isAdvancedMode.value ? 'Advanced' : 'Standard'} dashboard customizations to their defaults.`,
    confirmText: 'Reset',
    variant: 'warning'
  })) return
  config.resetDefaults()
}

function handleClose() {
  emit('close')
}

// ─── Unplaced widget picker state ───────────────────────────
const showWidgetPicker = ref(null)  // rowIdx or 'new'

// ─── Appearance section (Session B, updated Session 1) ──────
const appearanceOpen = ref(false)

/** Widget IDs that are placed in the grid (for opacity sliders) — both modes */
const opacityWidgets = computed(() => config.placedWidgetIds.value)

function openWidgetPicker(target) {
  showWidgetPicker.value = target
}

function pickWidget(widgetId) {
  if (showWidgetPicker.value === 'new') {
    addWidgetAsNewRow(widgetId)
  } else if (typeof showWidgetPicker.value === 'number') {
    addWidgetToRow(showWidgetPicker.value, widgetId)
  }
  showWidgetPicker.value = null
}

function closeWidgetPicker() {
  showWidgetPicker.value = null
}

// ─── Refresh Rate helpers (Session 5) ──────────────────────

/**
 * Widgets that have configurable refresh rates.
 * Excludes static widgets (clock, search, actions, favorites, etc.).
 * Session 9: Unified — both modes use the same dynamic logic.
 */
const refreshableWidgets = computed(() => {
  return config.placedWidgetIds.value.filter(
    id => !wsInfo.isStaticWidget(id)
  )
})

/** Format a refresh interval for display */
function formatRefreshLabel(seconds) {
  if (seconds === 0) return 'Manual'
  if (seconds < 60) return `${seconds}s`
  return `${seconds / 60} min`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div
        v-if="show"
        ref="panelRef"
        class="fixed inset-0 z-50 flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard Settings"
        tabindex="-1"
        @keydown.escape="handleClose"
        @keydown="trapFocus"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
          @click="handleClose"
        ></div>

        <!-- Panel -->
        <div class="relative w-full max-w-md h-full bg-theme-card border-l border-theme-primary shadow-theme-xl flex flex-col animate-settings-slide-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-theme-primary flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-theme-tertiary flex items-center justify-center">
                <Icon name="SlidersHorizontal" :size="18" class="text-theme-secondary" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-theme-primary">Dashboard Settings</h2>
                <p class="text-xs text-theme-muted">
                  {{ isAdvancedMode ? 'Advanced' : 'Standard' }} view
                  <span class="ml-1 text-theme-tertiary">&middot; Ctrl+,</span>
                </p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close settings"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto p-5 space-y-6">

            <!-- ══════════════════════════════════════════════ -->
            <!-- ═══ ADVANCED MODE SECTIONS ═══════════════════ -->
            <!-- ══════════════════════════════════════════════ -->
            <template v-if="isAdvancedMode">

              <!-- Section: Presets (Session 6) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Presets</h3>
                <button
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-theme-primary bg-theme-secondary/30
                         hover:border-accent/40 hover:bg-accent/5 transition-all text-left"
                  @click="emit('open-presets'); emit('close')"
                >
                  <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="LayoutTemplate" :size="16" class="text-theme-secondary" />
                  </div>
                  <div class="min-w-0">
                    <span class="text-sm font-medium text-theme-primary">Choose a Preset</span>
                    <p class="text-[11px] text-theme-muted">One-click layouts for common use cases</p>
                  </div>
                  <Icon name="ChevronRight" :size="14" class="text-theme-muted ml-auto flex-shrink-0" />
                </button>
              </section>

              <!-- Section: Layout Lock (Session 6) -->
              <section>
                <div class="flex items-center justify-between py-1">
                  <div class="flex items-center gap-2">
                    <Icon name="Lock" :size="14" class="text-theme-secondary" />
                    <span class="text-sm text-theme-secondary">Lock layout</span>
                  </div>
                  <button
                    class="relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0"
                    :class="config.isLayoutLocked.value ? 'bg-warning' : 'bg-theme-tertiary border border-theme-primary'"
                    role="switch"
                    :aria-checked="String(config.isLayoutLocked.value)"
                    aria-label="Toggle layout lock"
                    @click="config.toggleLayoutLock()"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 w-[18px] h-[18px] rounded-full transition-transform duration-200 shadow-sm',
                        config.isLayoutLocked.value
                          ? 'translate-x-[22px] bg-white'
                          : 'translate-x-0.5 bg-theme-muted'
                      ]"
                    ></span>
                  </button>
                </div>
                <p v-if="config.isLayoutLocked.value" class="text-[11px] text-warning/70 mt-1">
                  Layout editing is disabled. Toggle off to make changes.
                </p>
              </section>

              <!-- Section: Widget Visibility (Session 9 — unified WIDGET_REGISTRY-driven) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Widgets</h3>
                <div class="space-y-3">
                  <SettingsToggle
                    v-for="w in widgetToggles"
                    :key="w.id"
                    :label="w.label"
                    :active="w.active"
                    @toggle="toggle(w.key, w.active)"
                  />
                </div>
              </section>

              <!-- Section: Appearance (Session 9 — all placed widgets, unified) -->
              <section>
                <button
                  class="w-full flex items-center justify-between text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3"
                  @click="appearanceOpen = !appearanceOpen"
                >
                  <span>Appearance</span>
                  <Icon
                    :name="appearanceOpen ? 'ChevronUp' : 'ChevronDown'"
                    :size="14"
                    class="text-theme-muted transition-transform"
                  />
                </button>
                <template v-if="appearanceOpen">
                  <p class="text-xs text-theme-muted mb-3">
                    Card background opacity. 0 = transparent, 100 = opaque.
                  </p>
                  <div class="space-y-3">
                    <div
                      v-for="wid in opacityWidgets"
                      :key="wid"
                      class="flex items-center gap-3"
                    >
                      <Icon :name="widgetIcon(wid)" :size="14" class="text-theme-secondary flex-shrink-0" />
                      <span class="text-sm text-theme-secondary flex-1 min-w-0 truncate">{{ widgetLabel(wid) }}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        :value="config.getOpacity(wid)"
                        class="w-20 accent-accent flex-shrink-0"
                        @input="config.updateOpacity(wid, parseInt($event.target.value))"
                      />
                      <span class="text-xs font-mono text-theme-muted w-8 text-right flex-shrink-0">
                        {{ config.getOpacity(wid) }}
                      </span>
                    </div>
                  </div>
                  <button
                    class="mt-3 text-xs text-theme-muted hover:text-accent transition-colors"
                    @click="config.resetAllOpacity()"
                  >
                    Reset all to defaults
                  </button>
                </template>
              </section>

              <!-- Section: Refresh Rate (Session 9 — unified) -->
              <section>
                <button
                  class="w-full flex items-center justify-between text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3"
                  @click="refreshRateOpen = !refreshRateOpen"
                >
                  <span>Refresh Rate</span>
                  <Icon
                    :name="refreshRateOpen ? 'ChevronUp' : 'ChevronDown'"
                    :size="14"
                    class="text-theme-muted transition-transform"
                  />
                </button>
                <template v-if="refreshRateOpen">
                  <p class="text-xs text-theme-muted mb-3">
                    Per-widget polling interval. Widgets receiving live WebSocket data skip polling automatically.
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="wid in refreshableWidgets"
                      :key="'adv-refresh-' + wid"
                      class="flex items-center gap-3"
                    >
                      <Icon :name="widgetIcon(wid)" :size="14" class="text-theme-secondary flex-shrink-0" />
                      <span class="text-sm text-theme-secondary flex-1 min-w-0 truncate">
                        {{ widgetLabel(wid) }}
                      </span>

                      <!-- Live badge OR dropdown -->
                      <template v-if="wsInfo.isWsCoverable(wid) && wsInfo.isWsActive.value">
                        <span class="flex items-center gap-1 text-[10px] text-emerald-400 font-medium flex-shrink-0">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Live
                        </span>
                      </template>
                      <template v-else>
                        <select
                          class="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary border border-theme-primary
                                 text-theme-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 flex-shrink-0"
                          :value="config.getRefreshInterval(wid)"
                          @change="config.updateRefreshInterval(wid, parseInt($event.target.value))"
                        >
                          <option
                            v-for="opt in REFRESH_INTERVAL_OPTIONS"
                            :key="opt.value"
                            :value="opt.value"
                          >{{ opt.label }}</option>
                        </select>
                      </template>
                    </div>
                  </div>
                  <button
                    class="mt-3 text-xs text-theme-muted hover:text-accent transition-colors"
                    @click="config.resetAllRefreshIntervals()"
                  >
                    Reset to defaults
                  </button>
                </template>
              </section>

              <!-- Section: Quick Actions (Session 9 — added to Advanced) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                  Quick Actions
                  <span class="text-theme-muted font-normal normal-case tracking-normal ml-1">({{ enabledActions.length }}/8)</span>
                </h3>

                <!-- Enabled list (reorderable) -->
                <div v-if="enabledActions.length" class="space-y-1 mb-3">
                  <div
                    v-for="(id, index) in enabledActions"
                    :key="id"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary"
                  >
                    <Icon :name="getActionMeta(id).icon" :size="16" class="text-theme-secondary flex-shrink-0" />
                    <span class="text-sm text-theme-primary flex-1">{{ getActionMeta(id).label }}</span>
                    <button
                      :disabled="index === 0"
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                      @click="moveAction(index, -1)"
                    >
                      <Icon name="ChevronUp" :size="14" />
                    </button>
                    <button
                      :disabled="index === enabledActions.length - 1"
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                      @click="moveAction(index, 1)"
                    >
                      <Icon name="ChevronDown" :size="14" />
                    </button>
                    <button
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-error hover:bg-error-muted transition-colors"
                      aria-label="Remove action"
                      @click="removeAction(id)"
                    >
                      <Icon name="X" :size="14" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-xs text-theme-muted italic mb-3">No quick actions enabled</p>

                <!-- Available pool -->
                <div v-if="availableActions.length" class="space-y-1">
                  <p class="text-xs text-theme-muted mb-1">Available</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="action in availableActions"
                      :key="action.id"
                      :disabled="enabledActions.length >= 8"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-primary text-xs text-theme-secondary
                             hover:bg-theme-tertiary hover:text-theme-primary transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                      @click="addAction(action.id)"
                    >
                      <Icon :name="action.icon" :size="12" />
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </section>

              <!-- Section: App Settings (Session 9 — added to Advanced) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">App Settings</h3>
                <div class="space-y-3">
                  <!-- My Apps rows -->
                  <div class="flex items-center justify-between py-1">
                    <span class="text-sm text-theme-secondary">My Apps rows</span>
                    <div class="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        :value="config.myAppsRows.value"
                        class="w-24 accent-accent"
                        @input="config.updateConfig('my_apps_rows', parseInt($event.target.value))"
                      />
                      <span class="text-xs font-mono text-theme-muted w-8 text-right">
                        {{ config.myAppsRows.value === 0 ? 'All' : config.myAppsRows.value }}
                      </span>
                    </div>
                  </div>

                  <!-- Favorites columns -->
                  <div class="flex items-center justify-between py-1">
                    <span class="text-sm text-theme-secondary">Favorites columns</span>
                    <div class="flex rounded-lg border border-theme-primary overflow-hidden">
                      <button
                        v-for="n in [2, 3, 4, 5, 6]"
                        :key="n"
                        class="px-2.5 py-1.5 text-xs font-medium transition-colors"
                        :class="config.favoriteCols.value === n
                          ? 'bg-accent text-on-accent'
                          : 'text-theme-secondary hover:bg-theme-tertiary'"
                        @click="config.updateConfig('favorite_cols', n)"
                      >
                        {{ n }}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Section: Layout (Session 9 — added to Advanced, same as Standard) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Layout</h3>
                <p class="text-xs text-theme-muted mb-3">
                  Arrange widgets into rows. Each row holds 1-2 widgets side-by-side.
                </p>

                <div class="space-y-2">
                  <div
                    v-for="(entry, rowIdx) in config.gridLayout.value"
                    :key="rowIdx"
                    class="rounded-lg border border-theme-primary bg-theme-tertiary overflow-hidden"
                  >
                    <!-- Row header -->
                    <div class="flex items-center gap-1 px-2 py-1.5 border-b border-theme-primary/50">
                      <span class="text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex-1">
                        Row {{ rowIdx + 1 }}
                        <span class="font-normal normal-case tracking-normal ml-0.5">
                          ({{ entry.row.length === 1 ? 'full width' : 'side-by-side' }})
                        </span>
                      </span>

                      <!-- Row actions -->
                      <button
                        :disabled="rowIdx === 0"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move row up"
                        @click="moveRow(rowIdx, -1)"
                      >
                        <Icon name="ChevronUp" :size="12" />
                      </button>
                      <button
                        :disabled="rowIdx === config.gridLayout.value.length - 1"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move row down"
                        @click="moveRow(rowIdx, 1)"
                      >
                        <Icon name="ChevronDown" :size="12" />
                      </button>

                      <!-- Split (only for 2-widget rows) -->
                      <button
                        v-if="entry.row.length === 2"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
                        title="Split into two rows"
                        @click="splitRow(rowIdx)"
                      >
                        <Icon name="SplitSquareVertical" :size="12" />
                      </button>

                      <!-- Merge with next (only for single-widget rows with a single-widget next) -->
                      <button
                        v-if="canMerge(rowIdx)"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-accent transition-colors"
                        title="Merge with row below"
                        @click="mergeWithNext(rowIdx)"
                      >
                        <Icon name="Combine" :size="12" />
                      </button>
                    </div>

                    <!-- Widgets in this row -->
                    <div class="divide-y divide-theme-primary/30">
                      <div
                        v-for="widgetId in entry.row"
                        :key="widgetId"
                        class="flex items-center gap-2 px-3 py-2"
                      >
                        <Icon :name="widgetIcon(widgetId)" :size="14" class="text-theme-secondary flex-shrink-0" />
                        <span class="text-sm text-theme-primary flex-1">{{ widgetLabel(widgetId) }}</span>

                        <!-- Width selector (only for single-widget rows) -->
                        <select
                          v-if="entry.row.length === 1"
                          class="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary border border-theme-primary
                                 text-theme-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50"
                          :value="resize.getWidgetWidth(widgetId)"
                          @change="resize.updateWidgetWidth(widgetId, $event.target.value)"
                        >
                          <option value="full">Full</option>
                          <option value="half">Half</option>
                        </select>

                        <!-- Collapse toggle -->
                        <button
                          class="w-5 h-5 rounded flex items-center justify-center transition-colors"
                          :class="resize.isCollapsed(widgetId) ? 'text-accent' : 'text-theme-muted hover:text-theme-primary'"
                          :title="resize.isCollapsed(widgetId) ? 'Expand widget' : 'Collapse widget'"
                          @click="resize.toggleCollapse(widgetId)"
                        >
                          <Icon :name="resize.isCollapsed(widgetId) ? 'Minimize2' : 'Maximize2'" :size="12" />
                        </button>

                        <button
                          class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-error transition-colors"
                          title="Remove from layout"
                          @click="removeWidgetFromGrid(rowIdx, widgetId)"
                        >
                          <Icon name="X" :size="12" />
                        </button>
                      </div>

                      <!-- Add widget to this row (if only 1 widget and unplaced widgets exist) -->
                      <button
                        v-if="canAddToRow(rowIdx) && config.unplacedWidgetIds.value.length > 0"
                        class="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-muted hover:text-accent hover:bg-accent/5 transition-colors"
                        @click="openWidgetPicker(rowIdx)"
                      >
                        <Icon name="Plus" :size="12" />
                        <span>Add widget to this row</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Add new row -->
                <button
                  v-if="config.unplacedWidgetIds.value.length > 0"
                  class="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-theme-primary
                         text-xs text-theme-muted hover:text-accent hover:border-accent/40 transition-colors"
                  @click="openWidgetPicker('new')"
                >
                  <Icon name="Plus" :size="14" />
                  <span>Add row</span>
                </button>

                <!-- Unplaced widgets info -->
                <p v-if="config.unplacedWidgetIds.value.length > 0" class="text-[10px] text-theme-muted mt-2">
                  {{ config.unplacedWidgetIds.value.length }} widget{{ config.unplacedWidgetIds.value.length !== 1 ? 's' : '' }} not placed:
                  {{ config.unplacedWidgetIds.value.map(id => widgetLabel(id)).join(', ') }}
                </p>

                <!-- Widget picker inline popup -->
                <div
                  v-if="showWidgetPicker !== null && config.unplacedWidgetIds.value.length > 0"
                  class="mt-2 p-2 rounded-lg border border-accent/30 bg-theme-secondary"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-theme-secondary">Choose widget</span>
                    <button
                      class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
                      @click="closeWidgetPicker"
                    >
                      <Icon name="X" :size="12" />
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="wid in config.unplacedWidgetIds.value"
                      :key="wid"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-primary text-xs text-theme-secondary
                             hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
                      @click="pickWidget(wid)"
                    >
                      <Icon :name="widgetIcon(wid)" :size="12" />
                      {{ widgetLabel(wid) }}
                    </button>
                  </div>
                </div>
              </section>
            </template>

            <!-- ══════════════════════════════════════════════ -->
            <!-- ═══ STANDARD MODE SECTIONS ═══════════════════ -->
            <!-- ══════════════════════════════════════════════ -->
            <template v-else>

              <!-- Section: Presets (Session 6) -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Presets</h3>
                <button
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-theme-primary bg-theme-secondary/30
                         hover:border-accent/40 hover:bg-accent/5 transition-all text-left"
                  @click="emit('open-presets'); emit('close')"
                >
                  <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon name="LayoutTemplate" :size="16" class="text-theme-secondary" />
                  </div>
                  <div class="min-w-0">
                    <span class="text-sm font-medium text-theme-primary">Choose a Preset</span>
                    <p class="text-[11px] text-theme-muted">One-click layouts for common use cases</p>
                  </div>
                  <Icon name="ChevronRight" :size="14" class="text-theme-muted ml-auto flex-shrink-0" />
                </button>
              </section>

              <!-- Section: Layout Lock (Session 6) -->
              <section>
                <div class="flex items-center justify-between py-1">
                  <div class="flex items-center gap-2">
                    <Icon name="Lock" :size="14" class="text-theme-secondary" />
                    <span class="text-sm text-theme-secondary">Lock layout</span>
                  </div>
                  <button
                    class="relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0"
                    :class="config.isLayoutLocked.value ? 'bg-warning' : 'bg-theme-tertiary border border-theme-primary'"
                    role="switch"
                    :aria-checked="String(config.isLayoutLocked.value)"
                    aria-label="Toggle layout lock"
                    @click="config.toggleLayoutLock()"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 w-[18px] h-[18px] rounded-full transition-transform duration-200 shadow-sm',
                        config.isLayoutLocked.value
                          ? 'translate-x-[22px] bg-white'
                          : 'translate-x-0.5 bg-theme-muted'
                      ]"
                    ></span>
                  </button>
                </div>
                <p v-if="config.isLayoutLocked.value" class="text-[11px] text-warning/70 mt-1">
                  Layout editing is disabled. Toggle off to make changes.
                </p>
              </section>

              <!-- ═══ Section: Clock & Date ═══ -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Clock & Date</h3>
                <div class="space-y-3">
                  <SettingsToggle label="Show clock" :active="config.showClock.value" @toggle="toggle('show_clock', config.showClock.value)" />
                  <SettingsToggle label="Show greeting" :active="config.showGreeting.value" @toggle="toggle('show_greeting', config.showGreeting.value)" />
                  <SettingsToggle label="Show seconds" :active="config.showSeconds.value" @toggle="toggle('show_seconds', config.showSeconds.value)" />

                  <!-- Time format -->
                  <div class="flex items-center justify-between py-1">
                    <span class="text-sm text-theme-secondary">Time format</span>
                    <div class="flex rounded-lg border border-theme-primary overflow-hidden">
                      <button
                        v-for="fmt in ['12h', '24h']"
                        :key="fmt"
                        class="px-3 py-1.5 text-xs font-medium transition-colors"
                        :class="config.clockFormat.value === fmt
                          ? 'bg-accent text-on-accent'
                          : 'text-theme-secondary hover:bg-theme-tertiary'"
                        @click="config.updateConfig('clock_format', fmt)"
                      >
                        {{ fmt }}
                      </button>
                    </div>
                  </div>

                  <!-- Date format -->
                  <div class="space-y-2">
                    <span class="text-sm text-theme-secondary">Date format</span>
                    <div class="space-y-1">
                      <button
                        v-for="fmt in DATE_FORMATS"
                        :key="fmt.id"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                        :class="config.dateFormat.value === fmt.id
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'text-theme-secondary hover:bg-theme-tertiary border border-transparent'"
                        @click="config.updateConfig('date_format', fmt.id)"
                      >
                        <span class="font-medium">{{ fmt.label }}</span>
                        <span class="text-xs opacity-70">{{ formatDatePreview(fmt.id) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- ═══ Section: Widgets (Session 9 — unified WIDGET_REGISTRY-driven) ═══ -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Widgets</h3>
                <div class="space-y-3">
                  <SettingsToggle
                    v-for="w in widgetToggles"
                    :key="w.id"
                    :label="w.label"
                    :active="w.active"
                    @toggle="toggle(w.key, w.active)"
                  />
                </div>
              </section>

              <!-- ═══ Section: Quick Actions ═══ -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                  Quick Actions
                  <span class="text-theme-muted font-normal normal-case tracking-normal ml-1">({{ enabledActions.length }}/8)</span>
                </h3>

                <!-- Enabled list (reorderable) -->
                <div v-if="enabledActions.length" class="space-y-1 mb-3">
                  <div
                    v-for="(id, index) in enabledActions"
                    :key="id"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary"
                  >
                    <Icon :name="getActionMeta(id).icon" :size="16" class="text-theme-secondary flex-shrink-0" />
                    <span class="text-sm text-theme-primary flex-1">{{ getActionMeta(id).label }}</span>
                    <button
                      :disabled="index === 0"
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                      @click="moveAction(index, -1)"
                    >
                      <Icon name="ChevronUp" :size="14" />
                    </button>
                    <button
                      :disabled="index === enabledActions.length - 1"
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                      @click="moveAction(index, 1)"
                    >
                      <Icon name="ChevronDown" :size="14" />
                    </button>
                    <button
                      class="w-6 h-6 rounded flex items-center justify-center text-theme-muted hover:text-error hover:bg-error-muted transition-colors"
                      aria-label="Remove action"
                      @click="removeAction(id)"
                    >
                      <Icon name="X" :size="14" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-xs text-theme-muted italic mb-3">No quick actions enabled</p>

                <!-- Available pool -->
                <div v-if="availableActions.length" class="space-y-1">
                  <p class="text-xs text-theme-muted mb-1">Available</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="action in availableActions"
                      :key="action.id"
                      :disabled="enabledActions.length >= 8"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-primary text-xs text-theme-secondary
                             hover:bg-theme-tertiary hover:text-theme-primary transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                      @click="addAction(action.id)"
                    >
                      <Icon :name="action.icon" :size="12" />
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </section>

              <!-- ═══ Section: App Launcher ═══ -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">App Launcher</h3>
                <div class="space-y-3">
                  <SettingsToggle label="Favorites section" :active="config.showFavorites.value" @toggle="toggle('show_favorites', config.showFavorites.value)" />
                  <SettingsToggle label="Recently Used section" :active="config.showRecent.value" @toggle="toggle('show_recent', config.showRecent.value)" />
                  <SettingsToggle label="My Apps section" :active="config.showMyApps.value" @toggle="toggle('show_my_apps', config.showMyApps.value)" />

                  <!-- My Apps rows -->
                  <div class="flex items-center justify-between py-1">
                    <span class="text-sm text-theme-secondary">My Apps rows</span>
                    <div class="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        :value="config.myAppsRows.value"
                        class="w-24 accent-accent"
                        @input="config.updateConfig('my_apps_rows', parseInt($event.target.value))"
                      />
                      <span class="text-xs font-mono text-theme-muted w-8 text-right">
                        {{ config.myAppsRows.value === 0 ? 'All' : config.myAppsRows.value }}
                      </span>
                    </div>
                  </div>

                  <!-- Favorites columns -->
                  <div class="flex items-center justify-between py-1">
                    <span class="text-sm text-theme-secondary">Favorites columns</span>
                    <div class="flex rounded-lg border border-theme-primary overflow-hidden">
                      <button
                        v-for="n in [2, 3, 4, 5, 6]"
                        :key="n"
                        class="px-2.5 py-1.5 text-xs font-medium transition-colors"
                        :class="config.favoriteCols.value === n
                          ? 'bg-accent text-on-accent'
                          : 'text-theme-secondary hover:bg-theme-tertiary'"
                        @click="config.updateConfig('favorite_cols', n)"
                      >
                        {{ n }}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- ═══ Section: Appearance (Session B) ═══ -->
              <section>
                <button
                  class="w-full flex items-center justify-between text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3"
                  @click="appearanceOpen = !appearanceOpen"
                >
                  <span>Appearance</span>
                  <Icon
                    :name="appearanceOpen ? 'ChevronUp' : 'ChevronDown'"
                    :size="14"
                    class="text-theme-muted transition-transform"
                  />
                </button>

                <template v-if="appearanceOpen">
                  <p class="text-xs text-theme-muted mb-3">
                    Control card background opacity per widget. 0 = transparent, 100 = opaque.
                  </p>
                  <div class="space-y-3">
                    <div
                      v-for="wid in opacityWidgets"
                      :key="wid"
                      class="flex items-center gap-3"
                    >
                      <Icon :name="widgetIcon(wid)" :size="14" class="text-theme-secondary flex-shrink-0" />
                      <span class="text-sm text-theme-secondary flex-1 min-w-0 truncate">{{ widgetLabel(wid) }}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        :value="config.getOpacity(wid)"
                        class="w-20 accent-accent flex-shrink-0"
                        @input="config.updateOpacity(wid, parseInt($event.target.value))"
                      />
                      <span class="text-xs font-mono text-theme-muted w-8 text-right flex-shrink-0">
                        {{ config.getOpacity(wid) }}
                      </span>
                    </div>
                  </div>
                  <button
                    class="mt-3 text-xs text-theme-muted hover:text-accent transition-colors"
                    @click="config.resetAllOpacity()"
                  >
                    Reset all to defaults
                  </button>
                </template>
              </section>

              <!-- ═══ Section: Refresh Rate (Session 5) ═══ -->
              <section>
                <button
                  class="w-full flex items-center justify-between text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3"
                  @click="refreshRateOpen = !refreshRateOpen"
                >
                  <span>Refresh Rate</span>
                  <Icon
                    :name="refreshRateOpen ? 'ChevronUp' : 'ChevronDown'"
                    :size="14"
                    class="text-theme-muted transition-transform"
                  />
                </button>
                <template v-if="refreshRateOpen">
                  <p class="text-xs text-theme-muted mb-3">
                    Per-widget polling interval. Widgets receiving live WebSocket data skip polling automatically.
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="wid in refreshableWidgets"
                      :key="'std-refresh-' + wid"
                      class="flex items-center gap-3"
                    >
                      <Icon :name="widgetIcon(wid)" :size="14" class="text-theme-secondary flex-shrink-0" />
                      <span class="text-sm text-theme-secondary flex-1 min-w-0 truncate">{{ widgetLabel(wid) }}</span>

                      <!-- Live badge OR dropdown -->
                      <template v-if="wsInfo.isWsCoverable(wid) && wsInfo.isWsActive.value">
                        <span class="flex items-center gap-1 text-[10px] text-emerald-400 font-medium flex-shrink-0">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Live
                        </span>
                      </template>
                      <template v-else>
                        <select
                          class="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary border border-theme-primary
                                 text-theme-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 flex-shrink-0"
                          :value="config.getRefreshInterval(wid)"
                          @change="config.updateRefreshInterval(wid, parseInt($event.target.value))"
                        >
                          <option
                            v-for="opt in REFRESH_INTERVAL_OPTIONS"
                            :key="opt.value"
                            :value="opt.value"
                          >{{ opt.label }}</option>
                        </select>
                      </template>
                    </div>
                  </div>
                  <button
                    class="mt-3 text-xs text-theme-muted hover:text-accent transition-colors"
                    @click="config.resetAllRefreshIntervals()"
                  >
                    Reset to defaults
                  </button>
                </template>
              </section>

              <!-- ═══ Section: Layout (Grid Rows) ═══ -->
              <section>
                <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Layout</h3>
                <p class="text-xs text-theme-muted mb-3">
                  Arrange widgets into rows. Each row holds 1-2 widgets side-by-side.
                </p>

                <div class="space-y-2">
                  <div
                    v-for="(entry, rowIdx) in config.gridLayout.value"
                    :key="rowIdx"
                    class="rounded-lg border border-theme-primary bg-theme-tertiary overflow-hidden"
                  >
                    <!-- Row header -->
                    <div class="flex items-center gap-1 px-2 py-1.5 border-b border-theme-primary/50">
                      <span class="text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex-1">
                        Row {{ rowIdx + 1 }}
                        <span class="font-normal normal-case tracking-normal ml-0.5">
                          ({{ entry.row.length === 1 ? 'full width' : 'side-by-side' }})
                        </span>
                      </span>

                      <!-- Row actions -->
                      <button
                        :disabled="rowIdx === 0"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move row up"
                        @click="moveRow(rowIdx, -1)"
                      >
                        <Icon name="ChevronUp" :size="12" />
                      </button>
                      <button
                        :disabled="rowIdx === config.gridLayout.value.length - 1"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move row down"
                        @click="moveRow(rowIdx, 1)"
                      >
                        <Icon name="ChevronDown" :size="12" />
                      </button>

                      <!-- Split (only for 2-widget rows) -->
                      <button
                        v-if="entry.row.length === 2"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
                        title="Split into two rows"
                        @click="splitRow(rowIdx)"
                      >
                        <Icon name="SplitSquareVertical" :size="12" />
                      </button>

                      <!-- Merge with next (only for single-widget rows with a single-widget next) -->
                      <button
                        v-if="canMerge(rowIdx)"
                        class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-accent transition-colors"
                        title="Merge with row below"
                        @click="mergeWithNext(rowIdx)"
                      >
                        <Icon name="Combine" :size="12" />
                      </button>
                    </div>

                    <!-- Widgets in this row -->
                    <div class="divide-y divide-theme-primary/30">
                      <div
                        v-for="widgetId in entry.row"
                        :key="widgetId"
                        class="flex items-center gap-2 px-3 py-2"
                      >
                        <Icon :name="widgetIcon(widgetId)" :size="14" class="text-theme-secondary flex-shrink-0" />
                        <span class="text-sm text-theme-primary flex-1">{{ widgetLabel(widgetId) }}</span>

                        <!-- Width selector (only for single-widget rows) -->
                        <select
                          v-if="entry.row.length === 1"
                          class="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary border border-theme-primary
                                 text-theme-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50"
                          :value="resize.getWidgetWidth(widgetId)"
                          @change="resize.updateWidgetWidth(widgetId, $event.target.value)"
                        >
                          <option value="full">Full</option>
                          <option value="half">Half</option>
                        </select>

                        <!-- Collapse toggle -->
                        <button
                          class="w-5 h-5 rounded flex items-center justify-center transition-colors"
                          :class="resize.isCollapsed(widgetId) ? 'text-accent' : 'text-theme-muted hover:text-theme-primary'"
                          :title="resize.isCollapsed(widgetId) ? 'Expand widget' : 'Collapse widget'"
                          @click="resize.toggleCollapse(widgetId)"
                        >
                          <Icon :name="resize.isCollapsed(widgetId) ? 'Minimize2' : 'Maximize2'" :size="12" />
                        </button>

                        <button
                          class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-error transition-colors"
                          title="Remove from layout"
                          @click="removeWidgetFromGrid(rowIdx, widgetId)"
                        >
                          <Icon name="X" :size="12" />
                        </button>
                      </div>

                      <!-- Add widget to this row (if only 1 widget and unplaced widgets exist) -->
                      <button
                        v-if="canAddToRow(rowIdx) && config.unplacedWidgetIds.value.length > 0"
                        class="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-muted hover:text-accent hover:bg-accent/5 transition-colors"
                        @click="openWidgetPicker(rowIdx)"
                      >
                        <Icon name="Plus" :size="12" />
                        <span>Add widget to this row</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Add new row -->
                <button
                  v-if="config.unplacedWidgetIds.value.length > 0"
                  class="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-theme-primary
                         text-xs text-theme-muted hover:text-accent hover:border-accent/40 transition-colors"
                  @click="openWidgetPicker('new')"
                >
                  <Icon name="Plus" :size="14" />
                  <span>Add row</span>
                </button>

                <!-- Unplaced widgets info -->
                <p v-if="config.unplacedWidgetIds.value.length > 0" class="text-[10px] text-theme-muted mt-2">
                  {{ config.unplacedWidgetIds.value.length }} widget{{ config.unplacedWidgetIds.value.length !== 1 ? 's' : '' }} not placed:
                  {{ config.unplacedWidgetIds.value.map(id => widgetLabel(id)).join(', ') }}
                </p>

                <!-- Widget picker inline popup -->
                <div
                  v-if="showWidgetPicker !== null && config.unplacedWidgetIds.value.length > 0"
                  class="mt-2 p-2 rounded-lg border border-accent/30 bg-theme-secondary"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-theme-secondary">Choose widget</span>
                    <button
                      class="w-5 h-5 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
                      @click="closeWidgetPicker"
                    >
                      <Icon name="X" :size="12" />
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="wid in config.unplacedWidgetIds.value"
                      :key="wid"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-primary text-xs text-theme-secondary
                             hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
                      @click="pickWidget(wid)"
                    >
                      <Icon :name="widgetIcon(wid)" :size="12" />
                      {{ widgetLabel(wid) }}
                    </button>
                  </div>
                </div>
              </section>
            </template>

          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between p-5 border-t border-theme-primary flex-shrink-0">
            <div class="flex items-center gap-2">
              <button
                @click="handleReset"
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warning hover:bg-warning/10 transition-colors"
              >
                <Icon name="RotateCcw" :size="14" />
                Reset
              </button>
              <button
                @click="presets.downloadExport()"
                class="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary transition-colors"
                title="Export layout as JSON"
              >
                <Icon name="Download" :size="12" />
                Export
              </button>
            </div>
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-lg bg-theme-tertiary text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Slide-in animation for the settings panel */
@keyframes settings-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-settings-slide-in {
  animation: settings-slide-in 0.25s ease-out;
}

/* Fade transition for backdrop */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s ease;
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}
</style>
