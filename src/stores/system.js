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
  const cpuUsage = computed(() => stats.value?.cpu?.usage_percent ?? 0)
  const memoryUsage = computed(() => {
    if (!stats.value?.memory) return 0
    const { used, total } = stats.value.memory
    return total > 0 ? Math.round((used / total) * 100) : 0
  })
  const temperature = computed(() => stats.value?.temperature?.current ?? null)
  const diskUsage = computed(() => {
    if (!stats.value?.disk) return 0
    const { used, total } = stats.value.disk
    return total > 0 ? Math.round((used / total) * 100) : 0
  })

  // Formatted values
  const memoryFormatted = computed(() => {
    if (!stats.value?.memory) return '—'
    const { used, total } = stats.value.memory
    const usedGB = (used / 1024 / 1024 / 1024).toFixed(1)
    const totalGB = (total / 1024 / 1024 / 1024).toFixed(1)
    return `${usedGB} / ${totalGB} GB`
  })

  const diskFormatted = computed(() => {
    if (!stats.value?.disk) return '—'
    const { used, total } = stats.value.disk
    const usedGB = (used / 1024 / 1024 / 1024).toFixed(0)
    const totalGB = (total / 1024 / 1024 / 1024).toFixed(0)
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
