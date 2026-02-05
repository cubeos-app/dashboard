/**
 * CubeOS Mounts Store — Sprint 3 Additions
 *
 * The existing mounts.js already has:
 *   - fetchMounts()        → GET /mounts
 *   - addMount(config)     → POST /mounts
 *   - deleteMount(name)    → DELETE /mounts/{name}
 *   - mountShare(name)     → POST /mounts/{name}/mount
 *   - unmountShare(name)   → POST /mounts/{name}/unmount
 *
 * Sprint 3 adds: mount detail, test connection, mount status (3 new endpoints).
 *
 * INSTRUCTIONS: Merge these additions into your existing mounts.js.
 * The file below is a COMPLETE standalone store for reference.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useMountsStore = defineStore('mounts', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)
  const mounts = ref([])

  // Sprint 3 additions
  const selectedMount = ref(null)       // Single mount detail
  const mountStatuses = ref({})         // Per-mount status: { 'myshare': { mounted: true } }
  const testResult = ref(null)          // Connection test result

  // ==========================================
  // Computed
  // ==========================================

  const mountCount = computed(() => mounts.value.length)
  const mountedCount = computed(() =>
    mounts.value.filter(m => mountStatuses.value[m.name]?.mounted).length
  )

  // ==========================================
  // Existing Methods (preserved)
  // ==========================================

  /**
   * List all configured mounts
   * GET /mounts
   */
  async function fetchMounts() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/mounts')
      mounts.value = response.mounts || response || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch mounts:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a new mount configuration
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
      console.error('Failed to add mount:', e)
      throw e
    }
  }

  /**
   * Delete a mount configuration
   * DELETE /mounts/{name}
   */
  async function deleteMount(name) {
    error.value = null
    try {
      await api.delete(`/mounts/${encodeURIComponent(name)}`)
      mounts.value = mounts.value.filter(m => m.name !== name)
    } catch (e) {
      error.value = e.message
      console.error(`Failed to delete mount ${name}:`, e)
      throw e
    }
  }

  /**
   * Mount a configured share
   * POST /mounts/{name}/mount
   */
  async function mountShare(name) {
    error.value = null
    try {
      await api.post(`/mounts/${encodeURIComponent(name)}/mount`)
      await fetchMountStatus(name)
    } catch (e) {
      error.value = e.message
      console.error(`Failed to mount ${name}:`, e)
      throw e
    }
  }

  /**
   * Unmount a share
   * POST /mounts/{name}/unmount
   */
  async function unmountShare(name) {
    error.value = null
    try {
      await api.post(`/mounts/${encodeURIComponent(name)}/unmount`)
      await fetchMountStatus(name)
    } catch (e) {
      error.value = e.message
      console.error(`Failed to unmount ${name}:`, e)
      throw e
    }
  }

  // ==========================================
  // Sprint 3 Additions
  // ==========================================

  /**
   * Get detailed info for a single mount
   * GET /mounts/{name}
   */
  async function fetchMountDetail(name) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      selectedMount.value = await api.get(`/mounts/${encoded}`)
      return selectedMount.value
    } catch (e) {
      error.value = e.message
      console.error(`Failed to fetch mount detail for ${name}:`, e)
      return null
    }
  }

  /**
   * Test connection to a remote share before saving
   * POST /mounts/test
   */
  async function testMountConnection(config) {
    testResult.value = null
    try {
      testResult.value = await api.post('/mounts/test', config)
      return testResult.value
    } catch (e) {
      testResult.value = { success: false, error: e.message }
      console.error('Failed to test mount connection:', e)
      return testResult.value
    }
  }

  /**
   * Get status for a specific mount
   * GET /mounts/{name}/status
   */
  async function fetchMountStatus(name) {
    try {
      const encoded = encodeURIComponent(name)
      const status = await api.get(`/mounts/${encoded}/status`)
      mountStatuses.value = { ...mountStatuses.value, [name]: status }
      return status
    } catch (e) {
      console.error(`Failed to fetch status for mount ${name}:`, e)
      return null
    }
  }

  /**
   * Refresh status for all mounts
   */
  async function fetchAllMountStatuses() {
    const promises = mounts.value.map(m => fetchMountStatus(m.name))
    await Promise.allSettled(promises)
  }

  /**
   * Check if a specific mount is active
   */
  function isMounted(name) {
    return mountStatuses.value[name]?.mounted === true
  }

  /**
   * Clear test result (e.g., when closing modal)
   */
  function clearTestResult() {
    testResult.value = null
  }

  return {
    // State
    loading,
    error,
    mounts,
    selectedMount,
    mountStatuses,
    testResult,

    // Computed
    mountCount,
    mountedCount,

    // Existing Actions
    fetchMounts,
    addMount,
    deleteMount,
    mountShare,
    unmountShare,

    // Sprint 3 Additions
    fetchMountDetail,
    testMountConnection,
    fetchMountStatus,
    fetchAllMountStatuses,
    isMounted,
    clearTestResult
  }
})
