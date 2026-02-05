/**
 * CubeOS Services Store
 *
 * Sprint 5: Docker-level service abstraction.
 * Complements apps.js (CubeOS app layer) with container/Swarm-level detail
 * that the /apps endpoint doesn't expose.
 *
 * API Endpoints:
 *   GET    /services              - List Docker services
 *   GET    /services/{name}       - Get service detail (container ID, image, labels, etc.)
 *   POST   /services/{name}/start   - Start a Docker service
 *   POST   /services/{name}/stop    - Stop a Docker service
 *   POST   /services/{name}/restart - Restart a Docker service
 *
 * Note: enable/disable lives in apps.js — no duplication here.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useServicesStore = defineStore('services', () => {
  // ==========================================
  // State
  // ==========================================

  const dockerServices = ref([])
  const selectedService = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // ==========================================
  // Computed
  // ==========================================

  const serviceCount = computed(() => dockerServices.value.length)

  const runningServices = computed(() =>
    dockerServices.value.filter(s =>
      s.status === 'running' || s.state === 'running'
    )
  )

  const runningCount = computed(() => runningServices.value.length)

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch all Docker services
   * GET /services
   */
  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/services')
      dockerServices.value = response.services || response || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch Docker services:', e)
      dockerServices.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single Docker service detail
   * GET /services/{name}
   *
   * Returns container-level info: container ID, image, created date,
   * Docker labels, resource limits, networks, volumes, etc.
   *
   * @param {string} name - Service name
   */
  async function fetchService(name) {
    error.value = null
    try {
      const response = await api.get(`/services/${encodeURIComponent(name)}`)
      selectedService.value = response
      return response
    } catch (e) {
      error.value = e.message
      console.error(`Failed to fetch service ${name}:`, e)
      return null
    }
  }

  /**
   * Start a Docker service
   * POST /services/{name}/start
   *
   * @param {string} name - Service name
   */
  async function startService(name) {
    error.value = null
    try {
      await api.post(`/services/${encodeURIComponent(name)}/start`)
      await fetchAll()
    } catch (e) {
      error.value = e.message
      console.error(`Failed to start service ${name}:`, e)
      throw e
    }
  }

  /**
   * Stop a Docker service
   * POST /services/{name}/stop
   *
   * @param {string} name - Service name
   */
  async function stopService(name) {
    error.value = null
    try {
      await api.post(`/services/${encodeURIComponent(name)}/stop`)
      await fetchAll()
    } catch (e) {
      error.value = e.message
      console.error(`Failed to stop service ${name}:`, e)
      throw e
    }
  }

  /**
   * Restart a Docker service
   * POST /services/{name}/restart
   *
   * @param {string} name - Service name
   */
  async function restartService(name) {
    error.value = null
    try {
      await api.post(`/services/${encodeURIComponent(name)}/restart`)
      await fetchAll()
    } catch (e) {
      error.value = e.message
      console.error(`Failed to restart service ${name}:`, e)
      throw e
    }
  }

  /**
   * Clear selected service (e.g., when navigating away)
   */
  function clearSelected() {
    selectedService.value = null
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State
    dockerServices,
    selectedService,
    loading,
    error,

    // Computed
    serviceCount,
    runningServices,
    runningCount,

    // Actions
    fetchAll,
    fetchService,
    startService,
    stopService,
    restartService,
    clearSelected
  }
})
