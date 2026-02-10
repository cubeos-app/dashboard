/**
 * CubeOS Dashboard Config Composable
 *
 * Reads dashboard configuration from the current mode's layout config:
 *   preferencesStore.preferences.dashboard.standard  (when in Standard mode)
 *   preferencesStore.preferences.dashboard.advanced   (when in Advanced mode)
 *
 * Provides computed getters with sane defaults for every setting, and exposes
 * updateConfig(key, value) that persists changes via PUT /preferences, correctly
 * nesting the update under the current mode key.
 *
 * SESSION 1: Changed default grid layouts to single-widget rows.
 * Removed forced pairing in migrateWidgetOrderToGrid().
 * Added migrateAdvancedSectionOrder() to expand composite IDs.
 * Advanced mode now uses the same grid-row layout engine as Standard.
 *
 * Usage:
 *   const { gridLayout, updateGridLayout, updateConfig } = useDashboardConfig()
 */
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'

// ─── Widget registry ────────────────────────────────────────

/** All known widget IDs with metadata */
export const WIDGET_REGISTRY = {
  clock:               { label: 'Clock',              icon: 'Clock' },
  search:              { label: 'Search Bar',         icon: 'Search' },
  status:              { label: 'Status Pill',        icon: 'Activity' },
  vitals:              { label: 'System Vitals',      icon: 'Cpu' },
  network:             { label: 'Network',            icon: 'Wifi' },
  disk:                { label: 'Disk Usage',         icon: 'HardDrive' },
  signals:             { label: 'Signals',            icon: 'Radio' },
  uptime_load:         { label: 'Uptime & Load',      icon: 'Clock' },
  network_throughput:  { label: 'Network Traffic',     icon: 'ArrowUpDown' },
  recent_logs:         { label: 'Recent Logs',         icon: 'ScrollText' },
  battery:             { label: 'Battery',             icon: 'Battery' },
  actions:             { label: 'Quick Actions',       icon: 'Zap' },
  launcher:            { label: 'App Launcher',        icon: 'Grid3x3' },
}

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)

/** Advanced-mode section IDs with metadata */
export const ADVANCED_SECTION_REGISTRY = {
  gauges:              { label: 'Status Gauges',       icon: 'Activity' },
  infobar:             { label: 'Info Bar',            icon: 'Info' },
  disk:                { label: 'Disk Usage',          icon: 'HardDrive' },
  signals:             { label: 'Signals',             icon: 'Radio' },
  swarm:               { label: 'Swarm Overview',      icon: 'Layers' },
  alerts:              { label: 'Alerts Feed',         icon: 'Bell' },
  'uptime-load':       { label: 'Uptime & Load',       icon: 'Clock' },
  'network-throughput':{ label: 'Network Traffic',      icon: 'ArrowUpDown' },
  'recent-logs':       { label: 'Recent Logs',          icon: 'ScrollText' },
  'battery':           { label: 'Battery',              icon: 'Battery' },
  favorites:           { label: 'Favorites',            icon: 'Star' },
  core:                { label: 'Core Services',        icon: 'Box' },
  'user-apps':         { label: 'User Apps',            icon: 'Package' },
  'quick-links':       { label: 'Quick Links',          icon: 'Zap' },
}

export const ALL_ADVANCED_SECTION_IDS = Object.keys(ADVANCED_SECTION_REGISTRY)

// ─── Default grid layouts ───────────────────────────────────

/** Default per-widget opacity (0=transparent, 100=opaque) */
const DEFAULT_OPACITY = 100
const CLOCK_DEFAULT_OPACITY = 0  // backward compat: clock was fully transparent

/**
 * SESSION 1: All single-widget rows by default.
 * Users can pair widgets via DnD (drag to side) or Settings modal (Merge).
 */
const STANDARD_GRID_LAYOUT = [
  { row: ['clock'] },
  { row: ['search'] },
  { row: ['status'] },
  { row: ['vitals'] },
  { row: ['network'] },
  { row: ['disk'] },
  { row: ['signals'] },
  { row: ['uptime_load'] },
  { row: ['network_throughput'] },
  { row: ['recent_logs'] },
  { row: ['battery'] },
  { row: ['actions'] },
  { row: ['launcher'] },
]

const ADVANCED_GRID_LAYOUT = [
  { row: ['vitals'] },
  { row: ['network'] },
  { row: ['disk'] },
  { row: ['signals'] },
  { row: ['uptime_load'] },
  { row: ['network_throughput'] },
  { row: ['recent_logs'] },
  { row: ['battery'] },
  { row: ['actions'] },
  { row: ['launcher'] },
]

