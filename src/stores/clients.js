/**
 * CubeOS Clients Store
 * 
 * Sprint 2: Manages connected client devices — list, count, block, unblock.
 * Separate from network store (different API prefix: /clients).
 * 
 * API Endpoints:
 * - GET  /clients             - List connected clients
 * - GET  /clients/count       - Client count
 * - POST /clients/{mac}/block   - Block a client by MAC
 * - POST /clients/{mac}/unblock - Unblock a client by MAC
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'

export const useClientsStore = defineStore('clients', () => {
  // ==========================================
  // State
  // ==========================================
  
  const loading = ref(false)
  const error = ref(null)
  const clients = ref([])
  const count = ref(0)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const activeClients = computed(() => clients.value.filter(c => !c.blocked))
  const blockedClients = computed(() => clients.value.filter(c => c.blocked))
  const activeCount = computed(() => activeClients.value.length)
  const blockedCount = computed(() => blockedClients.value.length)
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all connected clients
   */
  async function fetchClients() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/clients')
      clients.value = response.clients || []
    } catch (e) {
      error.value = e.message
      clients.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch client count
   */
  async function fetchCount() {
    try {
      const response = await api.get('/clients/count')
      count.value = response.count || 0
    } catch (e) {
      error.value = e.message
      count.value = 0
    }
  }
  
  /**
   * Block a client by MAC address
   * @param {string} mac - Client MAC address
   */
  async function blockClient(mac) {
    if (!await confirm({
      title: 'Block Client',
      message: `Are you sure you want to block client ${mac}? The device will be disconnected.`,
      confirmText: 'Block',
      variant: 'danger'
    })) return false
    
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/clients/${encodeURIComponent(mac)}/block`)
      await fetchClients()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Unblock a client by MAC address
   * @param {string} mac - Client MAC address
   */
  async function unblockClient(mac) {
    if (!await confirm({
      title: 'Unblock Client',
      message: `Are you sure you want to unblock client ${mac}?`,
      confirmText: 'Unblock',
      variant: 'info'
    })) return false
    
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/clients/${encodeURIComponent(mac)}/unblock`)
      await fetchClients()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  // ==========================================
  // Export
  // ==========================================
  
  return {
    // State
    loading,
    error,
    clients,
    count,
    
    // Computed
    activeClients,
    blockedClients,
    activeCount,
    blockedCount,
    
    // API Methods
    fetchClients,
    fetchCount,
    blockClient,
    unblockClient
  }
})
