/**
 * CubeOS Mounts Store
 * 
 * Sprint 4: Uses verified /api/v1/mounts endpoints.
 * Handles SMB and NFS mount configurations.
 * 
 * Verified endpoints:
 * - GET /api/v1/mounts - List mounts (working)
 * - POST /api/v1/mounts - Add mount (rejects invalid with 400)
 * - DELETE /api/v1/mounts/{id} - Delete mount (404 for nonexistent)
 * - POST /api/v1/mounts/{id}/mount - Mount
 * - POST /api/v1/mounts/{id}/unmount - Unmount
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Mount type constants
export const MOUNT_TYPES = {
  SMB: 'smb',
  NFS: 'nfs'
}

// Mount type labels
export const MOUNT_TYPE_LABELS = {
  [MOUNT_TYPES.SMB]: 'SMB/CIFS (Windows Share)',
  [MOUNT_TYPES.NFS]: 'NFS (Network File System)'
}

export const useMountsStore = defineStore('mounts', () => {
  // ==========================================
  // State
  // ==========================================
  
  const mounts = ref([])
  const loading = ref(false)
  const error = ref(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const mountCount = computed(() => mounts.value.length)
  const activeMounts = computed(() => mounts.value.filter(m => m.is_mounted))
  const smbMounts = computed(() => mounts.value.filter(m => m.type === MOUNT_TYPES.SMB))
  const nfsMounts = computed(() => mounts.value.filter(m => m.type === MOUNT_TYPES.NFS))
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all mounts
   * GET /api/v1/mounts (verified working)
   */
  async function fetchMounts() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/mounts')
      mounts.value = response.mounts || []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Add a new mount
   * POST /api/v1/mounts (verified - rejects invalid with 400)
   */
  async function addMount(config) {
    loading.value = true
    error.value = null
    
    try {
      // Validate required fields
      if (!config.name || !config.type || !config.remote_path) {
        throw new Error('Name, type, and remote path are required')
      }
      
      const mountData = {
        name: config.name,
        type: config.type,
        remote_path: config.remote_path,
        auto_mount: config.auto_mount || false,
        options: config.options || ''
      }
      
      // Add SMB-specific fields
      if (config.type === MOUNT_TYPES.SMB) {
        mountData.username = config.username || ''
        mountData.password = config.password || ''
      }
      
      await api.post('/mounts', mountData)
      await fetchMounts()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Delete a mount
   * DELETE /api/v1/mounts/{name}
   */
  async function deleteMount(name) {
    loading.value = true
    error.value = null
    
    try {
      await api.delete(`/mounts/${name}`)
      await fetchMounts()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Mount a configured mount point
   * POST /api/v1/mounts/{name}/mount
   */
  async function mountPath(name) {
    error.value = null
    
    try {
      await api.post(`/mounts/${name}/mount`)
      await fetchMounts()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }
  
  /**
   * Unmount a mount point
   * POST /api/v1/mounts/{name}/unmount
   */
  async function unmountPath(name) {
    error.value = null
    
    try {
      await api.post(`/mounts/${name}/unmount`)
      await fetchMounts()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }
  
  // ==========================================
  // Helper Methods
  // ==========================================
  
  /**
   * Get mount by name
   */
  function getMount(name) {
    return mounts.value.find(m => m.name === name)
  }
  
  /**
   * Get mount type label
   */
  function getTypeLabel(type) {
    return MOUNT_TYPE_LABELS[type] || type
  }
  
  /**
   * Format remote path for display
   */
  function formatRemotePath(mount) {
    if (!mount) return ''
    if (mount.type === MOUNT_TYPES.SMB) {
      return mount.remote_path // Already in //server/share format
    }
    return mount.remote_path // server:/path format
  }
  
  /**
   * Get mount status color
   */
  function getStatusColor(mount) {
    if (!mount) return 'text-gray-500'
    return mount.is_mounted ? 'text-green-500' : 'text-gray-500'
  }
  
  /**
   * Get mount status label
   */
  function getStatusLabel(mount) {
    if (!mount) return 'Unknown'
    return mount.is_mounted ? 'Mounted' : 'Not Mounted'
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    mounts,
    loading,
    error,
    
    // Computed
    mountCount,
    activeMounts,
    smbMounts,
    nfsMounts,
    
    // API Methods
    fetchMounts,
    addMount,
    deleteMount,
    mountPath,
    unmountPath,
    
    // Helpers
    getMount,
    getTypeLabel,
    formatRemotePath,
    getStatusColor,
    getStatusLabel
  }
})
