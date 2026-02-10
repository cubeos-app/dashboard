/**
 * useDashboardPresets.js — Session 6
 *
 * Dashboard preset management: built-in presets, export current layout as JSON,
 * import layout from JSON file. Each preset defines grid_layout, widget_opacity,
 * widget_dimensions, visibility flags, and (optionally) widget_refresh_intervals.
 *
 * Built-in presets:
 *   - Home Server: clean overview of all key widgets
 *   - Expedition: focus on connectivity, power, signals
 *   - Monitoring: dense information layout for sysadmins
 *   - Minimal: three widgets only, distraction-free
 *
 * Usage:
 *   const { builtInPresets, applyPreset, exportLayout, importLayout } = useDashboardPresets()
 */
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useMode } from '@/composables/useMode'

// ─── Built-in preset definitions ────────────────────────────────

const PRESETS = {
  home_server: {
    id: 'home_server',
    name: 'Home Server',
    description: 'Clean overview with clock, status, vitals, services, and app launcher.',
    icon: 'Server',
    standard: {
      grid_layout: [
        { row: ['clock'] },
        { row: ['search'] },
        { row: ['status'] },
        { row: ['vitals', 'network'] },
        { row: ['actions'] },
        { row: ['launcher'] },
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
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['vitals'] },
        { row: ['network'] },
        { row: ['actions'] },
        { row: ['launcher'] },
      ],
      show_system_vitals: true,
      show_info_bar: true,
      show_swarm: true,
      show_alerts: true,
      show_disk_widget: false,
      show_signals_widget: false,
      show_favorites: true,
      show_core_services: true,
      show_my_apps: true,
      show_quick_actions: true,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: false,
      widget_opacity: {},
      widget_dimensions: {},
      advanced_section_order: [
        'gauges', 'infobar', 'swarm', 'alerts',
        'favorites', 'core', 'user-apps', 'quick-links',
      ],
    },
    /** Simple SVG diagram data: rows of widget blocks (for preview) */
    preview: [
      [{ w: 1, label: 'Clock' }],
      [{ w: 1, label: 'Search' }],
      [{ w: 1, label: 'Status' }],
      [{ w: 0.5, label: 'Vitals' }, { w: 0.5, label: 'Network' }],
      [{ w: 1, label: 'Actions' }],
      [{ w: 1, label: 'Launcher' }],
    ],
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
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['vitals'] },
        { row: ['network'] },
        { row: ['battery'] },
      ],
      show_system_vitals: true,
      show_info_bar: true,
      show_swarm: false,
      show_alerts: true,
      show_disk_widget: false,
      show_signals_widget: true,
      show_favorites: false,
      show_core_services: false,
      show_my_apps: false,
      show_quick_actions: true,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: true,
      widget_opacity: {},
      widget_dimensions: {},
      advanced_section_order: [
        'gauges', 'infobar', 'signals', 'battery',
        'alerts', 'quick-links',
      ],
    },
    preview: [
      [{ w: 1, label: 'Clock' }],
      [{ w: 1, label: 'Status' }],
      [{ w: 0.5, label: 'Network' }, { w: 0.5, label: 'Battery' }],
      [{ w: 1, label: 'Signals' }],
      [{ w: 1, label: 'Vitals' }],
      [{ w: 1, label: 'Actions' }],
    ],
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
        { row: ['launcher'] },
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
      widget_opacity: {},
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['vitals'] },
        { row: ['network'] },
        { row: ['disk'] },
      ],
      show_system_vitals: true,
      show_info_bar: true,
      show_swarm: true,
      show_alerts: true,
      show_disk_widget: true,
      show_signals_widget: true,
      show_favorites: false,
      show_core_services: true,
      show_my_apps: true,
      show_quick_actions: true,
      show_uptime_load: true,
      show_network_throughput: true,
      show_recent_logs: true,
      show_battery: false,
      widget_opacity: {},
      widget_dimensions: {},
      advanced_section_order: [
        'gauges', 'infobar', 'disk', 'signals',
        'swarm', 'alerts', 'uptime-load', 'network-throughput',
        'recent-logs', 'core', 'user-apps', 'quick-links',
      ],
    },
    preview: [
      [{ w: 1, label: 'Status' }],
      [{ w: 0.5, label: 'Vitals' }, { w: 0.5, label: 'Network' }],
      [{ w: 0.5, label: 'Uptime' }, { w: 0.5, label: 'Throughput' }],
      [{ w: 0.5, label: 'Disk' }, { w: 0.5, label: 'Signals' }],
      [{ w: 1, label: 'Logs' }],
      [{ w: 1, label: 'Launcher' }],
    ],
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
      widget_opacity: { clock: 0 },
      widget_dimensions: {},
    },
    advanced: {
      grid_layout: [
        { row: ['vitals'] },
      ],
      show_system_vitals: true,
      show_info_bar: false,
      show_swarm: false,
      show_alerts: false,
      show_disk_widget: false,
      show_signals_widget: false,
      show_favorites: false,
      show_core_services: false,
      show_my_apps: false,
      show_quick_actions: true,
      show_uptime_load: false,
      show_network_throughput: false,
      show_recent_logs: false,
      show_battery: false,
      widget_opacity: {},
      widget_dimensions: {},
      advanced_section_order: ['gauges', 'quick-links'],
    },
    preview: [
      [{ w: 1, label: 'Clock' }],
      [{ w: 1, label: 'Status' }],
      [{ w: 1, label: 'Actions' }],
    ],
  },
}

