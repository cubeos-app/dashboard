/**
 * CubeOS Firewall Store
 * 
 * Sprint 2: Manages firewall rules, port management, and firewall status.
 * Standalone store replacing the inline firewall data in NetworkView.
 * 
 * API Endpoints:
 * - GET    /firewall/rules       - List all rules
 * - POST   /firewall/rules       - Add a rule
 * - DELETE  /firewall/rules       - Delete a rule
 * - POST   /firewall/save        - Save current ruleset
 * - POST   /firewall/restore     - Restore saved ruleset
 * - POST   /firewall/reset       - Reset to defaults
 * - POST   /firewall/port/allow  - Allow a port
 * - POST   /firewall/port/block  - Block a port
 * - POST   /firewall/service/allow - Allow a service
 * - GET    /firewall/status      - Full firewall status
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'

export const useFirewallStore = defineStore('firewall', () => {
  // ==========================================
  // State
  // ==========================================
  
  const loading = ref(false)
  const error = ref(null)
  const rules = ref([])
  const status = ref(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const ruleCount = computed(() => rules.value.length)
  const isEnabled = computed(() => status.value?.enabled === true)
  const activeProfile = computed(() => status.value?.profile || 'default')
  const defaultPolicy = computed(() => status.value?.default_policy || 'deny')
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all firewall rules
   */
  async function fetchRules() {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/firewall/rules')
      rules.value = response.rules || []
    } catch (e) {
      error.value = e.message
      rules.value = []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Add a firewall rule
   * @param {object} rule - Rule definition (action, direction, port, protocol, from, to, comment)
   */
  async function addRule(rule) {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/rules', rule)
      await fetchRules()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Delete a firewall rule
   * @param {object} rule - Rule to delete (must match existing rule)
   */
  async function deleteRule(rule) {
    if (!await confirm({
      title: 'Delete Firewall Rule',
      message: 'Are you sure you want to delete this firewall rule?',
      confirmText: 'Delete',
      variant: 'danger'
    })) return false
    
    loading.value = true
    error.value = null
    
    try {
      await api.delete('/firewall/rules', rule)
      await fetchRules()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Save current ruleset persistently
   */
  async function saveRuleset() {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/save')
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Restore previously saved ruleset
   */
  async function restoreRuleset() {
    if (!await confirm({
      title: 'Restore Firewall Rules',
      message: 'This will restore the last saved ruleset, discarding any unsaved changes.',
      confirmText: 'Restore',
      variant: 'warning'
    })) return false
    
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/restore')
      await fetchRules()
      await fetchStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Reset firewall to default rules
   */
  async function resetRuleset() {
    if (!await confirm({
      title: 'Reset Firewall',
      message: 'This will reset all firewall rules to factory defaults. This action cannot be undone.',
      confirmText: 'Reset to Defaults',
      variant: 'danger'
    })) return false
    
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/reset')
      await fetchRules()
      await fetchStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Allow a specific port
   * @param {number} port - Port number
   * @param {string} proto - Protocol ('tcp', 'udp', or 'both')
   */
  async function allowPort(port, proto = 'tcp') {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/port/allow', { port, protocol: proto })
      await fetchRules()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Block a specific port
   * @param {number} port - Port number
   * @param {string} proto - Protocol ('tcp', 'udp', or 'both')
   */
  async function blockPort(port, proto = 'tcp') {
    loading.value = true
    error.value = null
    
    try {
      await api.post('/firewall/port/block', { port, protocol: proto })
      await fetchRules()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Allow a named service (e.g., 'ssh', 'http', 'https')
   * @param {string} service - Service name
   */
  async function allowService(service) {
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/firewall/service/${encodeURIComponent(service)}/allow`)
      await fetchRules()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch full firewall status
   */
  async function fetchStatus() {
    loading.value = true
    try {
      const response = await api.get('/firewall/status')
      status.value = response
    } catch (e) {
      error.value = e.message
      status.value = null
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
    rules,
    status,
    
    // Computed
    ruleCount,
    isEnabled,
    activeProfile,
    defaultPolicy,
    
    // API Methods
    fetchRules,
    addRule,
    deleteRule,
    saveRuleset,
    restoreRuleset,
    resetRuleset,
    allowPort,
    blockPort,
    allowService,
    fetchStatus
  }
})
