<script setup>
/**
 * NPMTab.vue — Sprint 3 G4
 *
 * Nginx Proxy Manager proxy host management component.
 * New tab in AppManagerView for managing reverse proxy hosts.
 *
 * Features:
 *   - NPM service status card
 *   - Proxy host list with enable/disable indicators
 *   - Create Host modal with domain, forward, SSL config
 *   - Delete Host with confirm dialog
 *   - Responsive: desktop table → mobile card layout
 *
 * Store:
 *   - useNPMStore → status, hosts, createHost, deleteHost
 */
import { ref, computed, onMounted } from 'vue'
import { useNPMStore } from '@/stores/npm'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const npmStore = useNPMStore()

// ==========================================
// State
// ==========================================

const showCreateModal = ref(false)
const createLoading = ref(false)
const deleteLoading = ref({})
const actionError = ref(null)

const hostForm = ref({
  domain_names: '',
  forward_host: '',
  forward_port: 80,
  forward_scheme: 'http',
  ssl_forced: false,
  certificate_id: 0,
  block_exploits: true,
  allow_websocket_upgrade: true
})

// ==========================================
// Computed
// ==========================================

const hosts = computed(() => npmStore.hosts || [])

const activeCount = computed(() => npmStore.activeHosts?.length || 0)

// ==========================================
// Data Fetching
// ==========================================

onMounted(() => {
  npmStore.fetchAll()
})

async function refresh() {
  actionError.value = null
  await npmStore.fetchAll()
}

// ==========================================
// Actions
// ==========================================

function openCreateHost() {
  hostForm.value = {
    domain_names: '',
    forward_host: '',
    forward_port: 80,
    forward_scheme: 'http',
    ssl_forced: false,
    certificate_id: 0,
    block_exploits: true,
    allow_websocket_upgrade: true
  }
  actionError.value = null
  showCreateModal.value = true
}

async function saveHost() {
  if (!hostForm.value.domain_names.trim() || !hostForm.value.forward_host.trim()) return

  createLoading.value = true
  actionError.value = null
  try {
    // Parse domain names — support comma-separated
    const domains = hostForm.value.domain_names
      .split(',')
      .map(d => d.trim())
      .filter(Boolean)

    // Validate domain format
    const domainPattern = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
    const invalid = domains.find(d => !domainPattern.test(d))
    if (invalid) {
      actionError.value = `Invalid domain format: ${invalid}`
      createLoading.value = false
      return
    }

    await npmStore.createHost({
      domain_names: domains,
      forward_host: hostForm.value.forward_host.trim(),
      forward_port: Number(hostForm.value.forward_port) || 80,
      forward_scheme: hostForm.value.forward_scheme,
      ssl_forced: hostForm.value.ssl_forced,
      certificate_id: hostForm.value.certificate_id || 0,
      block_exploits: hostForm.value.block_exploits,
      allow_websocket_upgrade: hostForm.value.allow_websocket_upgrade
    })
    showCreateModal.value = false
  } catch (e) {
    actionError.value = 'Failed to create host: ' + e.message
  } finally {
    createLoading.value = false
  }
}

