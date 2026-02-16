/**
 * CubeOS Dashboard Config Composable
 *
 * SESSION 7: Unified WIDGET_REGISTRY replaces dual registries.
 * - AppLauncher decomposed into favorites, recent_apps, my_apps
 * - Gauges decomposed into cpu_gauge, memory_gauge, disk_gauge, temp_gauge
 * - Migration from 'launcher' → 3 widgets, 'gauges' → 4 widgets
 *
 * SESSION 8: Unified architecture for Advanced mode.
 * - Advanced now uses gridLayout exclusively (same as Standard)
 * - advancedSectionOrder migrated to gridLayout via migrateAdvancedSectionOrderToGrid()
 * - ADVANCED_SECTION_REGISTRY kept as deprecated alias for one release cycle
 * - advancedSectionOrder / updateAdvancedSectionOrder still exported but no longer
 *   consumed by DashboardAdvanced.vue
 *
 * Usage:
 *   const { gridLayout, updateGridLayout, updateConfig } = useDashboardConfig()
 */
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'

// ─── Unified Widget Registry (Session 7) ────────────────────────

/** All known widget IDs with metadata — single source of truth for both modes */
export const WIDGET_REGISTRY = {
  // Information widgets
  clock:               { label: 'Clock',              icon: 'Clock' },
  search:              { label: 'Search Bar',         icon: 'Search' },
  status:              { label: 'Status Pill',        icon: 'Activity' },
  infobar:             { label: 'Info Bar',           icon: 'Info' },
  alerts:              { label: 'Alerts Feed',        icon: 'Bell' },

  // System monitoring
  vitals:              { label: 'System Vitals',      icon: 'Cpu' },
  cpu_gauge:           { label: 'CPU Gauge',          icon: 'Cpu' },
  memory_gauge:        { label: 'Memory Gauge',       icon: 'MemoryStick' },
  disk_gauge:          { label: 'Disk Gauge',         icon: 'HardDrive' },
  temp_gauge:          { label: 'Temperature Gauge',  icon: 'Thermometer' },
  network:             { label: 'Network',            icon: 'Wifi' },
  disk:                { label: 'Disk Usage',         icon: 'HardDrive' },
  signals:             { label: 'Signals',            icon: 'Radio' },
  uptime_load:         { label: 'Uptime & Load',      icon: 'Clock' },
  network_throughput:  { label: 'Network Traffic',     icon: 'ArrowUpDown' },
  recent_logs:         { label: 'Recent Logs',         icon: 'ScrollText' },
  battery:             { label: 'Battery',             icon: 'Battery' },

  // Container management
  swarm:               { label: 'Swarm Overview',     icon: 'Layers' },
  core_services:       { label: 'Core Services',      icon: 'Box' },

  // App widgets (decomposed from launcher — Session 7)
  favorites:           { label: 'Favorites',          icon: 'Star' },
  recent_apps:         { label: 'Recent Apps',        icon: 'Clock' },
  my_apps:             { label: 'My Apps',            icon: 'Grid3x3' },

  // Actions
  actions:             { label: 'Quick Actions',       icon: 'Zap' },

  // DEPRECATED — kept for migration only. Do not use for new layouts.
  launcher:            { label: 'App Launcher (Legacy)', icon: 'Grid3x3', deprecated: true },
}

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY).filter(
  id => !WIDGET_REGISTRY[id].deprecated
)

/**
 * DEPRECATED — backward compatibility alias for Advanced mode.
 * Session 8 will remove usage of this.
 */
export const ADVANCED_SECTION_REGISTRY = {
  gauges:              { label: 'Status Gauges',       icon: 'Activity', deprecated: true },
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

// ─── Default grid layouts ───────────────────────────────────────

const DEFAULT_OPACITY = 100
const CLOCK_DEFAULT_OPACITY = 0

/** SESSION 7: Default Standard layout uses decomposed widget IDs. */
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
  { row: ['favorites'] },
  { row: ['recent_apps'] },
  { row: ['my_apps'] },
]

/**
 * SESSION 8: Advanced default layout uses unified widget IDs.
 * Gauges are paired 2-per-row for a compact 2×2 layout.
 * Replaces the old advancedSectionOrder flat array.
 */
