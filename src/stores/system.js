import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useSystemStore = defineStore('system', () => {
  // State
  const info = ref(null)
  const stats = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  // Getters
  const hostname = computed(() => info.value?.hostname ?? 'CubeOS')
  const uptime = computed(() => stats.value?.uptime_human ?? '—')
  
  // CPU - API returns cpu.percent (not usage_percent)
  const cpuUsage = computed(() => {
    const cpu = stats.value?.cpu
    if (!cpu) return 0
    // Try different field names
    return Math.round(cpu.percent ?? cpu.usage_percent ?? 0)
  })
  
  // Memory - API returns memory.percent directly, or we calculate from used/total
  const memoryUsage = computed(() => {
    const mem = stats.value?.memory
    if (!mem) return 0
    if (mem.percent !== undefined) return Math.round(mem.percent)
    if (mem.used && mem.total && mem.total > 0) {
      return Math.round((mem.used / mem.total) * 100)
    }
    return 0
  })
  
  // Temperature - API returns temperature.current or temperature.cpu_temp_c
  const temperature = computed(() => {
    const temp = stats.value?.temperature
    if (!temp) return null
    return temp.current ?? temp.cpu_temp_c ?? null
  })
  
  const diskUsage = computed(() => {
    if (!stats.value?.disk) return 0
    const { used, total, percent } = stats.value.disk
    if (percent !== undefined) return Math.round(percent)
    return total > 0 ? Math.round((used / total) * 100) : 0
  })

  // Formatted values
  const memoryFormatted = computed(() => {
    const mem = stats.value?.memory
    if (!mem) return '—'
    const { used, total, available } = mem
    if (!total) return '—'
    const usedVal = used ?? (total - (available ?? 0))
    const usedGB = (usedVal / 1024 / 1024 / 1024).toFixed(1)
    const totalGB = (total / 1024 / 1024 / 1024).toFixed(1)
    return `${usedGB} / ${totalGB} GB`
  })

  const diskFormatted = computed(() => {
    if (!stats.value?.disk) return '—'
    const { used, total } = stats.value.disk
    if (!total) return '—'
    const usedGB = (used / 1024 / 1024 / 1024).toFixed(0)
    const totalGB = (total / 1024 / 1024 / 1024).toFixed(0)
    return `${usedGB} / ${totalGB} GB`
  })

  // Actions
  async function fetchInfo() {
    try {
      info.value = await api.getSystemInfo()
    } catch (e) {
      console.error('Failed to fetch system info:', e)
      error.value = e.message
    }
  }

  async function fetchStats() {
    try {
      const data = await api.getSystemStats()
      stats.value = data
      lastUpdated.value = new Date()
    } catch (e) {
      console.error('Failed to fetch system stats:', e)
      error.value = e.message
    }
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([fetchInfo(), fetchStats()])
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
    fetchInfo,
    fetchStats,
    fetchAll,
    reboot,
    shutdown
  }
})
