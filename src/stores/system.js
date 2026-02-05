/**
 * CubeOS System Store
 * 
 * Manages system information, stats, and hardware status.
 * Uses HAL endpoints for hardware-specific data (battery, Pi model, etc.)
 * 
 * Sprint 2: Added hostname get/set, timezone get/set, timezones list.
 * Sprint 6: Added quickBackup, getBackupDetail.
 * 
 * API Endpoints used:
 * - /system/info - Basic system info (container-aware)
 * - /system/stats - CPU, memory, disk, temperature
 * - /hardware/battery - Battery status from HAL (UPS/PiJuice)
 * - /hardware/eeprom - Pi model, serial, revision from EEPROM
 * - /system/hostname - Get/set hostname (Sprint 2)
 * - /system/timezone - Get/set timezone (Sprint 2)
 * - /system/timezones - List available timezones (Sprint 2)
 * - POST /backups/quick - Quick backup with type/description (Sprint 6)
 * - GET /backups/{id} - Backup detail (Sprint 6)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

import { confirm } from '@/utils/confirmDialog'

export const useSystemStore = defineStore('system', () => {
  // State
  const info = ref(null)
  const stats = ref(null)
  const battery = ref(null)
  const hardware = ref(null)  // Pi model, serial from EEPROM
  const wifiClientsData = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const wsConnected = ref(false)  // WebSocket connection status

  // Sprint 2: New state refs
  const hostnameValue = ref(null)
  const timezone = ref(null)
  const timezonesList = ref([])

  // Uptime - can come from info or be fetched separately
  const uptime = computed(() => {
    return {
      uptime_seconds: info.value?.uptime_seconds || 0,
      uptime_human: info.value?.uptime_human || '—'
    }
  })

  // Getters - system info
  const hostname = computed(() => {
    // If we have a hostname from the dedicated endpoint, prefer it
    if (hostnameValue.value) return hostnameValue.value
    // info.hostname returns container name when running in Docker (e.g. "cubeos-api")
    // Prefer Pi model from EEPROM, fall back to hostname only if it's a real host name
    const h = info.value?.hostname
    const isContainerName = !h || h === 'cubeos-api' || h === 'cubeos_api' || h.startsWith('cubeos-')
    if (!isContainerName) return h
    return hardware.value?.model || 'CubeOS'
  })
  
  const cpuUsage = computed(() => Math.round(stats.value?.cpu_percent ?? 0))
  const memoryUsage = computed(() => Math.round(stats.value?.memory_percent ?? 0))
  const temperature = computed(() => stats.value?.temperature_cpu ?? null)
  const diskUsage = computed(() => Math.round(stats.value?.disk_percent ?? 0))
  
  // WiFi clients count
  const wifiClients = computed(() => {
    if (wifiClientsData.value === null) return null
    return wifiClientsData.value?.clients?.length ?? 0
  })
  
  /**
   * Battery getters - mapped from HAL /hardware/battery response
   * The HAL endpoint returns:
   * - available: boolean (whether battery hardware is detected)
   * - percentage: number (0-100)
   * - is_charging: boolean
   * - ac_present: boolean
   * - voltage: number
   */
  const batteryPercent = computed(() => {
    if (!battery.value?.available) return null
    const pct = battery.value?.percentage
    if (pct === null || pct === undefined || pct < 0) return null
    return Math.round(pct)
  })
  
  const batteryAvailable = computed(() => battery.value?.available ?? false)
  
  const onBattery = computed(() => {
    // On battery if available, not charging, and no AC present
    if (!battery.value?.available) return false
    return !battery.value?.ac_present && !battery.value?.is_charging
  })
  
  const isCharging = computed(() => battery.value?.is_charging ?? false)

  /**
   * Power getter - formatted for AppHeader.vue compatibility
   * Returns null if no battery hardware detected
   */
  const power = computed(() => {
    if (!battery.value) return null
    return {
      available: battery.value.available ?? false,
      battery_percent: battery.value.percentage ?? null,
      is_charging: battery.value.is_charging ?? false,
      charging: battery.value.is_charging ?? false, // alias
      on_battery: onBattery.value
    }
  })

  // Hardware info getters (from EEPROM)
  const piModel = computed(() => hardware.value?.model ?? info.value?.pi_model ?? null)
  const piSerial = computed(() => hardware.value?.serial ?? info.value?.pi_serial ?? null)
  const piRevision = computed(() => hardware.value?.revision ?? info.value?.pi_revision ?? null)

  // Formatted values
  const memoryFormatted = computed(() => {
    if (!stats.value?.memory_total) return '—'
    const usedGB = (stats.value.memory_used / 1024 / 1024 / 1024).toFixed(1)
    const totalGB = (stats.value.memory_total / 1024 / 1024 / 1024).toFixed(1)
    return `${usedGB} / ${totalGB} GB`
  })

  const diskFormatted = computed(() => {
    if (!stats.value?.disk_total) return '—'
    const usedGB = (stats.value.disk_used / 1024 / 1024 / 1024).toFixed(0)
    const totalGB = (stats.value.disk_total / 1024 / 1024 / 1024).toFixed(0)
    return `${usedGB} / ${totalGB} GB`
  })

  // Actions
  async function fetchInfo(options = {}) {
    try {
      info.value = await api.getSystemInfo()
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    }
  }

  async function fetchStats(options = {}) {
    try {
      const result = await api.get('/system/stats', {}, options)
      if (result === null) return // Aborted
      stats.value = result
      lastUpdated.value = new Date()
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    }
  }
  
  /**
   * Fetch battery status from HAL
   * Uses /hardware/battery endpoint
   */
  async function fetchBattery(options = {}) {
    try {
      const data = await api.get('/hardware/battery', {}, options)
      if (data === null) return // Aborted
      battery.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      // Battery/UPS might not be available, that's ok
      // Set available: false so UI knows not to display battery
      battery.value = { available: false }
    }
  }

  /**
   * Fetch hardware info from HAL EEPROM
   * Returns Pi model, serial, revision
   */
  async function fetchHardware(options = {}) {
    try {
      const data = await api.get('/hardware/eeprom', {}, options)
      if (data === null) return // Aborted
      hardware.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      // EEPROM read might fail on non-Pi hardware
      hardware.value = null
    }
  }
  
  async function fetchWifiClients(options = {}) {
    try {
      const data = await api.get('/network/wifi/ap/clients', {}, options)
      if (data === null) return // Aborted
      wifiClientsData.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      // AP might not be available
      wifiClientsData.value = { clients: [] }
    }
  }

  // Legacy alias for backward compatibility
  async function fetchPower(options = {}) {
    return fetchBattery(options)
  }

  /**
   * Fetch all system data - info, stats, battery, hardware
   * Called on app init for header display
   * @param {object} options - Optional { signal } for AbortController
   */
  async function fetchAll(options = {}) {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchInfo(options),
        fetchStats(options),
        fetchBattery(options),
        fetchHardware(options),
        fetchWifiClients(options)
      ])
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function reboot() {
    if (!await confirm({
      title: 'Reboot System',
      message: 'Are you sure you want to reboot the system?',
      confirmText: 'Reboot',
      variant: 'warning'
    })) return false
    try {
      await api.reboot()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function shutdown() {
    if (!await confirm({
      title: 'Shutdown System',
      message: 'Are you sure you want to shutdown the system?',
      confirmText: 'Shutdown',
      variant: 'danger'
    })) return false
    try {
      await api.shutdown()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  // ==========================================
  // Sprint 6: Backup Extension Methods
  // ==========================================

  /**
   * Quick backup — creates a backup with minimal configuration
   * POST /backups/quick?backup_type={type}&description={desc}
   *
   * NOTE: api.post() only accepts (endpoint, data) — no query params support.
   * We must build the URL with URLSearchParams manually.
   *
   * @param {string} [backupType='full'] - Backup type: 'full', 'config', 'data'
   * @param {string} [description] - Optional description for the backup
   * @returns {Object|null} Created backup data or null on error
   */
  async function quickBackup(backupType = 'full', description) {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({ backup_type: backupType })
      if (description) {
        params.set('description', description)
      }
      const data = await api.post(`/backups/quick?${params.toString()}`)
      return data
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Get detailed info for a specific backup
   * GET /backups/{backup_id}
   *
   * @param {string} backupId - Backup identifier
   * @returns {Object|null} Backup detail or null on error
   */
  async function getBackupDetail(backupId) {
    try {
      const data = await api.get(`/backups/${encodeURIComponent(backupId)}`)
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // Sprint 2: Hostname & Timezone Methods
  // ==========================================

  /**
   * Fetch current hostname
   */
  async function fetchHostname() {
    try {
      const response = await api.get('/system/hostname')
      hostnameValue.value = response.hostname || null
    } catch (e) {
      error.value = e.message
    }
  }

  /**
   * Set hostname
   * @param {string} name - New hostname (DNS-safe characters)
   */
  async function setHostname(name) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/system/hostname', { hostname: name })
      hostnameValue.value = name
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch current timezone
   */
  async function fetchTimezone() {
    try {
      const response = await api.get('/system/timezone')
      timezone.value = response.timezone || null
    } catch (e) {
      error.value = e.message
    }
  }

  /**
   * Set timezone
   * @param {string} tz - Timezone identifier (e.g., 'Europe/Amsterdam')
   */
  async function setTimezone(tz) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/system/timezone', { timezone: tz })
      timezone.value = tz
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch list of available timezones
   */
  async function fetchTimezones() {
    try {
      const response = await api.get('/system/timezones')
      timezonesList.value = response.timezones || []
    } catch (e) {
      error.value = e.message
      timezonesList.value = []
    }
  }

  /**
   * Update stats from WebSocket message.
   * Maps the WS payload format to the flat format used by the store.
   * Called by App.vue's onStats callback.
   *
   * WS format:  { system: { cpu: { percent }, memory: { percent, used, total }, ... }, network, docker }
   * Store format: { cpu_percent, memory_percent, memory_used, memory_total, ... }
   */
  function updateFromWebSocket(data) {
    if (!data) return

    const sys = data.system
    if (sys) {
      // Build the flat stats object the store and AppHeader expect
      const updated = { ...(stats.value || {}) }
      if (sys.cpu) {
        updated.cpu_percent = sys.cpu.percent ?? updated.cpu_percent
      }
      if (sys.memory) {
        updated.memory_percent = sys.memory.percent ?? updated.memory_percent
        updated.memory_used = sys.memory.used ?? updated.memory_used
        updated.memory_total = sys.memory.total ?? updated.memory_total
      }
      if (sys.disk) {
        updated.disk_percent = sys.disk.percent ?? updated.disk_percent
        updated.disk_used = sys.disk.used ?? updated.disk_used
        updated.disk_total = sys.disk.total ?? updated.disk_total
      }
      if (sys.temperature) {
        updated.temperature_cpu = sys.temperature.cpu_temp_c ?? updated.temperature_cpu
      }
      stats.value = updated
    }

    // Network → wifi client count
    if (data.network && data.network.clients_connected !== undefined) {
      wifiClientsData.value = { clients: new Array(data.network.clients_connected) }
    }

    lastUpdated.value = new Date()
  }

  /**
   * Set WebSocket connection status — called by App.vue
   */
  function setWsConnected(value) {
    wsConnected.value = value
  }

  return {
    // State
    info,
    stats,
    battery,
    hardware,
    power,  // Computed for AppHeader compatibility
    uptime, // Computed for uptime display
    loading,
    error,
    lastUpdated,
    wsConnected,
    hostnameValue,
    timezone,
    timezonesList,
    
    // Computed getters
    hostname,
    cpuUsage,
    memoryUsage,
    temperature,
    diskUsage,
    memoryFormatted,
    diskFormatted,
    batteryPercent,
    batteryAvailable,
    onBattery,
    isCharging,
    wifiClients,
    piModel,
    piSerial,
    piRevision,
    
    // Actions
    fetchInfo,
    fetchStats,
    fetchBattery,
    fetchHardware,
    fetchPower,  // Legacy alias
    fetchWifiClients,
    fetchAll,
    updateFromWebSocket,
    setWsConnected,
    reboot,
    shutdown,
    
    // Sprint 2: Hostname & Timezone
    fetchHostname,
    setHostname,
    fetchTimezone,
    setTimezone,
    fetchTimezones,

    // Sprint 6: Backup Extensions
    quickBackup,
    getBackupDetail,
    
    // Aliases for backward compatibility
    systemInfo: info,
    fetchSystemInfo: fetchInfo
  }
})
