/**
 * CubeOS Monitoring Store
 *
 * Sprint 4: Real-time monitoring with alerts and thresholds.
 *
 * API Endpoints:
 *   - GET  /monitoring/stats       - Current system stats snapshot
 *   - GET  /monitoring/history     - Stats history (time-series)
 *   - GET  /monitoring/alerts      - Active alerts
 *   - GET  /monitoring/thresholds  - Alert threshold configuration
 *   - PUT  /monitoring/thresholds  - Update alert thresholds
 *   - GET  /monitoring/websocket   - WebSocket connection debug info
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useMonitoringStore = defineStore('monitoring', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const stats = ref(null)
  const history = ref([])
  const alerts = ref([])
  const thresholds = ref(null)
  const wsInfo = ref(null)

  // Current history period for UI state tracking
  const historyPeriod = ref('1h')
  const historyResolution = ref('1m')

  // Per-action loading states
  const savingThresholds = ref(false)

  // ==========================================
  // Computed
  // ==========================================

  const cpuPercent = computed(() => Math.round(stats.value?.cpu_percent ?? stats.value?.cpu?.percent ?? 0))
  const memoryPercent = computed(() => Math.round(stats.value?.memory_percent ?? stats.value?.memory?.percent ?? 0))
  const diskPercent = computed(() => Math.round(stats.value?.disk_percent ?? stats.value?.disk?.percent ?? 0))
  const temperature = computed(() => stats.value?.temperature_cpu ?? stats.value?.temperature?.cpu_temp_c ?? null)

  const memoryUsed = computed(() => stats.value?.memory_used ?? stats.value?.memory?.used ?? 0)
  const memoryTotal = computed(() => stats.value?.memory_total ?? stats.value?.memory?.total ?? 0)
  const diskUsed = computed(() => stats.value?.disk_used ?? stats.value?.disk?.used ?? 0)
  const diskTotal = computed(() => stats.value?.disk_total ?? stats.value?.disk?.total ?? 0)

  const alertCount = computed(() => alerts.value.length)
  const criticalAlerts = computed(() => alerts.value.filter(a => a.severity === 'critical'))
  const warningAlerts = computed(() => alerts.value.filter(a => a.severity === 'warning'))
  const hasAlerts = computed(() => alerts.value.length > 0)

  const wsConnectionCount = computed(() => wsInfo.value?.connections ?? wsInfo.value?.count ?? 0)

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch current stats snapshot
   * GET /monitoring/stats
   */
  async function fetchStats() {
    try {
      stats.value = await api.get('/monitoring/stats')
    } catch (e) {
      console.error('Failed to fetch monitoring stats:', e)
    }
  }

  /**
   * Fetch stats history for charts
   * GET /monitoring/history?period=1h&resolution=1m
   *
   * @param {Object} params - Query parameters
   * @param {string} params.period - Time period (1h, 6h, 24h, 7d)
   * @param {string} params.resolution - Data point resolution (1m, 5m, 15m, 1h)
   */
  async function fetchHistory(params = {}) {
    loading.value = true
    error.value = null
    try {
      const query = {
        period: params.period || historyPeriod.value,
        resolution: params.resolution || historyResolution.value
      }
      const response = await api.get('/monitoring/history', query)
      history.value = response.data || response.points || response || []
      // Track the current period selection
      if (params.period) historyPeriod.value = params.period
      if (params.resolution) historyResolution.value = params.resolution
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch monitoring history:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch active alerts
   * GET /monitoring/alerts
   */
  async function fetchAlerts() {
    try {
      const response = await api.get('/monitoring/alerts')
      alerts.value = response.alerts || response || []
    } catch (e) {
      console.error('Failed to fetch monitoring alerts:', e)
      alerts.value = []
    }
  }

  /**
   * Fetch alert threshold configuration
   * GET /monitoring/thresholds
   */
  async function fetchThresholds() {
    try {
      thresholds.value = await api.get('/monitoring/thresholds')
    } catch (e) {
      console.error('Failed to fetch monitoring thresholds:', e)
    }
  }

  /**
   * Update alert thresholds
   * PUT /monitoring/thresholds
   *
   * @param {Object} newThresholds - Threshold config
   * @param {number} newThresholds.cpu_percent - CPU alert threshold (0-100)
   * @param {number} newThresholds.memory_percent - Memory alert threshold (0-100)
   * @param {number} newThresholds.disk_percent - Disk alert threshold (0-100)
   * @param {number} [newThresholds.temperature_c] - Temperature alert threshold
   */
  async function updateThresholds(newThresholds) {
    savingThresholds.value = true
    error.value = null
    try {
      const result = await api.put('/monitoring/thresholds', newThresholds)
      thresholds.value = result.thresholds || result || newThresholds
      return result
    } catch (e) {
      error.value = e.message
      console.error('Failed to update monitoring thresholds:', e)
      throw e
    } finally {
      savingThresholds.value = false
    }
  }

  /**
   * Fetch WebSocket connection debug info
   * GET /monitoring/websocket
   */
  async function fetchWebSocketInfo() {
    try {
      wsInfo.value = await api.get('/monitoring/websocket')
    } catch (e) {
      console.error('Failed to fetch WebSocket info:', e)
      wsInfo.value = null
    }
  }

  /**
   * Update stats from WebSocket message (called by MonitoringView
   * when listening on /ws/monitoring)
   */
  function updateFromWebSocket(data) {
    if (!data) return
    if (data.stats) {
      stats.value = { ...(stats.value || {}), ...data.stats }
    }
    if (data.alerts) {
      alerts.value = data.alerts
    }
  }

  /**
   * Fetch all monitoring data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchStats(),
        fetchAlerts(),
        fetchThresholds(),
        fetchWebSocketInfo()
      ])
    } finally {
      loading.value = false
    }
  }

  /**
   * Set period and fetch corresponding history.
   * Maps periods to sensible resolutions.
   */
  async function setPeriod(period) {
    const resolutionMap = {
      '1h': '1m',
      '6h': '5m',
      '24h': '15m',
      '7d': '1h'
    }
    await fetchHistory({
      period,
      resolution: resolutionMap[period] || '5m'
    })
  }

  return {
    // State
    loading,
    error,
    stats,
    history,
    alerts,
    thresholds,
    wsInfo,
    historyPeriod,
    historyResolution,
    savingThresholds,

    // Computed
    cpuPercent,
    memoryPercent,
    diskPercent,
    temperature,
    memoryUsed,
    memoryTotal,
    diskUsed,
    diskTotal,
    alertCount,
    criticalAlerts,
    warningAlerts,
    hasAlerts,
    wsConnectionCount,

    // Actions
    fetchStats,
    fetchHistory,
    fetchAlerts,
    fetchThresholds,
    updateThresholds,
    fetchWebSocketInfo,
    updateFromWebSocket,
    fetchAll,
    setPeriod
  }
})
