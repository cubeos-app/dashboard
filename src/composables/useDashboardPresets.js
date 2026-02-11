/**
 * useDashboardPresets.js — Session 10
 *
 * Dashboard preset management: built-in presets, user-created presets,
 * export current layout as JSON, import layout from JSON file.
 *
 * Session 10 changes:
 *   - All 4 built-in presets updated to unified widget IDs (no more
 *     advanced_section_order, gauges, launcher, quick-links, etc.)
 *   - User-created presets: save, rename, delete, list
 *   - Preset version bumped to 2 with v1→v2 import migration
 *   - Preview auto-generated from grid_layout (no manual preview arrays)
 *
 * Built-in presets:
 *   - Home Server: clean overview of all key widgets
 *   - Expedition: focus on connectivity, power, signals
 *   - Monitoring: dense information layout for sysadmins
 *   - Minimal: three widgets only, distraction-free
 *
 * Usage:
 *   const {
 *     builtInPresets, userPresets,
 *     applyPreset, applyUserPreset,
 *     saveCurrentAsPreset, renameUserPreset, deleteUserPreset,
 *     exportLayout, importLayout,
 *   } = useDashboardPresets()
 */
import { computed } from 'vue'
import { useDashboardConfig, WIDGET_REGISTRY } from '@/composables/useDashboardConfig'
import { usePreferencesStore } from '@/stores/preferences'
import { useMode } from '@/composables/useMode'

// ─── Current preset version ─────────────────────────────────
const PRESET_VERSION = 2

// ─── Built-in preset definitions (Session 10: unified IDs) ──

