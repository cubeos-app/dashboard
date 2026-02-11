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
 * - GET    /firewall/hal/status             - HAL-level firewall status (active, rules, nat, forwarding)
 * 
 * ⚡ = Endpoints verified in Swagger but not yet tested against backend.
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
  const halFirewallStatus = ref(null)
  
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

  // Docker/system chains to exclude from user-facing display
  const SYSTEM_CHAINS = new Set([
    'DOCKER', 'DOCKER-ISOLATION-STAGE-1', 'DOCKER-ISOLATION-STAGE-2',
    'DOCKER-USER', 'DOCKER-INGRESS', 'DOCKER_OUTPUT', 'DOCKER_POSTROUTING',
    'KUBE-SERVICES', 'KUBE-POSTROUTING', 'KUBE-FIREWALL'
  ])

  /**
   * Rules filtered to show only user-meaningful entries.
   * Backend now normalizes fields (action, direction, protocol, from, to).
   * This filter catches any remaining noise not handled server-side.
   */
  const userRules = computed(() => {
    return rules.value.filter(rule => {
      // Exclude Docker/system chains (backup for non-user_only requests)
      if (rule.chain && SYSTEM_CHAINS.has(rule.chain)) return false

      // Exclude nat/mangle/raw tables (usually system-managed)
      if (rule.table && rule.table !== 'filter') return false

      // Exclude rules involving Docker bridge interfaces
      const iface = rule.in_interface || rule.out_interface || ''
      if (iface.startsWith('br-') || iface.startsWith('docker') || iface === 'ingress_sbox') return false

      // Exclude rules with no useful specificity (the "any/any/any" noise)
      const hasPort = rule.port || rule.dport || rule.sport || rule.destination_port || rule.source_port
      const hasAddr = rule.from || rule.to
      const hasComment = rule.comment
      const hasAction = rule.action && rule.action !== '-'
      const hasProtocol = rule.protocol && rule.protocol !== 'all' && rule.protocol !== ''

      // Keep if rule has at least one meaningful field
      if (hasPort || hasAddr || hasComment || hasProtocol) return true

      // Keep ACCEPT/DROP/REJECT rules in INPUT/OUTPUT/FORWARD even without specifics
      if (hasAction && ['in', 'out', 'forward'].includes(rule.direction)) return true

      return false
    })
  })
  const userRuleCount = computed(() => userRules.value.length)
  
  // ==========================================
  // API Methods
  // ==========================================
  
  /**
   * Fetch all firewall rules
   * @param {boolean} skipLoading - Skip loading state
   * @param {object} options - Request options (e.g., abort signal)
   * @param {boolean} includeSystem - Include system/Docker rules (default: false)
   */
  async function fetchRules(skipLoading = false, options = {}, includeSystem = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    
    try {
      const params = includeSystem ? {} : { user_only: 'true' }
      const response = await api.get('/firewall/rules', params, options)
      if (response === null) return
      // API returns rules as map[string][]Rule (e.g. {"filter:INPUT": [...], "filter:FORWARD": [...]})
      // Flatten to a single array, adding table/chain metadata to each rule
      const raw = response.rules
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const allRules = []
        for (const [key, chainRules] of Object.entries(raw)) {
          const parts = key.split(':')
          const table = parts[0] || 'filter'
          const chain = parts[1] || 'INPUT'
          if (Array.isArray(chainRules)) {
            chainRules.forEach(r => allRules.push({ ...r, table, chain: r.chain || chain }))
          }
        }
        rules.value = allRules
      } else if (Array.isArray(raw)) {
        rules.value = raw
      } else {
        rules.value = []
      }
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
  async function fetchNatStatus(options = {}) {
    try {
      const response = await api.get('/firewall/nat', {}, options)
      if (response === null) return null
      natStatus.value = response
      return response
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      natStatus.value = null
      return null
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
  // HAL Firewall Status
  // ==========================================

  /**
   * Fetch HAL-level firewall status
   * GET /firewall/hal/status
   * Returns: { active, rules, nat, forwarding }
   */
  async function fetchHALFirewallStatus(options = {}) {
    try {
      const response = await api.get('/firewall/hal/status', {}, options)
      if (response === null) return null
      halFirewallStatus.value = response
      return response
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      halFirewallStatus.value = null
      return null
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
    halFirewallStatus,
    
    // Computed
    ruleCount,
    userRules,
    userRuleCount,
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
    setIpForward,

    // HAL Firewall
    fetchHALFirewallStatus
  }
})