const ADVANCED_GRID_LAYOUT = [
  { row: ['cpu_gauge', 'memory_gauge'] },
  { row: ['disk_gauge', 'temp_gauge'] },
  { row: ['infobar'] },
  { row: ['disk'] },
  { row: ['signals'] },
  { row: ['swarm'] },
  { row: ['alerts'] },
  { row: ['uptime_load'] },
  { row: ['network_throughput'] },
  { row: ['recent_logs'] },
  { row: ['battery'] },
  { row: ['favorites'] },
  { row: ['core_services'] },
  { row: ['my_apps'] },
  { row: ['actions'] },
]

const DEFAULT_ADVANCED_SECTION_ORDER = [
  'gauges', 'infobar', 'disk', 'signals', 'swarm', 'alerts',
  'uptime-load', 'network-throughput', 'recent-logs', 'battery',
  'favorites', 'core', 'user-apps', 'quick-links'
]

// ─── Defaults (per mode) ─────────────────────────────────────

const DEFAULT_REFRESH_INTERVALS = {
  vitals: 5,
  network: 5,
  disk: 10,
  signals: 10,
  status: 5,
  uptime_load: 60,
  network_throughput: 5,
  recent_logs: 15,
  battery: 30,
  cpu_gauge: 5,
  memory_gauge: 5,
  disk_gauge: 10,
  temp_gauge: 5,
}

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
  show_cpu_gauge: false,
  show_memory_gauge: false,
  show_disk_gauge: false,
  show_temp_gauge: false,
  show_swarm: false,
  show_core_services: false,
  show_info_bar: false,
  clock_format: '24h',
  date_format: 'long',
  show_seconds: true,
  show_greeting: true,
  my_apps_rows: 2,
  favorite_cols: 4,
  quick_actions: ['add_app', 'network', 'storage', 'ask_cubeos'],
  widget_order: ['clock', 'search', 'status', 'vitals', 'network', 'disk', 'signals', 'actions', 'favorites', 'recent_apps', 'my_apps'],
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
  show_disk_widget: true,
  show_signals_widget: true,
  show_quick_actions: true,
  show_favorites: true,
  show_recent: false,
  show_my_apps: true,
  show_alerts: true,
  show_uptime_load: true,
  show_network_throughput: true,
  show_recent_logs: true,
  show_battery: true,
  show_cpu_gauge: true,
  show_memory_gauge: true,
  show_disk_gauge: true,
  show_temp_gauge: true,
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
  widget_order: ['alerts', 'vitals', 'network', 'disk', 'signals', 'actions', 'favorites', 'my_apps'],
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

function boolOr(val, def) {
  return val != null ? val : def
}

/**
 * Migrate a flat widget_order array to grid_layout rows.
 * SESSION 7: Also expands 'launcher' to decomposed widgets.
 */
function migrateWidgetOrderToGrid(order) {
  if (!Array.isArray(order) || order.length === 0) return null
  const rows = []
  for (let i = 0; i < order.length; i++) {
    const key = order[i]
    if (key === 'disk-signals') {
      rows.push({ row: ['disk'] })
      rows.push({ row: ['signals'] })
      continue
    }
    if (key === 'launcher') {
      rows.push({ row: ['favorites'] })
      rows.push({ row: ['recent_apps'] })
      rows.push({ row: ['my_apps'] })
      continue
    }
    rows.push({ row: [key] })
  }
  return rows
}

/**
 * SESSION 7: Migrate grid_layout containing 'launcher' to decomposed widgets.
 * Returns null if no migration needed.
 */
function migrateLauncherInGrid(layout) {
  if (!Array.isArray(layout)) return null

  let hasLauncher = false
  for (const entry of layout) {
    if (entry.row && entry.row.includes('launcher')) {
      hasLauncher = true
      break
    }
  }
  if (!hasLauncher) return null

  const migrated = []
  for (const entry of layout) {
    if (entry.row && entry.row.includes('launcher')) {
      const otherWidgets = entry.row.filter(id => id !== 'launcher')
      if (otherWidgets.length > 0) {
        migrated.push({ row: otherWidgets })
      }
      migrated.push({ row: ['favorites'] })
      migrated.push({ row: ['recent_apps'] })
      migrated.push({ row: ['my_apps'] })
    } else {
      migrated.push({ row: [...entry.row] })
    }
  }
  return migrated
}

