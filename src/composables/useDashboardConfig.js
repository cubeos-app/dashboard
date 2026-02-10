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
 * Usage:
 *   const { showClock, clockFormat, myAppsRows, updateConfig } = useDashboardConfig()
 *
 *   <ClockWidget v-if="showClock" />
 *   <span>{{ clockFormat }}</span>
 *
 *   await updateConfig('show_clock', false)
 *   await updateConfig('my_apps_rows', 3)
 */
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'

// ─── Defaults (per mode) ─────────────────────────────────────────

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
  clock_format: '24h',
  date_format: 'long',
  show_seconds: false,
  show_greeting: false,
  my_apps_rows: 3,
  favorite_cols: 6,
  quick_actions: ['add_app', 'monitoring', 'logs', 'docs'],
  widget_order: ['alerts', 'vitals', 'network', 'disk-signals', 'actions', 'launcher'],
}

const DEFAULTS_BY_MODE = {
  standard: STANDARD_DEFAULTS,
  advanced: ADVANCED_DEFAULTS,
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Return val if non-null/undefined, otherwise the default. */
function boolOr(val, def) {
  return val != null ? val : def
}

// ─── Composable ──────────────────────────────────────────────────

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

  // ─── Persistence ──────────────────────────────────────────────

  /**
   * Update a single dashboard config key and persist via PUT /preferences.
   * The value is nested under dashboard.[currentMode].[key] automatically.
   *
   * @param {string} key - Config key matching the JSON field (e.g. 'show_clock', 'clock_format')
   * @param {*} value - New value
   * @returns {Promise<boolean>} Success
   */
  async function updateConfig(key, value) {
    return preferencesStore.savePreferences({
      dashboard: {
        [modeKey.value]: { [key]: value },
      },
    })
  }

  /**
   * Batch-update multiple dashboard config keys at once.
   *
   * @param {Object} updates - Key-value pairs (e.g. { show_clock: false, clock_format: '12h' })
   * @returns {Promise<boolean>} Success
   */
  async function updateConfigs(updates) {
    return preferencesStore.savePreferences({
      dashboard: {
        [modeKey.value]: updates,
      },
    })
  }

  /**
   * Reset current mode's dashboard config to defaults.
   * Sends null for the mode key, which the backend interprets as "remove overrides".
   *
   * @returns {Promise<boolean>} Success
   */
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

    // Raw access
    raw,
    modeKey,
    defaults,

    // Persistence
    updateConfig,
    updateConfigs,
    resetDefaults,
  }
}
