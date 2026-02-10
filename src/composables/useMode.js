/**
 * CubeOS Mode Composable
 *
 * S01 — Provides reactive access to the UI mode (Standard/Advanced).
 * Every view component uses this to conditionally render content.
 *
 * Usage:
 *   const { isAdvanced, isStandard, toggleMode, mode } = useMode()
 *
 *   <SectionPanel v-if="isAdvanced">...</SectionPanel>
 *   <button @click="toggleMode">Switch mode</button>
 */
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

export function useMode() {
  const preferencesStore = usePreferencesStore()

  /** Current mode string: 'standard' | 'advanced' */
  const mode = computed(() => preferencesStore.uiMode)

  /** Whether UI is in Advanced mode */
  const isAdvanced = computed(() => preferencesStore.isAdvanced)

  /** Whether UI is in Standard mode */
  const isStandard = computed(() => preferencesStore.isStandard)

  /**
   * Toggle between Standard and Advanced mode.
   * Persists the change to the API.
   * @param {'standard'|'advanced'} [forceMode] - Force a specific mode
   * @returns {Promise<boolean>} Success
   */
  async function toggleMode(forceMode) {
    return preferencesStore.setUiMode(forceMode)
  }

  return {
    mode,
    isAdvanced,
    isStandard,
    toggleMode
  }
}
