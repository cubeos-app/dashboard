<script setup>
/**
 * FirewallTab.vue — S06 Component (Advanced only)
 *
 * Firewall management tab. Absorbs FirewallView.vue functionality:
 * status cards, HAL status, ruleset management (save/restore/reset),
 * rule list with quick port/service panels, add rule form.
 * Desktop: table view. Mobile: card stack.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFirewallStore } from '@/stores/firewall'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const { signal } = useAbortOnUnmount()
const firewallStore = useFirewallStore()

// ── Local State ──────────────────────────────────────────────
const showAddRule = ref(false)
const showQuickPort = ref(false)
const showQuickService = ref(false)
const showSystemRules = ref(false)
const actionLoading = ref(null)
const actionSuccess = ref(null)
let actionSuccessTimeout = null
const localError = ref(null)

// Add Rule form
const newRule = ref({
  action: 'allow',
  direction: 'in',
  port: '',
  protocol: 'tcp',
  from: '',
  to: '',
  comment: ''
})

// Quick Port form
const quickPort = ref({ port: '', protocol: 'tcp', action: 'allow' })

// Quick Service form
const quickService = ref({ service: '' })

const commonServices = [
  { name: 'ssh', label: 'SSH', port: '22' },
  { name: 'http', label: 'HTTP', port: '80' },
  { name: 'https', label: 'HTTPS', port: '443' },
  { name: 'dns', label: 'DNS', port: '53' },
  { name: 'dhcp', label: 'DHCP', port: '67-68' },
  { name: 'ntp', label: 'NTP', port: '123' }
]

// ── Computed ─────────────────────────────────────────────────
const statusColor = computed(() => firewallStore.isEnabled ? 'text-success' : 'text-error')
const statusLabel = computed(() => firewallStore.isEnabled ? 'Active' : 'Inactive')
const policyColor = computed(() => {
  const policy = firewallStore.defaultPolicy
  if (policy === 'deny' || policy === 'drop') return 'text-error'
  if (policy === 'allow' || policy === 'accept') return 'text-success'
  return 'text-warning'
})
const displayedRules = computed(() => showSystemRules.value ? firewallStore.rules : firewallStore.userRules)
const hasRules = computed(() => displayedRules.value.length > 0)
const systemRuleCount = computed(() => firewallStore.ruleCount - firewallStore.userRuleCount)

// ── Data Loading ─────────────────────────────────────────────
async function fetchAll() {
  localError.value = null
  try {
    const opts = { signal: signal() }
    await Promise.all([
      firewallStore.fetchStatus(false, opts),
      firewallStore.fetchRules(false, opts, showSystemRules.value),
      firewallStore.fetchHALFirewallStatus(opts)
    ])
  } catch (e) {
    localError.value = 'Failed to load firewall data'
  }
}

// Toggle system rules: refetch with or without system rules
async function toggleSystemRules() {
  showSystemRules.value = !showSystemRules.value
  await firewallStore.fetchRules(false, { signal: signal() }, showSystemRules.value)
}

onMounted(fetchAll)
onUnmounted(() => { if (actionSuccessTimeout) clearTimeout(actionSuccessTimeout) })

// ── Rule Management ──────────────────────────────────────────
async function handleAddRule() {
  if (!newRule.value.port && !newRule.value.from && !newRule.value.to) {
    localError.value = 'Please specify at least a port, source, or destination'
    return
  }

  localError.value = null
  const rule = { ...newRule.value }
  if (!rule.port) delete rule.port
  if (!rule.from) delete rule.from
  if (!rule.to) delete rule.to
  if (!rule.comment) delete rule.comment

  if (rule.port) {
    rule.port = parseInt(rule.port, 10)
    if (isNaN(rule.port) || rule.port < 1 || rule.port > 65535) {
      localError.value = 'Port must be between 1 and 65535'
      return
    }
  }

  const success = await firewallStore.addRule(rule)
  if (success) {
    newRule.value = { action: 'allow', direction: 'in', port: '', protocol: 'tcp', from: '', to: '', comment: '' }
    showAddRule.value = false
  }
}

async function handleDeleteRule(rule) {
  await firewallStore.deleteRule(rule)
}

// ── Ruleset Actions ──────────────────────────────────────────
function showSuccessFor(action) {
  actionSuccess.value = action
  if (actionSuccessTimeout) clearTimeout(actionSuccessTimeout)
  actionSuccessTimeout = setTimeout(() => { actionSuccess.value = null }, 3000)
}

async function handleSave() {
  actionLoading.value = 'save'
  actionSuccess.value = null
  const ok = await firewallStore.saveRuleset()
  actionLoading.value = null
  if (ok) showSuccessFor('save')
}

async function handleRestore() {
  actionLoading.value = 'restore'
  actionSuccess.value = null
  const ok = await firewallStore.restoreRuleset()
  actionLoading.value = null
  if (ok) showSuccessFor('restore')
}

async function handleReset() {
  actionLoading.value = 'reset'
  actionSuccess.value = null
  const ok = await firewallStore.resetRuleset()
  actionLoading.value = null
  if (ok) showSuccessFor('reset')
}

// ── Quick Port ───────────────────────────────────────────────
async function handleQuickPort() {
  const portNum = parseInt(quickPort.value.port, 10)
  if (!portNum || portNum < 1 || portNum > 65535) {
    localError.value = 'Enter a valid port (1–65535)'
    return
  }
  localError.value = null
  let success
  if (quickPort.value.action === 'allow') {
    success = await firewallStore.allowPort(portNum, quickPort.value.protocol)
  } else {
    success = await firewallStore.blockPort(portNum, quickPort.value.protocol)
  }
  if (success) {
    quickPort.value = { port: '', protocol: 'tcp', action: 'allow' }
    showQuickPort.value = false
  }
}

// ── Quick Service ────────────────────────────────────────────
async function handleQuickService(serviceName) {
  localError.value = null
  await firewallStore.allowService(serviceName || quickService.value.service)
  quickService.value.service = ''
}

// ── Helpers ──────────────────────────────────────────────────
function ruleActionColor(action) {
  if (action === 'allow' || action === 'accept') return 'text-success'
  if (action === 'deny' || action === 'drop' || action === 'reject') return 'text-error'
  return 'text-warning'
}

function ruleActionBg(action) {
  if (action === 'allow' || action === 'accept') return 'bg-success-muted'
  if (action === 'deny' || action === 'drop' || action === 'reject') return 'bg-error-muted'
  return 'bg-warning-muted'
}

function formatDirection(dir) {
  if (dir === 'in') return 'Inbound'
  if (dir === 'out') return 'Outbound'
  return dir || 'Any'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error -->
    <div v-if="localError || firewallStore.error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ localError || firewallStore.error }}</p>
      <button @click="localError = null; firewallStore.error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">Status</p>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" :class="firewallStore.isEnabled ? 'bg-success' : 'bg-error'"></span>
          <span class="text-lg font-semibold" :class="statusColor">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">Profile</p>
        <p class="text-lg font-semibold text-theme-primary capitalize">{{ firewallStore.activeProfile }}</p>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">Default Policy</p>
        <p class="text-lg font-semibold capitalize" :class="policyColor">{{ firewallStore.defaultPolicy }}</p>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">Rules</p>
        <p class="text-lg font-semibold text-theme-primary">{{ firewallStore.userRuleCount }}</p>
      </div>
    </div>

    <!-- HAL Firewall Status -->
    <div v-if="firewallStore.halFirewallStatus" class="bg-theme-card rounded-xl border border-theme-primary p-4">
      <div class="flex items-center gap-2 mb-3">
        <Icon name="Shield" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-theme-primary">HAL Firewall</h2>
        <span
          :class="[
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-tertiary'
          ]"
        >
          {{ (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'Active' : 'Inactive' }}
        </span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'bg-success' : 'bg-error'"></span>
          <span class="text-xs text-theme-secondary">Status</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'Active' : 'Inactive' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Icon name="List" :size="12" class="text-theme-muted" />
          <span class="text-xs text-theme-secondary">Rules</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ firewallStore.halFirewallStatus.rules_count ?? firewallStore.halFirewallStatus.rules ?? 0 }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.nat_enabled || firewallStore.halFirewallStatus.nat) ? 'bg-success' : 'bg-neutral-muted'"></span>
          <span class="text-xs text-theme-secondary">NAT</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.nat_enabled || firewallStore.halFirewallStatus.nat) ? 'Enabled' : 'Disabled' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.forwarding_enabled || firewallStore.halFirewallStatus.forwarding) ? 'bg-success' : 'bg-neutral-muted'"></span>
          <span class="text-xs text-theme-secondary">Forwarding</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.forwarding_enabled || firewallStore.halFirewallStatus.forwarding) ? 'Enabled' : 'Disabled' }}</span>
        </div>
      </div>
    </div>

    <!-- Ruleset Actions Bar -->
    <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Ruleset Management</h2>
          <p class="text-xs text-theme-muted mt-0.5">Save, restore, or reset your firewall configuration</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button
            @click="handleSave"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            :class="actionSuccess === 'save' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent hover:opacity-80'"
            aria-label="Save firewall ruleset"
          >
            <Icon v-if="actionLoading === 'save'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'save'" name="Check" :size="14" />
            <Icon v-else name="Save" :size="14" />
            {{ actionSuccess === 'save' ? 'Saved' : 'Save' }}
          </button>
          <button
            @click="handleRestore"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg bg-warning-muted text-warning hover:opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            aria-label="Restore saved firewall ruleset"
          >
            <Icon v-if="actionLoading === 'restore'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'restore'" name="Check" :size="14" />
            <Icon v-else name="RotateCcw" :size="14" />
            {{ actionSuccess === 'restore' ? 'Restored' : 'Restore' }}
          </button>
          <button
            @click="handleReset"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            aria-label="Reset firewall to defaults"
          >
            <Icon v-if="actionLoading === 'reset'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'reset'" name="Check" :size="14" />
            <Icon v-else name="Trash2" :size="14" />
            {{ actionSuccess === 'reset' ? 'Done' : 'Reset' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rules Section -->
    <div class="bg-theme-card rounded-xl border border-theme-primary">
      <!-- Rules Header -->
      <div class="p-4 border-b border-theme-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-theme-primary">Firewall Rules</h2>
          <button
            v-if="systemRuleCount > 0"
            @click="toggleSystemRules"
            class="px-2 py-1 text-[10px] font-medium rounded-full transition-colors"
            :class="showSystemRules ? 'bg-warning-muted text-warning' : 'bg-theme-tertiary text-theme-muted hover:text-theme-secondary'"
          >
            {{ showSystemRules ? `Hide ${systemRuleCount} system` : `+${systemRuleCount} system` }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="showQuickPort = !showQuickPort; showQuickService = false; showAddRule = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-1.5"
          >
            <Icon name="Hash" :size="14" />
            Quick Port
          </button>
          <button
            @click="showQuickService = !showQuickService; showQuickPort = false; showAddRule = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-1.5"
          >
            <Icon name="Server" :size="14" />
            Service
          </button>
          <button
            @click="showAddRule = !showAddRule; showQuickPort = false; showQuickService = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg btn-accent text-on-accent transition-colors flex items-center gap-1.5"
          >
            <Icon name="Plus" :size="14" />
            Add Rule
          </button>
        </div>
      </div>

      <!-- Quick Port Panel -->
      <div v-if="showQuickPort" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <div class="flex flex-col sm:flex-row items-end gap-3">
          <div class="flex-1 w-full sm:w-auto">
            <label for="quick-port" class="block text-xs text-theme-muted mb-1">Port</label>
            <input id="quick-port" v-model="quickPort.port" type="number" min="1" max="65535" placeholder="e.g. 8080" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-[color:var(--accent-primary)] font-mono" @keyup.enter="handleQuickPort" />
          </div>
          <div class="w-full sm:w-32">
            <label for="quick-protocol" class="block text-xs text-theme-muted mb-1">Protocol</label>
            <select id="quick-protocol" v-model="quickPort.protocol" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-[color:var(--accent-primary)]">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div class="w-full sm:w-32">
            <label for="quick-action" class="block text-xs text-theme-muted mb-1">Action</label>
            <select id="quick-action" v-model="quickPort.action" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-[color:var(--accent-primary)]">
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </div>
          <button @click="handleQuickPort" :disabled="firewallStore.loading" class="w-full sm:w-auto px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Icon v-if="firewallStore.loading" name="Loader2" :size="14" class="animate-spin" />
            Apply
          </button>
        </div>
      </div>

      <!-- Quick Service Panel -->
      <div v-if="showQuickService" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <p class="text-xs text-theme-muted mb-3">Allow a common service through the firewall</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="svc in commonServices" :key="svc.name" @click="handleQuickService(svc.name)" :disabled="firewallStore.loading" class="px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm hover:border-[color:var(--accent-primary)] hover:text-accent transition-colors disabled:opacity-50 flex items-center gap-2">
            <span class="font-medium text-theme-primary">{{ svc.label }}</span>
            <span class="text-theme-muted text-xs font-mono">:{{ svc.port }}</span>
          </button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input v-model="quickService.service" type="text" placeholder="Custom service name" class="flex-1 px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-[color:var(--accent-primary)]" @keyup.enter="handleQuickService()" />
          <button @click="handleQuickService()" :disabled="!quickService.service || firewallStore.loading" class="px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50">
            Allow
          </button>
        </div>
      </div>

      <!-- Add Rule Panel -->
      <div v-if="showAddRule" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label for="rule-action" class="block text-xs text-theme-muted mb-1">Action</label>
            <select id="rule-action" v-model="newRule.action" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="allow">Allow</option><option value="deny">Deny</option><option value="reject">Reject</option></select>
          </div>
          <div>
            <label for="rule-direction" class="block text-xs text-theme-muted mb-1">Direction</label>
            <select id="rule-direction" v-model="newRule.direction" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="in">Inbound</option><option value="out">Outbound</option></select>
          </div>
          <div>
            <label for="rule-port" class="block text-xs text-theme-muted mb-1">Port</label>
            <input id="rule-port" v-model="newRule.port" type="number" min="1" max="65535" placeholder="e.g. 443" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
          <div>
            <label for="rule-protocol" class="block text-xs text-theme-muted mb-1">Protocol</label>
            <select id="rule-protocol" v-model="newRule.protocol" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="both">Both</option></select>
          </div>
          <div>
            <label for="rule-from" class="block text-xs text-theme-muted mb-1">From (source IP/CIDR)</label>
            <input id="rule-from" v-model="newRule.from" type="text" placeholder="e.g. 192.168.1.0/24" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
          <div>
            <label for="rule-to" class="block text-xs text-theme-muted mb-1">To (destination IP/CIDR)</label>
            <input id="rule-to" v-model="newRule.to" type="text" placeholder="e.g. any" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
        </div>
        <div class="mt-3">
          <label for="rule-comment" class="block text-xs text-theme-muted mb-1">Comment (optional)</label>
          <input id="rule-comment" v-model="newRule.comment" type="text" placeholder="Rule description" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted" @keyup.enter="handleAddRule" />
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button @click="showAddRule = false" class="px-4 py-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
          <button @click="handleAddRule" :disabled="firewallStore.loading" class="px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            <Icon v-if="firewallStore.loading" name="Loader2" :size="14" class="animate-spin" />
            Add Rule
          </button>
        </div>
      </div>

      <!-- Rules List — Desktop Table -->
      <div v-if="hasRules" class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-theme-muted uppercase tracking-wide border-b border-theme-primary">
              <th class="px-4 py-3 font-medium">Action</th>
              <th class="px-4 py-3 font-medium">Direction</th>
              <th class="px-4 py-3 font-medium">Port</th>
              <th class="px-4 py-3 font-medium">Protocol</th>
              <th class="px-4 py-3 font-medium">From</th>
              <th class="px-4 py-3 font-medium">To</th>
              <th class="px-4 py-3 font-medium">Comment</th>
              <th class="px-4 py-3 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(rule, idx) in displayedRules" :key="idx" class="border-b border-theme-primary last:border-0 hover:bg-theme-secondary transition-colors">
              <td class="px-4 py-3"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase" :class="[ruleActionColor(rule.action), ruleActionBg(rule.action)]">{{ rule.action }}</span></td>
              <td class="px-4 py-3 text-theme-secondary">{{ formatDirection(rule.direction) }}</td>
              <td class="px-4 py-3 text-theme-primary font-mono">{{ rule.port || 'any' }}</td>
              <td class="px-4 py-3 text-theme-secondary uppercase">{{ rule.protocol || 'any' }}</td>
              <td class="px-4 py-3 text-theme-secondary font-mono">{{ rule.from || 'any' }}</td>
              <td class="px-4 py-3 text-theme-secondary font-mono">{{ rule.to || 'any' }}</td>
              <td class="px-4 py-3 text-theme-muted max-w-[200px] truncate">{{ rule.comment || '-' }}</td>
              <td class="px-4 py-3">
                <button @click="handleDeleteRule(rule)" :disabled="firewallStore.loading" class="p-1.5 text-theme-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors disabled:opacity-50" title="Delete rule" :aria-label="`Delete firewall rule for port ${rule.port || 'any'}`">
                  <Icon name="Trash2" :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Rules List — Mobile Cards -->
      <div v-if="hasRules" class="md:hidden divide-y divide-theme-primary">
        <div v-for="(rule, idx) in displayedRules" :key="idx" class="p-4 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase" :class="[ruleActionColor(rule.action), ruleActionBg(rule.action)]">{{ rule.action }}</span>
              <span class="text-xs text-theme-muted">{{ formatDirection(rule.direction) }}</span>
            </div>
            <button @click="handleDeleteRule(rule)" :disabled="firewallStore.loading" class="p-1.5 text-theme-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors disabled:opacity-50" :aria-label="`Delete firewall rule for port ${rule.port || 'any'}`">
              <Icon name="Trash2" :size="16" />
            </button>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span class="text-theme-muted">Port: </span><span class="text-theme-primary font-mono">{{ rule.port || 'any' }}</span></div>
            <div><span class="text-theme-muted">Protocol: </span><span class="text-theme-secondary uppercase">{{ rule.protocol || 'any' }}</span></div>
            <div><span class="text-theme-muted">From: </span><span class="text-theme-secondary font-mono">{{ rule.from || 'any' }}</span></div>
            <div><span class="text-theme-muted">To: </span><span class="text-theme-secondary font-mono">{{ rule.to || 'any' }}</span></div>
          </div>
          <p v-if="rule.comment" class="text-xs text-theme-muted">{{ rule.comment }}</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!hasRules && !firewallStore.loading" class="p-8 text-center">
        <Icon name="Shield" :size="40" class="mx-auto text-theme-tertiary mb-3" />
        <p class="text-theme-secondary text-sm">No firewall rules configured</p>
        <p class="text-theme-muted text-xs mt-1">Add rules to control network traffic</p>
        <button @click="showAddRule = true" class="mt-4 px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg inline-flex items-center gap-1.5">
          <Icon name="Plus" :size="14" />
          Add First Rule
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="firewallStore.loading && !hasRules" class="p-8 flex items-center justify-center gap-2">
        <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
        <span class="text-theme-muted text-sm">Loading rules...</span>
      </div>
    </div>
  </div>
</template>
