/**
 * CubeOS Firewall Store
 * 
 * Sprint 2: Manages firewall rules, port management, and firewall status.
 * Standalone store replacing the inline firewall data in NetworkView.
 * 
 * API Endpoints:
 * - GET    /firewall/rules                  - List all rules
 * - POST   /firewall/rules                  - Add a rule
 * - DELETE  /firewall/rules                  - Delete a rule
 * - POST   /firewall/save                   - Save current ruleset
 * - POST   /firewall/restore                - Restore saved ruleset
 * - POST   /firewall/reset                  - Reset to defaults
 * - POST   /firewall/port/allow             - Allow a port
 * - POST   /firewall/port/block             - Block a port
 * - DELETE  /firewall/port/{port}            - Delete port rule ⚡
 * - POST   /firewall/service/{service}/allow - Allow a service
 * - GET    /firewall/status                 - Full firewall status
 * - GET    /firewall/nat                    - Get NAT status ⚡
 * - POST   /firewall/nat/enable             - Enable NAT ⚡
 * - POST   /firewall/nat/disable            - Disable NAT ⚡
 * - GET    /firewall/nat/status             - Get NAT status (alt) ⚡
 * - GET    /firewall/forwarding             - Get IP forwarding status ⚡
 * - POST   /firewall/forwarding/enable      - Enable IP forwarding ⚡
 * - POST   /firewall/forwarding/disable     - Disable IP forwarding ⚡
 * - GET    /firewall/ipforward              - Get IP forward setting ⚡
 * - PUT    /firewall/ipforward              - Set IP forward setting ⚡
 * 
 * ⚡ = Endpoints verified in Swagger but not yet tested against backend.
 *      TODO: NetworkView still calls some of these directly — migrate to use store.
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
  const natStatus = ref(null)
  const forwardingStatus = ref(null)
  const ipForward = ref(null)
  
  // ==========================================
  // Computed
  // ==========================================
  
  const ruleCount = computed(() => rules.value.length)
  const isEnabled = computed(() => status.value?.enabled === true)
  const activeProfile = computed(() => status.value?.profile || 'default')
  const defaultPolicy = computed(() => status.value?.default_policy || 'deny')
  const isNatEnabled = computed(() => natStatus.value?.enabled === true)
  const isForwardingEnabled = computed(() => forwardingStatus.value?.enabled === true)
  const isIpForwardEnabled = computed(() => ipForward.value?.enabled === true)
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all firewall rules
   */
  async function fetchRules(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/firewall/rules', {}, options)
      if (response === null) return
      rules.value = response.rules || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      rules.value = []
    } finally {
      if (!skipLoading) loading.value = false
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
      await fetchRules(true)
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
      await fetchRules(true)
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
      await fetchRules(true)
      await fetchStatus(true)
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
      await fetchRules(true)
      await fetchStatus(true)
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
      await fetchRules(true)
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
      await fetchRules(true)
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
      await fetchRules(true)
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
  async function fetchStatus(skipLoading = false, options = {}) {
    if (!skipLoading) loading.value = true
    try {
      const response = await api.get('/firewall/status', {}, options)
      if (response === null) return
      status.value = response
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      status.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }
  
  // ==========================================
  // NAT Management ⚡
  // ==========================================
  
  /** GET /firewall/nat — fetch NAT status */
  async function fetchNatStatus() {
    try {
      const response = await api.get('/firewall/nat')
      natStatus.value = response
    } catch (e) {
      error.value = e.message
      natStatus.value = null
    }
  }
  
  /** POST /firewall/nat/enable */
  async function enableNat() {
    loading.value = true
    error.value = null
    try {
      await api.post('/firewall/nat/enable')
      await fetchNatStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /** POST /firewall/nat/disable */
  async function disableNat() {
    loading.value = true
    error.value = null
    try {
      await api.post('/firewall/nat/disable')
      await fetchNatStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  // ==========================================
  // IP Forwarding ⚡
  // ==========================================
  
  /** GET /firewall/forwarding — fetch forwarding status */
  async function fetchForwardingStatus() {
    try {
      const response = await api.get('/firewall/forwarding')
      forwardingStatus.value = response
    } catch (e) {
      error.value = e.message
      forwardingStatus.value = null
    }
  }
  
  /** POST /firewall/forwarding/enable */
  async function enableForwarding() {
    loading.value = true
    error.value = null
    try {
      await api.post('/firewall/forwarding/enable')
      await fetchForwardingStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /** POST /firewall/forwarding/disable */
  async function disableForwarding() {
    loading.value = true
    error.value = null
    try {
      await api.post('/firewall/forwarding/disable')
      await fetchForwardingStatus()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  /** GET /firewall/ipforward — get IP forward setting */
  async function fetchIpForward() {
    try {
      const response = await api.get('/firewall/ipforward')
      ipForward.value = response
    } catch (e) {
      error.value = e.message
      ipForward.value = null
    }
  }
  
  /** PUT /firewall/ipforward — set IP forward enabled/disabled */
  async function setIpForward(enabled) {
    loading.value = true
    error.value = null
    try {
      await api.put('/firewall/ipforward', { enabled })
      await fetchIpForward()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }
  
  // ==========================================
  // Port Delete ⚡
  // ==========================================
  
  /**
   * Delete a port-specific firewall rule
   * @param {number} port - Port number
   * @param {string} proto - Protocol ('tcp', 'udp', or 'both')
   */
  async function deletePort(port, proto = 'tcp') {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/firewall/port/${encodeURIComponent(port)}?protocol=${encodeURIComponent(proto)}`)
      await fetchRules(true)
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
    rules,
    status,
    natStatus,
    forwardingStatus,
    ipForward,
    
    // Computed
    ruleCount,
    isEnabled,
    activeProfile,
    defaultPolicy,
    isNatEnabled,
    isForwardingEnabled,
    isIpForwardEnabled,
    
    // Rules
    fetchRules,
    addRule,
    deleteRule,
    saveRuleset,
    restoreRuleset,
    resetRuleset,
    
    // Ports
    allowPort,
    blockPort,
    deletePort,
    allowService,
    
    // Status
    fetchStatus,
    
    // NAT ⚡
    fetchNatStatus,
    enableNat,
    disableNat,
    
    // Forwarding ⚡
    fetchForwardingStatus,
    enableForwarding,
    disableForwarding,
    
    // IP Forward ⚡
    fetchIpForward,
    setIpForward
  }
})