async function deleteHost(host) {
  const displayName = host.domain_names?.join(', ') || host.domain || `Host #${host.id}`
  if (!await confirm({
    title: 'Delete Proxy Host',
    message: `Delete proxy host for "${displayName}"? This will remove the reverse proxy configuration.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  deleteLoading.value = { ...deleteLoading.value, [host.id]: true }
  actionError.value = null
  try {
    await npmStore.deleteHost(host.id)
  } catch (e) {
    actionError.value = 'Failed to delete host: ' + e.message
  } finally {
    deleteLoading.value = { ...deleteLoading.value, [host.id]: false }
  }
}

// ==========================================
// Helpers
// ==========================================

function getDomainDisplay(host) {
  if (Array.isArray(host.domain_names)) return host.domain_names.join(', ')
  return host.domain || host.domain_names || '-'
}

function getForwardDisplay(host) {
  const scheme = host.forward_scheme || 'http'
  const fwdHost = host.forward_host || '-'
  const port = host.forward_port || 80
  return `${scheme}://${fwdHost}:${port}`
}

function hostStatusClass(host) {
  if (host.enabled === false) return 'bg-theme-tertiary text-theme-muted'
  return 'bg-success-muted text-success'
}

function hostStatusText(host) {
  if (host.enabled === false) return 'Disabled'
  return 'Active'
}
</script>

<template>
  <div class="space-y-6">

    <!-- ==================== Status Card ==================== -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="npmStore.isOnline ? 'bg-success-muted' : 'bg-theme-tertiary'"
          >
            <Icon
              name="Shield"
              :size="20"
              :class="npmStore.isOnline ? 'text-success' : 'text-theme-muted'"
            />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Nginx Proxy Manager</h3>
            <div v-if="npmStore.loading" class="flex items-center gap-2 text-sm text-theme-muted mt-0.5">
              <Icon name="Loader2" :size="14" class="animate-spin" />
              Loading...
            </div>
            <div v-else class="flex flex-wrap items-center gap-3 text-sm mt-0.5">
              <span
                class="flex items-center gap-1"
                :class="npmStore.isOnline ? 'text-success' : 'text-error'"
              >
                <Icon :name="npmStore.isOnline ? 'CheckCircle' : 'XCircle'" :size="14" />
                {{ npmStore.isOnline ? 'Running' : 'Stopped' }}
              </span>
              <span class="text-theme-muted">{{ npmStore.hostCount }} host{{ npmStore.hostCount !== 1 ? 's' : '' }}</span>
              <span v-if="activeCount !== npmStore.hostCount" class="text-theme-muted">({{ activeCount }} active)</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            @click="openCreateHost"
            :disabled="!npmStore.isOnline"
            class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon name="Plus" :size="16" />
            Add Host
          </button>
          <button
            @click="refresh"
            :disabled="npmStore.loading"
            class="p-2 bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh NPM status"
          >
            <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': npmStore.loading }" class="text-theme-secondary" />
          </button>
        </div>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- Not running info -->
    <div v-if="npmStore.status && !npmStore.isOnline" class="bg-warning-muted border border-warning rounded-lg p-4">
      <div class="flex items-center gap-2 mb-2">
        <Icon name="AlertCircle" :size="16" class="text-warning" />
        <p class="text-sm font-medium text-warning">NPM is not running</p>
      </div>
      <p class="text-sm text-theme-muted">Start Nginx Proxy Manager to manage reverse proxy hosts.</p>
    </div>

    <!-- ==================== Hosts List — Desktop Table ==================== -->
    <div v-if="hosts.length > 0" class="hidden md:block bg-theme-card rounded-xl border border-theme-primary overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-theme-muted border-b border-theme-primary bg-theme-tertiary/30">
            <th class="py-3 px-4">Domain</th>
            <th class="py-3 px-4">Forward To</th>
            <th class="py-3 px-4">SSL</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 w-10"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="host in hosts"
            :key="host.id"
            class="border-b border-theme-primary/50 hover:bg-theme-tertiary/30 transition-colors"
          >
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <Icon name="Globe" :size="16" class="text-accent flex-shrink-0" />
                <span class="text-theme-primary font-medium truncate max-w-xs">{{ getDomainDisplay(host) }}</span>
              </div>
            </td>
            <td class="py-3 px-4">
              <span class="text-theme-secondary font-mono text-xs">{{ getForwardDisplay(host) }}</span>
            </td>
            <td class="py-3 px-4">
              <span
                class="px-2 py-0.5 text-[10px] font-semibold rounded"
                :class="host.ssl_forced || host.certificate_id ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
              >
                {{ host.ssl_forced || host.certificate_id ? 'Enabled' : 'Off' }}
              </span>
            </td>
            <td class="py-3 px-4">
              <span
                class="px-2 py-0.5 text-[10px] font-semibold rounded"
                :class="hostStatusClass(host)"
              >{{ hostStatusText(host) }}</span>
            </td>
            <td class="py-3 px-4">
              <button
                @click="deleteHost(host)"
                :disabled="deleteLoading[host.id]"
                class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted disabled:opacity-50"
                title="Delete host"
                :aria-label="'Delete proxy host ' + getDomainDisplay(host)"
              >
                <Icon v-if="deleteLoading[host.id]" name="Loader2" :size="14" class="animate-spin" />
                <Icon v-else name="Trash2" :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== Hosts List — Mobile Cards ==================== -->
    <div v-if="hosts.length > 0" class="md:hidden space-y-3">
      <div
        v-for="host in hosts"
        :key="'m-' + host.id"
        class="bg-theme-card rounded-xl border border-theme-primary p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon name="Globe" :size="20" class="text-accent" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-theme-primary truncate">{{ getDomainDisplay(host) }}</p>
              <p class="text-xs text-theme-muted font-mono truncate mt-0.5">{{ getForwardDisplay(host) }}</p>
            </div>
          </div>
          <button
            @click="deleteHost(host)"
            :disabled="deleteLoading[host.id]"
            class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted disabled:opacity-50 flex-shrink-0"
            title="Delete host"
            :aria-label="'Delete proxy host ' + getDomainDisplay(host)"
          >
            <Icon v-if="deleteLoading[host.id]" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Trash2" :size="14" />
          </button>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <span
            class="px-2 py-0.5 text-[10px] font-semibold rounded"
            :class="hostStatusClass(host)"
          >{{ hostStatusText(host) }}</span>
          <span
            class="px-2 py-0.5 text-[10px] font-semibold rounded"
            :class="host.ssl_forced || host.certificate_id ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
          >
            SSL {{ host.ssl_forced || host.certificate_id ? 'On' : 'Off' }}
          </span>
          <span v-if="host.block_exploits" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-accent-muted text-accent">
            Exploits Blocked
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="hosts.length === 0 && npmStore.isOnline && !npmStore.loading" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Shield" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Proxy Hosts</h3>
      <p class="text-theme-muted text-sm mb-4">Add a proxy host to route traffic to your services.</p>
      <button @click="openCreateHost" class="px-4 py-2 btn-accent rounded-lg text-sm">Add First Host</button>
    </div>

    <!-- ==================== Create Host Modal ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showCreateModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create Proxy Host"
        >
          <div class="absolute inset-0 bg-theme-overlay" @click="showCreateModal = false"></div>
          <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary flex-shrink-0">
              <h3 class="text-lg font-semibold text-theme-primary">Create Proxy Host</h3>
              <button @click="showCreateModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
                <Icon name="X" :size="18" />
              </button>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label for="npm-domain-names" class="block text-sm font-medium text-theme-secondary mb-1">Domain Name(s)</label>
                <input
                  id="npm-domain-names"
                  v-model="hostForm.domain_names"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="app.cubeos.cube"
                >
                <p class="mt-1 text-xs text-theme-muted">Comma-separated for multiple domains</p>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-1">
                  <label for="npm-scheme" class="block text-sm font-medium text-theme-secondary mb-1">Scheme</label>
                  <select
                    id="npm-scheme"
                    v-model="hostForm.forward_scheme"
                    class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  >
                    <option value="http">http</option>
                    <option value="https">https</option>
                  </select>
                </div>
                <div class="col-span-1">
                  <label for="npm-forward-host" class="block text-sm font-medium text-theme-secondary mb-1">Forward Host</label>
                  <input
                    id="npm-forward-host"
                    v-model="hostForm.forward_host"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                    placeholder="10.42.24.1"
                  >
                </div>
                <div class="col-span-1">
                  <label for="npm-forward-port" class="block text-sm font-medium text-theme-secondary mb-1">Port</label>
                  <input
                    id="npm-forward-port"
                    v-model.number="hostForm.forward_port"
                    type="number"
                    min="1"
                    max="65535"
                    class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                    placeholder="80"
                  >
                </div>
              </div>

              <div class="space-y-3 pt-2">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="hostForm.ssl_forced" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Force SSL (redirect HTTP to HTTPS)</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="hostForm.block_exploits" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Block common exploits</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="hostForm.allow_websocket_upgrade" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Allow WebSocket upgrade</span>
                </label>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary flex-shrink-0">
              <button @click="showCreateModal = false" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">
                Cancel
              </button>
              <button
                @click="saveHost"
                :disabled="createLoading || !hostForm.domain_names.trim() || !hostForm.forward_host.trim()"
                class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon v-if="createLoading" name="Loader2" :size="14" class="animate-spin" />
                Create Host
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