const PRESETS = {
  home_server: {
    id: 'home_server',
    name: 'Home Server',
    description: 'Clean overview with clock, status, vitals, services, and apps.',
    icon: 'Server',
    standard: {
      grid_layout: [
        { row: ['clock'] },
        { row: ['search'] },
        { row: ['status'] },
        { row: ['vitals', 'network'] },
        { row: ['actions'] },
        { row: ['favorites'] },
        { row: ['recent_apps'] },
        { row: ['my_apps'] },
      ],
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
      show_battery: false,
      show_cpu_gauge: false,
      show_memory_gauge: false,
      show_disk_gauge: false,
      show_temp_gauge: false,
      show_swarm: false,
      show_core_services: false,
      show_info_bar: false,
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['cpu_gauge', 'memory_gauge'] },
        { row: ['disk_gauge', 'temp_gauge'] },
        { row: ['infobar'] },
        { row: ['swarm'] },
        { row: ['alerts'] },
        { row: ['favorites'] },
        { row: ['core_services'] },
        { row: ['my_apps'] },
        { row: ['actions'] },
      ],
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
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: false,
      show_cpu_gauge: true,
      show_memory_gauge: true,
      show_disk_gauge: true,
      show_temp_gauge: true,
      show_info_bar: true,
      show_swarm: true,
      show_core_services: true,
      widget_opacity: {},
      widget_dimensions: {},
    },
  },

  expedition: {
    id: 'expedition',
    name: 'Expedition',
    description: 'Connectivity, power, and signal monitoring for field deployments.',
    icon: 'Compass',
    standard: {
      grid_layout: [
        { row: ['clock'] },
        { row: ['status'] },
        { row: ['network', 'battery'] },
        { row: ['signals'] },
        { row: ['vitals'] },
        { row: ['actions'] },
      ],
      show_clock: true,
      show_search: false,
      show_status_pill: true,
      show_system_vitals: true,
      show_network_widget: true,
      show_disk_widget: false,
      show_signals_widget: true,
      show_quick_actions: true,
      show_favorites: false,
      show_recent: false,
      show_my_apps: false,
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
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['cpu_gauge', 'memory_gauge'] },
        { row: ['disk_gauge', 'temp_gauge'] },
        { row: ['infobar'] },
        { row: ['signals'] },
        { row: ['battery'] },
        { row: ['alerts'] },
        { row: ['actions'] },
      ],
      show_clock: false,
      show_search: false,
      show_status_pill: false,
      show_system_vitals: true,
      show_network_widget: true,
      show_disk_widget: false,
      show_signals_widget: true,
      show_quick_actions: true,
      show_favorites: false,
      show_recent: false,
      show_my_apps: false,
      show_alerts: true,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: true,
      show_cpu_gauge: true,
      show_memory_gauge: true,
      show_disk_gauge: true,
      show_temp_gauge: true,
      show_info_bar: true,
      show_swarm: false,
      show_core_services: false,
      widget_opacity: {},
      widget_dimensions: {},
    },
  },

  monitoring: {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Dense layout with vitals, throughput, uptime, logs, and disk.',
    icon: 'BarChart3',
    standard: {
      grid_layout: [
        { row: ['status'] },
        { row: ['vitals', 'network'] },
        { row: ['uptime_load', 'network_throughput'] },
        { row: ['disk', 'signals'] },
        { row: ['recent_logs'] },
        { row: ['my_apps'] },
      ],
      show_clock: false,
      show_search: false,
      show_status_pill: true,
      show_system_vitals: true,
      show_network_widget: true,
      show_disk_widget: true,
      show_signals_widget: true,
      show_quick_actions: false,
      show_favorites: false,
      show_recent: false,
      show_my_apps: true,
      show_alerts: true,
      show_uptime_load: true,
      show_network_throughput: true,
      show_recent_logs: true,
      show_battery: false,
      show_cpu_gauge: false,
      show_memory_gauge: false,
      show_disk_gauge: false,
      show_temp_gauge: false,
      show_swarm: false,
      show_core_services: false,
      show_info_bar: false,
      widget_opacity: {},
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['cpu_gauge', 'memory_gauge'] },
        { row: ['disk_gauge', 'temp_gauge'] },
        { row: ['infobar'] },
        { row: ['disk', 'signals'] },
        { row: ['swarm'] },
        { row: ['alerts'] },
        { row: ['uptime_load', 'network_throughput'] },
        { row: ['recent_logs'] },
        { row: ['core_services'] },
        { row: ['my_apps'] },
        { row: ['actions'] },
      ],
      show_clock: false,
      show_search: false,
      show_status_pill: false,
      show_system_vitals: true,
      show_network_widget: true,
      show_disk_widget: true,
      show_signals_widget: true,
      show_quick_actions: true,
      show_favorites: false,
      show_recent: false,
      show_my_apps: true,
      show_alerts: true,
      show_uptime_load: true,
      show_network_throughput: true,
      show_recent_logs: true,
      show_battery: false,
      show_cpu_gauge: true,
      show_memory_gauge: true,
      show_disk_gauge: true,
      show_temp_gauge: true,
      show_info_bar: true,
      show_swarm: true,
      show_core_services: true,
      widget_opacity: {},
      widget_dimensions: {},
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Three widgets only. Clean and distraction-free.',
    icon: 'Minus',
    standard: {
      grid_layout: [
        { row: ['clock'] },
        { row: ['status'] },
        { row: ['actions'] },
      ],
      show_clock: true,
      show_search: false,
      show_status_pill: true,
      show_system_vitals: false,
      show_network_widget: false,
      show_disk_widget: false,
      show_signals_widget: false,
      show_quick_actions: true,
      show_favorites: false,
      show_recent: false,
      show_my_apps: false,
      show_alerts: false,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: false,
      show_cpu_gauge: false,
      show_memory_gauge: false,
      show_disk_gauge: false,
      show_temp_gauge: false,
      show_swarm: false,
      show_core_services: false,
      show_info_bar: false,
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['cpu_gauge', 'memory_gauge'] },
        { row: ['disk_gauge', 'temp_gauge'] },
        { row: ['actions'] },
      ],
      show_clock: false,
      show_search: false,
      show_status_pill: false,
      show_system_vitals: true,
      show_network_widget: false,
      show_disk_widget: false,
      show_signals_widget: false,
      show_quick_actions: true,
      show_favorites: false,
      show_recent: false,
      show_my_apps: false,
      show_alerts: false,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: false,
      show_cpu_gauge: true,
      show_memory_gauge: true,
      show_disk_gauge: true,
      show_temp_gauge: true,
      show_info_bar: false,
      show_swarm: false,
      show_core_services: false,
      widget_opacity: {},
      widget_dimensions: {},
    },
  },
}

export const PRESET_IDS = Object.keys(PRESETS)
export const BUILT_IN_PRESETS = Object.values(PRESETS)

// ─── Preview generation from grid_layout ─────────────────────

/**
 * Auto-generate an SVG preview descriptor from a grid_layout.
 * Returns an array of row descriptors: [{ w: number, label: string }][]
 */
