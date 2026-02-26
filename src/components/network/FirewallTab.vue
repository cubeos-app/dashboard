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
import { useI18n } from 'vue-i18n'
import { useFirewallStore } from '@/stores/firewall'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const { signal } = useAbortOnUnmount()
const firewallStore = useFirewallStore()
const { t } = useI18n()

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
const statusLabel = computed(() => firewallStore.isEnabled ? t('common.active') : t('common.inactive'))
const policyColor = computed(() => {
  const policy = firewallStore.defaultPolicy
  if (policy === 'deny' || policy === 'drop') return 'text-error'
  if (policy === 'allow' || policy === 'accept') return 'text-success'
  return 'text-warning'
})
const displayedRules = computed(() => showSystemRules.value ? firewallStore.rules : firewallStore.userRules)
const hasRules = computed(() => displayedRules.value.length > 0)
// HAL reports total iptables rules; user rules come from filtered API response
const halTotalRules = computed(() => firewallStore.halFirewallStatus?.rules_count ?? firewallStore.halFirewallStatus?.rules ?? 0)
const systemRuleCount = computed(() => Math.max(0, halTotalRules.value - firewallStore.userRuleCount))

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
    localError.value = t('network.firewallRules.failedToLoad')
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
    localError.value = t('network.firewallRules.specifyFilter')
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
      localError.value = t('network.firewallRules.invalidPort')
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
    localError.value = t('network.firewallRules.invalidPortRange')
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
  if (dir === 'in') return t('network.firewallRules.inbound')
  if (dir === 'out') return t('network.firewallRules.outbound')
  return dir || t('network.firewallRules.any')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error -->
    <div v-if="localError || firewallStore.error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ localError || firewallStore.error }}</p>
      <button @click="localError = null; firewallStore.error = null" class="p-1 text-error hover:opacity-70" :aria-label="$t('common.dismissError')">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">{{ $t('network.firewallRules.status') }}</p>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" :class="firewallStore.isEnabled ? 'bg-success' : 'bg-error'"></span>
          <span class="text-lg font-semibold" :class="statusColor">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">{{ $t('network.firewallRules.profile') }}</p>
        <p class="text-lg font-semibold text-theme-primary capitalize">{{ firewallStore.activeProfile }}</p>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">{{ $t('network.firewallRules.defaultPolicy') }}</p>
        <p class="text-lg font-semibold capitalize" :class="policyColor">{{ firewallStore.defaultPolicy }}</p>
      </div>
      <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
        <p class="text-xs text-theme-muted uppercase tracking-wide mb-1">{{ $t('network.firewallRules.rules') }}</p>
        <p class="text-lg font-semibold text-theme-primary">{{ firewallStore.userRuleCount }}</p>
      </div>
    </div>

    <!-- HAL Firewall Status -->
    <div v-if="firewallStore.halFirewallStatus" class="bg-theme-card rounded-xl border border-theme-primary p-4">
      <div class="flex items-center gap-2 mb-3">
        <Icon name="Shield" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-theme-primary">{{ $t('network.firewallRules.halFirewall') }}</h2>
        <span
          :class="[
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-tertiary'
          ]"
        >
          {{ (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? $t('common.active') : $t('common.inactive') }}
        </span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? 'bg-success' : 'bg-error'"></span>
          <span class="text-xs text-theme-secondary">{{ $t('network.firewallRules.status') }}</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.enabled || firewallStore.halFirewallStatus.active) ? $t('common.active') : $t('common.inactive') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Icon name="List" :size="12" class="text-theme-muted" />
          <span class="text-xs text-theme-secondary">{{ $t('network.firewallRules.rules') }}</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ firewallStore.halFirewallStatus.rules_count ?? firewallStore.halFirewallStatus.rules ?? 0 }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.nat_enabled || firewallStore.halFirewallStatus.nat) ? 'bg-success' : 'bg-neutral-muted'"></span>
          <span class="text-xs text-theme-secondary">{{ $t('network.firewallRules.nat') }}</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.nat_enabled || firewallStore.halFirewallStatus.nat) ? $t('common.enabled') : $t('common.disabled') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="(firewallStore.halFirewallStatus.forwarding_enabled || firewallStore.halFirewallStatus.forwarding) ? 'bg-success' : 'bg-neutral-muted'"></span>
          <span class="text-xs text-theme-secondary">{{ $t('network.firewallRules.forwarding') }}</span>
          <span class="text-xs font-medium text-theme-primary ml-auto">{{ (firewallStore.halFirewallStatus.forwarding_enabled || firewallStore.halFirewallStatus.forwarding) ? $t('common.enabled') : $t('common.disabled') }}</span>
        </div>
      </div>
    </div>

    <!-- Ruleset Actions Bar -->
    <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">{{ $t('network.firewallRules.rulesetManagement') }}</h2>
          <p class="text-xs text-theme-muted mt-0.5">{{ $t('network.firewallRules.rulesetDescription') }}</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button
            @click="handleSave"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            :class="actionSuccess === 'save' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent hover:opacity-80'"
            :aria-label="$t('network.firewallRules.saveRuleset')"
          >
            <Icon v-if="actionLoading === 'save'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'save'" name="Check" :size="14" />
            <Icon v-else name="Save" :size="14" />
            {{ actionSuccess === 'save' ? $t('network.firewallRules.saved') : $t('common.save') }}
          </button>
          <button
            @click="handleRestore"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg bg-warning-muted text-warning hover:opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            :aria-label="$t('network.firewallRules.restoreRuleset')"
          >
            <Icon v-if="actionLoading === 'restore'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'restore'" name="Check" :size="14" />
            <Icon v-else name="RotateCcw" :size="14" />
            {{ actionSuccess === 'restore' ? $t('network.firewallRules.restored') : $t('network.firewallRules.restore') }}
          </button>
          <button
            @click="handleReset"
            :disabled="actionLoading !== null"
            class="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            :aria-label="$t('network.firewallRules.resetFirewall')"
          >
            <Icon v-if="actionLoading === 'reset'" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else-if="actionSuccess === 'reset'" name="Check" :size="14" />
            <Icon v-else name="Trash2" :size="14" />
            {{ actionSuccess === 'reset' ? $t('network.firewallRules.done') : $t('network.firewallRules.reset') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rules Section -->
    <div class="bg-theme-card rounded-xl border border-theme-primary">
      <!-- Rules Header -->
      <div class="p-4 border-b border-theme-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-theme-primary">{{ $t('network.firewallRules.title') }}</h2>
          <button
            v-if="systemRuleCount > 0"
            @click="toggleSystemRules"
            class="px-2 py-1 text-[10px] font-medium rounded-full transition-colors"
            :class="showSystemRules ? 'bg-warning-muted text-warning' : 'bg-theme-tertiary text-theme-muted hover:text-theme-secondary'"
          >
            {{ showSystemRules ? $t('network.firewallRules.hideSystemCount', { count: systemRuleCount }) : $t('network.firewallRules.showSystemCount', { count: systemRuleCount }) }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="showQuickPort = !showQuickPort; showQuickService = false; showAddRule = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-1.5"
          >
            <Icon name="Hash" :size="14" />
            {{ $t('network.firewallRules.quickPort') }}
          </button>
          <button
            @click="showQuickService = !showQuickService; showQuickPort = false; showAddRule = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-1.5"
          >
            <Icon name="Server" :size="14" />
            {{ $t('network.firewallRules.service') }}
          </button>
          <button
            @click="showAddRule = !showAddRule; showQuickPort = false; showQuickService = false"
            class="px-3 py-1.5 text-xs font-medium rounded-lg btn-accent text-on-accent transition-colors flex items-center gap-1.5"
          >
            <Icon name="Plus" :size="14" />
            {{ $t('network.firewallRules.addRule') }}
          </button>
        </div>
      </div>

      <!-- Quick Port Panel -->
      <div v-if="showQuickPort" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <div class="flex flex-col sm:flex-row items-end gap-3">
          <div class="flex-1 w-full sm:w-auto">
            <label for="quick-port" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.port') }}</label>
            <input id="quick-port" v-model="quickPort.port" type="number" min="1" max="65535" placeholder="e.g. 8080" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-[color:var(--accent-primary)] font-mono" @keyup.enter="handleQuickPort" />
          </div>
          <div class="w-full sm:w-32">
            <label for="quick-protocol" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.protocol') }}</label>
            <select id="quick-protocol" v-model="quickPort.protocol" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-[color:var(--accent-primary)]">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div class="w-full sm:w-32">
            <label for="quick-action" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.action') }}</label>
            <select id="quick-action" v-model="quickPort.action" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-[color:var(--accent-primary)]">
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </div>
          <button @click="handleQuickPort" :disabled="firewallStore.loading" class="w-full sm:w-auto px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Icon v-if="firewallStore.loading" name="Loader2" :size="14" class="animate-spin" />
            {{ $t('common.apply') }}
          </button>
        </div>
      </div>

      <!-- Quick Service Panel -->
      <div v-if="showQuickService" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <p class="text-xs text-theme-muted mb-3">{{ $t('network.firewallRules.allowService') }}</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="svc in commonServices" :key="svc.name" @click="handleQuickService(svc.name)" :disabled="firewallStore.loading" class="px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm hover:border-[color:var(--accent-primary)] hover:text-accent transition-colors disabled:opacity-50 flex items-center gap-2">
            <span class="font-medium text-theme-primary">{{ svc.label }}</span>
            <span class="text-theme-muted text-xs font-mono">:{{ svc.port }}</span>
          </button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input v-model="quickService.service" type="text" :placeholder="$t('network.firewallRules.customServicePlaceholder')" class="flex-1 px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-[color:var(--accent-primary)]" @keyup.enter="handleQuickService()" />
          <button @click="handleQuickService()" :disabled="!quickService.service || firewallStore.loading" class="px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50">
            {{ $t('network.firewallRules.allow') }}
          </button>
        </div>
      </div>

      <!-- Add Rule Panel -->
      <div v-if="showAddRule" class="p-4 border-b border-theme-primary bg-theme-secondary">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label for="rule-action" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.action') }}</label>
            <select id="rule-action" v-model="newRule.action" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="allow">{{ $t('network.firewallRules.allow') }}</option><option value="deny">{{ $t('network.firewallRules.deny') }}</option><option value="reject">{{ $t('network.firewallRules.reject') }}</option></select>
          </div>
          <div>
            <label for="rule-direction" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.direction') }}</label>
            <select id="rule-direction" v-model="newRule.direction" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="in">{{ $t('network.firewallRules.inbound') }}</option><option value="out">{{ $t('network.firewallRules.outbound') }}</option></select>
          </div>
          <div>
            <label for="rule-port" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.port') }}</label>
            <input id="rule-port" v-model="newRule.port" type="number" min="1" max="65535" placeholder="e.g. 443" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
          <div>
            <label for="rule-protocol" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.protocol') }}</label>
            <select id="rule-protocol" v-model="newRule.protocol" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="both">Both</option></select>
          </div>
          <div>
            <label for="rule-from" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.fromSource') }}</label>
            <input id="rule-from" v-model="newRule.from" type="text" placeholder="e.g. 192.168.1.0/24" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
          <div>
            <label for="rule-to" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.toDest') }}</label>
            <input id="rule-to" v-model="newRule.to" type="text" placeholder="e.g. any" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted font-mono" />
          </div>
        </div>
        <div class="mt-3">
          <label for="rule-comment" class="block text-xs text-theme-muted mb-1">{{ $t('network.firewallRules.commentOptional') }}</label>
          <input id="rule-comment" v-model="newRule.comment" type="text" :placeholder="$t('network.firewallRules.ruleDescription')" class="w-full px-3 py-2 bg-theme-input border border-theme-primary rounded-lg text-sm text-theme-primary placeholder-theme-muted" @keyup.enter="handleAddRule" />
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button @click="showAddRule = false" class="px-4 py-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors">{{ $t('common.cancel') }}</button>
          <button @click="handleAddRule" :disabled="firewallStore.loading" class="px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            <Icon v-if="firewallStore.loading" name="Loader2" :size="14" class="animate-spin" />
            {{ $t('network.firewallRules.addRule') }}
          </button>
        </div>
      </div>

      <ResponsiveTable
        v-if="hasRules"
        :columns="[
          { key: 'action', label: $t('network.firewallRules.action') },
          { key: 'direction', label: $t('network.firewallRules.direction') },
          { key: 'port', label: $t('network.firewallRules.port') },
          { key: 'protocol', label: $t('network.firewallRules.protocol') },
          { key: 'from', label: $t('network.firewallRules.from') },
          { key: 'to', label: $t('network.firewallRules.to') },
          { key: 'comment', label: $t('network.firewallRules.comment') }
        ]"
        :rows="displayedRules"
        :row-key="(row) => displayedRules.indexOf(row)"
        compact
      >
        <template #cell-action="{ row }">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase" :class="[ruleActionColor(row.action), ruleActionBg(row.action)]">{{ row.action }}</span>
        </template>
        <template #cell-direction="{ row }">
          <span class="text-theme-secondary">{{ formatDirection(row.direction) }}</span>
        </template>
        <template #cell-port="{ row }">
          <span class="text-theme-primary font-mono">{{ row.port || 'any' }}</span>
        </template>
        <template #cell-protocol="{ row }">
          <span class="text-theme-secondary uppercase">{{ row.protocol || 'any' }}</span>
        </template>
        <template #cell-from="{ row }">
          <span class="text-theme-secondary font-mono">{{ row.from || 'any' }}</span>
        </template>
        <template #cell-to="{ row }">
          <span class="text-theme-secondary font-mono">{{ row.to || 'any' }}</span>
        </template>
        <template #cell-comment="{ row }">
          <span class="text-theme-muted truncate max-w-[200px]">{{ row.comment || '-' }}</span>
        </template>
        <template #row-actions="{ row }">
          <button @click="handleDeleteRule(row)" :disabled="firewallStore.loading" class="p-1.5 text-theme-muted hover:text-error hover:bg-error-muted rounded-lg transition-colors disabled:opacity-50" :title="$t('common.delete')" :aria-label="$t('network.firewallRules.deleteRuleLabel', { port: row.port || $t('network.firewallRules.any') })">
            <Icon name="Trash2" :size="16" />
          </button>
        </template>
      </ResponsiveTable>

      <!-- Empty State -->
      <div v-if="!hasRules && !firewallStore.loading" class="p-8 text-center">
        <Icon name="Shield" :size="40" class="mx-auto text-theme-tertiary mb-3" />
        <p class="text-theme-secondary text-sm">{{ $t('network.firewallRules.noRules') }}</p>
        <p class="text-theme-muted text-xs mt-1">{{ $t('network.firewallRules.addRulesHint') }}</p>
        <p v-if="systemRuleCount > 0 && !showSystemRules" class="text-theme-muted text-xs mt-2">
          {{ $t('network.firewallRules.systemRulesHidden', { count: systemRuleCount }) }}
          <button @click="toggleSystemRules" class="text-accent hover:underline">{{ $t('network.firewallRules.showThem') }}</button>
        </p>
        <button @click="showAddRule = true" class="mt-4 px-4 py-2 btn-accent text-on-accent text-sm font-medium rounded-lg inline-flex items-center gap-1.5">
          <Icon name="Plus" :size="14" />
          {{ $t('network.firewallRules.addFirstRule') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="firewallStore.loading && !hasRules" class="p-8 flex items-center justify-center gap-2">
        <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
        <span class="text-theme-muted text-sm">{{ $t('network.firewallRules.loadingRules') }}</span>
      </div>
    </div>
  </div>
</template>
