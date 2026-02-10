<script setup>
/**
 * VPNManager.vue — Sprint 2 G4
 * 
 * Standalone VPN management page at /vpn route.
 * 
 * Features:
 * - Page header with back button + refresh
 * - Status card with connection state + public IP
 * - Config list with expandable detail panels (mutually exclusive)
 * - Auto-connect toggle per config
 * - Config detail: type, filename, created date, connection stats
 * - Add config modal with file upload
 * - Delete config with confirm dialog
 * 
 * Store methods used:
 *   fetchConfigs, fetchStatus, fetchPublicIP, fetchConfigDetail,
 *   addConfig, deleteConfig, connect, disconnect, setAutoConnect,
 *   getTypeLabel, getTypeIcon, formatDuration
 */
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useVPNStore, VPN_TYPES } from '@/stores/vpn'
import { confirm } from '@/utils/confirmDialog'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'

const { signal } = useAbortOnUnmount()
const { trapFocus } = useFocusTrap()
const router = useRouter()
const vpnStore = useVPNStore()

// ==========================================
// State
// ==========================================

const refreshing = ref(false)
const error = ref(null)

// Detail panel — which config is expanded (name or null)
const expandedConfig = ref(null)
const detailLoading = ref(false)

// Add config modal
const showAddModal = ref(false)
const addModalRef = ref(null)
const addForm = ref({
  name: '',
  type: VPN_TYPES.WIREGUARD,
  configFile: null
})
const addLoading = ref(false)
const addError = ref(null)
const fileInputRef = ref(null)

// ==========================================
// Computed
// ==========================================

const configs = computed(() => vpnStore.configs)
const status = computed(() => vpnStore.status)
const isConnected = computed(() => vpnStore.isConnected)
const publicIP = computed(() => vpnStore.publicIP)
const combinedError = computed(() => error.value || vpnStore.error)

// ==========================================
// Data Fetching
// ==========================================

async function loadAll() {
  refreshing.value = true
  error.value = null
  try {
    const opts = { signal: signal() }
    await Promise.all([
      vpnStore.fetchConfigs(false, opts),
      vpnStore.fetchStatus(false, opts),
      vpnStore.fetchPublicIP(false, opts)
    ])
  } catch (e) {
    error.value = e.message
  } finally {
    refreshing.value = false
  }
}

async function refresh() {
  expandedConfig.value = null
  await loadAll()
}

let statusPollInterval = null

onMounted(() => {
  loadAll()
  // Poll VPN status every 30s to detect external disconnects
  statusPollInterval = setInterval(() => {
    vpnStore.fetchStatus(false, { signal: signal() }).catch(() => {})
  }, 30000)
})

onUnmounted(() => {
  if (statusPollInterval) {
    clearInterval(statusPollInterval)
    statusPollInterval = null
  }
})

// Focus add modal when shown
watch(showAddModal, (visible) => {
  if (visible) nextTick(() => addModalRef.value?.focus())
})

// ==========================================
// Detail Panel
// ==========================================

async function toggleDetail(config) {
  if (expandedConfig.value === config.name) {
    expandedConfig.value = null
    return
  }
  
  expandedConfig.value = config.name
  detailLoading.value = true
  try {
    await vpnStore.fetchConfigDetail(config.name)
  } finally {
    detailLoading.value = false
  }
}

function isExpanded(config) {
  return expandedConfig.value === config.name
}

// ==========================================
// Auto-Connect
// ==========================================

async function toggleAutoConnect(config) {
  const newValue = !config.auto_connect
  try {
    await vpnStore.setAutoConnect(config.name, newValue)
  } catch (e) {
    error.value = e.message || 'Failed to toggle auto-connect'
  }
}

// ==========================================
// Connect / Disconnect
// ==========================================

async function handleConnect(config) {
  try {
    await vpnStore.connect(config.name)
    // Refresh public IP after connect
    await vpnStore.fetchPublicIP()
  } catch (e) {
    error.value = e.message || 'Failed to connect'
  }
}

async function handleDisconnect(config) {
  try {
    await vpnStore.disconnect(config.name)
    // Refresh public IP after disconnect
    await vpnStore.fetchPublicIP()
  } catch (e) {
    error.value = e.message || 'Failed to disconnect'
  }
}

