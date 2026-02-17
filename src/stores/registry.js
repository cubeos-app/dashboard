/**
 * CubeOS Registry Store
 *
 * Sprint 3: Dedicated store for the local Docker registry.
 * Previously registry endpoints lived in appmanager.js — this extracts
 * them into a focused store with Sprint 3's new endpoints.
 *
 * Existing (from appmanager.js):
 *   - fetchStatus()     → GET /registry/status
 *   - fetchImages()     → GET /registry/images
 *
 * Sprint 3 adds: disk-usage, cleanup, image tags, delete image (4 new).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useRegistryStore = defineStore('registry', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  const status = ref(null)
  const images = ref([])
  const diskUsage = ref(null)           // Sprint 3
  const selectedImageTags = ref([])     // Sprint 3
  const selectedImageName = ref(null)   // Which image's tags are loaded

  // ==========================================
  // Computed
  // ==========================================

  const isOnline = computed(() => status.value?.online === true || status.value?.running === true || status.value?.status === 'running')
  const imageCount = computed(() => images.value.length)
  const totalDiskUsage = computed(() => diskUsage.value?.total_size || diskUsage.value?.size || 0)

  // ==========================================
  // Existing Methods (migrated from appmanager.js)
  // ==========================================

  /**
   * Fetch registry status
   * GET /registry/status
   */
  async function fetchStatus(skipLoading = false) {
    if (!skipLoading) loading.value = true
    try {
      status.value = await api.get('/registry/status')
    } catch (e) {
      // Registry might not be running — not a fatal error
      status.value = { running: false, error: e.message }
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch all images in the registry
   * GET /registry/images
   */
  async function fetchImages(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/registry/images')
      const data = response.images ?? response.repositories ?? response
      images.value = Array.isArray(data) ? data : []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  // ==========================================
  // Sprint 3 Additions
  // ==========================================

  /**
   * Fetch registry disk usage statistics
   * GET /registry/disk-usage
   */
  async function fetchDiskUsage(skipLoading = false) {
    if (!skipLoading) loading.value = true
    try {
      diskUsage.value = await api.get('/registry/disk-usage')
      return diskUsage.value
    } catch (e) {
      // Disk usage fetch failure is non-fatal
      return null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Cleanup unused images and layers from the registry
   * POST /registry/cleanup
   */
  async function cleanup() {
    loading.value = true
    error.value = null
    try {
      const result = await api.post('/registry/cleanup')
      // Refresh images and disk usage after cleanup
      await Promise.all([fetchImages(true), fetchDiskUsage(true)])
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch tags for a specific image
   * GET /registry/images/{name}/tags
   */
  async function fetchImageTags(name) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      const response = await api.get(`/registry/images/${encoded}/tags`)
      const data = response.tags ?? response
      selectedImageTags.value = Array.isArray(data) ? data : []
      selectedImageName.value = name
      return selectedImageTags.value
    } catch (e) {
      error.value = e.message
      return []
    }
  }

  /**
   * Delete an image from the registry
   * DELETE /registry/images/{name}
   */
  async function deleteImage(name) {
    error.value = null
    try {
      const encoded = encodeURIComponent(name)
      await api.delete(`/registry/images/${encoded}`)
      // Remove from local state
      images.value = images.value.filter(img => {
        const imgName = typeof img === 'string' ? img : img.name
        return imgName !== name
      })
      // Clear selected if we just deleted it
      if (selectedImageName.value === name) {
        selectedImageTags.value = []
        selectedImageName.value = null
      }
      // Refresh disk usage
      await fetchDiskUsage(true)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch all registry data in parallel
   */
  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchStatus(true),
        fetchImages(true),
        fetchDiskUsage(true)
      ])
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear selected image state (e.g., when closing detail panel)
   */
  function clearSelectedImage() {
    selectedImageTags.value = []
    selectedImageName.value = null
  }

  return {
    // State
    loading,
    error,
    status,
    images,
    diskUsage,
    selectedImageTags,
    selectedImageName,

    // Computed
    isOnline,
    imageCount,
    totalDiskUsage,

    // Existing Actions
    fetchStatus,
    fetchImages,

    // Sprint 3 Actions
    fetchDiskUsage,
    cleanup,
    fetchImageTags,
    deleteImage,

    // Utilities
    fetchAll,
    clearSelectedImage
  }
})
