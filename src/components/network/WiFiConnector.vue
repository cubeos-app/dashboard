<script setup>
/**
 * WiFiConnector.vue - Sprint 2 Enhanced
 * 
 * Scan and connect to upstream WiFi networks for ONLINE_WIFI mode.
 * Sprint 2 additions: disconnect button, saved networks list with forget action,
 * WiFi status indicator showing connected SSID + signal.
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'connected'])

const networkStore = useNetworkStore()
const { trapFocus } = useFocusTrap()
const modalRef = ref(null)

// Local state
const selectedNetwork = ref(null)
const password = ref('')
const showPassword = ref(false)
const connecting = ref(false)
const connectError = ref(null)
const activeView = ref('scan') // 'scan' | 'saved'

// Computed
const networks = computed(() => networkStore.wifiNetworks)
const scanning = computed(() => networkStore.scanning)

// Sort networks by signal strength
const sortedNetworks = computed(() => {
  return [...networks.value].sort((a, b) => b.signal - a.signal)
})

// Watch for modal open
watch(() => props.show, (val) => {
  if (val) {
    scanNetworks()
    networkStore.fetchWiFiStatus()
    networkStore.fetchSavedNetworks()
    activeView.value = 'scan'
    // Focus the modal container on open for keyboard accessibility
    nextTick(() => {
      modalRef.value?.focus()
    })
  }
})

// Initial scan on mount
onMounted(() => {
  if (props.show) {
    scanNetworks()
  }
})

const scanCooldown = ref(false)
let scanCooldownTimeout = null

async function scanNetworks() {
  if (scanCooldown.value) return
  scanCooldown.value = true
  await networkStore.scanWiFi()
  // 5s cooldown between scans
  if (scanCooldownTimeout) clearTimeout(scanCooldownTimeout)
  scanCooldownTimeout = setTimeout(() => { scanCooldown.value = false }, 5000)
}

function selectNetwork(network) {
  selectedNetwork.value = network
  password.value = ''
  connectError.value = null
}

function clearSelection() {
  selectedNetwork.value = null
  password.value = ''
  connectError.value = null
}

async function connect() {
  if (!selectedNetwork.value) return
  
  connecting.value = true
  connectError.value = null
  
  try {
    const success = await networkStore.setMode(NETWORK_MODES.ONLINE_WIFI, {
      ssid: selectedNetwork.value.ssid,
      password: password.value
    })
    
    if (success) {
      emit('connected', selectedNetwork.value.ssid)
      close()
    } else {
      connectError.value = networkStore.error || 'Failed to connect'
    }
  } catch (e) {
    connectError.value = e.message
  } finally {
    connecting.value = false
  }
}

async function disconnect() {
  connecting.value = true
  try {
    await networkStore.disconnectWiFi()
  } finally {
    connecting.value = false
  }
}

async function forgetNetwork(ssid) {
  await networkStore.forgetNetwork(ssid)
}

function close() {
  emit('close')
  selectedNetwork.value = null
  password.value = ''
  connectError.value = null
  activeView.value = 'scan'
}

function getSignalBars(signal) {
  const percent = networkStore.formatSignal(signal)
  if (percent >= 75) return 4
  if (percent >= 50) return 3
  if (percent >= 25) return 2
  return 1
}

function getSecurityIcon(security) {
  if (!security || security === 'open') return 'Unlock'
  return 'Lock'
}

onUnmounted(() => {
  if (scanCooldownTimeout) clearTimeout(scanCooldownTimeout)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"></div>
        
        <!-- Modal -->
        <div 
          ref="modalRef"
          class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="WiFi Manager"
          tabindex="-1"
          @keydown="trapFocus"
          @keydown.escape="close"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-theme-primary">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-success-muted flex items-center justify-center">
                <Icon name="Wifi" :size="20" class="text-success" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-theme-primary">WiFi Manager</h2>
                <p class="text-sm text-theme-tertiary">Connect, disconnect, and manage networks</p>
              </div>
            </div>
            <button
              @click="close"
              class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close"
            >
              <Icon name="X" :size="20" />
            </button>
          </div>

          <!-- WiFi Status Bar (when connected) -->
          <div v-if="networkStore.isWiFiConnected" class="px-4 py-3 bg-success-muted border-b border-theme-primary">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon name="Wifi" :size="16" class="text-success" />
                <span class="text-sm font-medium text-success">
                  Connected to {{ networkStore.wifiStatus?.ssid || 'Unknown' }}
                </span>
                <span v-if="networkStore.wifiStatus?.signal" class="text-xs text-success/70">
                  {{ networkStore.wifiStatus.signal }}%
                </span>
              </div>
              <button
                @click="disconnect"
                :disabled="connecting"
                class="px-2.5 py-1 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 disabled:opacity-50"
                aria-label="Disconnect WiFi"
              >
                Disconnect
              </button>
            </div>
          </div>

          <!-- Tab switcher: Scan / Saved -->
          <div class="flex border-b border-theme-primary" role="tablist" aria-label="WiFi views">
            <button
              @click="activeView = 'scan'"
              class="flex-1 px-4 py-2 text-sm font-medium text-center border-b-2 -mb-px transition-colors"
              role="tab"
              :aria-selected="activeView === 'scan'"
              :class="activeView === 'scan' 
                ? 'border-[color:var(--accent-primary)] text-accent' 
                : 'border-transparent text-theme-muted hover:text-theme-primary'"
            >
              Scan Networks
            </button>
            <button
              @click="activeView = 'saved'"
              class="flex-1 px-4 py-2 text-sm font-medium text-center border-b-2 -mb-px transition-colors flex items-center justify-center gap-1.5"
              role="tab"
              :aria-selected="activeView === 'saved'"
              :class="activeView === 'saved' 
                ? 'border-[color:var(--accent-primary)] text-accent' 
                : 'border-transparent text-theme-muted hover:text-theme-primary'"
            >
              Saved
              <span 
                v-if="networkStore.savedNetworks.length"
                class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-theme-tertiary text-theme-secondary"
              >
                {{ networkStore.savedNetworks.length }}
              </span>
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-4 max-h-96 overflow-y-auto">
            <!-- ========== Scan View ========== -->
            <template v-if="activeView === 'scan'">
              <!-- Loading/Scanning state -->
              <div v-if="scanning" class="flex flex-col items-center justify-center py-8">
                <Icon name="Loader2" :size="32" class="animate-spin text-accent mb-3" />
                <p class="text-theme-tertiary text-sm">Scanning for networks...</p>
              </div>
              
              <!-- Network List -->
              <div v-else-if="!selectedNetwork" class="space-y-2">
                <button
                  @click="scanNetworks"
                  :disabled="scanning || scanCooldown"
                  class="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Scan for WiFi networks"
                >
                  <Icon name="RefreshCw" :size="16" />
                  Refresh
                </button>
                
                <button
                  v-for="network in sortedNetworks"
                  :key="network.bssid"
                  @click="selectNetwork(network)"
                  class="w-full flex items-center gap-3 p-3 rounded-xl border border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary transition-all text-left"
                  :aria-label="network.ssid + ' — ' + networkStore.getSignalLabel(network.signal) + ', ' + network.frequency + 'MHz'"
                >
                  <div class="flex items-end gap-0.5 h-4" aria-hidden="true">
                    <div 
                      v-for="i in 4" 
                      :key="i"
                      :class="[
                        'w-1 rounded-sm transition-colors',
                        i <= getSignalBars(network.signal) ? 'bg-success' : 'bg-theme-tertiary'
                      ]"
                      :style="{ height: `${i * 4}px` }"
                    ></div>
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-theme-primary truncate">{{ network.ssid }}</p>
                    <p class="text-xs text-theme-tertiary">
                      {{ networkStore.getSignalLabel(network.signal) }} · {{ network.frequency }}MHz
                    </p>
                  </div>
                  
                  <Icon 
                    :name="getSecurityIcon(network.security)" 
                    :size="16" 
                    :class="network.security && network.security !== 'open' ? 'text-theme-secondary' : 'text-theme-muted'"
                  />
                </button>
                
                <div v-if="sortedNetworks.length === 0" class="text-center py-8">
                  <Icon name="WifiOff" :size="32" class="text-theme-muted mx-auto mb-2" />
                  <p class="text-theme-tertiary">No networks found</p>
                  <button
                    @click="scanNetworks"
                    :disabled="scanning || scanCooldown"
                    class="mt-2 text-sm text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Scan for WiFi networks again"
                  >
                    Try again
                  </button>
                </div>
              </div>
              
              <!-- Password Entry -->
              <div v-else class="space-y-4">
                <button
                  @click="clearSelection"
                  class="flex items-center gap-2 text-sm text-theme-tertiary hover:text-theme-primary transition-colors"
                  aria-label="Back to network list"
                >
                  <Icon name="ChevronLeft" :size="16" />
                  Back to networks
                </button>
                
                <div class="p-4 rounded-xl bg-theme-tertiary">
                  <div class="flex items-center gap-3">
                    <div class="flex items-end gap-0.5 h-4" aria-hidden="true">
                      <div 
                        v-for="i in 4" 
                        :key="i"
                        :class="[
                          'w-1 rounded-sm',
                          i <= getSignalBars(selectedNetwork.signal) ? 'bg-success' : 'bg-neutral'
                        ]"
                        :style="{ height: `${i * 4}px` }"
                      ></div>
                    </div>
                    <div>
                      <p class="font-medium text-theme-primary">{{ selectedNetwork.ssid }}</p>
                      <p class="text-xs text-theme-tertiary">{{ selectedNetwork.security || 'Open' }}</p>
                    </div>
                  </div>
                </div>
                
                <div v-if="selectedNetwork.security && selectedNetwork.security !== 'open'">
                  <label class="block text-sm font-medium text-theme-secondary mb-2">
                    Password
                  </label>
                  <div class="relative">
                    <input
                      v-model="password"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="Enter WiFi password"
                      class="w-full px-4 py-2.5 pr-10 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      @keyup.enter="connect"
                    />
                    <button
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary transition-colors"
                      :aria-label="showPassword ? 'Hide password' : 'Show password'"
                    >
                      <Icon :name="showPassword ? 'EyeOff' : 'Eye'" :size="18" />
                    </button>
                  </div>
                </div>
                
                <div 
                  v-if="connectError" 
                  class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
                >
                  <Icon name="AlertCircle" :size="16" />
                  {{ connectError }}
                </div>
              </div>
            </template>

            <!-- ========== Saved Networks View ========== -->
            <template v-if="activeView === 'saved'">
              <div v-if="networkStore.savedNetworks.length" class="space-y-2">
                <div
                  v-for="net in networkStore.savedNetworks"
                  :key="net.ssid"
                  class="flex items-center justify-between p-3 rounded-xl border border-theme-primary"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <Icon name="Wifi" :size="16" class="text-theme-muted shrink-0" />
                    <div class="min-w-0">
                      <p class="font-medium text-theme-primary text-sm truncate">{{ net.ssid }}</p>
                      <p v-if="net.last_connected" class="text-xs text-theme-muted">{{ net.last_connected }}</p>
                    </div>
                  </div>
                  <button
                    @click="forgetNetwork(net.ssid)"
                    class="px-2.5 py-1 text-xs font-medium text-error hover:bg-error-muted rounded-lg transition-colors shrink-0 ml-2"
                    :aria-label="'Forget network ' + net.ssid"
                  >
                    Forget
                  </button>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <Icon name="WifiOff" :size="32" class="text-theme-muted mx-auto mb-2" />
                <p class="text-theme-tertiary text-sm">No saved networks</p>
                <p class="text-xs text-theme-muted mt-1">Networks are saved when you connect to them</p>
              </div>
            </template>
          </div>
          
          <!-- Footer -->
          <div class="flex justify-end gap-2 p-4 border-t border-theme-primary bg-theme-secondary">
            <button
              @click="close"
              class="px-4 py-2 rounded-lg text-sm font-medium bg-theme-tertiary text-theme-secondary hover:bg-theme-card transition-colors"
            >
              Cancel
            </button>
            <button
              v-if="selectedNetwork && activeView === 'scan'"
              @click="connect"
              :disabled="connecting || (selectedNetwork.security && selectedNetwork.security !== 'open' && !password)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                connecting || (selectedNetwork.security && selectedNetwork.security !== 'open' && !password)
                  ? 'bg-accent/50 text-on-accent cursor-not-allowed'
                  : 'bg-accent text-on-accent hover:bg-accent-hover'
              ]"
            >
              <Icon v-if="connecting" name="Loader2" :size="16" class="animate-spin" />
              {{ connecting ? 'Connecting...' : 'Connect' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
