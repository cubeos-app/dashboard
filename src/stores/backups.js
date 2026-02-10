/**
 * CubeOS Backups Store — S07
 *
 * Pinia store for backup management. Wires all 8 backup endpoints:
 *   GET    /backups           — List all backups
 *   POST   /backups           — Create backup with config
 *   GET    /backups/stats     — Backup statistics
 *   POST   /backups/quick     — Quick one-click backup
 *   GET    /backups/{id}      — Get single backup detail
 *   DELETE /backups/{id}      — Delete a backup
 *   GET    /backups/{id}/download — Download backup file
 *   POST   /backups/{id}/restore  — Restore from backup
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
   */
  async function createBackup(config = {}) {
    createLoading.value = true
    error.value = null
    try {
      const result = await api.post('/backups', {
        type: config.type || 'config',
        description: config.description || '',
        include_docker_volumes: config.include_docker_volumes || false,
        compress: config.compress !== false
      })
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
   * Get download URL for a backup
   * Returns the URL string (actual download handled by browser)
   */
  function getDownloadUrl(id) {
    const encoded = encodeURIComponent(id)
    return api.buildUrl(`/backups/${encoded}/download`)
  }

  /**
   * Download a backup file (triggers browser download)
   * GET /backups/{id}/download
   */
  async function downloadBackup(id) {
    try {
      const encoded = encodeURIComponent(id)
      const url = api.buildUrl(`/backups/${encoded}/download`)
      // Open in new tab / trigger browser download
      window.open(url, '_blank')
    } catch (e) {
      error.value = e.message
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
    fetchAll,

    // Helpers
    formatBytes,
    clearSelected
  }
})
