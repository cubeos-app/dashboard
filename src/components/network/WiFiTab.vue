<script setup>
/**
 * WiFiTab.vue — S06 Component
 *
 * WiFi management tab (both modes). WiFi status, scan & connect, saved networks,
 * AP configuration with start/stop controls and settings modal.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useNetworkStore } from '@/stores/network'
import { useClientsStore } from '@/stores/clients'
import { confirm } from '@/utils/confirmDialog'
import { showWiFiTransition } from '@/utils/transitionScreen'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'
import WiFiConnector from '@/components/network/WiFiConnector.vue'

const props = defineProps({
  apStatus: Object,
  apHardwarePresent: Boolean
})

const emit = defineEmits(['refresh'])

const networkStore = useNetworkStore()
const clientsStore = useClientsStore()
const { trapFocus: trapAPConfigFocus } = useFocusTrap()

// WiFi connector modal
const showWiFiConnector = ref(false)

// Single-adapter constraint: wlan0 cannot do AP + station simultaneously.
// When AP is active and no USB WiFi adapter is plugged in, block scan/connect.
const singleAdapterBlocked = computed(() => {
  return apIsActive.value && !networkStore.hasClientWiFiAdapter
})

// AP computed
const apIsActive = computed(() => {
  if (!props.apStatus) return false
  const s = props.apStatus
  if (s.status === 'up' || s.status === 'active') return true
  if (s.state === 'active' || s.state === 'up') return true
  if (s.active === true) return true
  if (s.ssid && s.ssid.length > 0) return true
  return false
})

// AP action
const apActionLoading = ref(false)
const error = ref(null)

async function handleStartAP() {
  apActionLoading.value = true
  try {
    await networkStore.startAP()
    emit('refresh')
  } catch (e) {
    error.value = e.message
  } finally {
    apActionLoading.value = false
  }
}

async function handleStopAP() {
  if (!await confirm({
    title: 'Stop Access Point',
    message: 'Stopping the AP will disconnect all wireless clients. Are you sure?',
    confirmText: 'Stop AP',
    variant: 'warning'
  })) return

  apActionLoading.value = true
  try {
    await networkStore.stopAP()
    emit('refresh')
  } catch (e) {
    error.value = e.message
  } finally {
    apActionLoading.value = false
  }
}

// AP Config Modal
const showAPConfigModal = ref(false)
const apConfigModalRef = ref(null)
const apConfigLoading = ref(false)
const apConfig = ref({
  ssid: '',
  password: '',
  channel: 6,
  hidden: false,
  country_code: 'NL'
})
const availableChannels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

watch(showAPConfigModal, (val) => {
  if (val) nextTick(() => apConfigModalRef.value?.focus())
})

async function openAPConfigModal() {
  apConfigLoading.value = true
  try {
    const cfg = await networkStore.fetchAPConfig()
    apConfig.value = {
      ssid: cfg?.ssid || 'CubeOS',
      password: cfg?.password || '',
      channel: cfg?.channel || 6,
      hidden: cfg?.hidden || false,
      country_code: cfg?.country_code || 'NL'
    }
    showAPConfigModal.value = true
  } catch (e) {
    error.value = 'Failed to load AP config'
  } finally {
    apConfigLoading.value = false
  }
}

async function saveAPConfig() {
  if (apConfig.value.password && apConfig.value.password.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  apConfigLoading.value = true
  try {
    const newSSID = apConfig.value.ssid || 'CubeOS'
    await networkStore.updateAPConfig(apConfig.value, true)
    await networkStore.restartAP()
    showAPConfigModal.value = false
    showWiFiTransition(newSSID)
  } catch (e) {
    error.value = 'Failed to save AP config: ' + e.message
  } finally {
    apConfigLoading.value = false
  }
}

// Saved networks
const reconnecting = ref(false)
const reconnectingSSID = ref(null)

async function handleConnectSaved(ssid) {
  reconnecting.value = true
  reconnectingSSID.value = ssid
  try {
    await networkStore.connectToWiFi(ssid, '')
    emit('refresh')
  } catch (e) {
    error.value = 'Failed to connect to ' + ssid + ': ' + e.message
  } finally {
    reconnecting.value = false
    reconnectingSSID.value = null
  }
}

async function handleForgetNetwork(ssid) {
  if (!await confirm({
    title: 'Forget Network',
    message: `Forget saved network "${ssid}"? You will need to re-enter the password to connect again.`,
    confirmText: 'Forget',
    variant: 'danger'
  })) return
  networkStore.forgetNetwork(ssid)
}

// Load WiFi data on mount-like (tab activation)
networkStore.fetchWiFiStatus()
networkStore.fetchSavedNetworks()

// Convert dotted-decimal netmask to CIDR prefix (e.g. "255.255.255.0" -> 24)
function netmaskToPrefix(mask) {
  if (!mask) return ''
  return mask.split('.').reduce((acc, octet) => {
    return acc + (parseInt(octet) >>> 0).toString(2).replace(/0/g, '').length
  }, 0)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error -->
    <div v-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ error }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- WiFi Status -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
               :class="networkStore.isWiFiConnected ? 'bg-success-muted' : 'bg-theme-tertiary'">
            <Icon name="Wifi" :size="20" :class="networkStore.isWiFiConnected ? 'text-success' : 'text-theme-muted'" />
          </div>
          <div>
            <p class="font-semibold text-theme-primary">
              {{ networkStore.isWiFiConnected ? 'Connected' : 'Not Connected' }}
            </p>
            <p v-if="networkStore.wifiStatus?.ssid" class="text-sm text-theme-muted">
              {{ networkStore.wifiStatus.ssid }}
              <span v-if="networkStore.wifiStatus?.signal"> · {{ networkStore.wifiStatus.signal }}%</span>
              <span v-if="networkStore.wifiStatus?.channel"> · Ch {{ networkStore.wifiStatus.channel }}</span>
            </p>
            <p v-else class="text-sm text-theme-muted">No upstream WiFi connection</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            v-if="networkStore.isWiFiConnected"
            @click="networkStore.disconnectWiFi()"
            :disabled="networkStore.loading"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
            aria-label="Disconnect WiFi"
          >
            <Icon name="WifiOff" :size="14" />
            Disconnect
          </button>
          <button
            @click="showWiFiConnector = true"
            :disabled="singleAdapterBlocked"
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5',
              singleAdapterBlocked
                ? 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
                : 'btn-accent'
            ]"
            :title="singleAdapterBlocked ? 'Cannot scan while AP is active on the only WiFi adapter (wlan0). Plug in a USB WiFi dongle or stop the AP first.' : 'Scan for WiFi networks'"
            aria-label="Scan for WiFi networks"
          >
            <Icon name="Search" :size="14" />
            Scan & Connect
          </button>
        </div>
      </div>

      <!-- Connection details grid (shown when connected) -->
      <div v-if="networkStore.isWiFiConnected && networkStore.wifiStatus" class="mt-4 pt-3 border-t border-theme-primary">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <div v-if="networkStore.wifiStatus.ip_address">
            <p class="text-theme-muted">IP Address</p>
            <p class="text-theme-primary font-mono">{{ networkStore.wifiStatus.ip_address }}{{ networkStore.wifiStatus.netmask ? '/' + netmaskToPrefix(networkStore.wifiStatus.netmask) : '' }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.gateway">
            <p class="text-theme-muted">Gateway</p>
            <p class="text-theme-primary font-mono">{{ networkStore.wifiStatus.gateway }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.dns?.length">
            <p class="text-theme-muted">DNS</p>
            <p class="text-theme-primary font-mono">{{ networkStore.wifiStatus.dns.join(', ') }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.signal">
            <p class="text-theme-muted">Signal</p>
            <p class="text-theme-primary">
              {{ networkStore.wifiStatus.signal }}%
              <span v-if="networkStore.wifiStatus.signal_dbm" class="text-theme-muted">({{ networkStore.wifiStatus.signal_dbm }} dBm)</span>
            </p>
          </div>
          <div v-if="networkStore.wifiStatus.channel">
            <p class="text-theme-muted">Channel</p>
            <p class="text-theme-primary">{{ networkStore.wifiStatus.channel }}{{ networkStore.wifiStatus.frequency ? ' (' + (networkStore.wifiStatus.frequency / 1000).toFixed(1) + ' GHz)' : '' }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.security">
            <p class="text-theme-muted">Security</p>
            <p class="text-theme-primary">{{ networkStore.wifiStatus.security }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.tx_bitrate">
            <p class="text-theme-muted">TX Rate</p>
            <p class="text-theme-primary">{{ networkStore.wifiStatus.tx_bitrate }}</p>
          </div>
          <div v-if="networkStore.wifiStatus.interface">
            <p class="text-theme-muted">Interface</p>
            <p class="text-theme-primary font-mono text-xs">{{ networkStore.wifiStatus.interface }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Single-adapter constraint warning -->
    <div v-if="singleAdapterBlocked" class="bg-warning-muted border border-warning rounded-lg p-4 flex items-start gap-3">
      <Icon name="AlertTriangle" :size="18" class="text-warning shrink-0 mt-0.5" />
      <div class="text-sm">
        <p class="font-medium text-warning">Single WiFi adapter</p>
        <p class="text-theme-secondary mt-0.5">
          The built-in WiFi (wlan0) is running the Access Point. It cannot simultaneously connect to an upstream network.
          Plug in a USB WiFi adapter for client mode, or stop the AP first.
        </p>
      </div>
    </div>

    <!-- Saved Networks -->
    <div class="bg-theme-card rounded-xl border border-theme-primary">
      <div class="px-4 py-3 border-b border-theme-primary flex items-center justify-between">
        <h3 class="font-semibold text-theme-primary">Saved Networks</h3>
        <button
          @click="networkStore.fetchSavedNetworks()"
          class="text-xs text-accent hover:underline"
          aria-label="Refresh saved networks"
        >
          Refresh
        </button>
      </div>
      <div class="divide-y divide-[color:var(--border-primary)]">
        <div
          v-for="net in networkStore.savedNetworks"
          :key="net.ssid"
          class="px-4 py-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <Icon name="Wifi" :size="16" class="text-theme-muted" />
            <div>
              <p class="font-medium text-theme-primary text-sm">{{ net.ssid }}</p>
              <p v-if="net.last_connected" class="text-xs text-theme-muted">Last connected: {{ net.last_connected }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleConnectSaved(net.ssid)"
              :disabled="reconnecting || singleAdapterBlocked"
              :class="[
                'px-2.5 py-1 text-xs rounded-lg transition-colors',
                singleAdapterBlocked
                  ? 'text-theme-muted cursor-not-allowed'
                  : 'text-accent hover:bg-accent/10'
              ]"
              :title="singleAdapterBlocked ? 'Stop the AP or add a USB WiFi adapter first' : 'Connect to ' + net.ssid"
              :aria-label="'Connect to ' + net.ssid"
            >
              {{ reconnecting && reconnectingSSID === net.ssid ? 'Connecting...' : 'Connect' }}
            </button>
            <button
              @click="handleForgetNetwork(net.ssid)"
              :disabled="reconnecting"
              class="px-2.5 py-1 text-xs text-error hover:bg-error-muted rounded-lg transition-colors"
              :aria-label="'Forget network ' + net.ssid"
            >
              Forget
            </button>
          </div>
        </div>
        <div v-if="!networkStore.savedNetworks.length" class="px-4 py-8 text-center text-theme-muted text-sm">
          <Icon name="WifiOff" :size="32" class="mx-auto mb-2 text-theme-muted" />
          <p>No saved networks</p>
          <p class="text-xs mt-1">Connect to a WiFi network to save it</p>
        </div>
      </div>
    </div>

    <!-- AP Configuration Section -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-theme-primary">Access Point</h3>
        <button
          @click="openAPConfigModal"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:bg-theme-card flex items-center gap-1.5"
          aria-label="Configure access point"
        >
          <Icon name="Settings" :size="14" />
          Configure
        </button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p class="text-theme-muted">Status</p>
          <p :class="apIsActive ? 'text-success font-medium' : 'text-error font-medium'">
            {{ apIsActive ? 'Active' : 'Inactive' }}
          </p>
        </div>
        <div>
          <p class="text-theme-muted">SSID</p>
          <p class="text-theme-primary font-medium">{{ apStatus?.ssid || 'CubeOS' }}</p>
        </div>
        <div>
          <p class="text-theme-muted">Channel</p>
          <p class="text-theme-secondary">{{ apStatus?.channel || '-' }}</p>
        </div>
        <div>
          <p class="text-theme-muted">Clients</p>
          <p class="text-theme-secondary">{{ clientsStore.count || 0 }}</p>
        </div>
      </div>
      <!-- AP Start/Stop -->
      <div class="mt-3 flex gap-2">
        <button
          v-if="!apIsActive"
          @click="handleStartAP"
          :disabled="apActionLoading"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-success-muted text-success hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
          aria-label="Start access point"
        >
          <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
          <Icon v-else name="Play" :size="14" />
          Start AP
        </button>
        <button
          v-if="apIsActive"
          @click="handleStopAP"
          :disabled="apActionLoading"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
          aria-label="Stop access point"
        >
          <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
          <Icon v-else name="Square" :size="14" />
          Stop AP
        </button>
      </div>
    </div>

    <!-- WiFi Connector Modal -->
    <WiFiConnector
      :show="showWiFiConnector"
      :single-adapter-blocked="singleAdapterBlocked"
      @close="showWiFiConnector = false"
      @connected="showWiFiConnector = false; emit('refresh')"
    />

    <!-- WiFi AP Config Modal -->
    <Teleport to="body">
      <div v-if="showAPConfigModal" ref="apConfigModalRef" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-overlay" @click.self="showAPConfigModal = false" role="dialog" aria-modal="true" aria-label="WiFi Access Point Settings" tabindex="-1" @keydown="trapAPConfigFocus" @keydown.escape="showAPConfigModal = false">
        <div class="bg-theme-card rounded-2xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
            <h3 class="text-lg font-semibold text-theme-primary">WiFi Access Point Settings</h3>
            <button @click="showAPConfigModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
              <Icon name="X" :size="20" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Network Name (SSID)</label>
              <input
                v-model="apConfig.ssid"
                type="text"
                maxlength="32"
                class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                placeholder="CubeOS"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Password</label>
              <input
                v-model="apConfig.password"
                type="password"
                minlength="8"
                maxlength="63"
                class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                placeholder="Min 8 characters"
              >
              <p class="text-xs text-theme-muted mt-1">WPA2-PSK encryption. Minimum 8 characters.</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Channel</label>
              <select
                v-model="apConfig.channel"
                class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
              >
                <option v-for="ch in availableChannels" :key="ch" :value="ch">
                  Channel {{ ch }} {{ ch === 1 || ch === 6 || ch === 11 ? '(recommended)' : '' }}
                </option>
              </select>
              <p class="text-xs text-theme-muted mt-1">Channels 1, 6, 11 don't overlap with neighbors</p>
            </div>

            <div class="flex items-center gap-3">
              <input
                v-model="apConfig.hidden"
                type="checkbox"
                id="ap-hidden"
                class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]"
              >
              <label for="ap-hidden" class="text-sm text-theme-secondary">
                Hide network (don't broadcast SSID)
              </label>
            </div>

            <div class="bg-warning-muted border border-warning rounded-lg p-3 text-sm text-warning">
              <strong>Note:</strong> Saving will restart the access point. Connected devices will briefly disconnect.
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary">
            <button
              @click="showAPConfigModal = false"
              class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="saveAPConfig"
              :disabled="apConfigLoading || !apConfig.ssid"
              class="px-4 py-2 btn-accent rounded-lg hover:bg-[color:var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon v-if="apConfigLoading" name="Loader2" :size="16" class="animate-spin" />
              Save & Restart AP
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
