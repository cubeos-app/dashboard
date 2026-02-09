/**
 * CubeOS SMB Store
 *
 * Sprint 3: Dedicated store for SMB file sharing management.
 * Previously SMB endpoints may have lived inline in StorageView or
 * scattered across stores — this consolidates them.
 *
 * Existing endpoints:
 *   - fetchStatus()       → GET /smb/status
 *   - fetchShares()       → GET /smb/shares
 *   - createShare(config) → POST /smb/shares
 *   - updateShare(name, c)→ PUT /smb/shares/{name}
 *   - deleteShare(name)   → DELETE /smb/shares/{name}
 *
 * Sprint 3 adds: share detail (1 new endpoint).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useSMBStore = defineStore('smb', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const status = ref(null)
  const shares = ref([])
  const selectedShare = ref(null)     // Sprint 3: share detail

  // ==========================================
  // Computed
  // ==========================================

  const isRunning = computed(() => status.value?.running === true || status.value?.status === 'running')
  const shareCount = computed(() => shares.value.length)

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch SMB service status
   * GET /smb/status
   */
  async function fetchStatus() {
    try {
      status.value = await api.get('/smb/status')
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch SMB status:', e)
      status.value = { running: false, error: e.message }
    }
  }

  /**
   * Fetch all SMB shares
   * GET /smb/shares
   */
  async function fetchShares() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/smb/shares')
      const data = response.shares ?? response
      shares.value = Array.isArray(data) ? data : []
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error('Failed to fetch SMB shares:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get detailed info for a single share
   * GET /smb/shares/{name}
   * Sprint 3 addition
   */
  async function fetchShareDetail(name) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      selectedShare.value = await api.get(`/smb/shares/${encoded}`)
      return selectedShare.value
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error(`Failed to fetch share detail for ${name}:`, e)
      return null
    }
  }

  /**
   * Create a new SMB share
   * POST /smb/shares
   */
  async function createShare(config) {
    error.value = null
    try {
      const result = await api.post('/smb/shares', config)
      await fetchShares()
      return result
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error('Failed to create SMB share:', e)
      throw e
    }
  }

  /**
   * Update an existing SMB share
   * PUT /smb/shares/{name}
   */
  async function updateShare(name, config) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      const result = await api.put(`/smb/shares/${encoded}`, config)
      await fetchShares()
      return result
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error(`Failed to update SMB share ${name}:`, e)
      throw e
    }
  }

  /**
   * Delete an SMB share
   * DELETE /smb/shares/{name}
   */
  async function deleteShare(name) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      await api.delete(`/smb/shares/${encoded}`)
      shares.value = shares.value.filter(s => s.name !== name)
      // Clear selected if we just deleted it
      if (selectedShare.value?.name === name) {
        selectedShare.value = null
      }
    } catch (e) {
      error.value = e.message
      if (import.meta.env.DEV) console.error(`Failed to delete SMB share ${name}:`, e)
      throw e
    }
  }

  /**
   * Fetch all SMB data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([fetchStatus(), fetchShares()])
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear selected share (e.g., when closing detail panel)
   */
  function clearSelectedShare() {
    selectedShare.value = null
  }

  return {
    // State
    loading,
    error,
    status,
    shares,
    selectedShare,

    // Computed
    isRunning,
    shareCount,

    // Actions
    fetchStatus,
    fetchShares,
    fetchShareDetail,
    createShare,
    updateShare,
    deleteShare,
    fetchAll,
    clearSelectedShare
  }
})
