<script setup>
/**
 * NetworkConfigDialog.vue — Batch 4 / T17
 *
 * Multi-step configuration dialog for network mode switching.
 * Replaces the old direct-switch + separate WiFiConnector pattern.
 *
 * Flow:
 *   WiFi modes  → Step 1: WiFi Scan → Step 2: IP Config → Step 3: Confirm
 *   Ethernet modes →                   Step 1: IP Config → Step 2: Confirm
 *
 * OFFLINE mode never opens this dialog (handled in NetworkModeSelector).
 */
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'
import IPConfigStep from './IPConfigStep.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  /** Target mode to configure */
  targetMode: {
    type: String,
    required: true
  },
  /** Current active mode (for warning generation) */
  currentMode: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'applied'])

const networkStore = useNetworkStore()
const { trapFocus } = useFocusTrap()
const modalRef = ref(null)
const ipConfigRef = ref(null)

// ── Mode metadata ────────────────────────────────────────────
const modeLabels = {
  [NETWORK_MODES.ONLINE_ETH]:  'Online via Ethernet',
  [NETWORK_MODES.ONLINE_WIFI]: 'Online via WiFi',
  [NETWORK_MODES.SERVER_ETH]:  'Server via Ethernet',
  [NETWORK_MODES.SERVER_WIFI]: 'Server via WiFi',
}

const modeIcons = {
  [NETWORK_MODES.ONLINE_ETH]:  'Cable',
  [NETWORK_MODES.ONLINE_WIFI]: 'Wifi',
  [NETWORK_MODES.SERVER_ETH]:  'Server',
  [NETWORK_MODES.SERVER_WIFI]: 'Server',
}

const isWiFiMode = computed(() =>
  props.targetMode === NETWORK_MODES.ONLINE_WIFI ||
  props.targetMode === NETWORK_MODES.SERVER_WIFI
)

const isAPMode = computed(() =>
  props.targetMode === NETWORK_MODES.ONLINE_ETH ||
  props.targetMode === NETWORK_MODES.ONLINE_WIFI
)

// ── Step management ──────────────────────────────────────────
// WiFi modes: wifi → ipconfig → confirm
// Ethernet modes: ipconfig → confirm
const STEPS = computed(() => {
  if (isWiFiMode.value) {
    return ['wifi', 'ipconfig', 'confirm']
  }
  return ['ipconfig', 'confirm']
})

const currentStepIndex = ref(0)
const currentStep = computed(() => STEPS.value[currentStepIndex.value])
const isFirstStep = computed(() => currentStepIndex.value === 0)
const isLastStep = computed(() => currentStepIndex.value === STEPS.value.length - 1)

const stepLabel = computed(() => {
  switch (currentStep.value) {
    case 'wifi': return 'Select WiFi Network'
    case 'ipconfig': return 'IP Configuration'
    case 'confirm': return 'Confirm Changes'
    default: return ''
  }
})

// ── WiFi state ───────────────────────────────────────────────
const selectedNetwork = ref(null)
const wifiPassword = ref('')
const showPassword = ref(false)
const manualSSID = ref('')
const showManualEntry = ref(false)

const networks = computed(() => networkStore.wifiNetworks)
const scanning = computed(() => networkStore.scanning)
const scanCooldown = ref(false)
let scanCooldownTimer = null

const savedSSIDs = computed(() => new Set(networkStore.savedNetworks.map(n => n.ssid)))

// Filter phantom entries (0MHz / empty SSID)
const sortedNetworks = computed(() => {
  return [...networks.value]
    .filter(n => {
      if ((n.frequency === 0 || n.freq === 0) && !n.ssid?.trim()) return false
      if (n.frequency === 0 || n.freq === 0) return false
      if (!n.ssid || !n.ssid.trim()) return false
      return true
    })
    .sort((a, b) => b.signal - a.signal)
})

const hasClientAdapter = computed(() => {
  if (!scanning.value && networks.value.length === 0 && !scanCooldown.value) return true
  if (networks.value.length > 0 && sortedNetworks.value.length === 0) return false
  return true
})

async function scanNetworks() {
  if (scanCooldown.value) return
  scanCooldown.value = true
  await networkStore.scanWiFi()
  if (scanCooldownTimer) clearTimeout(scanCooldownTimer)
  scanCooldownTimer = setTimeout(() => { scanCooldown.value = false }, 5000)
}