/**
 * Migrate legacy advanced_section_order with composite IDs.
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

  for (const id of DEFAULT_ADVANCED_SECTION_ORDER) {
    if (!expanded.includes(id)) {
      expanded.push(id)
    }
  }

  return expanded
}

function isValidGridLayout(layout) {
  if (!Array.isArray(layout) || layout.length === 0) return false
  return layout.every(
    entry => entry && Array.isArray(entry.row) && entry.row.length >= 1 && entry.row.length <= 2
  )
}

/**
 * SESSION 8: Convert an advancedSectionOrder flat array into a gridLayout.
 *
 * Maps old section IDs to unified widget IDs:
 *   'gauges'             → ['cpu_gauge', 'memory_gauge'] + ['disk_gauge', 'temp_gauge'] (2 rows)
 *   'quick-links'        → 'actions'
 *   'user-apps'          → 'my_apps'
 *   'core'               → 'core_services'
 *   'uptime-load'        → 'uptime_load'
 *   'network-throughput'  → 'network_throughput'
 *   'recent-logs'        → 'recent_logs'
 *
 * Returns null if the input is not a valid section order.
 */
function migrateAdvancedSectionOrderToGrid(sectionOrder) {
  if (!Array.isArray(sectionOrder) || sectionOrder.length === 0) return null

  // First, expand any legacy composites (disk-signals, swarm-alerts)
  const expanded = migrateAdvancedSectionOrder(sectionOrder) || sectionOrder

  const SECTION_TO_WIDGET = {
    'gauges':              null, // Special case — expands to 4 gauge widgets
    'infobar':             'infobar',
    'disk':                'disk',
    'signals':             'signals',
    'swarm':               'swarm',
    'alerts':              'alerts',
    'uptime-load':         'uptime_load',
    'network-throughput':  'network_throughput',
    'recent-logs':         'recent_logs',
    'battery':             'battery',
    'favorites':           'favorites',
    'core':                'core_services',
    'user-apps':           'my_apps',
    'quick-links':         'actions',
  }

  const rows = []
  for (const sectionId of expanded) {
    if (sectionId === 'gauges') {
      rows.push({ row: ['cpu_gauge', 'memory_gauge'] })
      rows.push({ row: ['disk_gauge', 'temp_gauge'] })
      continue
    }

    const widgetId = SECTION_TO_WIDGET[sectionId]
    if (widgetId) {
      rows.push({ row: [widgetId] })
    }
    // Unknown section IDs are silently dropped
  }

  // Ensure any missing default widgets are appended
  const placed = new Set(rows.flatMap(r => r.row))
  for (const entry of ADVANCED_GRID_LAYOUT) {
    for (const wid of entry.row) {
      if (!placed.has(wid)) {
        rows.push({ row: [wid] })
        placed.add(wid)
      }
    }
  }

  return rows.length > 0 ? rows : null
}

/**
 * SESSION 8: Check if a grid layout contains any old hyphenated section IDs
 * that need to be migrated to underscore-based widget IDs.
 */
function migrateHyphenatedIds(layout) {
  if (!Array.isArray(layout)) return null

  const HYPHEN_MAP = {
    'uptime-load': 'uptime_load',
    'network-throughput': 'network_throughput',
    'recent-logs': 'recent_logs',
    'quick-links': 'actions',
    'user-apps': 'my_apps',
    'core': 'core_services',
  }

  let needsMigration = false
  for (const entry of layout) {
    if (entry.row && entry.row.some(id => HYPHEN_MAP[id])) {
      needsMigration = true
      break
    }
  }
  if (!needsMigration) return null

  return layout.map(entry => ({
    row: entry.row.map(id => HYPHEN_MAP[id] || id),
  }))
}

// ─── Composable ──────────────────────────────────────────────

