/**
 * CubeOS Updates Store
 *
 * Manages system update state: version checking, applying updates, history.
 *
 * Endpoints:
 *   - GET  /system/updates        — check for available updates
 *   - POST /system/updates/apply  — apply an update (async workflow)
 *   - GET  /system/updates/history — list past update attempts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useUpdatesStore = defineStore('updates', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const checking = ref(false)
  const applying = ref(false)
  const error = ref(null)

  const currentVersion = ref('')
  const latestVersion = ref('')
  const updateAvailable = ref(false)
  const release = ref(null)
  const lastChecked = ref('')
  const channel = ref('alpha')

  const history = ref([])
  const activeWorkflowId = ref(null)

  // ==========================================
  // Computed
  // ==========================================

  const hasUpdate = computed(() => updateAvailable.value)
  const hasBreakingChanges = computed(() => release.value?.breaking?.length > 0)

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Check for available system updates
   * GET /system/updates
   */
  async function checkForUpdates() {
    checking.value = true
    error.value = null
    try {
      const data = await api.get('/system/updates')
      if (!data) return
      currentVersion.value = data.current_version || ''
      latestVersion.value = data.latest_version || ''
      updateAvailable.value = data.update_available || false
      release.value = data.release || null
      lastChecked.value = data.last_checked || ''
      channel.value = data.channel || 'alpha'
    } catch (e) {
      error.value = e.message
    } finally {
      checking.value = false
    }
  }

  /**
   * Apply a system update
   * POST /system/updates/apply → 202 { workflow_id }
   */
  async function applyUpdate(version, force = false) {
    applying.value = true
    error.value = null
    try {
      const data = await api.post('/system/updates/apply', { version, force })
      if (data?.workflow_id) {
        activeWorkflowId.value = data.workflow_id
      }
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      applying.value = false
    }
  }

  /**
   * Fetch update history
   * GET /system/updates/history
   */
  async function fetchHistory() {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/system/updates/history')
      history.value = Array.isArray(data) ? data : (data?.history || [])
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    loading.value = false
    checking.value = false
    applying.value = false
    error.value = null
    currentVersion.value = ''
    latestVersion.value = ''
    updateAvailable.value = false
    release.value = null
    lastChecked.value = ''
    channel.value = 'alpha'
    history.value = []
    activeWorkflowId.value = null
  }

  return {
    // State
    loading,
    checking,
    applying,
    error,
    currentVersion,
    latestVersion,
    updateAvailable,
    release,
    lastChecked,
    channel,
    history,
    activeWorkflowId,

    // Computed
    hasUpdate,
    hasBreakingChanges,

    // Actions
    checkForUpdates,
    applyUpdate,
    fetchHistory,
    reset
  }
})
