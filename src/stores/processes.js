/**
 * CubeOS Processes Store
 *
 * Sprint 4: System process management — list, search, inspect, kill/terminate.
 *
 * API Endpoints:
 *   - GET  /processes               - List all processes
 *   - GET  /processes/stats         - Process summary stats
 *   - GET  /processes/top/cpu       - Top CPU consumers
 *   - GET  /processes/top/memory    - Top memory consumers
 *   - GET  /processes/search/{name} - Search processes by name
 *   - GET  /processes/{pid}         - Process details
 *   - POST /processes/{pid}/kill    - Kill process (SIGKILL)
 *   - POST /processes/{pid}/terminate - Terminate process (SIGTERM)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'

export const useProcessesStore = defineStore('processes', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const processes = ref([])
  const processStats = ref(null)
  const topCpu = ref([])
  const topMemory = ref([])
  const searchResults = ref([])
  const selectedProcess = ref(null)
  const searchQuery = ref('')

  // Per-action loading states
  const killing = ref(false)
  const terminating = ref(false)

  // ==========================================
  // Computed
  // ==========================================

  const totalCount = computed(() => processStats.value?.total ?? processes.value.length)
  const runningCount = computed(() => processStats.value?.running ?? 0)
  const sleepingCount = computed(() => processStats.value?.sleeping ?? 0)
  const zombieCount = computed(() => processStats.value?.zombie ?? 0)

  const hasSelected = computed(() => selectedProcess.value !== null)

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch all processes
   * GET /processes
   */
  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/processes')
      processes.value = response.processes || response || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch processes:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch process summary stats
   * GET /processes/stats
   */
  async function fetchStats() {
    try {
      processStats.value = await api.get('/processes/stats')
    } catch (e) {
      console.error('Failed to fetch process stats:', e)
    }
  }

  /**
   * Fetch top CPU-consuming processes
   * GET /processes/top/cpu?limit=10
   *
   * @param {number} [limit=10] - Number of top processes to return
   */
  async function fetchTopCpu(limit = 10) {
    try {
      const response = await api.get('/processes/top/cpu', { limit })
      topCpu.value = response.processes || response || []
    } catch (e) {
      console.error('Failed to fetch top CPU processes:', e)
      topCpu.value = []
    }
  }

  /**
   * Fetch top memory-consuming processes
   * GET /processes/top/memory?limit=10
   *
   * @param {number} [limit=10] - Number of top processes to return
   */
  async function fetchTopMemory(limit = 10) {
    try {
      const response = await api.get('/processes/top/memory', { limit })
      topMemory.value = response.processes || response || []
    } catch (e) {
      console.error('Failed to fetch top memory processes:', e)
      topMemory.value = []
    }
  }

  /**
   * Search processes by name
   * GET /processes/search/{name}
   *
   * @param {string} name - Process name to search for
   */
  async function searchProcesses(name) {
    if (!name || !name.trim()) {
      searchResults.value = []
      searchQuery.value = ''
      return
    }
    error.value = null
    try {
      const encoded = encodeURIComponent(name.trim())
      const response = await api.get(`/processes/search/${encoded}`)
      searchResults.value = response.processes || response || []
      searchQuery.value = name.trim()
    } catch (e) {
      error.value = e.message
      console.error(`Failed to search processes for "${name}":`, e)
      searchResults.value = []
    }
  }

  /**
   * Fetch details for a specific process
   * GET /processes/{pid}
   *
   * @param {number} pid - Process ID
   */
  async function fetchProcess(pid) {
    error.value = null
    try {
      selectedProcess.value = await api.get(`/processes/${pid}`)
      return selectedProcess.value
    } catch (e) {
      error.value = e.message
      console.error(`Failed to fetch process ${pid}:`, e)
      selectedProcess.value = null
      return null
    }
  }

  /**
   * Kill a process (SIGKILL — immediate, forceful)
   * POST /processes/{pid}/kill
   *
   * @param {number} pid - Process ID
   * @param {string} [name] - Process name for confirm dialog
   */
  async function killProcess(pid, name) {
    const label = name ? `${name} (PID ${pid})` : `PID ${pid}`
    const confirmed = await confirm({
      title: 'Kill Process',
      message: `Force kill ${label}? This will immediately terminate the process without cleanup. Data loss may occur.`,
      confirmText: 'Kill',
      confirmClass: 'danger'
    })
    if (!confirmed) return false

    killing.value = true
    error.value = null
    try {
      await api.post(`/processes/${pid}/kill`)
      // Remove from local state
      processes.value = processes.value.filter(p => p.pid !== pid)
      searchResults.value = searchResults.value.filter(p => p.pid !== pid)
      topCpu.value = topCpu.value.filter(p => p.pid !== pid)
      topMemory.value = topMemory.value.filter(p => p.pid !== pid)
      if (selectedProcess.value?.pid === pid) {
        selectedProcess.value = null
      }
      return true
    } catch (e) {
      error.value = e.message
      console.error(`Failed to kill process ${pid}:`, e)
      throw e
    } finally {
      killing.value = false
    }
  }

  /**
   * Terminate a process (SIGTERM — graceful shutdown)
   * POST /processes/{pid}/terminate
   *
   * @param {number} pid - Process ID
   * @param {string} [name] - Process name for confirm dialog
   */
  async function terminateProcess(pid, name) {
    const label = name ? `${name} (PID ${pid})` : `PID ${pid}`
    const confirmed = await confirm({
      title: 'Terminate Process',
      message: `Gracefully terminate ${label}? The process will be asked to shut down cleanly.`,
      confirmText: 'Terminate',
      confirmClass: 'warning'
    })
    if (!confirmed) return false

    terminating.value = true
    error.value = null
    try {
      await api.post(`/processes/${pid}/terminate`)
      // Remove from local state optimistically
      processes.value = processes.value.filter(p => p.pid !== pid)
      searchResults.value = searchResults.value.filter(p => p.pid !== pid)
      if (selectedProcess.value?.pid === pid) {
        selectedProcess.value = null
      }
      return true
    } catch (e) {
      error.value = e.message
      console.error(`Failed to terminate process ${pid}:`, e)
      throw e
    } finally {
      terminating.value = false
    }
  }

  /**
   * Clear selected process
   */
  function clearSelected() {
    selectedProcess.value = null
  }

  /**
   * Clear search state
   */
  function clearSearch() {
    searchResults.value = []
    searchQuery.value = ''
  }

  /**
   * Load initial data — processes + stats + top consumers
   */
  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchAll(),
        fetchStats(),
        fetchTopCpu(),
        fetchTopMemory()
      ])
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    error,
    processes,
    processStats,
    topCpu,
    topMemory,
    searchResults,
    selectedProcess,
    searchQuery,
    killing,
    terminating,

    // Computed
    totalCount,
    runningCount,
    sleepingCount,
    zombieCount,
    hasSelected,

    // Actions
    fetchAll,
    fetchStats,
    fetchTopCpu,
    fetchTopMemory,
    searchProcesses,
    fetchProcess,
    killProcess,
    terminateProcess,
    clearSelected,
    clearSearch,
    loadAll
  }
})