/** Default advanced section order — all individual IDs, no composites */
const DEFAULT_ADVANCED_SECTION_ORDER = [
  'gauges', 'infobar', 'disk', 'signals', 'swarm', 'alerts',
  'uptime-load', 'network-throughput', 'recent-logs', 'battery',
  'favorites', 'core', 'user-apps', 'quick-links'
]

// ─── Defaults (per mode) ─────────────────────────────────────

/**
 * Default per-widget refresh intervals in seconds.
 * Widgets covered by WebSocket won't poll when WS is connected.
 * Widgets set to 0 mean "manual only" (no auto-refresh).
 */
const DEFAULT_REFRESH_INTERVALS = {
  vitals: 2,
  network: 5,
  disk: 10,
  signals: 10,
  status: 5,
  uptime_load: 60,
  network_throughput: 5,
  recent_logs: 15,
  battery: 30,
}

/** Available refresh interval options for the settings UI (seconds) */
export const REFRESH_INTERVAL_OPTIONS = [
  { value: 1,  label: '1s' },
  { value: 2,  label: '2s' },
  { value: 5,  label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 0,  label: 'Manual' },
]

const STANDARD_DEFAULTS = {
  show_clock: true,
  show_search: true,
  show_status_pill: true,
  show_system_vitals: true,
  show_network_widget: true,
  show_disk_widget: false,
  show_signals_widget: false,
  show_quick_actions: true,
  show_favorites: true,
  show_recent: true,
  show_my_apps: true,
  show_alerts: true,
  show_uptime_load: false,
  show_network_throughput: false,
  show_recent_logs: false,
  show_battery: true,
  clock_format: '24h',
  date_format: 'long',
  show_seconds: true,
  show_greeting: true,
  my_apps_rows: 2,
  favorite_cols: 4,
  quick_actions: ['add_app', 'network', 'storage', 'ask_cubeos'],
  widget_order: ['clock', 'search', 'status', 'vitals', 'network', 'disk', 'signals', 'actions', 'launcher'],
  grid_layout: STANDARD_GRID_LAYOUT,
  widget_opacity: { clock: CLOCK_DEFAULT_OPACITY },
  widget_dimensions: {},
  widget_refresh_intervals: {},
  layout_locked: false,
}

const ADVANCED_DEFAULTS = {
  show_clock: false,
  show_search: false,
  show_status_pill: false,
  show_system_vitals: true,
  show_network_widget: true,
  show_disk_widget: false,
  show_signals_widget: false,
  show_quick_actions: true,
  show_favorites: true,
  show_recent: false,
  show_my_apps: true,
  show_alerts: true,
  show_uptime_load: true,
  show_network_throughput: true,
  show_recent_logs: true,
  show_battery: true,
  // Advanced-specific section visibility
  show_info_bar: true,
  show_swarm: true,
  show_core_services: true,
  clock_format: '24h',
  date_format: 'long',
  show_seconds: false,
  show_greeting: false,
  my_apps_rows: 3,
  favorite_cols: 6,
  quick_actions: ['add_app', 'monitoring', 'logs', 'docs'],
  widget_order: ['alerts', 'vitals', 'network', 'disk', 'signals', 'actions', 'launcher'],
  grid_layout: ADVANCED_GRID_LAYOUT,
  widget_opacity: {},
  widget_dimensions: {},
  widget_refresh_intervals: {},
  layout_locked: false,
  advanced_section_order: DEFAULT_ADVANCED_SECTION_ORDER,
}

const DEFAULTS_BY_MODE = {
  standard: STANDARD_DEFAULTS,
  advanced: ADVANCED_DEFAULTS,
}

// ─── Helpers ─────────────────────────────────────────────────

/** Return val if non-null/undefined, otherwise the default. */
function boolOr(val, def) {
  return val != null ? val : def
}

/**
 * Migrate a flat widget_order array to grid_layout rows.
 * Handles the legacy 'disk-signals' composite key by splitting it.
 *
 * SESSION 1: No longer forces vitals+network pairing. Each widget
 * gets its own row, matching the new single-widget-row default.
 */
function migrateWidgetOrderToGrid(order) {
  if (!Array.isArray(order) || order.length === 0) return null
  const rows = []
  for (let i = 0; i < order.length; i++) {
    const key = order[i]

    // Legacy composite key: 'disk-signals' → two separate rows
    if (key === 'disk-signals') {
      rows.push({ row: ['disk'] })
      rows.push({ row: ['signals'] })
      continue
    }

    // Every widget gets its own row
    rows.push({ row: [key] })
  }
  return rows
}