// ==========================================
// Delete
// ==========================================

async function handleDelete(config) {
  if (!await confirm({
    title: 'Delete VPN Configuration',
    message: `Delete VPN configuration "${config.name}"? This cannot be undone.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return
  
  if (expandedConfig.value === config.name) {
    expandedConfig.value = null
  }
  await vpnStore.deleteConfig(config.name)
}

// ==========================================
// Add Modal
// ==========================================

function openAddModal() {
  addForm.value = {
    name: '',
    type: VPN_TYPES.WIREGUARD,
    configFile: null
  }
  addError.value = null
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    addForm.value.configFile = file
    if (file.name.endsWith('.conf')) {
      addForm.value.type = VPN_TYPES.WIREGUARD
    } else if (file.name.endsWith('.ovpn')) {
      addForm.value.type = VPN_TYPES.OPENVPN
    }
  }
}

async function submitAdd() {
  if (!addForm.value.name || !addForm.value.configFile) {
    addError.value = 'Name and config file are required'
    return
  }
  
  addLoading.value = true
  addError.value = null
  
  try {
    const success = await vpnStore.addConfig(
      addForm.value.name,
      addForm.value.type,
      addForm.value.configFile
    )
    if (success) {
      closeAddModal()
    } else {
      addError.value = vpnStore.error || 'Failed to add configuration'
    }
  } finally {
    addLoading.value = false
  }
}

// ==========================================
// Helpers
// ==========================================

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5 pb-8">
    <!-- ==================== Page Header ==================== -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="router.push('/network')"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          aria-label="Back to network"
        >
          <Icon name="ArrowLeft" :size="18" />
        </button>
        <div>
          <h1 class="text-xl font-semibold text-theme-primary tracking-tight">VPN</h1>
          <p class="text-theme-tertiary text-sm">Manage VPN configurations</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="refresh"
          :disabled="refreshing"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          aria-label="Refresh VPN status"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': refreshing }" />
        </button>
        <button
          @click="openAddModal"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium btn-accent"
          aria-label="Add VPN configuration"
        >
          <Icon name="Plus" :size="16" />
          <span class="hidden sm:inline">Add Config</span>
        </button>
      </div>
    </div>

    <!-- ==================== Error Banner ==================== -->
    <div
      v-if="combinedError"
      class="flex items-center gap-2 p-3 rounded-xl bg-error-muted border border-error/20"
    >
      <Icon name="AlertCircle" :size="16" class="text-error flex-shrink-0" />
      <p class="text-sm text-error flex-1">{{ combinedError }}</p>
      <button @click="error = null; vpnStore.clearError()" class="text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- ==================== Status Card ==================== -->
    <div
      :class="[
        'p-4 rounded-xl border transition-colors',
        isConnected
          ? 'bg-success-muted border-success-subtle'
          : 'bg-theme-card border-theme-primary'
      ]"
    >
      <div class="flex items-center gap-3">
        <div
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center',
            isConnected ? 'bg-success-muted' : 'bg-theme-tertiary'
          ]"
        >
          <Icon
            :name="isConnected ? 'ShieldCheck' : 'ShieldOff'"
            :size="20"
            :class="isConnected ? 'text-success' : 'text-theme-muted'"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p :class="['font-medium', isConnected ? 'text-success' : 'text-theme-secondary']">
            {{ isConnected ? 'VPN Connected' : 'VPN Disconnected' }}
          </p>
          <p v-if="isConnected && (status?.config_name || status?.active_config)" class="text-sm text-theme-secondary truncate">
            {{ status.config_name || status.active_config }}
            <span v-if="status?.connected_since"> · {{ vpnStore.formatDuration(status.connected_since) }}</span>
          </p>
          <p v-if="!isConnected" class="text-xs text-theme-muted">
            {{ configs.length === 0 ? 'Add a configuration to get started' : 'Select a configuration to connect' }}
          </p>
        </div>
        <!-- Public IP -->
        <div v-if="publicIP" class="text-right hidden sm:block">
          <p class="text-xs text-theme-muted">Public IP</p>
          <p class="font-mono text-sm text-theme-primary">{{ publicIP }}</p>
        </div>
      </div>
      <!-- Public IP mobile -->
      <div v-if="publicIP" class="mt-3 pt-3 border-t border-theme-primary sm:hidden">
        <div class="flex items-center justify-between">
          <p class="text-xs text-theme-muted">Public IP</p>
          <p class="font-mono text-sm text-theme-primary">{{ publicIP }}</p>
        </div>
      </div>
    </div>

    <!-- ==================== Config List ==================== -->
    <div v-if="configs.length > 0" class="space-y-2">
      <div
        v-for="config in configs"
        :key="config.id || config.name"
        class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden transition-all"
      >
        <!-- Config Row (clickable for detail) -->
        <div
          @click="toggleDetail(config)"
          @keydown.enter="toggleDetail(config)"
          role="button"
          tabindex="0"
          :aria-expanded="isExpanded(config)"
          :aria-label="'VPN configuration: ' + config.name + (config.is_active ? ' (active)' : '')"
          class="flex items-center gap-3 p-4 cursor-pointer hover:bg-theme-tertiary transition-colors"
        >
          <!-- Type icon -->
          <div
            :class="[
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              config.is_active ? 'bg-success-muted' : 'bg-theme-tertiary'
            ]"
          >
            <Icon
              :name="vpnStore.getTypeIcon(config.type)"
              :size="20"
              :class="config.is_active ? 'text-success' : 'text-theme-secondary'"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium text-theme-primary truncate">{{ config.name }}</p>
              <span
                v-if="config.is_active"
                class="px-1.5 py-0.5 text-xs rounded-full bg-success-muted text-success flex-shrink-0"
              >
                Active
              </span>
              <span
                v-if="config.auto_connect"
                class="px-1.5 py-0.5 text-xs rounded-full bg-accent/10 text-accent flex-shrink-0 hidden sm:inline"
              >
                Auto
              </span>
            </div>
            <p class="text-xs text-theme-tertiary">
              {{ vpnStore.getTypeLabel(config.type) }}
            </p>
          </div>

          <!-- Actions (stop propagation on buttons) -->
          <div class="flex items-center gap-1 flex-shrink-0" @click.stop>
            <button
              v-if="config.is_active"
              @click="handleDisconnect(config)"
              :disabled="vpnStore.loading"
              class="px-3 py-1.5 rounded-lg text-sm font-medium bg-error-muted text-error hover:opacity-80 transition-colors disabled:opacity-50"
              :aria-label="'Disconnect ' + config.name"
            >
              Disconnect
            </button>
            <button
              v-else
              @click="handleConnect(config)"
              :disabled="vpnStore.loading"
              class="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
              :aria-label="'Connect ' + config.name"
            >
              Connect
            </button>
            <button
              @click="handleDelete(config)"
              :disabled="config.is_active"
              :title="config.is_active ? 'Disconnect before deleting' : 'Delete configuration'"
              :aria-label="'Delete ' + config.name + ' configuration'"
              class="p-1.5 rounded-lg text-theme-tertiary hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="Trash2" :size="16" />
            </button>
          </div>

          <!-- Expand indicator -->
          <Icon
            name="ChevronDown"
            :size="16"
            :class="[
              'text-theme-muted transition-transform duration-200 flex-shrink-0',
              isExpanded(config) ? 'rotate-180' : ''
            ]"
          />
        </div>

        <!-- ==================== Detail Panel (expandable) ==================== -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-[600px] opacity-100"
          leave-from-class="max-h-[600px] opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div v-if="isExpanded(config)" class="overflow-hidden">
            <div class="px-4 pb-4 border-t border-theme-primary">
              <!-- Loading state -->
              <div v-if="detailLoading" class="flex items-center justify-center py-6">
                <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
              </div>

              <!-- Detail content -->
              <div v-else class="pt-4 space-y-4">
                <!-- Detail grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Type</p>
                    <p class="text-xs font-medium text-theme-primary">{{ vpnStore.getTypeLabel(config.type) }}</p>
                  </div>
                  <div>
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Status</p>
                    <p :class="['text-xs font-medium', config.is_active ? 'text-success' : 'text-theme-secondary']">
                      {{ config.is_active ? 'Connected' : 'Disconnected' }}
                    </p>
                  </div>
                  <div v-if="vpnStore.selectedConfig?.created_at || config.created_at">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Created</p>
                    <p class="text-xs font-medium text-theme-primary">
                      {{ formatDate(vpnStore.selectedConfig?.created_at || config.created_at) }}
                    </p>
                  </div>
                  <div v-if="vpnStore.selectedConfig?.config_path || vpnStore.selectedConfig?.filename || config.config_path || config.filename">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">File</p>
                    <p class="text-xs font-medium text-theme-primary font-mono truncate">
                      {{ vpnStore.selectedConfig?.config_path || vpnStore.selectedConfig?.filename || config.config_path || config.filename }}
                    </p>
                  </div>
                  <div v-if="config.is_active && status?.connected_since">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Connected For</p>
                    <p class="text-xs font-medium text-success">
                      {{ vpnStore.formatDuration(status.connected_since) }}
                    </p>
                  </div>
                  <div v-if="config.is_active && publicIP">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Public IP</p>
                    <p class="text-xs font-medium text-theme-primary font-mono">{{ publicIP }}</p>
                  </div>
                </div>

                <!-- Connection stats (when active and detail has stats) -->
                <!-- NOTE: stats field not in Swagger VPNConfig model. Block renders
                     only if fetchConfigDetail returns stats (rx_bytes, tx_bytes). -->
                <div
                  v-if="config.is_active && vpnStore.selectedConfig?.stats"
                  class="grid grid-cols-2 sm:grid-cols-4 gap-3"
                >
                  <div v-if="vpnStore.selectedConfig.stats.rx_bytes != null">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Downloaded</p>
                    <p class="text-xs font-medium text-theme-primary font-mono">
                      {{ formatBytes(vpnStore.selectedConfig.stats.rx_bytes) }}
                    </p>
                  </div>
                  <div v-if="vpnStore.selectedConfig.stats.tx_bytes != null">
                    <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Uploaded</p>
                    <p class="text-xs font-medium text-theme-primary font-mono">
                      {{ formatBytes(vpnStore.selectedConfig.stats.tx_bytes) }}
                    </p>
                  </div>
                </div>

                <!-- Auto-connect toggle -->
                <div class="flex items-center justify-between py-2 border-t border-theme-primary">
                  <div>
                    <p class="text-xs font-medium text-theme-primary">Auto-connect</p>
                    <p class="text-xs text-theme-muted">Connect automatically on boot</p>
                  </div>
                  <button
                    @click="toggleAutoConnect(config)"
                    :disabled="vpnStore.loading"
                    role="switch"
                    :aria-checked="config.auto_connect ? 'true' : 'false'"
                    :aria-label="'Auto-connect ' + config.name"
                    class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 disabled:opacity-50"
                    :class="config.auto_connect ? 'bg-accent' : 'bg-theme-tertiary border border-theme-secondary'"
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-full bg-theme-primary shadow transform transition-transform duration-200"
                      :class="config.auto_connect ? 'translate-x-5' : 'translate-x-1'"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ==================== Empty State ==================== -->
    <div v-else-if="!refreshing" class="text-center py-12">
      <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center mx-auto mb-3">
        <Icon name="Shield" :size="24" class="text-theme-muted" />
      </div>
      <p class="text-theme-secondary font-medium mb-1">No VPN Configurations</p>
      <p class="text-sm text-theme-muted mb-4">Add a WireGuard or OpenVPN configuration to get started</p>
      <button
        @click="openAddModal"
        class="px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        aria-label="Add VPN configuration"
      >
        Add Configuration
      </button>
    </div>

    <!-- ==================== Loading State ==================== -->
    <div v-if="refreshing && configs.length === 0" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-2 text-sm text-theme-muted">Loading VPN configurations...</span>
    </div>

    <!-- ==================== Add Config Modal ==================== -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showAddModal"
          ref="addModalRef"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add VPN Configuration"
          tabindex="-1"
          @click.self="closeAddModal"
          @keydown.escape="closeAddModal"
          @keydown="trapFocus"
        >
          <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"></div>

          <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-theme-primary">
              <h2 class="text-lg font-semibold text-theme-primary">Add VPN Configuration</h2>
              <button
                @click="closeAddModal"
                class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                aria-label="Close"
              >
                <Icon name="X" :size="20" />
              </button>
            </div>

            <!-- Form -->
            <div class="p-4 space-y-4">
              <!-- Name -->
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">
                  Configuration Name
                </label>
                <input
                  v-model="addForm.name"
                  type="text"
                  placeholder="e.g., Work VPN"
                  class="w-full px-4 py-2.5 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <!-- Type -->
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Type</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    @click="addForm.type = VPN_TYPES.WIREGUARD"
                    aria-label="Select WireGuard type"
                    :class="[
                      'p-3 rounded-xl border-2 text-left transition-all',
                      addForm.type === VPN_TYPES.WIREGUARD
                        ? 'border-accent bg-accent/5'
                        : 'border-theme-primary hover:border-theme-secondary'
                    ]"
                  >
                    <Icon name="Lock" :size="20" class="text-theme-secondary mb-1" />
                    <p class="font-medium text-sm">WireGuard</p>
                    <p class="text-xs text-theme-tertiary">.conf file</p>
                  </button>
                  <button
                    @click="addForm.type = VPN_TYPES.OPENVPN"
                    aria-label="Select OpenVPN type"
                    :class="[
                      'p-3 rounded-xl border-2 text-left transition-all',
                      addForm.type === VPN_TYPES.OPENVPN
                        ? 'border-accent bg-accent/5'
                        : 'border-theme-primary hover:border-theme-secondary'
                    ]"
                  >
                    <Icon name="Key" :size="20" class="text-theme-secondary mb-1" />
                    <p class="font-medium text-sm">OpenVPN</p>
                    <p class="text-xs text-theme-tertiary">.ovpn file</p>
                  </button>
                </div>
              </div>

              <!-- File upload -->
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">
                  Configuration File
                </label>
                <div
                  @click="fileInputRef?.click()"
                  @keydown.enter="fileInputRef?.click()"
                  @keydown.space.prevent="fileInputRef?.click()"
                  role="button"
                  tabindex="0"
                  :aria-label="addForm.configFile ? 'Selected file: ' + addForm.configFile.name + '. Click to change.' : 'Click to upload VPN configuration file'"
                  class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-theme-primary rounded-xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".conf,.ovpn"
                    class="hidden"
                    @change="handleFileSelect"
                    aria-label="Upload VPN configuration file"
                  />
                  <Icon
                    :name="addForm.configFile ? 'FileCheck' : 'Upload'"
                    :size="24"
                    :class="addForm.configFile ? 'text-success' : 'text-theme-muted'"
                  />
                  <p class="mt-2 text-sm text-theme-secondary">
                    {{ addForm.configFile?.name || 'Click to upload' }}
                  </p>
                  <p class="text-xs text-theme-tertiary">.conf or .ovpn file</p>
                </div>
              </div>

              <!-- Error -->
              <div
                v-if="addError"
                class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
              >
                <Icon name="AlertCircle" :size="16" />
                {{ addError }}
              </div>
            </div>

            <!-- Footer -->
            <div class="flex justify-end gap-2 p-4 border-t border-theme-primary bg-theme-secondary">
              <button
                @click="closeAddModal"
                class="px-4 py-2 rounded-lg text-sm font-medium bg-theme-tertiary text-theme-secondary hover:bg-theme-card transition-colors"
              >
                Cancel
              </button>
              <button
                @click="submitAdd"
                :disabled="addLoading || !addForm.name || !addForm.configFile"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                  addLoading || !addForm.name || !addForm.configFile
                    ? 'bg-accent/50 text-on-accent cursor-not-allowed'
                    : 'bg-accent text-on-accent hover:bg-accent-hover'
                ]"
              >
                <Icon v-if="addLoading" name="Loader2" :size="16" class="animate-spin" />
                {{ addLoading ? 'Adding...' : 'Add Configuration' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