function selectNetwork(network) {
  selectedNetwork.value = network
  manualSSID.value = ''
  showManualEntry.value = false
  wifiPassword.value = ''
}

function startManualEntry() {
  showManualEntry.value = true
  selectedNetwork.value = null
  manualSSID.value = ''
  wifiPassword.value = ''
}

function cancelManualEntry() {
  showManualEntry.value = false
  manualSSID.value = ''
}

// Effective SSID (from scan selection or manual entry)
const effectiveSSID = computed(() => {
  if (showManualEntry.value) return manualSSID.value.trim()
  return selectedNetwork.value?.ssid || ''
})

const wifiStepValid = computed(() => {
  if (!effectiveSSID.value) return false
  // Open networks or saved networks don't need password
  if (showManualEntry.value) return true
  if (selectedNetwork.value) {
    const isOpen = !selectedNetwork.value.security || selectedNetwork.value.security === 'open'
    const isSaved = savedSSIDs.value.has(selectedNetwork.value.ssid)
    if (isOpen || isSaved || wifiPassword.value) return true
    return false
  }
  return false
})

// ── IP config state ──────────────────────────────────────────
const ipConfig = ref({
  useStaticIP: false,
  ip: '',
  netmask: '255.255.255.0',
  gateway: '',
  dnsPrimary: '',
  dnsSecondary: ''
})

const ipStepValid = computed(() => {
  if (!ipConfig.value.useStaticIP) return true
  return ipConfigRef.value?.validation?.valid ?? false
})

// ── Confirm step ─────────────────────────────────────────────
const applying = ref(false)
const applyError = ref(null)

const warningMessage = computed(() => {
  const lines = []
  const fromHasAP = ['offline', 'online_eth', 'online_wifi'].includes(props.currentMode)
  const toHasAP = isAPMode.value
  const toMode = props.targetMode

  if (fromHasAP && !toHasAP) {
    lines.push('This will disable the Access Point. All WiFi clients will be disconnected.')
    lines.push('If you are connected via the CubeOS WiFi, you will lose access to this dashboard.')
    if (toMode === NETWORK_MODES.SERVER_ETH) {
      lines.push('To reconnect: access the dashboard via the Ethernet IP address.')
    } else {
      lines.push('To reconnect: join the same WiFi network as the device.')
    }
  } else if (!fromHasAP && toHasAP) {
    lines.push('This will start the Access Point and reconfigure networking.')
    lines.push('Your connection may be interrupted during reconfiguration.')
  } else if (fromHasAP && toHasAP && props.currentMode !== toMode) {
    lines.push('This will reconfigure the internet uplink. WiFi clients may experience a brief interruption.')
  } else if (!fromHasAP && !toHasAP) {
    lines.push('This will reconfigure the network interface. You may lose access temporarily.')
  }

  return lines
})

// Summary items for the confirm step
const summaryItems = computed(() => {
  const items = [
    { label: 'Network Mode', value: modeLabels[props.targetMode] || props.targetMode }
  ]

  if (isWiFiMode.value && effectiveSSID.value) {
    items.push({ label: 'WiFi Network', value: effectiveSSID.value })
  }

  if (ipConfig.value.useStaticIP) {
    items.push({ label: 'IP Configuration', value: 'Static IP' })
    items.push({ label: 'IP Address', value: ipConfig.value.ip })
    items.push({ label: 'Subnet Mask', value: ipConfig.value.netmask })
    items.push({ label: 'Gateway', value: ipConfig.value.gateway })
    if (ipConfig.value.dnsPrimary) {
      items.push({ label: 'Primary DNS', value: ipConfig.value.dnsPrimary })
    }
    if (ipConfig.value.dnsSecondary) {
      items.push({ label: 'Secondary DNS', value: ipConfig.value.dnsSecondary })
    }
  } else {
    items.push({ label: 'IP Configuration', value: 'DHCP (automatic)' })
  }

  return items
})

// ── Navigation ───────────────────────────────────────────────
function canProceed() {
  switch (currentStep.value) {
    case 'wifi': return wifiStepValid.value
    case 'ipconfig': return ipStepValid.value
    case 'confirm': return true
    default: return false
  }
}

