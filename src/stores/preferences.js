/**
 * CubeOS Preferences Store
 *
 * Sprint 6: Manages user preferences (theme, language, dashboard layout, etc.).
 * Consolidates inline api.get/put('/preferences') calls from SetupWizard.vue
 * into a proper Pinia store.
 *
 * API Endpoints used:
 * - GET  /preferences       - Fetch current preferences
 * - PUT  /preferences       - Save/update preferences
 * - POST /preferences/reset - Reset preferences to defaults (NEW)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'

export const usePreferencesStore = defineStore('preferences', () => {
  // ==========================================
  // State
  // ==========================================

  const preferences = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // ==========================================
  // Computed
  // ==========================================

  /** Whether preferences have been loaded at least once */
  const isLoaded = computed(() => preferences.value !== null)

  /** Setup complete flag from preferences (used by wizard/router) */
  const setupComplete = computed(() => preferences.value?.setup_complete ?? false)

  /** Theme preference shortcut */
  const theme = computed(() => preferences.value?.theme ?? 'system')

  /** Language preference shortcut */
  const language = computed(() => preferences.value?.language ?? 'en')

  /** UI mode: 'standard' or 'advanced' (default: advanced for existing users) */
  const uiMode = computed(() => preferences.value?.ui_mode ?? 'advanced')

  /** Whether the UI is in advanced mode */
  const isAdvanced = computed(() => uiMode.value === 'advanced')

  /** Whether the UI is in standard mode */
  const isStandard = computed(() => uiMode.value === 'standard')

  /** Wallpaper preference for Standard mode */
  const wallpaper = computed(() => preferences.value?.wallpaper ?? {
    type: 'preset',
    value: 'topo'
  })

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch current preferences
   * GET /preferences
   */
  async function fetchPreferences() {
    loading.value = true
    error.value = null

    try {
      const data = await api.get('/preferences')
      preferences.value = data
      return data
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Save/update preferences
   * PUT /preferences
   * @param {Object} updates - Partial preferences object to merge
   */
  async function savePreferences(updates) {
    loading.value = true
    error.value = null

    try {
      const data = await api.put('/preferences', updates)
      // Update local state with the response (full preferences) or merge updates
      preferences.value = data?.preferences ?? { ...preferences.value, ...updates }
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset preferences to defaults
   * POST /preferences/reset
   * Requires user confirmation (warning variant — destructive but recoverable)
   */
  async function resetPreferences() {
    if (!await confirm({
      title: 'Reset Preferences',
      message: 'This will reset all preferences to their default values. Your customizations will be lost.',
      confirmText: 'Reset',
      variant: 'warning'
    })) return false

    loading.value = true
    error.value = null

    try {
      const data = await api.post('/preferences/reset')
      // Server returns the new (default) preferences
      preferences.value = data?.preferences ?? data
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Toggle or set UI mode (standard/advanced).
   * Persists via PUT /preferences.
   * @param {'standard'|'advanced'} [mode] - If omitted, toggles current mode
   */
  async function setUiMode(mode) {
    const newMode = mode || (uiMode.value === 'advanced' ? 'standard' : 'advanced')
    return savePreferences({ ui_mode: newMode })
  }

  /**
   * Update wallpaper preference.
   * @param {{ type: 'preset'|'custom'|'none', value: string|null }} wp
   */
  async function setWallpaper(wp) {
    return savePreferences({ wallpaper: wp })
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State
    preferences,
    loading,
    error,

    // Computed
    isLoaded,
    setupComplete,
    theme,
    language,
    uiMode,
    isAdvanced,
    isStandard,
    wallpaper,

    // Actions
    fetchPreferences,
    savePreferences,
    resetPreferences,
    setUiMode,
    setWallpaper
  }
})
