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
 * SESSION A: Added grid_layout support (array of {row: string[]} objects).
 * Replaces flat widget_order with row-based layout. Backward compatible:
 * auto-derives grid_layout from widget_order if grid_layout is absent.
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
  clock:    { label: 'Clock',          icon: 'Clock' },
  search:   { label: 'Search Bar',     icon: 'Search' },
  status:   { label: 'Status Pill',    icon: 'Activity' },
  vitals:   { label: 'System Vitals',  icon: 'Cpu' },
  network:  { label: 'Network',        icon: 'Wifi' },
  disk:     { label: 'Disk Usage',     icon: 'HardDrive' },
  signals:  { label: 'Signals',        icon: 'Radio' },
  actions:  { label: 'Quick Actions',  icon: 'Zap' },
  launcher: { label: 'App Launcher',   icon: 'Grid3x3' },
}

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)

// ─── Default grid layouts ───────────────────────────────────

/** Default per-widget opacity (0=transparent, 100=opaque) */
const DEFAULT_OPACITY = 100
const CLOCK_DEFAULT_OPACITY = 0  // backward compat: clock was fully transparent

const STANDARD_GRID_LAYOUT = [
  { row: ['clock'] },
  { row: ['search'] },
  { row: ['status'] },
  { row: ['vitals', 'network'] },
  { row: ['disk', 'signals'] },
  { row: ['actions'] },
  { row: ['launcher'] },
]

const ADVANCED_GRID_LAYOUT = [
  { row: ['vitals', 'network'] },
  { row: ['disk', 'signals'] },
  { row: ['actions'] },
  { row: ['launcher'] },
]

// ─── Defaults (per mode) ─────────────────────────────────────

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
  clock_format: '24h',
  date_format: 'long',
  show_seconds: true,
  show_greeting: true,
  my_apps_rows: 2,
  favorite_cols: 4,
  quick_actions: ['add_app', 'network', 'storage', 'ask_cubeos'],
  widget_order: ['clock', 'search', 'status', 'vitals', 'network', 'disk-signals', 'actions', 'launcher'],
  grid_layout: STANDARD_GRID_LAYOUT,
  widget_opacity: { clock: CLOCK_DEFAULT_OPACITY },
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
  widget_order: ['alerts', 'vitals', 'network', 'disk-signals', 'actions', 'launcher'],
  grid_layout: ADVANCED_GRID_LAYOUT,
  widget_opacity: {},
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
 * Groups adjacent vitals+network into a paired row.
 */
function migrateWidgetOrderToGrid(order) {
  if (!Array.isArray(order) || order.length === 0) return null
  const rows = []
  let i = 0
  while (i < order.length) {
    const key = order[i]
    const next = order[i + 1]

    // Legacy composite key: 'disk-signals' → paired row
    if (key === 'disk-signals') {
      rows.push({ row: ['disk', 'signals'] })
      i++
      continue
    }

    // Group adjacent vitals+network into a paired row
    if (
      (key === 'vitals' && next === 'network') ||
      (key === 'network' && next === 'vitals')
    ) {
      rows.push({ row: [key, next] })
      i += 2
      continue
    }

    // Single-widget row
    rows.push({ row: [key] })
    i++
  }
  return rows
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

  // ─── Grid Layout (Session A) ──────────────────────────────────

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
    actions: showQuickActions.value,
    launcher: true,
  }))

  /** Check if a widget is visible */
  function isWidgetVisible(id) {
    return visibilityMap.value[id] ?? true
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

    // Grid layout (Session A)
    gridLayout,
    placedWidgetIds,
    unplacedWidgetIds,
    visibilityMap,
    isWidgetVisible,

    // Widget opacity (Session B)
    widgetOpacity,
    getOpacity,
    updateOpacity,
    resetAllOpacity,

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
