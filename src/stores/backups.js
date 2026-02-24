/**
 * CubeOS Backups Store — S07
 *
 * Pinia store for backup management. Wires all backup endpoints:
 *   GET    /backups                    — List all backups
 *   POST   /backups                    — Create backup (enhanced: scope, destination, encrypt)
 *   GET    /backups/stats              — Backup statistics
 *   POST   /backups/quick              — Quick one-click backup
 *   GET    /backups/{id}               — Get single backup detail
 *   DELETE /backups/{id}               — Delete a backup
 *   GET    /backups/{id}/download      — Download backup file
 *   POST   /backups/{id}/restore       — Restore from backup
 *   POST   /backups/{id}/verify        — Verify backup integrity
 *   GET    /backups/destinations       — List available destinations
 *   POST   /backups/destinations/test  — Test a destination
 *   GET    /backups/schedules          — List schedules
 *   POST   /backups/schedules          — Create schedule
 *   PUT    /backups/schedules/{id}     — Update schedule
 *   DELETE /backups/schedules/{id}     — Delete schedule
 *   POST   /backups/schedules/{id}/run — Trigger schedule immediately
 *   GET    /backups/restore-status     — Pending restore info
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useBackupsStore = defineStore('backups', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const backups = ref([])
  const totalCount = ref(0)
  const totalSizeBytes = ref(0)
  const stats = ref(null)
  const selectedBackup = ref(null)

  // New state — destinations, schedules, restore status
  const destinations = ref([])
  const schedules = ref([])
  const restoreStatus = ref(null)
  const schedulesLoading = ref(false)
  const destinationsLoading = ref(false)
  const verifyLoading = ref(false)

  // Operation states
  const createLoading = ref(false)
  const restoreLoading = ref(false)
  const deleteLoading = ref(false)

  // ==========================================
  // Computed
  // ==========================================

  const backupCount = computed(() => backups.value.length)

  const lastBackup = computed(() => {
    if (!backups.value.length) return null
    return backups.value.reduce((latest, b) => {
      if (!latest) return b
      return new Date(b.created_at) > new Date(latest.created_at) ? b : latest
    }, null)
  })

  const totalSizeHuman = computed(() => {
    return formatBytes(totalSizeBytes.value)
  })

  // ==========================================
  // Actions
  // ==========================================

  /**
   * List all backups
   * GET /backups
   */
  async function fetchBackups(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/backups')
      backups.value = response.backups ?? []
      totalCount.value = response.total_count ?? backups.value.length
      totalSizeBytes.value = response.total_size_bytes ?? 0
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error('Failed to fetch backups:', e)
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Get backup statistics
   * GET /backups/stats
   */
  async function fetchStats() {
    try {
      stats.value = await api.get('/backups/stats')
      return stats.value
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch backup stats:', e)
      return null
    }
  }

  /**
   * Get single backup detail
   * GET /backups/{id}
   */
  async function fetchBackup(id) {
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      selectedBackup.value = await api.get(`/backups/${encoded}`)
      return selectedBackup.value
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Create a new backup with config
   * POST /backups
   * Enhanced: supports scope, destination, encryption params
   */
  async function createBackup(config = {}) {
    createLoading.value = true
    error.value = null
    try {
      const payload = {
        type: config.type || 'config',
        description: config.description || '',
        include_docker_volumes: config.include_docker_volumes || false,
        compress: config.compress !== false
      }
      // Enhanced params (Batch 4)
      if (config.scope) payload.scope = config.scope
      if (config.destination) payload.destination = config.destination
      if (config.encrypt !== undefined) payload.encrypt = config.encrypt
      if (config.encryption_mode) payload.encryption_mode = config.encryption_mode
      if (config.passphrase) payload.passphrase = config.passphrase

      const result = await api.post('/backups', payload)
      await fetchBackups(true)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      createLoading.value = false
    }
  }

  /**
   * Quick one-click backup (config only, compressed)
   * POST /backups/quick
   */
  async function quickBackup() {
    createLoading.value = true
    error.value = null
    try {
      const result = await api.post('/backups/quick')
      await fetchBackups(true)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      createLoading.value = false
    }
  }

  /**
   * Delete a backup
   * DELETE /backups/{id}
   */
  async function deleteBackup(id) {
    deleteLoading.value = true
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      await api.delete(`/backups/${encoded}`)
      backups.value = backups.value.filter(b => b.id !== id)
      if (selectedBackup.value?.id === id) selectedBackup.value = null
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      deleteLoading.value = false
    }
  }

  /**
   * Restore from a backup
   * POST /backups/{id}/restore
   */
  async function restoreBackup(id) {
    restoreLoading.value = true
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      const result = await api.post(`/backups/${encoded}/restore`)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      restoreLoading.value = false
    }
  }

  /**
   * Get download URL for a backup (for display purposes)
   */
  function getDownloadUrl(id) {
    const encoded = encodeURIComponent(id)
    return `/api/v1/backups/${encoded}/download`
  }

  /**
   * Download a backup file (triggers browser download)
   * GET /backups/{id}/download
   */
  async function downloadBackup(id) {
    try {
      const encoded = encodeURIComponent(id)
      const response = await api.request(`/backups/${encoded}/download`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(err.error || 'Download failed')
      }
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `${id}.tar.gz`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=["']?([^"';\n]*)/)
        if (match && match[1]) filename = match[1]
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e.message
    }
  }

  /**
   * Verify backup integrity
   * POST /backups/{id}/verify
   */
  async function verifyBackup(id) {
    verifyLoading.value = true
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      const result = await api.post(`/backups/${encoded}/verify`)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      verifyLoading.value = false
    }
  }

  /**
   * List available backup destinations
   * GET /backups/destinations
   */
  async function fetchDestinations() {
    destinationsLoading.value = true
    try {
      const response = await api.get('/backups/destinations')
      destinations.value = response.destinations ?? response ?? []
      return destinations.value
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch destinations:', e)
      return []
    } finally {
      destinationsLoading.value = false
    }
  }

  /**
   * Test a backup destination configuration
   * POST /backups/destinations/test
   */
  async function testDestination(config) {
    error.value = null
    try {
      return await api.post('/backups/destinations/test', config)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * List backup schedules
   * GET /backups/schedules
   */
  async function fetchSchedules() {
    schedulesLoading.value = true
    try {
      const response = await api.get('/backups/schedules')
      schedules.value = response.schedules ?? response ?? []
      return schedules.value
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch schedules:', e)
      return []
    } finally {
      schedulesLoading.value = false
    }
  }

  /**
   * Create a backup schedule
   * POST /backups/schedules
   */
  async function createSchedule(schedule) {
    error.value = null
    try {
      const result = await api.post('/backups/schedules', schedule)
      await fetchSchedules()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Update a backup schedule
   * PUT /backups/schedules/{id}
   */
  async function updateSchedule(id, schedule) {
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      const result = await api.put(`/backups/schedules/${encoded}`, schedule)
      await fetchSchedules()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Delete a backup schedule
   * DELETE /backups/schedules/{id}
   */
  async function deleteSchedule(id) {
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      await api.delete(`/backups/schedules/${encoded}`)
      schedules.value = schedules.value.filter(s => s.id !== id)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Trigger a schedule to run immediately
   * POST /backups/schedules/{id}/run
   */
  async function triggerSchedule(id) {
    error.value = null
    try {
      const encoded = encodeURIComponent(id)
      const result = await api.post(`/backups/schedules/${encoded}/run`)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Get pending restore status (bare-metal restore info)
   * GET /backups/restore-status
   */
  async function fetchRestoreStatus() {
    try {
      restoreStatus.value = await api.get('/backups/restore-status')
      return restoreStatus.value
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch restore status:', e)
      return null
    }
  }

  /**
   * Fetch all backup data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([fetchBackups(true), fetchStats()])
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let value = bytes
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024
      i++
    }
    return `${value.toFixed(1)} ${units[i]}`
  }

  function clearSelected() {
    selectedBackup.value = null
  }

  return {
    // State
    loading,
    error,
    backups,
    totalCount,
    totalSizeBytes,
    stats,
    selectedBackup,
    createLoading,
    restoreLoading,
    deleteLoading,
    verifyLoading,
    destinations,
    schedules,
    restoreStatus,
    schedulesLoading,
    destinationsLoading,

    // Computed
    backupCount,
    lastBackup,
    totalSizeHuman,

    // Actions
    fetchBackups,
    fetchStats,
    fetchBackup,
    createBackup,
    quickBackup,
    deleteBackup,
    restoreBackup,
    getDownloadUrl,
    downloadBackup,
    verifyBackup,
    fetchDestinations,
    testDestination,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    fetchRestoreStatus,
    fetchAll,

    // Helpers
    formatBytes,
    clearSelected
  }
})