export const PRESET_IDS = Object.keys(PRESETS)
export const BUILT_IN_PRESETS = Object.values(PRESETS)

// ─── Composable ───────────────────────────────────────────────

export function useDashboardPresets() {
  const config = useDashboardConfig()
  const { isAdvanced } = useMode()

  /**
   * Apply a built-in preset to the current mode.
   * Overwrites grid_layout, visibility flags, opacity, and dimensions.
   */
  async function applyPreset(presetId) {
    const preset = PRESETS[presetId]
    if (!preset) return

    const modeData = isAdvanced.value ? preset.advanced : preset.standard
    if (!modeData) return

    // Build the update object with all preset fields
    const updates = {}
    for (const [key, value] of Object.entries(modeData)) {
      updates[key] = value
    }

    // Also include widget_refresh_intervals if the preset defines them
    if (modeData.widget_refresh_intervals) {
      updates.widget_refresh_intervals = modeData.widget_refresh_intervals
    }

    return config.updateConfigs(updates)
  }

  /**
   * Apply an imported layout config to the current mode.
   * Accepts a parsed JSON object with the same shape as a mode config.
   */
  async function applyImportedLayout(importedConfig) {
    if (!importedConfig || typeof importedConfig !== 'object') return

    const updates = {}
    for (const [key, value] of Object.entries(importedConfig)) {
      updates[key] = value
    }

    return config.updateConfigs(updates)
  }

  /**
   * Export the current mode's layout config as a JSON object.
   * Includes all settings the user has customized.
   */
  function exportLayout() {
    const raw = config.raw.value
    const defaults = config.defaults.value

    // Build export from current state (raw + defaults for unset values)
    const exported = {}
    const allKeys = new Set([
      ...Object.keys(defaults),
      ...(raw ? Object.keys(raw) : []),
    ])

    for (const key of allKeys) {
      // Use raw value if set, otherwise default
      const val = raw?.[key] ?? defaults[key]
      if (val !== undefined) {
        exported[key] = val
      }
    }

    return {
      cubeos_preset_version: 1,
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

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  }

  /**
   * Import a layout from a File object (JSON).
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

      if (data.cubeos_preset_version !== 1) {
        return { success: false, error: 'Unsupported preset version.' }
      }

      // Validate it has at least grid_layout
      if (!data.config.grid_layout && !data.config.advanced_section_order) {
        return { success: false, error: 'Invalid file: no layout data found.' }
      }

      await applyImportedLayout(data.config)
      return { success: true, config: data.config }
    } catch (e) {
      return { success: false, error: `Failed to parse file: ${e.message}` }
    }
  }

  return {
    builtInPresets: BUILT_IN_PRESETS,
    presetIds: PRESET_IDS,
    applyPreset,
    applyImportedLayout,
    exportLayout,
    downloadExport,
    importFromFile,
  }
}
