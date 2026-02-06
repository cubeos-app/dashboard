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
  async function fetchOverview(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      overview.value = await api.get('/storage')
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch overall disk health
   * GET /storage/health
   */
  async function fetchHealth(skipLoading = false) {
    if (!skipLoading) loading.value = true
    try {
      health.value = await api.get('/storage/health')
    } catch (e) {
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
   * GET /storage/mounts
   */
  async function fetchMounts(skipLoading = false) {
    if (!skipLoading) mountsLoading.value = true
    error.value = null
    try {
      const response = await api.get('/storage/mounts')
      mounts.value = response.mounts || response || []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) mountsLoading.value = false
    }
  }

  /**
   * Add a new mount
   * POST /storage/mounts
   */
  async function addMount(config) {
    error.value = null
    try {
      const result = await api.post('/storage/mounts', config)
      await fetchMounts()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Remove a mount
   * DELETE /storage/mounts/{id}
   */
  async function deleteMount(id) {
    error.value = null
    try {
      await api.delete(`/storage/mounts/${id}`)
      mounts.value = mounts.value.filter(m => m.id !== id)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch all storage data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchOverview(true),
        fetchHealth(true),
        fetchMounts(true)
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
