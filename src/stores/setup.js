/**
 * CubeOS Setup Store
 *
 * Sprint 6: Manages setup wizard state, first-boot detection, and wizard API calls.
 * Consolidates inline api.get/post calls from SetupWizard.vue and the raw fetch()
 * in router/index.js into a proper Pinia store.
 *
 * API Endpoints used:
 * - GET  /setup/status           - Check setup completion status (NEW — was raw fetch in router)
 * - POST /setup/reset            - Reset setup to trigger first-boot wizard again (NEW)
 * - GET  /wizard/profiles        - Fetch wizard profile options (consolidation from inline)
 * - GET  /wizard/services        - Fetch available services by category (consolidation from inline)
 * - POST /wizard/apply           - Apply wizard configuration (consolidation from inline)
 * - POST /wizard/estimate        - Get resource estimate for selected services (NEW)
 * - GET  /wizard/recommendations - Get service recommendations based on RAM (NEW)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'

export const useSetupStore = defineStore('setup', () => {
  // ==========================================
  // State
  // ==========================================

  /** Setup status from GET /setup/status — null means not yet fetched */
  const status = ref(null)

  /** Wizard profile options from GET /wizard/profiles */
  const profiles = ref([])

  /** Available services by category from GET /wizard/services */
  const services = ref([])

  /** Resource estimate from POST /wizard/estimate */
  const estimate = ref(null)

  /** Service recommendations from GET /wizard/recommendations */
  const recommendations = ref(null)

  const loading = ref(false)
  const error = ref(null)

  // ==========================================
  // Computed
  // ==========================================

  /** Whether setup/first-boot is complete */
  const isComplete = computed(() => status.value?.is_complete === true)

  /** Current step index (from status response, if available) */
  const currentStep = computed(() => status.value?.current_step ?? 0)

  /** Total steps in the wizard */
  const totalSteps = computed(() => status.value?.total_steps ?? 0)

  /** Progress percentage (0–100) */
  const progress = computed(() => {
    if (!totalSteps.value) return 0
    return Math.round((currentStep.value / totalSteps.value) * 100)
  })

  // ==========================================
  // Actions — Setup Status
  // ==========================================

  /**
   * Fetch setup status
   * GET /setup/status
   *
   * Dual-purpose: stores in state AND returns data directly for router guard
   * compatibility. The router guard needs the return value before the component
   * tree mounts.
   *
   * @returns {Object|null} Status data, or null on error
   */
  async function fetchStatus() {
    // If already fetched, return cached status
    if (status.value !== null) return status.value

    try {
      const data = await api.get('/setup/status')
      status.value = data
      return data
    } catch (e) {
      // If endpoint not found (404), assume setup is complete (backward compat)
      if (e.message?.includes('404') || e.message?.includes('not found')) {
        status.value = { is_complete: true }
        return status.value
      }
      // On any other error, assume complete to avoid blocking access
      error.value = e.message
      status.value = { is_complete: true }
      return status.value
    }
  }

  /**
   * Reset setup to trigger first-boot wizard again
   * POST /setup/reset
   * Requires user confirmation (danger variant — most destructive action in Sprint 6)
   *
   * @returns {boolean} true if reset succeeded
   */
  async function resetSetup() {
    if (!await confirm({
      title: 'Reset Setup',
      message: 'This will reset the system to first-boot state. All configuration will be cleared and the setup wizard will run again on next access. This action cannot be undone.',
      confirmText: 'Reset Setup',
      variant: 'danger'
    })) return false

    loading.value = true
    error.value = null

    try {
      await api.post('/setup/reset')
      // Clear cached status so the router guard will re-check
      status.value = null
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // ==========================================
  // Actions — Wizard Data
  // ==========================================

  /**
   * Fetch wizard profile options
   * GET /wizard/profiles
   * Consolidation: was inline in SetupWizard.vue line ~92
   */
  async function fetchProfiles() {
    loading.value = true
    error.value = null

    try {
      const data = await api.get('/wizard/profiles')
      profiles.value = data.profiles || data || []
      return profiles.value
    } catch (e) {
      error.value = e.message
      profiles.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch available services grouped by category
   * GET /wizard/services
   * Consolidation: was inline in SetupWizard.vue line ~101
   */
  async function fetchServices() {
    loading.value = true
    error.value = null

    try {
      const data = await api.get('/wizard/services')
      services.value = data.categories || data || []
      return services.value
    } catch (e) {
      error.value = e.message
      services.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Apply wizard configuration
   * POST /wizard/apply
   * Consolidation: was inline in SetupWizard.vue line ~174
   *
   * @param {Object} config - Wizard configuration to apply
   * @param {string} config.profile - Selected profile name
   * @param {string[]} [config.additional_services] - Services to add beyond profile
   * @param {string[]} [config.excluded_services] - Profile services to exclude
   * @returns {Object|null} API response or null on error
   */
  async function applyWizard(config) {
    loading.value = true
    error.value = null

    try {
      const data = await api.post('/wizard/apply', config)
      return data
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch resource estimate for selected services
   * POST /wizard/estimate
   * NEW endpoint — sends list of service names, gets back CPU/memory/disk estimates
   *
   * @param {string[]} serviceList - Array of service names to estimate
   * @returns {Object|null} Estimate data { cpu, memory_mb, disk_mb } or null
   */
  async function fetchEstimate(serviceList) {
    // Don't set loading — this is a non-blocking background call
    try {
      const data = await api.post('/wizard/estimate', { services: serviceList })
      estimate.value = data
      return data
    } catch (e) {
      // Non-blocking: failure doesn't prevent wizard progression
      estimate.value = null
      return null
    }
  }

  /**
   * Fetch service recommendations based on available RAM
   * GET /wizard/recommendations
   * NEW endpoint — returns recommended/not-recommended service lists
   *
   * @param {number} [availableRamMb] - Available RAM in MB (optional, server auto-detects if omitted)
   * @returns {Object|null} Recommendations data or null
   */
  async function fetchRecommendations(availableRamMb) {
    try {
      const params = {}
      if (availableRamMb !== undefined && availableRamMb !== null) {
        params.available_ram_mb = availableRamMb
      }
      const data = await api.get('/wizard/recommendations', params)
      recommendations.value = data
      return data
    } catch (e) {
      // Non-blocking: failure shouldn't break the wizard
      recommendations.value = null
      return null
    }
  }

  /**
   * Mark setup as complete
   * POST /setup/complete
   * Replaces the pattern of using preferencesStore.savePreferences({ setup_complete: true })
   * which couples setup completion to user preferences.
   *
   * Falls back to preferences store if dedicated endpoint not available.
   *
   * @returns {boolean} true if marked complete
   */
  async function markComplete() {
    try {
      await api.post('/setup/complete')
      status.value = { is_complete: true }
      return true
    } catch (e) {
      // Fallback to preferences if /setup/complete fails for any reason
      try {
        const { usePreferencesStore } = await import('@/stores/preferences')
        const preferencesStore = usePreferencesStore()
        await preferencesStore.savePreferences({ setup_complete: true })
        status.value = { is_complete: true }
        return true
      } catch (fallbackErr) {
        error.value = fallbackErr.message
        return false
      }
    }
  }

  /**
   * Clear cached status — called after setup completes or resets.
   * Replaces the old invalidateSetupCache() in router/index.js.
   */
  function clearStatus() {
    status.value = null
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State
    status,
    profiles,
    services,
    estimate,
    recommendations,
    loading,
    error,

    // Computed
    isComplete,
    currentStep,
    totalSteps,
    progress,

    // Actions — Setup
    fetchStatus,
    resetSetup,
    markComplete,
    clearStatus,

    // Actions — Wizard
    fetchProfiles,
    fetchServices,
    applyWizard,
    fetchEstimate,
    fetchRecommendations
  }
})
