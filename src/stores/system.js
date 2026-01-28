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
  
  // Uptime - check both nested and flat formats
  const uptime = computed(() => {
    if (!stats.value) return '—'
    // Flat format from Go API
    if (stats.value.uptime_human) return stats.value.uptime_human
    // Calculate from uptime_seconds if available
    if (stats.value.uptime_seconds) {
      const secs = stats.value.uptime_seconds
      const days = Math.floor(secs / 86400)
      const hours = Math.floor((secs % 86400) / 3600)
      const mins = Math.floor((secs % 3600) / 60)
      if (days > 0) return `${days}d ${hours}h`
      if (hours > 0) return `${hours}h ${mins}m`
      return `${mins}m`
    }
    return '—'
  })
  
  // CPU - handle both flat (cpu_percent) and nested (cpu.percent) formats
  const cpuUsage = computed(() => {
    if (!stats.value) return 0
    // Flat format from Go API
    if (stats.value.cpu_percent !== undefined) {
      return Math.round(stats.value.cpu_percent)
    }
    // Nested format
    if (stats.value.cpu?.percent !== undefined) {
      return Math.round(stats.value.cpu.percent)
    }
    if (stats.value.cpu?.usage_percent !== undefined) {
      return Math.round(stats.value.cpu.usage_percent)
    }
    return 0
  })
  
  // Memory - handle both flat and nested formats
  const memoryUsage = computed(() => {
    if (!stats.value) return 0
    // Flat format from Go API
    if (stats.value.memory_percent !== undefined) {
      return Math.round(stats.value.memory_percent)
    }
    // Nested format
    const mem = stats.value.memory
    if (mem?.percent !== undefined) return Math.round(mem.percent)
    if (mem?.used && mem?.total && mem.total > 0) {
      return Math.round((mem.used / mem.total) * 100)
    }
    return 0
  })
  
  // Temperature - handle both flat and nested formats
  const temperature = computed(() => {
    if (!stats.value) return null
    // Flat format from Go API
    if (stats.value.temperature_cpu !== undefined) {
      return Math.round(stats.value.temperature_cpu)
    }
    // Nested format
    const temp = stats.value.temperature
    if (temp?.current !== undefined) return Math.round(temp.current)
    if (temp?.cpu_temp_c !== undefined) return Math.round(temp.cpu_temp_c)
    return null
  })
  
  // Disk - handle both flat and nested formats
  const diskUsage = computed(() => {
    if (!stats.value) return 0
    // Flat format from Go API
    if (stats.value.disk_percent !== undefined) {
      return Math.round(stats.value.disk_percent)
    }
    // Nested format
    const disk = stats.value.disk
    if (disk?.percent !== undefined) return Math.round(disk.percent)
    if (disk?.used && disk?.total && disk.total > 0) {
      return Math.round((disk.used / disk.total) * 100)
    }
    return 0
  })

  // Formatted values
  const memoryFormatted = computed(() => {
    if (!stats.value) return '—'
    // Flat format
    const total = stats.value.memory_total
    const used = stats.value.memory_used
    if (total && used) {
      const usedGB = (used / 1024 / 1024 / 1024).toFixed(1)
      const totalGB = (total / 1024 / 1024 / 1024).toFixed(1)
      return `${usedGB} / ${totalGB} GB`
    }
    // Nested format
    const mem = stats.value.memory
    if (!mem?.total) return '—'
    const usedVal = mem.used ?? (mem.total - (mem.available ?? 0))
    const usedGB = (usedVal / 1024 / 1024 / 1024).toFixed(1)
    const totalGB = (mem.total / 1024 / 1024 / 1024).toFixed(1)
    return `${usedGB} / ${totalGB} GB`
  })

  const diskFormatted = computed(() => {
    if (!stats.value) return '—'
    // Flat format
    const total = stats.value.disk_total
    const used = stats.value.disk_used
    if (total && used) {
      const usedGB = (used / 1024 / 1024 / 1024).toFixed(0)
      const totalGB = (total / 1024 / 1024 / 1024).toFixed(0)
      return `${usedGB} / ${totalGB} GB`
    }
    // Nested format
    const disk = stats.value.disk
    if (!disk?.total) return '—'
    const usedGB = (disk.used / 1024 / 1024 / 1024).toFixed(0)
    const totalGB = (disk.total / 1024 / 1024 / 1024).toFixed(0)
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
