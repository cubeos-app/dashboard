<script setup>
/**
 * VPNManager.vue - Sprint 4 Component (S4-11)
 * 
 * Manage VPN configurations (WireGuard, OpenVPN).
 * Uses the VPN store and Sprint 3 API.
 */
import { ref, onMounted, computed } from 'vue'
import { useVPNStore, VPN_TYPES } from '@/stores/vpn'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const vpnStore = useVPNStore()

// Add config modal state
const showAddModal = ref(false)
const addForm = ref({
  name: '',
  type: VPN_TYPES.WIREGUARD,
  configFile: null
})
const addLoading = ref(false)
const addError = ref(null)

const fileInputRef = ref(null)

// Computed
const configs = computed(() => vpnStore.configs)
const status = computed(() => vpnStore.status)
const isConnected = computed(() => vpnStore.isConnected)

onMounted(() => {
  vpnStore.fetchConfigs()
  vpnStore.fetchStatus()
})

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
    // Auto-detect type from extension
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

async function handleConnect(config) {
  await vpnStore.connect(config.name)
}

async function handleDisconnect(config) {
  await vpnStore.disconnect(config.name)
}

async function handleDelete(config) {
  if (!await confirm({
    title: 'Delete VPN Configuration',
    message: `Delete VPN configuration "${config.name}"?`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return
  await vpnStore.deleteConfig(config.name)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-theme-secondary flex items-center gap-2">
        <Icon name="Shield" :size="16" />
        VPN Configurations
      </h3>
      <button
        @click="openAddModal"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
      >
        <Icon name="Plus" :size="16" />
        Add
      </button>
    </div>
    
    <!-- Status Card -->
    <div 
      v-if="isConnected"
      class="p-4 rounded-xl bg-success-muted border border-success-subtle"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-success-muted flex items-center justify-center">
          <Icon name="ShieldCheck" :size="20" class="text-success" />
        </div>
        <div class="flex-1">
          <p class="font-medium text-success">VPN Connected</p>
          <p class="text-sm text-success">
            {{ status?.active_config }} · {{ vpnStore.formatDuration(status?.connected_since) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-xs text-success">Public IP</p>
          <p class="font-mono text-sm text-success">{{ vpnStore.publicIP }}</p>
        </div>
      </div>
    </div>
    
    <!-- Config List -->
    <div v-if="configs.length > 0" class="space-y-2">
      <div
        v-for="config in configs"
        :key="config.id"
        class="flex items-center gap-3 p-3 rounded-xl border border-theme-primary hover:bg-theme-tertiary transition-colors"
      >
        <!-- Type icon -->
        <div 
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center',
            config.is_active 
              ? 'bg-success-muted' 
              : 'bg-theme-tertiary'
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
              class="px-1.5 py-0.5 text-xs rounded-full bg-success-muted text-success"
            >
              Active
            </span>
          </div>
          <p class="text-xs text-theme-tertiary">
            {{ vpnStore.getTypeLabel(config.type) }}
            <span v-if="config.auto_connect"> · Auto-connect</span>
          </p>
        </div>
        
        <!-- Actions -->
        <div class="flex items-center gap-1">
          <button
            v-if="config.is_active"
            @click="handleDisconnect(config)"
            :disabled="vpnStore.loading"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-error-muted text-error hover:opacity-80 transition-colors"
          >
            Disconnect
          </button>
          <button
            v-else
            @click="handleConnect(config)"
            :disabled="vpnStore.loading"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            Connect
          </button>
          <button
            @click="handleDelete(config)"
            :disabled="config.is_active"
            class="p-1.5 rounded-lg text-theme-tertiary hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
          >
            <Icon name="Trash2" :size="16" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-else class="text-center py-8">
      <Icon name="Shield" :size="32" class="text-theme-muted mx-auto mb-2" />
      <p class="text-theme-tertiary text-sm">No VPN configurations</p>
      <button
        @click="openAddModal"
        class="mt-2 text-sm text-accent hover:underline"
      >
        Add your first VPN
      </button>
    </div>
    
    <!-- Add Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="showAddModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeAddModal"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-theme-primary">
              <h2 class="text-lg font-semibold text-theme-primary">Add VPN Configuration</h2>
              <button
                @click="closeAddModal"
                class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
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
                <label class="block text-sm font-medium text-theme-secondary mb-2">
                  Type
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    @click="addForm.type = VPN_TYPES.WIREGUARD"
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
                  class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-theme-primary rounded-xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".conf,.ovpn"
                    class="hidden"
                    @change="handleFileSelect"
                  />
                  <Icon 
                    :name="addForm.configFile ? 'FileCheck' : 'Upload'" 
                    :size="24" 
                    :class="addForm.configFile ? 'text-success' : 'text-theme-muted'"
                  />
                  <p class="mt-2 text-sm text-theme-secondary">
                    {{ addForm.configFile?.name || 'Click to upload' }}
                  </p>
                  <p class="text-xs text-theme-tertiary">
                    .conf or .ovpn file
                  </p>
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
                    ? 'bg-accent/50 text-white cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent-hover'
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