/**
 * Migrate legacy advanced_section_order with composite IDs.
 * Expands 'disk-signals' → 'disk', 'signals' and
 * 'swarm-alerts' → 'swarm', 'alerts', preserving relative order.
 * Returns null if no migration needed (no composite IDs found).
 */
function migrateAdvancedSectionOrder(order) {
  if (!Array.isArray(order)) return null

  const COMPOSITES = {
    'disk-signals': ['disk', 'signals'],
    'swarm-alerts': ['swarm', 'alerts'],
  }

  let hasComposite = false
  const expanded = []

  for (const id of order) {
    if (COMPOSITES[id]) {
      hasComposite = true
      expanded.push(...COMPOSITES[id])
    } else {
      expanded.push(id)
    }
  }

  if (!hasComposite) return null

  // Ensure all expected section IDs are present
  for (const id of DEFAULT_ADVANCED_SECTION_ORDER) {
    if (!expanded.includes(id)) {
      expanded.push(id)
    }
  }

  return expanded
}

/**
 * Validate a grid_layout structure. Returns true if it's a valid
 * array of {row: string[]} objects where each row has 1-2 items.
 */
function isValidGridLayout(layout) {
  if (!Array.isArray(layout) || layout.length === 0) return false
  return layout.every(
    entry => entry && Array.isArray(entry.row) && entry.row.length >= 1 && entry.row.length <= 2
  )
}

// ─── Composable ──────────────────────────────────────────────

