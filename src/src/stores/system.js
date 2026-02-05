/**
 * CubeOS System Store
 * 
 * Manages system information, stats, and hardware status.
 * Uses HAL endpoints for hardware-specific data (battery, Pi model, etc.)
 * 
 * API Endpoints used:
 * - /system/info - Basic system info (container-aware)
 * - /system/stats - CPU, memory, disk, temperature
 * - /hardware/battery - Battery status from HAL (UPS/PiJuice)
 * - /hardware/eeprom - Pi model, serial, revision from EEPROM
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

  // Uptime - can come from info or be fetched separately
  const uptime = computed(() => {
    return {
      uptime_seconds: info.value?.uptime_seconds || 0,
      uptime_human: info.value?.uptime_human || '—'
    }
  })

  // Getters - system info
  const hostname = computed(() => {
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
    reboot,
    shutdown,
    
    // Aliases for backward compatibility
    systemInfo: info,
    fetchSystemInfo: fetchInfo
  }
})
