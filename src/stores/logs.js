/**
 * CubeOS Logs Store
 *
 * Sprint 7: Centralized log data layer.
 * Replaces inline api.get() calls in LogsView with proper Pinia store.
 * All log parsing/formatting remains in the view — store returns raw entries.
 *
 * API Endpoints:
 *   GET  /logs/units                      - List systemd units (EXISTS)
 *   GET  /logs/journal                    - Journal log entries (EXISTS)
 *   GET  /logs/service/{service}          - Service-specific logs (EXISTS)
 *   GET  /logs/container/{container}      - Container logs (EXISTS)
 *   GET  /logs/kernel                     - Kernel logs (EXISTS)
 *   GET  /logs/boot                       - Boot messages (NEW)
 *   GET  /logs/errors                     - Error log entries (NEW)
 *   GET  /logs/file                       - Read arbitrary log file (NEW)
 *   GET  /hal/logs/hardware               - HAL hardware logs (NEW)
 *   GET  /hal/logs/hardware/{category}    - HAL hardware logs by category (NEW)
 *   GET  /hal/logs/journal                - HAL journal logs (NEW)
 *   GET  /hal/logs/kernel                 - HAL kernel logs (NEW)
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useLogsStore = defineStore('logs', () => {
  // ==========================================
  // State
  // ==========================================

  const entries = ref([])
  const units = ref([])
  const loading = ref(false)
  const error = ref(null)
  const activeSource = ref('system')

  // ==========================================
  // System / Journal
  // ==========================================

  /**
   * Fetch available systemd units
   * GET /logs/units
   */
  async function fetchUnits(options = {}) {
    try {
      const data = await api.get('/logs/units', {}, options)
      if (data === null) return
      units.value = data.units || []
    } catch (e) {
      if (e.name === 'AbortError') return
      units.value = []
    }
  }

  /**
   * Fetch journal log entries
   * GET /logs/journal
   * @param {object} params - { lines, unit, grep, priority }
   */
  async function fetchJournal(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'system'
    try {
      const data = await api.get('/logs/journal', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch service-specific logs
   * GET /logs/service/{service}
   * @param {string} service - Systemd service name
   * @param {object} params - { lines, grep, priority }
   */
  async function fetchServiceLog(service, params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'system'
    try {
      const data = await api.get(`/logs/service/${encodeURIComponent(service)}`, params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch container logs
   * GET /logs/container/{container}
   * @param {string} container - Container name
   * @param {object} params - { lines, grep }
   */
  async function fetchContainerLog(container, params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'container'
    try {
      const data = await api.get(`/logs/container/${encodeURIComponent(container)}`, params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch kernel logs
   * GET /logs/kernel
   * @param {object} params - { lines, grep, priority }
   */
  async function fetchKernel(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'kernel'
    try {
      const data = await api.get('/logs/kernel', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // New Endpoints (Sprint 7)
  // ==========================================

  /**
   * Fetch boot messages
   * GET /logs/boot
   * @param {object} params - { lines, grep }
   */
  async function fetchBoot(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'boot'
    try {
      const data = await api.get('/logs/boot', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch error logs (last N hours)
   * GET /logs/errors
   * @param {object} params - { lines, hours, grep }
   */
  async function fetchErrors(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'errors'
    try {
      const data = await api.get('/logs/errors', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch arbitrary log file contents
   * GET /logs/file
   * @param {string} path - Absolute path to log file (e.g. /var/log/syslog)
   * @param {object} params - { lines, grep }
   */
  async function fetchFile(path, params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'file'
    try {
      const data = await api.get('/logs/file', { path, ...params }, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // HAL Log Endpoints (Sprint 7)
  // ==========================================

  /**
   * Fetch HAL hardware logs
   * GET /hal/logs/hardware
   * @param {object} params - { lines, grep }
   */
  async function fetchHALHardware(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'hal-hardware'
    try {
      const data = await api.get('/hal/logs/hardware', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch HAL hardware logs by category
   * GET /hal/logs/hardware/{category}
   * @param {string} category - Log category (power, network, storage, sensors, etc.)
   * @param {object} params - { lines, grep }
   */
  async function fetchHALCategory(category, params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'hal-hardware'
    try {
      const data = await api.get(`/hal/logs/hardware/${encodeURIComponent(category)}`, params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch HAL journal logs
   * GET /hal/logs/journal
   * @param {object} params - { lines, grep, priority }
   */
  async function fetchHALJournal(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'hal-journal'
    try {
      const data = await api.get('/hal/logs/journal', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch HAL kernel logs
   * GET /hal/logs/kernel
   * @param {object} params - { lines, grep }
   */
  async function fetchHALKernel(params = {}, options = {}) {
    loading.value = true
    error.value = null
    activeSource.value = 'hal-kernel'
    try {
      const data = await api.get('/hal/logs/kernel', params, options)
      if (data === null) return
      entries.value = data.entries || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State
    entries,
    units,
    loading,
    error,
    activeSource,

    // Existing endpoints
    fetchUnits,
    fetchJournal,
    fetchServiceLog,
    fetchContainerLog,
    fetchKernel,

    // New endpoints (Sprint 7)
    fetchBoot,
    fetchErrors,
    fetchFile,
    fetchHALHardware,
    fetchHALCategory,
    fetchHALJournal,
    fetchHALKernel
  }
})