function nextStep() {
  if (!canProceed()) return
  if (isLastStep.value) {
    applyChanges()
    return
  }
  currentStepIndex.value++
}

function prevStep() {
  if (isFirstStep.value) return
  currentStepIndex.value--
}

// ── Apply ────────────────────────────────────────────────────
async function applyChanges() {
  applying.value = true
  applyError.value = null

  try {
    const options = {}

    // WiFi credentials
    if (isWiFiMode.value) {
      options.ssid = effectiveSSID.value
      options.password = wifiPassword.value
    }

    // Static IP parameters (T20)
    if (ipConfig.value.useStaticIP) {
      options.use_static_ip = true
      options.static_ip = ipConfig.value.ip.trim()
      options.static_netmask = ipConfig.value.netmask.trim()
      options.static_gateway = ipConfig.value.gateway.trim()
      if (ipConfig.value.dnsPrimary) {
        options.static_dns_primary = ipConfig.value.dnsPrimary.trim()
      }
      if (ipConfig.value.dnsSecondary) {
        options.static_dns_secondary = ipConfig.value.dnsSecondary.trim()
      }
    }

    const success = await networkStore.setMode(props.targetMode, options)
    if (success) {
      emit('applied', props.targetMode)
      close()
    } else {
      applyError.value = networkStore.error || 'Failed to apply network configuration'
    }
  } catch (e) {
    applyError.value = e.message
  } finally {
    applying.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────
function close() {
  emit('close')
  reset()
}

function reset() {
  currentStepIndex.value = 0
  selectedNetwork.value = null
  wifiPassword.value = ''
  showPassword.value = false
  manualSSID.value = ''
  showManualEntry.value = false
  ipConfig.value = { useStaticIP: false, ip: '', netmask: '255.255.255.0', gateway: '', dnsPrimary: '', dnsSecondary: '' }
  applying.value = false
  applyError.value = null
}

// On dialog open: scan WiFi if needed, reset state
watch(() => props.show, (val) => {
  if (val) {
    reset()
    if (isWiFiMode.value) {
      scanNetworks()
      networkStore.fetchSavedNetworks()
    }
    nextTick(() => { modalRef.value?.focus() })
  }
})

// Signal bar helper
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
  if (scanCooldownTimer) clearTimeout(scanCooldownTimer)
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
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="close"></div>

        <!-- Dialog -->
        <div
          ref="modalRef"
          tabindex="-1"
          class="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-theme-card rounded-2xl shadow-2xl border border-theme-primary overflow-hidden"
          @keyup.escape="close"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-theme-primary bg-theme-secondary shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                <Icon :name="modeIcons[targetMode] || 'Network'" :size="18" class="text-accent" />
              </div>
              <div class="min-w-0">
                <h2 class="font-semibold text-theme-primary text-sm truncate">
                  {{ modeLabels[targetMode] || targetMode }}
                </h2>
                <p class="text-xs text-theme-muted">{{ stepLabel }}</p>
              </div>
            </div>
            <button
              @click="close"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close dialog"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Step indicator -->
          <div class="px-4 pt-3 pb-1 flex items-center gap-2 shrink-0">
            <template v-for="(step, i) in STEPS" :key="step">
              <div
                class="h-1 flex-1 rounded-full transition-colors duration-300"
                :class="i <= currentStepIndex ? 'bg-accent' : 'bg-theme-tertiary'"
              ></div>
            </template>
          </div>

          <!-- Body (scrollable) -->
          <div class="flex-1 overflow-y-auto p-4">
            <!-- ═══ WiFi Scan Step ═══ -->
            <template v-if="currentStep === 'wifi'">
              <!-- No client adapter warning -->
              <div v-if="!hasClientAdapter" class="text-center py-8">
                <Icon name="WifiOff" :size="36" class="text-theme-muted mx-auto mb-3" />
                <p class="text-theme-secondary font-medium mb-1">No WiFi Client Adapter</p>
                <p class="text-xs text-theme-tertiary max-w-xs mx-auto">
                  The built-in WiFi is used for the Access Point. Connect a USB WiFi adapter for uplink mode.
                </p>
              </div>

              <template v-else>
                <!-- Scan / Manual entry toggle -->
                <div class="flex items-center justify-between mb-3">
                  <button
                    @click="scanNetworks"
                    :disabled="scanning || scanCooldown"
                    class="flex items-center gap-2 text-sm text-accent hover:bg-accent/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Scan for WiFi networks"
                  >
                    <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': scanning }" />
                    {{ scanning ? 'Scanning...' : 'Scan' }}
                  </button>
                  <button
                    v-if="!showManualEntry"
                    @click="startManualEntry"
                    class="flex items-center gap-1.5 text-xs text-theme-muted hover:text-theme-primary px-2 py-1 rounded-lg transition-colors"
                  >
                    <Icon name="Edit3" :size="12" />
                    Enter manually
                  </button>
                  <button
                    v-else
                    @click="cancelManualEntry"
                    class="flex items-center gap-1.5 text-xs text-theme-muted hover:text-theme-primary px-2 py-1 rounded-lg transition-colors"
                  >
                    <Icon name="List" :size="12" />
                    Show scan results
                  </button>
                </div>

                <!-- Manual SSID entry -->
                <div v-if="showManualEntry" class="space-y-3 mb-3">
                  <div>
                    <label class="block text-xs font-medium text-theme-secondary mb-1.5">Network Name (SSID)</label>
                    <input
                      v-model="manualSSID"
                      type="text"
                      placeholder="Enter WiFi network name"
                      class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-theme-secondary mb-1.5">Password</label>
                    <div class="relative">
                      <input
                        v-model="wifiPassword"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="Enter WiFi password"
                        class="w-full px-3 py-2 pr-10 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                      <button
                        @click="showPassword = !showPassword"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary transition-colors"
                        :aria-label="showPassword ? 'Hide password' : 'Show password'"
                      >
                        <Icon :name="showPassword ? 'EyeOff' : 'Eye'" :size="16" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Scan results list -->
                <div v-else class="space-y-1.5">
                  <!-- Loading skeleton -->
                  <div v-if="scanning && sortedNetworks.length === 0" class="space-y-2">
                    <div v-for="i in 4" :key="i" class="h-14 rounded-xl bg-theme-tertiary animate-pulse"></div>
                  </div>

                  <!-- Network list -->
                  <button
                    v-for="network in sortedNetworks"
                    :key="network.bssid || network.ssid"
                    @click="selectNetwork(network)"
                    :class="[
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      selectedNetwork?.ssid === network.ssid && selectedNetwork?.bssid === network.bssid
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary'
                    ]"
                    :aria-label="network.ssid + ' — ' + networkStore.getSignalLabel(network.signal)"
                  >
                    <!-- Signal bars -->
                    <div class="flex items-end gap-0.5 h-4 shrink-0" aria-hidden="true">
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
                      <div class="flex items-center gap-2">
                        <p class="font-medium text-theme-primary text-sm truncate">{{ network.ssid }}</p>
                        <span
                          v-if="savedSSIDs.has(network.ssid)"
                          class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-accent/20 text-accent shrink-0"
                        >Saved</span>
                      </div>
                      <p class="text-xs text-theme-muted">
                        {{ networkStore.getSignalLabel(network.signal) }} · {{ network.frequency || network.freq }}MHz
                      </p>
                    </div>

                    <Icon
                      :name="getSecurityIcon(network.security)"
                      :size="14"
                      :class="network.security && network.security !== 'open' ? 'text-theme-secondary' : 'text-theme-muted'"
                    />
                  </button>

                  <!-- No results -->
                  <div v-if="!scanning && sortedNetworks.length === 0" class="text-center py-6">
                    <Icon name="WifiOff" :size="28" class="text-theme-muted mx-auto mb-2" />
                    <p class="text-theme-tertiary text-sm">No networks found</p>
                    <button
                      @click="scanNetworks"
                      :disabled="scanCooldown"
                      class="mt-2 text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      Try again
                    </button>
                  </div>
                </div>

                <!-- Password for selected network (inline, below the list) -->
                <div v-if="selectedNetwork && !showManualEntry" class="mt-3 p-3 rounded-xl bg-theme-tertiary space-y-3">
                  <div class="flex items-center gap-2">
                    <Icon name="Wifi" :size="14" class="text-accent" />
                    <span class="text-sm font-medium text-theme-primary">{{ selectedNetwork.ssid }}</span>
                    <span class="text-xs text-theme-muted">{{ selectedNetwork.security || 'Open' }}</span>
                  </div>

                  <div v-if="selectedNetwork.security && selectedNetwork.security !== 'open'">
                    <label class="block text-xs font-medium text-theme-secondary mb-1.5">Password</label>
                    <div class="relative">
                      <input
                        v-model="wifiPassword"
                        :type="showPassword ? 'text' : 'password'"
                        :placeholder="savedSSIDs.has(selectedNetwork.ssid) ? 'Leave empty to use saved' : 'Enter WiFi password'"
                        class="w-full px-3 py-2 pr-10 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        @keyup.enter="canProceed() && nextStep()"
                      />
                      <button
                        @click="showPassword = !showPassword"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary transition-colors"
                        :aria-label="showPassword ? 'Hide password' : 'Show password'"
                      >
                        <Icon :name="showPassword ? 'EyeOff' : 'Eye'" :size="16" />
                      </button>
                    </div>
                    <p v-if="savedSSIDs.has(selectedNetwork.ssid)" class="text-[11px] text-theme-muted mt-1">
                      This network is saved. Enter a new password only if it has changed.
                    </p>
                  </div>
                </div>
              </template>
            </template>

            <!-- ═══ IP Config Step ═══ -->
            <template v-if="currentStep === 'ipconfig'">
              <IPConfigStep
                ref="ipConfigRef"
                :mode="targetMode"
                v-model="ipConfig"
              />
            </template>

            <!-- ═══ Confirm Step ═══ -->
            <template v-if="currentStep === 'confirm'">
              <div class="space-y-4">
                <!-- Summary -->
                <div class="rounded-xl border border-theme-primary overflow-hidden">
                  <div class="px-3 py-2 bg-theme-tertiary border-b border-theme-primary">
                    <h4 class="text-xs font-semibold text-theme-secondary uppercase tracking-wide">Configuration Summary</h4>
                  </div>
                  <div class="divide-y divide-[color:var(--border-primary)]">
                    <div
                      v-for="item in summaryItems"
                      :key="item.label"
                      class="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <span class="text-theme-muted">{{ item.label }}</span>
                      <span class="font-medium text-theme-primary text-right">{{ item.value }}</span>
                    </div>
                  </div>
                </div>

                <!-- Warnings -->
                <div
                  v-if="warningMessage.length"
                  class="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-2"
                >
                  <div class="flex items-center gap-2">
                    <Icon name="AlertTriangle" :size="16" class="text-warning shrink-0" />
                    <span class="text-xs font-semibold text-warning uppercase tracking-wide">Warning</span>
                  </div>
                  <div class="space-y-1.5">
                    <p
                      v-for="(line, i) in warningMessage"
                      :key="i"
                      class="text-sm text-theme-secondary leading-relaxed"
                    >
                      {{ line }}
                    </p>
                  </div>
                </div>

                <!-- Error -->
                <div
                  v-if="applyError"
                  class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
                >
                  <Icon name="AlertCircle" :size="16" class="shrink-0" />
                  <span>{{ applyError }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between p-4 border-t border-theme-primary bg-theme-secondary shrink-0">
            <button
              v-if="!isFirstStep"
              @click="prevStep"
              :disabled="applying"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
            >
              <Icon name="ChevronLeft" :size="16" />
              Back
            </button>
            <div v-else></div>

            <div class="flex items-center gap-2">
              <button
                @click="close"
                :disabled="applying"
                class="px-4 py-2 rounded-lg text-sm font-medium bg-theme-tertiary text-theme-secondary hover:bg-theme-card transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                @click="nextStep"
                :disabled="!canProceed() || applying"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                  !canProceed() || applying
                    ? 'bg-accent/50 text-on-accent cursor-not-allowed'
                    : 'bg-accent text-on-accent hover:bg-accent-hover'
                ]"
              >
                <Icon v-if="applying" name="Loader2" :size="16" class="animate-spin" />
                {{ isLastStep ? (applying ? 'Applying...' : 'Apply') : 'Next' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
