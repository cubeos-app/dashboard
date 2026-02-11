/**
 * CubeOS Widget WebSocket Composable — Session 5
 *
 * Per-widget WebSocket awareness layer. Sits on top of the app-level
 * useWebSocket (connected in App.vue) and provides:
 *
 *   - Which widgets receive live data via WS vs need polling
 *   - Reactive connection state for UI indicators
 *   - Convenience method to check if a specific widget is WS-covered
 *
 * The app-level WS pushes system stats (CPU, memory, disk, temp, network,
 * docker) into the system store. Widgets that display this data don't need
 * their own polling — they're "covered" by WebSocket. Other widgets
 * (logs, battery, uptime history, network throughput) still need polling
 * at their configured intervals.
 *
 * Usage:
 *   const { isLiveViaWS, wsConnectionState } = useWidgetWebSocket()
 *   if (isLiveViaWS('vitals')) { ... } // true when WS connected
 *
 * This composable does NOT open a new WebSocket connection — it reads
 * the wsConnected state injected by App.vue.
 */
import { inject, computed, ref } from 'vue'

/**
 * Widget IDs that receive real-time data from /ws/stats.
 * When WS is connected, these widgets don't need to poll.
 *
 * The WS pushes: { system: { cpu, memory, disk, temperature }, network, docker }
 * This covers:
 *   - vitals (CPU %, memory %, temp)
 *   - disk (disk %)
 *   - network (wifi clients, interface status)
 *   - status (overall system health — derived from same data)
 *   - cpu_gauge, memory_gauge, disk_gauge, temp_gauge (individual gauge values
 *     derived from the same WS system stats — Session 9)
 *
 * NOT covered (still need polling):
 *   - uptime_load (needs /monitoring/history for sparkline data)
 *   - network_throughput (needs /network/traffic/history for bandwidth graphs)
 *   - recent_logs (needs /logs/journal)
 *   - battery (needs /hardware/battery — separate HAL endpoint)
 *   - signals (needs /signals or /hardware/gps — separate HAL endpoint)
 *   - clock, search, actions, favorites, etc. (no polling needed at all)
 */
const WS_COVERED_WIDGETS = new Set([
  'vitals',
  'disk',
  'network',
  'status',
  'cpu_gauge',
  'memory_gauge',
  'disk_gauge',
  'temp_gauge',
])

/**
 * Widgets that don't need any polling — they're either static,
 * event-driven, or purely user-triggered.
 * Session 9: Added favorites, recent_apps, my_apps (store-driven, no polling),
 * infobar (store-driven), core_services, swarm (store-driven).
 */
const NO_POLL_WIDGETS = new Set([
  'clock',
  'search',
  'actions',
  'launcher',
  'favorites',
  'recent_apps',
  'my_apps',
  'infobar',
  'core_services',
  'swarm',
])

/**
 * Connection state enum for UI display.
 */
export const WS_STATE = {
  CONNECTED: 'connected',      // Green dot — live data flowing
  DISCONNECTED: 'disconnected', // Grey dot — polling fallback
  CONNECTING: 'connecting',     // Yellow dot — attempting connection
}

export function useWidgetWebSocket() {
  // Read the WS connection state injected by App.vue
  const wsConnected = inject('wsConnected', ref(false))

  /**
   * Reactive connection state for UI indicators.
   * Maps the boolean to a display-friendly enum.
   */
  const wsConnectionState = computed(() => {
    return wsConnected.value ? WS_STATE.CONNECTED : WS_STATE.DISCONNECTED
  })

  /**
   * Whether WS is actively delivering data.
   */
  const isWsActive = computed(() => wsConnected.value)

  /**
   * Check if a widget is receiving live data via WebSocket.
   * Returns true only when WS is connected AND the widget is in the coverage set.
   *
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} True if this widget's data comes from WS right now
   */
  function isLiveViaWS(widgetId) {
    return wsConnected.value && WS_COVERED_WIDGETS.has(widgetId)
  }

  /**
   * Check if a widget needs polling at all.
   * Returns false for widgets that are fully covered by WS (when connected)
   * or that don't need polling (static/event-driven widgets).
   *
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} True if this widget should run its own poll interval
   */
  function needsPolling(widgetId) {
    // Static widgets never poll
    if (NO_POLL_WIDGETS.has(widgetId)) return false

    // WS-covered widgets don't poll when WS is connected
    if (wsConnected.value && WS_COVERED_WIDGETS.has(widgetId)) return false

    // Everything else polls
    return true
  }

  /**
   * Check if a widget is WS-coverable (even if WS is currently disconnected).
   * Used by settings UI to show "Live via WebSocket" label.
   *
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} True if this widget can receive WS data
   */
  function isWsCoverable(widgetId) {
    return WS_COVERED_WIDGETS.has(widgetId)
  }

  /**
   * Check if a widget is static (never needs polling or WS).
   *
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} True if this widget is static/event-driven
   */
  function isStaticWidget(widgetId) {
    return NO_POLL_WIDGETS.has(widgetId)
  }

  return {
    // State
    wsConnected,
    wsConnectionState,
    isWsActive,

    // Methods
    isLiveViaWS,
    needsPolling,
    isWsCoverable,
    isStaticWidget,

    // Constants (for external use)
    WS_STATE,
  }
}
