/**
 * CubeOS NPM (Nginx Proxy Manager) Store
 *
 * Sprint 3: Dedicated store for NPM proxy host management.
 * Previously NPM endpoints lived in appmanager.js or appstore.js.
 *
 * Existing endpoints:
 *   - fetchStatus()  → GET /npm/status
 *   - fetchHosts()   → GET /npm/hosts
 *
 * Sprint 3 adds: create host, delete host (2 new endpoints).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useNPMStore = defineStore('npm', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const status = ref(null)
  const hosts = ref([])

  // ==========================================
  // Computed
  // ==========================================

  const isOnline = computed(() => status.value?.running === true || status.value?.status === 'running')
  const hostCount = computed(() => hosts.value.length)
  const activeHosts = computed(() => hosts.value.filter(h => h.enabled !== false))

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch NPM service status
   * GET /npm/status
   */
  async function fetchStatus() {
    try {
      status.value = await api.get('/npm/status')
    } catch (e) {
      console.error('Failed to fetch NPM status:', e)
      status.value = { running: false, error: e.message }
    }
  }

  /**
   * Fetch all proxy hosts
   * GET /npm/hosts
   */
  async function fetchHosts() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/npm/hosts')
      hosts.value = response.hosts || response || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch NPM hosts:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new proxy host
   * POST /npm/hosts
   * Sprint 3 addition
   */
  async function createHost(config) {
    error.value = null
    try {
      const result = await api.post('/npm/hosts', config)
      await fetchHosts()
      return result
    } catch (e) {
      error.value = e.message
      console.error('Failed to create NPM host:', e)
      throw e
    }
  }

  /**
   * Delete a proxy host
   * DELETE /npm/hosts/{id}
   * Sprint 3 addition
   */
  async function deleteHost(id) {
    error.value = null
    try {
      await api.delete(`/npm/hosts/${id}`)
      hosts.value = hosts.value.filter(h => h.id !== id)
    } catch (e) {
      error.value = e.message
      console.error(`Failed to delete NPM host ${id}:`, e)
      throw e
    }
  }

  /**
   * Fetch all NPM data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([fetchStatus(), fetchHosts()])
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,
    status,
    hosts,

    // Computed
    isOnline,
    hostCount,
    activeHosts,

    // Actions
    fetchStatus,
    fetchHosts,
    createHost,
    deleteHost,
    fetchAll
  }
})