export function useDashboardConfig() {
  const preferencesStore = usePreferencesStore()
  const { isAdvanced } = useMode()

  const modeKey = computed(() => isAdvanced.value ? 'advanced' : 'standard')
  const defaults = computed(() => DEFAULTS_BY_MODE[modeKey.value])
  const raw = computed(() => {
    const dash = preferencesStore.preferences?.dashboard
    return dash?.[modeKey.value]
  })

  // ─── Widget visibility ──────────────────────────────────────

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
  const showUptimeLoad = computed(() => boolOr(raw.value?.show_uptime_load, defaults.value.show_uptime_load ?? false))
  const showNetworkThroughput = computed(() => boolOr(raw.value?.show_network_throughput, defaults.value.show_network_throughput ?? false))
  const showRecentLogs = computed(() => boolOr(raw.value?.show_recent_logs, defaults.value.show_recent_logs ?? false))
  const showBattery = computed(() => boolOr(raw.value?.show_battery, defaults.value.show_battery ?? true))

  // Individual gauges (Session 7)
  const showCpuGauge = computed(() => boolOr(raw.value?.show_cpu_gauge, defaults.value.show_cpu_gauge ?? false))
  const showMemoryGauge = computed(() => boolOr(raw.value?.show_memory_gauge, defaults.value.show_memory_gauge ?? false))
  const showDiskGauge = computed(() => boolOr(raw.value?.show_disk_gauge, defaults.value.show_disk_gauge ?? false))
  const showTempGauge = computed(() => boolOr(raw.value?.show_temp_gauge, defaults.value.show_temp_gauge ?? false))

  // Cross-mode (Session 7)
  const showInfoBar = computed(() => boolOr(raw.value?.show_info_bar, defaults.value.show_info_bar ?? false))
  const showSwarm = computed(() => boolOr(raw.value?.show_swarm, defaults.value.show_swarm ?? false))
  const showCoreServices = computed(() => boolOr(raw.value?.show_core_services, defaults.value.show_core_services ?? false))

  // Clock & date
  const clockFormat = computed(() => raw.value?.clock_format || defaults.value.clock_format)
  const dateFormat = computed(() => raw.value?.date_format || defaults.value.date_format)
  const showSeconds = computed(() => boolOr(raw.value?.show_seconds, defaults.value.show_seconds))
  const showGreeting = computed(() => boolOr(raw.value?.show_greeting, defaults.value.show_greeting))

  // Layout settings
  const myAppsRows = computed(() => raw.value?.my_apps_rows || defaults.value.my_apps_rows)
  const favoriteCols = computed(() => raw.value?.favorite_cols || defaults.value.favorite_cols)
  const quickActions = computed(() => raw.value?.quick_actions ?? defaults.value.quick_actions)
  const widgetOrder = computed(() => raw.value?.widget_order ?? defaults.value.widget_order)

  // ─── Grid Layout ────────────────────────────────────────────

  const gridLayout = computed(() => {
    const stored = raw.value?.grid_layout

    // 1. Try stored grid_layout
    if (isValidGridLayout(stored)) {
      // Migrate launcher → decomposed widgets (Session 7)
      const launcherMigrated = migrateLauncherInGrid(stored)
      if (launcherMigrated) return launcherMigrated

      // Migrate hyphenated section IDs → unified widget IDs (Session 8)
      const hyphenMigrated = migrateHyphenatedIds(stored)
      if (hyphenMigrated) return hyphenMigrated

      return stored
    }

    // 2. For Advanced mode: try migrating advancedSectionOrder → gridLayout (Session 8)
    if (isAdvanced.value) {
      const sectionOrder = raw.value?.advanced_section_order
      const migrated = migrateAdvancedSectionOrderToGrid(sectionOrder)
      if (migrated) return migrated
    }

    // 3. Try migrating flat widget_order → gridLayout
    const order = raw.value?.widget_order
    const migrated = migrateWidgetOrderToGrid(order)
    if (migrated) return migrated

    // 4. Fall back to mode defaults
    return defaults.value.grid_layout
  })

  const placedWidgetIds = computed(() => {
    return gridLayout.value.flatMap(entry => entry.row)
  })

  const unplacedWidgetIds = computed(() => {
    const placed = new Set(placedWidgetIds.value)
    return ALL_WIDGET_IDS.filter(id => !placed.has(id))
  })

  // ─── Visibility map ─────────────────────────────────────────

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
    favorites: showFavorites.value,
    recent_apps: showRecent.value,
    my_apps: showMyApps.value,
    cpu_gauge: showCpuGauge.value,
    memory_gauge: showMemoryGauge.value,
    disk_gauge: showDiskGauge.value,
    temp_gauge: showTempGauge.value,
    swarm: showSwarm.value,
    core_services: showCoreServices.value,
    alerts: showAlerts.value,
    infobar: showInfoBar.value,
    launcher: true, // deprecated, always visible for migration
  }))

  function isWidgetVisible(id) {
    return visibilityMap.value[id] ?? true
  }

  // ─── Advanced section order (deprecated in Session 8) ──────

  const advancedSectionOrder = computed(() => {
    const stored = raw.value?.advanced_section_order
    if (Array.isArray(stored) && stored.length > 0) {
      const migrated = migrateAdvancedSectionOrder(stored)
      if (migrated) return migrated
      return stored
    }
    return defaults.value.advanced_section_order ?? DEFAULT_ADVANCED_SECTION_ORDER
  })

  async function updateAdvancedSectionOrder(order) {
    return updateConfig('advanced_section_order', order)
  }

  // ─── Widget Opacity ─────────────────────────────────────────

  const widgetOpacity = computed(() => {
    return raw.value?.widget_opacity ?? defaults.value.widget_opacity ?? {}
  })

  function getOpacity(widgetId) {
    const stored = widgetOpacity.value[widgetId]
    if (stored != null) return stored
    return widgetId === 'clock' ? CLOCK_DEFAULT_OPACITY : DEFAULT_OPACITY
  }

  async function updateOpacity(widgetId, value) {
    const current = { ...widgetOpacity.value }
    current[widgetId] = value
    return updateConfig('widget_opacity', current)
  }

  async function resetAllOpacity() {
    return updateConfig('widget_opacity', defaults.value.widget_opacity ?? {})
  }

  // ─── Per-Widget Refresh Intervals ───────────────────────────

  const widgetRefreshIntervals = computed(() => {
    return raw.value?.widget_refresh_intervals ?? defaults.value.widget_refresh_intervals ?? {}
  })

  function getRefreshInterval(widgetId) {
    const stored = widgetRefreshIntervals.value[widgetId]
    if (stored != null) return stored
    return DEFAULT_REFRESH_INTERVALS[widgetId] ?? 10
  }

  async function updateRefreshInterval(widgetId, seconds) {
    const current = { ...widgetRefreshIntervals.value }
    current[widgetId] = seconds
    return updateConfig('widget_refresh_intervals', current)
  }

  async function resetAllRefreshIntervals() {
    return updateConfig('widget_refresh_intervals', {})
  }

  // ─── Layout Lock ────────────────────────────────────────────

  const isLayoutLocked = computed(() => {
    return boolOr(raw.value?.layout_locked, defaults.value.layout_locked ?? false)
  })

  async function toggleLayoutLock() {
    return updateConfig('layout_locked', !isLayoutLocked.value)
  }

  async function setLayoutLocked(locked) {
    return updateConfig('layout_locked', locked)
  }

  // ─── Persistence ────────────────────────────────────────────

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
    showClock, showSearch, showStatusPill, showSystemVitals,
    showNetwork, showDisk, showSignals, showQuickActions,
    showFavorites, showRecent, showMyApps, showAlerts,
    showUptimeLoad, showNetworkThroughput, showRecentLogs, showBattery,
    showCpuGauge, showMemoryGauge, showDiskGauge, showTempGauge,
    showInfoBar, showSwarm, showCoreServices,
    clockFormat, dateFormat, showSeconds, showGreeting,
    myAppsRows, favoriteCols, quickActions, widgetOrder,
    gridLayout, placedWidgetIds, unplacedWidgetIds,
    visibilityMap, isWidgetVisible,
    advancedSectionOrder, updateAdvancedSectionOrder,
    widgetOpacity, getOpacity, updateOpacity, resetAllOpacity,
    widgetRefreshIntervals, getRefreshInterval, updateRefreshInterval, resetAllRefreshIntervals,
    isLayoutLocked, toggleLayoutLock, setLayoutLocked,
    raw, modeKey, defaults,
    updateConfig, updateConfigs, updateGridLayout, resetDefaults,
  }
}