export function generatePreview(gridLayout) {
  if (!Array.isArray(gridLayout)) return []
  return gridLayout.map(entry => {
    const row = entry.row || []
    return row.map(id => {
      const meta = WIDGET_REGISTRY[id]
      const label = meta?.label || id
      // Abbreviate long labels for preview
      const short = label.length > 12 ? label.slice(0, 10) + '\u2026' : label
      return { w: 1 / row.length, label: short }
    })
  })
}

// ─── V1 → V2 migration for imported presets ─────────────────

const V1_ID_MAP = {
  'launcher': null,         // Expands to favorites, recent_apps, my_apps
  'gauges': null,            // Expands to cpu_gauge, memory_gauge, disk_gauge, temp_gauge
  'quick-links': 'actions',
  'user-apps': 'my_apps',
  'core': 'core_services',
  'uptime-load': 'uptime_load',
  'network-throughput': 'network_throughput',
  'recent-logs': 'recent_logs',
}

function migrateV1Config(config) {
  if (!config) return config

  const migrated = { ...config }

  // Migrate grid_layout widget IDs
  if (Array.isArray(migrated.grid_layout)) {
    const newLayout = []
    for (const entry of migrated.grid_layout) {
      const row = entry.row || []
      const expandedRows = []
      const normalRow = []

      for (const id of row) {
        if (id === 'launcher') {
          if (normalRow.length > 0) {
            expandedRows.push({ row: [...normalRow] })
            normalRow.length = 0
          }
          expandedRows.push({ row: ['favorites'] })
          expandedRows.push({ row: ['recent_apps'] })
          expandedRows.push({ row: ['my_apps'] })
        } else if (id === 'gauges') {
          if (normalRow.length > 0) {
            expandedRows.push({ row: [...normalRow] })
            normalRow.length = 0
          }
          expandedRows.push({ row: ['cpu_gauge', 'memory_gauge'] })
          expandedRows.push({ row: ['disk_gauge', 'temp_gauge'] })
        } else {
          normalRow.push(V1_ID_MAP[id] || id)
        }
      }

      if (normalRow.length > 0) {
        expandedRows.push({ row: normalRow })
      }

      newLayout.push(...(expandedRows.length > 0 ? expandedRows : [{ row: row }]))
    }
    migrated.grid_layout = newLayout
  }

  // Migrate advanced_section_order to grid_layout if present (and no grid_layout)
  if (Array.isArray(migrated.advanced_section_order) && !migrated.grid_layout) {
    const rows = []
    for (const id of migrated.advanced_section_order) {
      if (id === 'gauges') {
        rows.push({ row: ['cpu_gauge', 'memory_gauge'] })
        rows.push({ row: ['disk_gauge', 'temp_gauge'] })
      } else {
        const mapped = V1_ID_MAP[id] || id
        if (mapped) rows.push({ row: [mapped] })
      }
    }
    migrated.grid_layout = rows
    delete migrated.advanced_section_order
  }

  return migrated
}

// ─── Composable ───────────────────────────────────────────────

