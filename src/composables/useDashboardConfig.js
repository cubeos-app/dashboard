/**
 * CubeOS Dashboard Config Composable
 *
 * Reads dashboard configuration from preferencesStore.preferences.dashboard,
 * provides computed getters with sane defaults for every setting, and exposes
 * an updateConfig(key, value) helper that persists changes via PUT /preferences.
 *
 * Handles Standard vs Advanced mode configs separately through the layout
 * sub-objects (dashboard.standard / dashboard.advanced).
 *
 * Usage:
 *   const { showClock, clockFormat, myAppsRows, updateConfig } = useDashboardConfig()
 *
 *   // Read (reactive, with defaults):
 *   <ClockWidget v-if="showClock" />
 *   <span>{{ clockFormat }}</span>
 *
 *   // Write (persists to API):
 *   await updateConfig('show_clock', false)
 *   await updateConfig('my_apps_rows', 3)
 */
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'

// ─── Defaults ────────────────────────────────────────────────────

const DEFAULTS = {
  show_clock: true,
  show_system_vitals: true,
  show_network: true,
  show_alerts: true,
  show_favorites: true,
  show_my_apps: true,
  show_service_grid: true,
  clock_format: '24h',
  date_format: 'long',
  quick_actions: [],
}

const LAYOUT_DEFAULTS = {
  standard: {
    my_apps_rows: 2,
    favorite_cols: 4,
    widget_order: ['clock', 'alerts', 'favorites', 'my_apps', 'system_vitals', 'network'],
  },
  advanced: {
    my_apps_rows: 3,
    favorite_cols: 6,
    widget_order: ['alerts', 'system_vitals', 'service_grid', 'network'],
  },
}

// ─── Helper ──────────────────────────────────────────────────────

/**
 * Read a boolean field from the dashboard config, returning the default
 * when the field is null/undefined.
 */
function boolOr(val, def) {
  return val != null ? val : def
}

// ─── Composable ──────────────────────────────────────────────────

export function useDashboardConfig() {
  const preferencesStore = usePreferencesStore()
  const { isAdvanced } = useMode()

  /** Raw dashboard config object (may be null/undefined) */
  const raw = computed(() => preferencesStore.preferences?.dashboard)

  /** Current mode key ('standard' | 'advanced') for layout lookups */
  const modeKey = computed(() => isAdvanced.value ? 'advanced' : 'standard')

  /** Current mode's layout config */
  const layout = computed(() => {
    const key = modeKey.value
    return raw.value?.[key] ?? LAYOUT_DEFAULTS[key]
  })

  // ─── Widget visibility (boolean, default true) ───────────────

  const showClock = computed(() => boolOr(raw.value?.show_clock, DEFAULTS.show_clock))
  const showSystemVitals = computed(() => boolOr(raw.value?.show_system_vitals, DEFAULTS.show_system_vitals))
  const showNetwork = computed(() => boolOr(raw.value?.show_network, DEFAULTS.show_network))
  const showAlerts = computed(() => boolOr(raw.value?.show_alerts, DEFAULTS.show_alerts))
  const showFavorites = computed(() => boolOr(raw.value?.show_favorites, DEFAULTS.show_favorites))
  const showMyApps = computed(() => boolOr(raw.value?.show_my_apps, DEFAULTS.show_my_apps))
  const showServiceGrid = computed(() => boolOr(raw.value?.show_service_grid, DEFAULTS.show_service_grid))

  // ─── Display format preferences ─────────────────────────────

  const clockFormat = computed(() => raw.value?.clock_format || DEFAULTS.clock_format)
  const dateFormat = computed(() => raw.value?.date_format || DEFAULTS.date_format)

  // ─── Quick actions ──────────────────────────────────────────

  const quickActions = computed(() => raw.value?.quick_actions ?? DEFAULTS.quick_actions)

  // ─── Layout (mode-specific) ─────────────────────────────────

  const myAppsRows = computed(() =>
    layout.value?.my_apps_rows ?? LAYOUT_DEFAULTS[modeKey.value].my_apps_rows
  )

  const favoriteCols = computed(() =>
    layout.value?.favorite_cols ?? LAYOUT_DEFAULTS[modeKey.value].favorite_cols
  )

  const widgetOrder = computed(() =>
    layout.value?.widget_order ?? LAYOUT_DEFAULTS[modeKey.value].widget_order
  )

  // ─── Persistence ────────────────────────────────────────────

  // Layout-specific keys that go under dashboard.standard or dashboard.advanced
  const LAYOUT_KEYS = new Set(['my_apps_rows', 'favorite_cols', 'widget_order'])

  /**
   * Update a single dashboard config key and persist via PUT /preferences.
   *
   * For layout-specific keys (my_apps_rows, favorite_cols, widget_order),
   * the value is nested under the current mode's layout object.
   *
   * @param {string} key - Config key (e.g. 'show_clock', 'clock_format', 'my_apps_rows')
   * @param {*} value - New value
   * @returns {Promise<boolean>} Success
   */
  async function updateConfig(key, value) {
    let dashUpdate

    if (LAYOUT_KEYS.has(key)) {
      // Nest under current mode's layout
      dashUpdate = {
        [modeKey.value]: { [key]: value },
      }
    } else {
      dashUpdate = { [key]: value }
    }

    return preferencesStore.savePreferences({ dashboard: dashUpdate })
  }

  /**
   * Batch-update multiple dashboard config keys at once.
   *
   * @param {Object} updates - Key-value pairs to update
   * @returns {Promise<boolean>} Success
   */
  async function updateConfigs(updates) {
    const dashUpdate = {}
    const layoutUpdate = {}

    for (const [key, value] of Object.entries(updates)) {
      if (LAYOUT_KEYS.has(key)) {
        layoutUpdate[key] = value
      } else {
        dashUpdate[key] = value
      }
    }

    // Merge layout keys under current mode
    if (Object.keys(layoutUpdate).length > 0) {
      dashUpdate[modeKey.value] = layoutUpdate
    }

    return preferencesStore.savePreferences({ dashboard: dashUpdate })
  }

  return {
    // Widget visibility
    showClock,
    showSystemVitals,
    showNetwork,
    showAlerts,
    showFavorites,
    showMyApps,
    showServiceGrid,

    // Display format
    clockFormat,
    dateFormat,

    // Quick actions
    quickActions,

    // Layout (mode-aware)
    myAppsRows,
    favoriteCols,
    widgetOrder,

    // Raw access
    raw,
    modeKey,

    // Persistence
    updateConfig,
    updateConfigs,
  }
}
