/**
 * CubeOS Favorites Store
 *
 * Sprint 4: Server-side favorites replacing localStorage.
 * Favorites are synced to the API so they persist across devices and browsers.
 * Uses optimistic updates — toggles locally first, then confirms with API.
 *
 * API Endpoints:
 *   - GET    /favorites              - List all favorites
 *   - POST   /favorites/{name}       - Add a favorite
 *   - DELETE  /favorites/{name}       - Remove a favorite
 *   - POST   /favorites/{name}/toggle - Toggle favorite state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useFavoritesStore = defineStore('favorites', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)
  const favorites = ref([])

  // Track in-flight toggles to prevent double-clicks
  const pendingToggles = ref(new Set())

  // ==========================================
  // Computed
  // ==========================================

  const count = computed(() => favorites.value.length)

  /**
   * Set of favorite names for O(1) lookups.
   * Handles both string arrays and object arrays.
   */
  const favoriteSet = computed(() => {
    const set = new Set()
    for (const f of favorites.value) {
      const name = typeof f === 'string' ? f : f.name
      if (name) set.add(name)
    }
    return set
  })

  // ==========================================
  // Getters
  // ==========================================

  /**
   * Check if a service name is in favorites
   * @param {string} name - Service/app name
   * @returns {boolean}
   */
  function isFavorite(name) {
    return favoriteSet.value.has(name)
  }

  /**
   * Get the list of favorite names as plain strings
   * @returns {string[]}
   */
  function favoriteNames() {
    return Array.from(favoriteSet.value)
  }

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Fetch all favorites from the API
   * GET /favorites
   */
  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/favorites')
      favorites.value = response.favorites || response || []
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch favorites:', e)
      // Keep whatever we have locally if fetch fails
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a service to favorites
   * POST /favorites/{name}
   *
   * @param {string} name - Service/app name to add
   */
  async function addFavorite(name) {
    if (isFavorite(name)) return

    // Optimistic update
    favorites.value = [...favorites.value, name]
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      await api.post(`/favorites/${encoded}`)
    } catch (e) {
      // Rollback on failure
      favorites.value = favorites.value.filter(f => {
        const n = typeof f === 'string' ? f : f.name
        return n !== name
      })
      error.value = e.message
      console.error(`Failed to add favorite "${name}":`, e)
    }
  }

  /**
   * Remove a service from favorites
   * DELETE /favorites/{name}
   *
   * @param {string} name - Service/app name to remove
   */
  async function removeFavorite(name) {
    if (!isFavorite(name)) return

    // Save for rollback
    const previous = [...favorites.value]

    // Optimistic update
    favorites.value = favorites.value.filter(f => {
      const n = typeof f === 'string' ? f : f.name
      return n !== name
    })
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      await api.delete(`/favorites/${encoded}`)
    } catch (e) {
      // Rollback on failure
      favorites.value = previous
      error.value = e.message
      console.error(`Failed to remove favorite "${name}":`, e)
    }
  }

  /**
   * Toggle favorite state for a service.
   * Preferred method — uses server-side toggle endpoint.
   * Prevents double-click with pending set.
   *
   * POST /favorites/{name}/toggle
   *
   * @param {string} name - Service/app name to toggle
   */
  async function toggleFavorite(name) {
    // Guard against double-clicks
    if (pendingToggles.value.has(name)) return
    pendingToggles.value.add(name)

    // Save for rollback
    const wasFavorite = isFavorite(name)
    const previous = [...favorites.value]

    // Optimistic update
    if (wasFavorite) {
      favorites.value = favorites.value.filter(f => {
        const n = typeof f === 'string' ? f : f.name
        return n !== name
      })
    } else {
      favorites.value = [...favorites.value, name]
    }

    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      const result = await api.post(`/favorites/${encoded}/toggle`)
      // If server returns the full list, use it as source of truth
      if (result.favorites) {
        favorites.value = result.favorites
      }
    } catch (e) {
      // Rollback on failure
      favorites.value = previous
      error.value = e.message
      console.error(`Failed to toggle favorite "${name}":`, e)
    } finally {
      pendingToggles.value.delete(name)
    }
  }

  return {
    // State
    loading,
    error,
    favorites,

    // Computed
    count,
    favoriteSet,

    // Getters
    isFavorite,
    favoriteNames,

    // Actions
    fetchAll,
    addFavorite,
    removeFavorite,
    toggleFavorite
  }
})
