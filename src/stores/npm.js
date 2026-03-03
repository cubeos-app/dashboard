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
  const certificates = ref([])

  // ==========================================
  // Computed
  // ==========================================

  const isOnline = computed(() => {
    const s = status.value
    if (!s || s.error) return false
    if (s.online === true) return true
    if (s.running === true) return true
    const onlineStates = ['running', 'healthy', 'online', 'up']
    const checkField = (val) => val && onlineStates.includes(String(val).toLowerCase())
    return checkField(s.status) || checkField(s.state) || checkField(s.health?.status)
  })
  const hostCount = computed(() => hosts.value.length)
  const activeHosts = computed(() => hosts.value.filter(h => h.enabled !== false))

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch NPM service status
   * GET /npm/status
   */
  async function fetchStatus(skipLoading = false) {
    if (!skipLoading) loading.value = true
    try {
      status.value = await api.get('/npm/status')
    } catch (e) {
      status.value = { running: false, error: e.message }
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch all proxy hosts
   * GET /npm/hosts
   */
  async function fetchHosts(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/npm/hosts')
      const data = response.hosts ?? response
      hosts.value = Array.isArray(data) ? data : []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
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
      await fetchHosts(true)
      return result
    } catch (e) {
      error.value = e.message
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
      throw e
    }
  }

  /**
   * Update an existing proxy host
   * PUT /npm/hosts/{id}
   */
  async function updateHost(id, config) {
    error.value = null
    try {
      const result = await api.put(`/npm/hosts/${id}`, config)
      await fetchHosts(true)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch all certificates
   * GET /npm/certificates
   */
  async function fetchCertificates(skipLoading = false) {
    if (!skipLoading) loading.value = true
    try {
      const response = await api.get('/npm/certificates')
      const data = response.certificates ?? response
      certificates.value = Array.isArray(data) ? data : []
    } catch (e) {
      // Certificates may not be available if NPM is not authenticated
      certificates.value = []
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Delete a certificate
   * DELETE /npm/certificates/{id}
   */
  async function deleteCertificate(id) {
    error.value = null
    try {
      await api.delete(`/npm/certificates/${id}`)
      certificates.value = certificates.value.filter(c => c.id !== id)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch all NPM data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([fetchStatus(true), fetchHosts(true), fetchCertificates(true)])
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
    certificates,

    // Computed
    isOnline,
    hostCount,
    activeHosts,

    // Actions
    fetchStatus,
    fetchHosts,
    createHost,
    updateHost,
    deleteHost,
    fetchCertificates,
    deleteCertificate,
    fetchAll
  }
})