export function useDashboardPresets() {
  const config = useDashboardConfig()
  const preferencesStore = usePreferencesStore()
  const { isAdvanced } = useMode()

  // ─── User presets (stored in dashboard.user_presets) ─────

  const userPresets = computed(() => {
    const raw = preferencesStore.preferences?.dashboard?.user_presets
    if (!Array.isArray(raw)) return []
    return raw
  })

  /** User presets filtered to the current mode. */
  const userPresetsForMode = computed(() => {
    const mode = isAdvanced.value ? 'advanced' : 'standard'
    return userPresets.value.filter(p => p.mode === mode)
  })

  /**
   * Save the current layout as a user preset.
   * Captures grid_layout, all visibility flags, opacity, dimensions, and refresh intervals.
   */
  async function saveCurrentAsPreset(name, description = '') {
    const raw = config.raw.value
    const defaults = config.defaults.value
    const mode = config.modeKey.value

    // Capture current config snapshot
    const snapshot = {}
    const allKeys = new Set([
      ...Object.keys(defaults),
      ...(raw ? Object.keys(raw) : []),
    ])
    for (const key of allKeys) {
      const val = raw?.[key] ?? defaults[key]
      if (val !== undefined) {
        snapshot[key] = val
      }
    }

    const preset = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      mode,
      created_at: new Date().toISOString(),
      config: snapshot,
    }

    const updated = [...userPresets.value, preset]
    return _saveUserPresets(updated)
  }

  /**
   * Rename a user-created preset.
   */
  async function renameUserPreset(presetId, newName) {
    const updated = userPresets.value.map(p =>
      p.id === presetId ? { ...p, name: newName.trim() } : p
    )
    return _saveUserPresets(updated)
  }

  /**
   * Delete a user-created preset.
   */
  async function deleteUserPreset(presetId) {
    const updated = userPresets.value.filter(p => p.id !== presetId)
    return _saveUserPresets(updated)
  }

  /**
   * Apply a user-created preset.
   */
  async function applyUserPreset(presetId) {
    const preset = userPresets.value.find(p => p.id === presetId)
    if (!preset || !preset.config) return

    const updates = { ...preset.config }
    return config.updateConfigs(updates)
  }

  /**
   * Internal: persist the user_presets array to the API.
   * User presets are stored at dashboard.user_presets (mode-independent).
   */
  async function _saveUserPresets(presets) {
    return preferencesStore.savePreferences({
      dashboard: {
        user_presets: presets,
      },
    })
  }

  // ─── Built-in presets ───────────────────────────────────────

  /**
   * Apply a built-in preset to the current mode.
   * Overwrites grid_layout, visibility flags, opacity, and dimensions.
   */
  async function applyPreset(presetId) {
    const preset = PRESETS[presetId]
    if (!preset) return

    const modeData = isAdvanced.value ? preset.advanced : preset.standard
    if (!modeData) return

    const updates = {}
    for (const [key, value] of Object.entries(modeData)) {
      updates[key] = value
    }

    if (modeData.widget_refresh_intervals) {
      updates.widget_refresh_intervals = modeData.widget_refresh_intervals
    }

    return config.updateConfigs(updates)
  }

  /**
   * Apply an imported layout config to the current mode.
   */
  async function applyImportedLayout(importedConfig) {
    if (!importedConfig || typeof importedConfig !== 'object') return
    const updates = {}
    for (const [key, value] of Object.entries(importedConfig)) {
      updates[key] = value
    }
    return config.updateConfigs(updates)
  }

  // ─── Export/Import ──────────────────────────────────────────

  /**
   * Export the current mode's layout config as a JSON object.
   */
  function exportLayout() {
    const raw = config.raw.value
    const defaults = config.defaults.value

    const exported = {}
    const allKeys = new Set([
      ...Object.keys(defaults),
      ...(raw ? Object.keys(raw) : []),
    ])

    for (const key of allKeys) {
      const val = raw?.[key] ?? defaults[key]
      if (val !== undefined) {
        exported[key] = val
      }
    }

    return {
      cubeos_preset_version: PRESET_VERSION,
      mode: config.modeKey.value,
      exported_at: new Date().toISOString(),
      config: exported,
    }
  }

  /**
   * Download the current layout as a JSON file.
   */
  function downloadExport() {
    const data = exportLayout()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `cubeos-dashboard-${data.mode}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  }

  /**
   * Import a layout from a File object (JSON).
   * Handles v1 → v2 migration transparently.
   * Returns { success, error?, config? }.
   */
  async function importFromFile(file) {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate structure
      if (!data.config || typeof data.config !== 'object') {
        return { success: false, error: 'Invalid file: missing config object.' }
      }

      // Version validation and migration
      const version = data.cubeos_preset_version || 1
      if (version > PRESET_VERSION) {
        return { success: false, error: `Unsupported preset version ${version}. Please update CubeOS.` }
      }

      let importConfig = data.config

      // Migrate v1 → v2 if needed
      if (version < 2) {
        importConfig = migrateV1Config(importConfig)
      }

      // Validate it has at least grid_layout
      if (!importConfig.grid_layout) {
        return { success: false, error: 'Invalid file: no layout data found.' }
      }

      await applyImportedLayout(importConfig)
      return { success: true, config: importConfig }
    } catch (e) {
      return { success: false, error: `Failed to parse file: ${e.message}` }
    }
  }

  return {
    builtInPresets: BUILT_IN_PRESETS,
    presetIds: PRESET_IDS,
    userPresets,
    userPresetsForMode,
    applyPreset,
    applyUserPreset,
    saveCurrentAsPreset,
    renameUserPreset,
    deleteUserPreset,
    applyImportedLayout,
    exportLayout,
    downloadExport,
    importFromFile,
    generatePreview,
  }
}
