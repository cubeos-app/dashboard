import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useSystemStore = defineStore('system', () => {
  // State
  const info = ref(null)
  const stats = ref(null)
  const power = ref(null)
  const wifiClientsData = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  // Getters - adapted to match API flat response format
  const hostname = computed(() => info.value?.hostname ?? 'CubeOS')
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
  
  // Power getters
  const batteryPercent = computed(() => power.value?.battery_percent ?? null)
  const batteryAvailable = computed(() => power.value?.available ?? false)
  const onBattery = computed(() => power.value?.on_battery ?? false)
  const isCharging = computed(() => power.value?.is_charging ?? false)

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
  
  async function fetchPower() {
    try {
      power.value = await api.get('/power/status')
    } catch (e) {
      // UPS might not be available, that's ok
      power.value = { available: false }
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

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([fetchInfo(), fetchStats(), fetchPower(), fetchWifiClients()])
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
    info,
    stats,
    power,
    loading,
    error,
    lastUpdated,
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
    fetchInfo,
    fetchStats,
    fetchPower,
    fetchWifiClients,
    fetchAll,
    reboot,
    shutdown
  }
})
