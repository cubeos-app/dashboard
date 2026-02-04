/**
 * CubeOS System Store
 * 
 * Manages system information, stats, and hardware status.
 * Uses HAL endpoints for hardware-specific data (battery, Pi model, etc.)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

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

  // Getters - system info
  const hostname = computed(() => info.value?.hostname ?? hardware.value?.model ?? 'CubeOS')
  const uptime = computed(() => info.value?.uptime_human ?? '—')
  const cpuUsage = computed(() => Math.round(stats.value?.cpu_percent ?? 0))
  const memoryUsage = computed(() => Math.round(stats.value?.memory_percent ?? 0))
  const temperature = computed(() => stats.value?.temperature_cpu ?? null)
  const diskUsage = computed(() => Math.round(stats.value?.disk_percent ?? 0))
  
  // WiFi clients count
  const wifiClients = computed(() => {
    if (wifiClientsData.value === null) return null
    return wifiClientsData.value?.clients?.length ?? 0
  })
  
  // Battery getters - mapped from HAL /hardware/battery response
  const batteryPercent = computed(() => {
    if (!battery.value?.available) return null
    return battery.value?.percentage ?? null
  })
  const batteryAvailable = computed(() => battery.value?.available ?? false)
  const onBattery = computed(() => {
    // On battery if available, not charging, and no AC present
    if (!battery.value?.available) return false
    return !battery.value?.ac_present && !battery.value?.is_charging
  })
  const isCharging = computed(() => battery.value?.is_charging ?? false)

  // Power getter for backward compatibility
  const power = computed(() => {
    if (!battery.value) return null
    return {
      available: battery.value.available,
      battery_percent: battery.value.percentage,
      is_charging: battery.value.is_charging,
      on_battery: onBattery.value
    }
  })

  // Hardware info getters (from EEPROM)
  const piModel = computed(() => hardware.value?.model ?? null)
  const piSerial = computed(() => hardware.value?.serial ?? null)
  const piRevision = computed(() => hardware.value?.revision ?? null)

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
  async function fetchInfo() {
    try {
      info.value = await api.getSystemInfo()
    } catch (e) {
      error.value = e.message
    }
  }

  async function fetchStats() {
    try {
      stats.value = await api.getSystemStats()
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = e.message
    }
  }
  
  /**
   * Fetch battery status from HAL
   * Uses /hardware/battery endpoint which returns:
   * - available: boolean
   * - percentage: number (0-100)
   * - is_charging: boolean
   * - ac_present: boolean
   * - voltage: number
   */
  async function fetchBattery() {
    try {
      battery.value = await api.get('/hardware/battery')
    } catch (e) {
      // Battery/UPS might not be available, that's ok
      battery.value = { available: false }
    }
  }

  /**
   * Fetch hardware info from HAL EEPROM
   * Returns Pi model, serial, revision
   */
  async function fetchHardware() {
    try {
      hardware.value = await api.get('/hardware/eeprom')
    } catch (e) {
      // EEPROM read might fail on non-Pi hardware
      hardware.value = null
    }
  }
  
  async function fetchWifiClients() {
    try {
      wifiClientsData.value = await api.get('/network/wifi/ap/clients')
    } catch (e) {
      // AP might not be available
      wifiClientsData.value = { clients: [] }
    }
  }

  // Legacy alias for backward compatibility
  async function fetchPower() {
    return fetchBattery()
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchInfo(),
        fetchStats(),
        fetchBattery(),
        fetchHardware(),
        fetchWifiClients()
      ])
    } finally {
      loading.value = false
    }
  }

  async function reboot() {
    if (!confirm('Are you sure you want to reboot the system?')) return false
    try {
      await api.reboot()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function shutdown() {
    if (!confirm('Are you sure you want to shutdown the system?')) return false
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
    power,  // Computed for backward compatibility
    loading,
    error,
    lastUpdated,
    
    // Computed getters
    hostname,
    uptime,
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
    
    // Aliases for DashboardView.vue compatibility
    systemInfo: info,
    fetchSystemInfo: fetchInfo
  }
})
