<script setup>
/**
 * WiFiConnector.vue - Sprint 4 Component (S4-09)
 * 
 * Scan and connect to upstream WiFi networks for ONLINE_WIFI mode.
 * Uses the network store and Sprint 3 API.
 */
import { ref, computed, onMounted } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'connected'])

const networkStore = useNetworkStore()

// Local state
const selectedNetwork = ref(null)
const password = ref('')
const showPassword = ref(false)
const connecting = ref(false)
const connectError = ref(null)

// Computed
const networks = computed(() => networkStore.wifiNetworks)
const scanning = computed(() => networkStore.scanning)

// Sort networks by signal strength
const sortedNetworks = computed(() => {
  return [...networks.value].sort((a, b) => b.signal - a.signal)
})

// Initial scan on mount
onMounted(() => {
  if (props.show) {
    scanNetworks()
  }
})

async function scanNetworks() {
  await networkStore.scanWiFi()
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
    // Set mode to ONLINE_WIFI with credentials
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

function close() {
  emit('close')
  selectedNetwork.value = null
  password.value = ''
  connectError.value = null
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
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <!-- Modal -->
        <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-theme-primary">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-success-muted flex items-center justify-center">
                <Icon name="Wifi" :size="20" class="text-success" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-theme-primary">Connect to WiFi</h2>
                <p class="text-sm text-theme-tertiary">Select an upstream network</p>
              </div>
            </div>
            <button
              @click="close"
              class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            >
              <Icon name="X" :size="20" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-4 max-h-96 overflow-y-auto">
            <!-- Loading/Scanning state -->
            <div v-if="scanning" class="flex flex-col items-center justify-center py-8">
              <Icon name="Loader2" :size="32" class="animate-spin text-accent mb-3" />
              <p class="text-theme-tertiary text-sm">Scanning for networks...</p>
            </div>
            
            <!-- Network List -->
            <div v-else-if="!selectedNetwork" class="space-y-2">
              <!-- Refresh button -->
              <button
                @click="scanNetworks"
                class="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors mb-3"
              >
                <Icon name="RefreshCw" :size="16" />
                Refresh
              </button>
              
              <!-- Networks -->
              <button
                v-for="network in sortedNetworks"
                :key="network.bssid"
                @click="selectNetwork(network)"
                class="w-full flex items-center gap-3 p-3 rounded-xl border border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary transition-all text-left"
              >
                <!-- Signal strength indicator -->
                <div class="flex items-end gap-0.5 h-4">
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
                
                <!-- Network info -->
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-theme-primary truncate">{{ network.ssid }}</p>
                  <p class="text-xs text-theme-tertiary">
                    {{ networkStore.getSignalLabel(network.signal) }} · {{ network.frequency }}MHz
                  </p>
                </div>
                
                <!-- Security indicator -->
                <Icon 
                  :name="getSecurityIcon(network.security)" 
                  :size="16" 
                  :class="network.security && network.security !== 'open' ? 'text-theme-secondary' : 'text-theme-muted'"
                />
              </button>
              
              <!-- Empty state -->
              <div v-if="sortedNetworks.length === 0" class="text-center py-8">
                <Icon name="WifiOff" :size="32" class="text-theme-muted mx-auto mb-2" />
                <p class="text-theme-tertiary">No networks found</p>
                <button
                  @click="scanNetworks"
                  class="mt-2 text-sm text-accent hover:underline"
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
              >
                <Icon name="ChevronLeft" :size="16" />
                Back to networks
              </button>
              
              <div class="p-4 rounded-xl bg-theme-tertiary">
                <div class="flex items-center gap-3">
                  <div class="flex items-end gap-0.5 h-4">
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
              
              <!-- Password field (if secured) -->
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
                  >
                    <Icon :name="showPassword ? 'EyeOff' : 'Eye'" :size="18" />
                  </button>
                </div>
              </div>
              
              <!-- Error message -->
              <div 
                v-if="connectError" 
                class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
              >
                <Icon name="AlertCircle" :size="16" />
                {{ connectError }}
              </div>
            </div>
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
              v-if="selectedNetwork"
              @click="connect"
              :disabled="connecting || (selectedNetwork.security && selectedNetwork.security !== 'open' && !password)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                connecting || (selectedNetwork.security && selectedNetwork.security !== 'open' && !password)
                  ? 'bg-accent/50 text-white cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-accent-hover'
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
