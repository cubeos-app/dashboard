/**
 * CubeOS Profiles Store
 * 
 * Dedicated profile store used by ProfilesView and SystemView.
 * 
 * NOTE: Profile management also exists in appmanager.js (used by ProfilesTab).
 * The two stores share the same API endpoints but serve different UI components:
 *   - profiles.js  → ProfilesView (main profiles page), SystemView
 *   - appmanager.js → ProfilesTab (within App Manager), includes setProfileApp
 * 
 * TODO: Consider consolidating into a single store to avoid dual sources of truth.
 *       If consolidating, keep this store's richer API (activeProfile tracking,
 *       helper methods) and add appmanager.js's setProfileApp here.
 * 
 * Verified endpoints:
 * - GET /api/v1/profiles - List profiles
 * - POST /api/v1/profiles/{name}/apply - Apply profile
 * - POST /api/v1/profiles - Create profile
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Default profiles
export const DEFAULT_PROFILES = {
  FULL: 'full',
  MINIMAL: 'minimal',
  OFFLINE: 'offline'
}

// Profile descriptions
export const PROFILE_DESCRIPTIONS = {
  [DEFAULT_PROFILES.FULL]: 'All services enabled including AI/ML',
  [DEFAULT_PROFILES.MINIMAL]: 'Essential services only (Pi-hole, NPM, API, Dashboard)',
  [DEFAULT_PROFILES.OFFLINE]: 'Optimized for air-gapped operation'
}

export const useProfilesStore = defineStore('profiles', () => {
  // ==========================================
  // State
  // ==========================================
  
  const profiles = ref([])
  const activeProfile = ref('')
  const loading = ref(false)
  const error = ref(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const profileCount = computed(() => profiles.value.length)
  const systemProfiles = computed(() => profiles.value.filter(p => p.is_system))
  const customProfiles = computed(() => profiles.value.filter(p => !p.is_system))
  
  const currentProfile = computed(() => 
    profiles.value.find(p => p.name === activeProfile.value)
  )
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all profiles
   * GET /api/v1/profiles (verified: returns 3 profiles)
   */
  async function fetchProfiles() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/profiles')
      profiles.value = response.profiles || []
      activeProfile.value = response.active_profile || ''
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get profile details
   * GET /api/v1/profiles/{name}
   */
  async function getProfile(name) {
    try {
      return await api.get(`/profiles/${encodeURIComponent(name)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }
  
  /**
   * Apply/activate a profile
   * POST /api/v1/profiles/{name}/apply (verified: 404 for nonexistent)
   */
  async function applyProfile(name) {
    loading.value = true
    error.value = null
    
    try {
      const result = await api.post(`/profiles/${encodeURIComponent(name)}/apply`)
      activeProfile.value = name
      await fetchProfiles()
      return result
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Create a new custom profile
   * POST /api/v1/profiles
   */
  async function createProfile(name, displayName, description = '', apps = []) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/profiles', {
        name,
        display_name: displayName || name,
        description,
        apps
      })
      await fetchProfiles()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Delete a custom profile
   * NOTE: No DELETE /profiles/{name} endpoint exists in the API.
   * Profiles are managed server-side and cannot be deleted from the dashboard.
   */
  async function deleteProfile(name) {
    error.value = 'Profile deletion is not supported. Profiles are managed server-side.'
    return false
  }
  
  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Get profile by name
   */
  function getProfileByName(name) {
    return profiles.value.find(p => p.name === name)
  }
  
  /**
   * Check if profile is active
   */
  function isActive(name) {
    return activeProfile.value === name
  }
  
  /**
   * Get profile description
   */
  function getDescription(profile) {
    if (!profile) return ''
    return profile.description || PROFILE_DESCRIPTIONS[profile.name] || ''
  }
  
  /**
   * Get profile display name
   */
  function getDisplayName(profile) {
    if (!profile) return ''
    return profile.display_name || profile.name
  }
  
  /**
   * Check if profile can be deleted
   */
  function canDelete(profile) {
    if (!profile) return false
    return !profile.is_system
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    profiles,
    activeProfile,
    loading,
    error,
    
    // Computed
    profileCount,
    systemProfiles,
    customProfiles,
    currentProfile,
    
    // API Methods
    fetchProfiles,
    getProfile,
    applyProfile,
    createProfile,
    deleteProfile,
    
    // Helpers
    getProfileByName,
    isActive,
    getDescription,
    getDisplayName,
    canDelete
  }
})