export function useDashboardConfig() {
  const preferencesStore = usePreferencesStore()
  const { isAdvanced } = useMode()

  /** Current mode key: 'standard' | 'advanced' */
  const modeKey = computed(() => isAdvanced.value ? 'advanced' : 'standard')

  /** Defaults for the current mode */
  const defaults = computed(() => DEFAULTS_BY_MODE[modeKey.value])

  /** Raw layout config for the current mode (may be null/undefined) */
  const raw = computed(() => {
    const dash = preferencesStore.preferences?.dashboard
    return dash?.[modeKey.value]
  })

  // ─── Widget visibility (boolean, with mode-specific defaults) ──

  const showClock = computed(() => boolOr(raw.value?.show_clock, defaults.value.show_clock))
  const showSearch = computed(() => boolOr(raw.value?.show_search, defaults.value.show_search))
  const showStatusPill = computed(() => boolOr(raw.value?.show_status_pill, defaults.value.show_status_pill))
  const showSystemVitals = computed(() => boolOr(raw.value?.show_system_vitals, defaults.value.show_system_vitals))
  const showNetwork = computed(() => boolOr(raw.value?.show_network_widget, defaults.value.show_network_widget))
  const showDisk = computed(() => boolOr(raw.value?.show_disk_widget, defaults.value.show_disk_widget))
  const showSignals = computed(() => boolOr(raw.value?.show_signals_widget, defaults.value.show_signals_widget))
  const showQuickActions = computed(() => boolOr(raw.value?.show_quick_actions, defaults.value.show_quick_actions))
  const showFavorites = computed(() => boolOr(raw.value?.show_favorites, defaults.value.show_favorites))
  const showRecent = computed(() => boolOr(raw.value?.show_recent, defaults.value.show_recent))
  const showMyApps = computed(() => boolOr(raw.value?.show_my_apps, defaults.value.show_my_apps))
  const showAlerts = computed(() => boolOr(raw.value?.show_alerts, defaults.value.show_alerts))

  // ─── New widget visibility (Session 3) ────────────────────────

  const showUptimeLoad = computed(() => boolOr(raw.value?.show_uptime_load, defaults.value.show_uptime_load ?? false))
  const showNetworkThroughput = computed(() => boolOr(raw.value?.show_network_throughput, defaults.value.show_network_throughput ?? false))
  const showRecentLogs = computed(() => boolOr(raw.value?.show_recent_logs, defaults.value.show_recent_logs ?? false))
  const showBattery = computed(() => boolOr(raw.value?.show_battery, defaults.value.show_battery ?? true))

  // ─── Advanced-specific section visibility ─────────────────────

  const showInfoBar = computed(() => boolOr(raw.value?.show_info_bar, defaults.value.show_info_bar ?? true))
  const showSwarm = computed(() => boolOr(raw.value?.show_swarm, defaults.value.show_swarm ?? true))
  const showCoreServices = computed(() => boolOr(raw.value?.show_core_services, defaults.value.show_core_services ?? true))

  // ─── Clock & date settings ────────────────────────────────────

  const clockFormat = computed(() => raw.value?.clock_format || defaults.value.clock_format)
  const dateFormat = computed(() => raw.value?.date_format || defaults.value.date_format)
  const showSeconds = computed(() => boolOr(raw.value?.show_seconds, defaults.value.show_seconds))
  const showGreeting = computed(() => boolOr(raw.value?.show_greeting, defaults.value.show_greeting))

  // ─── Layout settings ──────────────────────────────────────────

  const myAppsRows = computed(() => raw.value?.my_apps_rows || defaults.value.my_apps_rows)
  const favoriteCols = computed(() => raw.value?.favorite_cols || defaults.value.favorite_cols)
  const quickActions = computed(() => raw.value?.quick_actions ?? defaults.value.quick_actions)
  const widgetOrder = computed(() => raw.value?.widget_order ?? defaults.value.widget_order)

  // ─── Grid Layout (Session A, updated Session 1) ───────────────

  /**
   * Resolved grid layout: array of { row: string[] } objects.
   * Priority: raw grid_layout → migrate from widget_order → mode default.
   */
  const gridLayout = computed(() => {
    // 1. Try stored grid_layout
    const stored = raw.value?.grid_layout
    if (isValidGridLayout(stored)) return stored

    // 2. Migrate from legacy widget_order
    const order = raw.value?.widget_order
    const migrated = migrateWidgetOrderToGrid(order)
    if (migrated) return migrated

    // 3. Fall back to mode default
    return defaults.value.grid_layout
  })

  /**
   * Flat list of all widget IDs present in the current grid layout.
   */
  const placedWidgetIds = computed(() => {
    return gridLayout.value.flatMap(entry => entry.row)
  })

  /**
   * Widget IDs not currently placed in the grid.
   */
  const unplacedWidgetIds = computed(() => {
    const placed = new Set(placedWidgetIds.value)
    return ALL_WIDGET_IDS.filter(id => !placed.has(id))
  })

  // ─── Visibility map (widget ID → boolean) ─────────────────────

  const visibilityMap = computed(() => ({
    clock: showClock.value,
    search: showSearch.value,
    status: showStatusPill.value,
    vitals: showSystemVitals.value,
    network: showNetwork.value,
    disk: showDisk.value,
    signals: showSignals.value,
    uptime_load: showUptimeLoad.value,
    network_throughput: showNetworkThroughput.value,
    recent_logs: showRecentLogs.value,
    battery: showBattery.value,
    actions: showQuickActions.value,
    launcher: true,
  }))

  /** Check if a widget is visible */
  function isWidgetVisible(id) {
    return visibilityMap.value[id] ?? true
  }

  // ─── Advanced section order (Session 1) ───────────────────────

  /**
   * Resolved advanced section order with migration from composite IDs.
   * Returns array of individual section IDs.
   */
  const advancedSectionOrder = computed(() => {
    const stored = raw.value?.advanced_section_order
    if (Array.isArray(stored) && stored.length > 0) {
      // Check if migration is needed (composite IDs present)
      const migrated = migrateAdvancedSectionOrder(stored)
      if (migrated) return migrated
      return stored
    }
    return defaults.value.advanced_section_order ?? DEFAULT_ADVANCED_SECTION_ORDER
  })

  /** Persist advanced section order */
  async function updateAdvancedSectionOrder(order) {
    return updateConfig('advanced_section_order', order)
  }

  // ─── Widget Opacity (Session B) ───────────────────────────────

  /**
   * Raw widget_opacity map from config.
   * Keys are widget IDs, values are 0–100.
   */
  const widgetOpacity = computed(() => {
    return raw.value?.widget_opacity ?? defaults.value.widget_opacity ?? {}
  })

  /**
   * Get opacity for a widget (0–100).
   * Clock defaults to 0 (transparent) for backward compat; all others default to 100.
   */
  function getOpacity(widgetId) {
    const stored = widgetOpacity.value[widgetId]
    if (stored != null) return stored
    return widgetId === 'clock' ? CLOCK_DEFAULT_OPACITY : DEFAULT_OPACITY
  }

  /** Persist opacity for a single widget */
  async function updateOpacity(widgetId, value) {
    const current = { ...widgetOpacity.value }
    current[widgetId] = value
    return updateConfig('widget_opacity', current)
  }

  /** Reset all opacities to defaults */
  async function resetAllOpacity() {
    return updateConfig('widget_opacity', defaults.value.widget_opacity ?? {})
  }

  // ─── Per-Widget Refresh Intervals (Session 5) ─────────────────

  /**
   * Raw widget_refresh_intervals map from config.
   * Keys are widget IDs, values are seconds (0 = manual).
   */
  const widgetRefreshIntervals = computed(() => {
    return raw.value?.widget_refresh_intervals ?? defaults.value.widget_refresh_intervals ?? {}
  })

  /**
   * Get refresh interval for a widget in seconds.
   * Falls back to DEFAULT_REFRESH_INTERVALS, then 10s.
   *
   * @param {string} widgetId - Widget identifier
   * @returns {number} Interval in seconds (0 = manual/disabled)
   */
  function getRefreshInterval(widgetId) {
    const stored = widgetRefreshIntervals.value[widgetId]
    if (stored != null) return stored
    return DEFAULT_REFRESH_INTERVALS[widgetId] ?? 10
  }

  /**
   * Persist refresh interval for a single widget.
   *
   * @param {string} widgetId - Widget identifier
   * @param {number} seconds - Interval in seconds (0 = manual)
   */
  async function updateRefreshInterval(widgetId, seconds) {
    const current = { ...widgetRefreshIntervals.value }
    current[widgetId] = seconds
    return updateConfig('widget_refresh_intervals', current)
  }

  /** Reset all refresh intervals to defaults */
  async function resetAllRefreshIntervals() {
    return updateConfig('widget_refresh_intervals', {})
  }

  // ─── Layout Lock (Session 6) ─────────────────────────────────

  /**
   * Whether the layout is locked (prevents entering edit mode).
   * Persisted per-mode.
   */
  const isLayoutLocked = computed(() => {
    return boolOr(raw.value?.layout_locked, defaults.value.layout_locked ?? false)
  })

  /** Toggle layout lock on/off and persist */
  async function toggleLayoutLock() {
    return updateConfig('layout_locked', !isLayoutLocked.value)
  }

  /** Explicitly set layout lock state */
  async function setLayoutLocked(locked) {
    return updateConfig('layout_locked', locked)
  }

  // ─── Persistence ──────────────────────────────────────────────

  async function updateConfig(key, value) {
    return preferencesStore.savePreferences({
      dashboard: {
        [modeKey.value]: { [key]: value },
      },
    })
  }

  async function updateConfigs(updates) {
    return preferencesStore.savePreferences({
      dashboard: {
        [modeKey.value]: updates,
      },
    })
  }

  /** Persist a new grid layout */
  async function updateGridLayout(rows) {
    return updateConfig('grid_layout', rows)
  }

  async function resetDefaults() {
    return preferencesStore.savePreferences({
      dashboard: {
        [modeKey.value]: null,
      },
    })
  }

  return {
    // Widget visibility
    showClock,
    showSearch,
    showStatusPill,
    showSystemVitals,
    showNetwork,
    showDisk,
    showSignals,
    showQuickActions,
    showFavorites,
    showRecent,
    showMyApps,
    showAlerts,

    // New widgets (Session 3)
    showUptimeLoad,
    showNetworkThroughput,
    showRecentLogs,
    showBattery,

    // Advanced-specific
    showInfoBar,
    showSwarm,
    showCoreServices,

    // Clock & date
    clockFormat,
    dateFormat,
    showSeconds,
    showGreeting,

    // Layout
    myAppsRows,
    favoriteCols,
    quickActions,
    widgetOrder,

    // Grid layout (Session A, updated Session 1)
    gridLayout,
    placedWidgetIds,
    unplacedWidgetIds,
    visibilityMap,
    isWidgetVisible,

    // Advanced section order (Session 1)
    advancedSectionOrder,
    updateAdvancedSectionOrder,

    // Widget opacity (Session B)
    widgetOpacity,
    getOpacity,
    updateOpacity,
    resetAllOpacity,

    // Widget refresh intervals (Session 5)
    widgetRefreshIntervals,
    getRefreshInterval,
    updateRefreshInterval,
    resetAllRefreshIntervals,

    // Layout lock (Session 6)
    isLayoutLocked,
    toggleLayoutLock,
    setLayoutLocked,

    // Raw access
    raw,
    modeKey,
    defaults,

    // Persistence
    updateConfig,
    updateConfigs,
    updateGridLayout,
    resetDefaults,
  }
}
