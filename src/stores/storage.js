/**
 * CubeOS Storage Store — Sprint 3 Additions
 *
 * ADD these state refs, methods, and return values to the existing
 * src/stores/storage.js (or wherever storage overview/health lives).
 *
 * The existing store already has:
 *   - fetchOverview()      → GET /storage
 *   - fetchHealth()        → GET /storage/health
 *
 * Sprint 3 adds: per-device health, storage mounts CRUD (4 new endpoints).
 *
 * INSTRUCTIONS: Merge these additions into your existing storage store.
 * The file below is a COMPLETE standalone store for reference — if your
 * existing storage.js is minimal, you can replace it entirely.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useStorageStore = defineStore('storage', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  // Existing state
  const overview = ref(null)
  const health = ref(null)

  // Sprint 3 additions
  const deviceHealth = ref(null)     // Single device health detail
  const mounts = ref([])             // Storage mounts list
  const mountsLoading = ref(false)

  // ==========================================
  // Computed
  // ==========================================

  const mountCount = computed(() => mounts.value.length)
  const activeMounts = computed(() => mounts.value.filter(m => m.active || m.mounted))

  // ==========================================
  // Existing Methods (preserved)
  // ==========================================

  /**
   * Fetch storage overview
   * GET /storage
   */
  async function fetchOverview(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const data = await api.get('/storage', {}, options)
      if (data === null) return
      overview.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch overall disk health
   * GET /storage/health
   */
  async function fetchHealth(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    try {
      const data = await api.get('/storage/health', {}, options)
      if (data === null) return
      health.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      // Health fetch failure is non-fatal
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  // ==========================================
  // Sprint 3 Additions
  // ==========================================

  /**
   * Fetch health data for a specific device
   * GET /storage/health/{device}
   */
  async function fetchDeviceHealth(device) {
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      deviceHealth.value = await api.get(`/storage/health/${encoded}`)
      return deviceHealth.value
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch storage mounts
   * GET /mounts
   */
  async function fetchMounts(skipLoading = false, options = {}) {
    if (!skipLoading) mountsLoading.value = true
    error.value = null
    try {
      const response = await api.get('/mounts', {}, options)
      if (response === null) return
      const data = response.mounts ?? response
      mounts.value = Array.isArray(data) ? data : []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    } finally {
      if (!skipLoading) mountsLoading.value = false
    }
  }

  /**
   * Add a new mount
   * POST /mounts
   */
  async function addMount(config) {
    error.value = null
    try {
      const result = await api.post('/mounts', config)
      await fetchMounts()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Remove a mount
   * DELETE /mounts/{id}
   */
  async function deleteMount(id) {
    error.value = null
    try {
      await api.delete(`/mounts/${id}`)
      mounts.value = mounts.value.filter(m => m.id !== id)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch all storage data in parallel
   */
  async function fetchAll(options = {}) {
    loading.value = true
    try {
      await Promise.all([
        fetchOverview(true, options),
        fetchHealth(true, options),
        fetchMounts(true, options)
      ])
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,
    overview,
    health,
    deviceHealth,
    mounts,
    mountsLoading,

    // Computed
    mountCount,
    activeMounts,

    // Actions
    fetchOverview,
    fetchHealth,
    fetchDeviceHealth,
    fetchMounts,
    addMount,
    deleteMount,
    fetchAll
  }
})
