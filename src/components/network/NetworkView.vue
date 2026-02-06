<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/client'
import { useNetworkStore } from '@/stores/network'
import { useClientsStore } from '@/stores/clients'
import { useFirewallStore } from '@/stores/firewall'
import { confirm } from '@/utils/confirmDialog'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import WiFiConnector from '@/components/network/WiFiConnector.vue'
import NetworkModeSelector from '@/components/network/NetworkModeSelector.vue'

const { signal, abort } = useAbortOnUnmount()
const router = useRouter()
const networkStore = useNetworkStore()
const clientsStore = useClientsStore()
const firewallStore = useFirewallStore()

// State
const loading = ref(true)
const apStatus = ref(null)
const interfaces = ref([])
const natStatus = ref(null)
const internetStatus = ref(null)
const firewallStatus = ref(null)
const networkMode = ref(null)
const error = ref(null)

// AP hardware detection — check once, cache result
const apHardwareChecked = ref(false)
const apHardwarePresent = ref(true)

// AP active computed
const apIsActive = computed(() => {
  if (!apStatus.value) return false
  const s = apStatus.value
  if (s.status === 'up' || s.status === 'active') return true
  if (s.state === 'active' || s.state === 'up') return true
  if (s.active === true) return true
  if (s.ssid && s.ssid.length > 0) return true
  return false
})

// AP start/stop loading state
const apActionLoading = ref(false)

// WiFi AP Config Modal
const showAPConfigModal = ref(false)
const apConfigLoading = ref(false)
const apConfig = ref({
  ssid: '',
  password: '',
  channel: 6,
  hidden: false,
  country_code: 'NL'
})
const availableChannels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

async function openAPConfigModal() {
  apConfigLoading.value = true
  try {
    const cfg = await api.get('/network/ap/config', {}, { signal: signal() })
    apConfig.value = {
      ssid: cfg.ssid || 'CubeOS',
      password: cfg.password || '',
      channel: cfg.channel || 6,
      hidden: cfg.hidden || false,
      country_code: cfg.country_code || 'NL'
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
    alert('Password must be at least 8 characters')
    return
  }
  
  apConfigLoading.value = true
  try {
    await api.put('/network/ap/config', apConfig.value)
    await api.post('/network/wifi/ap/restart')
    showAPConfigModal.value = false
    setTimeout(() => fetchAll(), 2000)
  } catch (e) {
    alert('Failed to save AP config: ' + e.message)
  } finally {
    apConfigLoading.value = false
  }
}

// AP Start/Stop controls
async function handleStartAP() {
  apActionLoading.value = true
  try {
    await networkStore.startAP()
    await fetchAll()
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
    await fetchAll()
  } catch (e) {
    error.value = e.message
  } finally {
    apActionLoading.value = false
  }
}

// Warning banner
const warningDismissed = ref(false)
const networkWarning = computed(() => {
  if (warningDismissed.value) return null
  if (!networkMode.value) return null
  if (networkMode.value.mode === 'OFFLINE' && natStatus.value?.enabled) {
    return 'NAT is enabled but you are in Offline mode. Internet sharing will not work without an uplink.'
  }
  if (networkMode.value.mode !== 'OFFLINE' && internetStatus.value && !internetStatus.value.connected) {
    return 'Internet connectivity check failed. Your uplink may be down.'
  }
  return null
})

async function dismissWarning() {
  warningDismissed.value = true
  await networkStore.dismissWarning()
}

// Network settings panel
const showNetworkSettings = ref(false)
const settingsLoading = ref(false)

async function loadNetworkSettings() {
  settingsLoading.value = true
  try {
    await networkStore.fetchSettings()
  } finally {
    settingsLoading.value = false
  }
}

// DNS tab state
const dnsLoading = ref(false)
const dnsPrimary = ref('')
const dnsSecondary = ref('')
const dnsSaveSuccess = ref(false)

async function loadDNS() {
  dnsLoading.value = true
  try {
    await networkStore.fetchDNS()
    dnsPrimary.value = networkStore.primaryDNS
    dnsSecondary.value = networkStore.secondaryDNS
  } finally {
    dnsLoading.value = false
  }
}

async function saveDNS() {
  dnsLoading.value = true
  dnsSaveSuccess.value = false
  try {
    const success = await networkStore.saveDNS({
      primary: dnsPrimary.value,
      secondary: dnsSecondary.value
    })
    if (success) {
      dnsSaveSuccess.value = true
      setTimeout(() => { dnsSaveSuccess.value = false }, 3000)
    }
  } finally {
    dnsLoading.value = false
  }
}

// WiFi tab state
const showWiFiConnector = ref(false)

// Tabs — restructured: removed Firewall, added WiFi and DNS
const activeTab = ref('overview')
const tabs = computed(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'wifi', label: 'WiFi' },
  { id: 'dns', label: 'DNS' },
  { id: 'clients', label: 'Clients', badge: clientsStore.activeCount || clientsStore.count || null },
  { id: 'traffic', label: 'Traffic' }
])

// Fetch data
// TODO (FS-11): Migrate remaining direct api.get calls to network/firewall stores
// Currently: /network/wifi/ap/status, /network/interfaces/detailed, /firewall/nat,
//   /network/internet, /firewall/status, /network/mode are all direct.
// NAT toggle already migrated to firewallStore (FS-04 #11).
async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    const apPromise = apHardwarePresent.value
      ? api.get('/network/wifi/ap/status', {}, { signal: s }).catch(() => null)
      : Promise.resolve(null)

    const [ap, ifacesResp, nat, internet, fw, mode] = await Promise.all([
      apPromise,
      api.get('/network/interfaces/detailed', {}, { signal: s }).catch(() => ({ interfaces: [] })),
      api.get('/firewall/nat', {}, { signal: s }).catch(() => ({ enabled: false })),
      api.get('/network/internet', {}, { signal: s }).catch(() => ({ connected: false })),
      api.get('/firewall/status', {}, { signal: s }).catch(() => null),
      api.get('/network/mode', {}, { signal: s }).catch(() => null)
    ])
    
    if (!apHardwareChecked.value) {
      apHardwareChecked.value = true
      if (!ap || ap.error === 'no_hardware' || ap.error === 'not_found') {
        apHardwarePresent.value = false
      }
    }
    
    apStatus.value = ap
    networkMode.value = mode
    const allIfaces = ifacesResp?.interfaces || []
    interfaces.value = allIfaces.filter(iface => {
      const name = iface.name || ''
      if (name.startsWith('veth')) return false
      if (name.startsWith('br-')) return false
      if (name === 'lo') return false
      return true
    })
    natStatus.value = nat
    internetStatus.value = internet
    firewallStatus.value = fw

    // Also fetch connectivity and VPN mode
    networkStore.checkConnectivity()
    networkStore.getVPNMode()
    
    // Fetch clients count for badge
    clientsStore.fetchCount()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Actions — uses firewall store (FS-03b provided methods)
async function toggleNAT() {
  try {
    if (natStatus.value?.enabled) {
      await firewallStore.disableNat()
    } else {
      await firewallStore.enableNat()
    }
    // Update local ref from store state
    natStatus.value = { enabled: firewallStore.isNatEnabled }
  } catch (e) {
    error.value = e.message
  }
}

// Tab change handler: load tab-specific data
function onTabChange(tabId) {
  activeTab.value = tabId
  if (tabId === 'dns' && !networkStore.dns) loadDNS()
  if (tabId === 'wifi') {
    networkStore.fetchWiFiStatus()
    networkStore.fetchSavedNetworks()
  }
  if (tabId === 'clients') clientsStore.fetchClients()
}

// Poll data — paused when tab/window is not visible
let pollInterval = null
let trafficInterval = null

function startPolling() {
  if (!pollInterval) pollInterval = setInterval(fetchAll, 10000)
  if (!trafficInterval) trafficInterval = setInterval(fetchTrafficHistory, 5000)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  if (trafficInterval) { clearInterval(trafficInterval); trafficInterval = null }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else {
    fetchAll()
    startPolling()
  }
}

onMounted(() => {
  fetchAll()
  fetchTrafficHistory()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})
onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// Traffic history state
const selectedTrafficInterface = ref('')
const trafficHistory = ref([])
const currentTrafficStats = ref(null)

const physicalInterfaces = computed(() => {
  return interfaces.value.filter(i => 
    i.name && !i.name.startsWith('veth') && !i.name.startsWith('br-') && i.name !== 'lo'
  )
})

async function fetchTrafficHistory() {
  try {
    const s = signal()
    const stats = await api.get('/network/traffic', {}, { signal: s })
    if (stats?.stats?.length > 0) {
      if (!selectedTrafficInterface.value) {
        const physical = stats.stats.find(s => 
          !s.interface.startsWith('veth') && 
          !s.interface.startsWith('br-') && 
          s.interface !== 'lo' &&
          s.interface !== 'docker0'
        )
        selectedTrafficInterface.value = physical?.interface || stats.stats[0].interface
      }
      currentTrafficStats.value = stats.stats.find(s => s.interface === selectedTrafficInterface.value)
    }
    
    if (selectedTrafficInterface.value) {
      const history = await api.get(`/network/traffic/${selectedTrafficInterface.value}/history`, { minutes: 60 }, { signal: s })
      trafficHistory.value = history?.history || []
    }
  } catch (e) {
    // Traffic history fetch failed silently
  }
}

const normalizedTrafficHistory = computed(() => {
  const history = trafficHistory.value
  if (!history.length) return []
  
  const maxPoints = 60
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  const sampled = history.filter((_, i) => i % step === 0).slice(-maxPoints)
  
  const maxRate = Math.max(
    ...sampled.map(p => p.rx_rate_bps || 0),
    ...sampled.map(p => p.tx_rate_bps || 0),
    1
  )
  
  return sampled.map(point => ({
    ...point,
    rxHeight: Math.max(2, ((point.rx_rate_bps || 0) / maxRate) * 100),
    txHeight: Math.max(2, ((point.tx_rate_bps || 0) / maxRate) * 100)
  }))
})

const maxRxRate = computed(() => 
  Math.max(...trafficHistory.value.map(p => p.rx_rate_bps || 0), 0)
)
const maxTxRate = computed(() => 
  Math.max(...trafficHistory.value.map(p => p.tx_rate_bps || 0), 0)
)
const avgRxRate = computed(() => {
  const rates = trafficHistory.value.map(p => p.rx_rate_bps || 0).filter(r => r > 0)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
})
const avgTxRate = computed(() => {
  const rates = trafficHistory.value.map(p => p.tx_rate_bps || 0).filter(r => r > 0)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
})

// Helpers
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(1)} ${units[i]}`
}

function formatRate(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let rate = bytesPerSec
  while (rate >= 1024 && i < units.length - 1) {
    rate /= 1024
    i++
  }
  return `${rate.toFixed(1)} ${units[i]}`
}

function signalColor(pct) {
  if (!pct) return 'text-theme-muted'
  if (pct >= 70) return 'text-success'
  if (pct >= 40) return 'text-warning'
  return 'text-error'
}

function formatDuration(seconds) {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-theme-primary">Network</h1>
        <p class="text-theme-tertiary mt-1">Manage network interfaces and connectivity</p>
      </div>
      <button 
        @click="fetchAll" 
        :disabled="loading"
        class="px-4 py-2 bg-theme-tertiary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
      >
        <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="bg-error-muted border border-error rounded-lg p-4">
      <p class="text-error">{{ error }}</p>
    </div>

    <!-- Warning Banner -->
    <div v-if="networkWarning" class="bg-warning-muted border border-warning rounded-lg p-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <Icon name="AlertTriangle" :size="20" class="text-warning shrink-0" />
        <p class="text-warning text-sm">{{ networkWarning }}</p>
      </div>
      <button 
        @click="dismissWarning"
        class="p-1 text-warning hover:text-warning/70 shrink-0"
        title="Dismiss"
      >
        <Icon name="X" :size="16" />
      </button>
    </div>

    <!-- Network Mode Banner -->
    <div v-if="networkMode" class="bg-theme-secondary rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div class="flex items-center gap-4 min-w-0">
        <div>
          <span class="text-xs font-medium text-theme-muted uppercase tracking-wide">Network Mode</span>
          <p class="text-theme-primary font-semibold mt-0.5">
            {{ networkMode.mode === 'OFFLINE' ? 'Offline (AP Only)' : networkMode.mode === 'ONLINE_ETH' ? 'Online via Ethernet' : networkMode.mode === 'ONLINE_WIFI' ? 'Online via WiFi' : networkMode.mode || 'Unknown' }}
          </p>
        </div>
        <!-- Connectivity badge -->
        <span 
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="networkStore.isOnline ? 'bg-success-muted text-success' : networkMode.mode === 'OFFLINE' ? 'bg-warning-muted text-warning' : 'bg-error-muted text-error'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="networkStore.isOnline ? 'bg-success' : networkMode.mode === 'OFFLINE' ? 'bg-warning' : 'bg-error'"></span>
          {{ networkStore.isOnline ? 'Online' : networkMode.mode === 'OFFLINE' ? 'Air-gapped' : 'No Internet' }}
        </span>
      </div>
      <!-- VPN mode indicator -->
      <div v-if="networkStore.vpnMode" class="flex items-center gap-2">
        <Icon name="Shield" :size="14" class="text-theme-muted" />
        <span class="text-xs text-theme-muted">VPN: {{ networkStore.vpnMode.mode || 'Off' }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary overflow-x-auto">
      <nav class="flex gap-1 sm:gap-4 min-w-max">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="onTabChange(tab.id)"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.id 
            ? 'border-[color:var(--accent-primary)] text-accent' 
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          {{ tab.label }}
          <span 
            v-if="tab.badge" 
            class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
            :class="activeTab === tab.id ? 'bg-accent text-white' : 'bg-theme-tertiary text-theme-secondary'"
          >
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </div>

    <!-- ==================== Overview Tab ==================== -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <!-- Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- WiFi AP Status -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Icon name="Wifi" :size="20" class="text-accent" />
              </div>
              <div>
                <p class="text-sm text-theme-tertiary">Access Point</p>
                <p class="font-semibold text-theme-primary">{{ apStatus?.ssid || 'CubeOS' }}</p>
              </div>
            </div>
            <button 
              @click="openAPConfigModal"
              class="p-2 text-theme-muted hover:text-accent hover:bg-accent-muted rounded-lg transition-colors"
              title="Configure Access Point"
            >
              <Icon name="Settings" :size="20" />
            </button>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-theme-muted">Status</span>
            <span :class="apIsActive ? 'text-success' : 'text-error'">
              {{ apIsActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm mt-1">
            <span class="text-theme-muted">Clients</span>
            <span class="font-medium text-theme-primary">{{ clientsStore.count || 0 }}</span>
          </div>
          <div class="flex items-center justify-between text-sm mt-1">
            <span class="text-theme-muted">Channel</span>
            <span class="text-theme-secondary">{{ apStatus?.channel || '-' }} ({{ apStatus?.frequency || '2.4GHz' }})</span>
          </div>
          <!-- AP Start/Stop controls -->
          <div class="mt-3 flex gap-2">
            <button
              v-if="!apIsActive"
              @click="handleStartAP"
              :disabled="apActionLoading"
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success-muted text-success hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
              <Icon v-else name="Play" :size="14" />
              Start AP
            </button>
            <button
              v-if="apIsActive"
              @click="handleStopAP"
              :disabled="apActionLoading"
              class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
              <Icon v-else name="Square" :size="14" />
              Stop AP
            </button>
          </div>
        </div>

        <!-- Internet Status -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                 :class="internetStatus?.connected ? 'bg-success-muted' : 'bg-theme-tertiary'">
              <Icon name="Globe" :size="20" :class="internetStatus?.connected ? 'text-success' : 'text-theme-muted'" />
            </div>
            <div>
              <p class="text-sm text-theme-tertiary">Internet</p>
              <p class="font-semibold" :class="internetStatus?.connected ? 'text-success' : 'text-theme-muted'">
                {{ internetStatus?.connected ? 'Connected' : 'Offline' }}
              </p>
            </div>
          </div>
          <div v-if="internetStatus?.connected" class="text-sm">
            <div class="flex items-center justify-between">
              <span class="text-theme-muted">Latency</span>
              <span class="text-theme-secondary">{{ internetStatus?.rtt_ms?.toFixed(1) || '-' }} ms</span>
            </div>
            <div class="flex items-center justify-between mt-1">
              <span class="text-theme-muted">Target</span>
              <span class="text-theme-secondary">{{ internetStatus?.target_name || '-' }}</span>
            </div>
          </div>
          <div v-else class="text-sm text-theme-muted mt-2">
            Running in offline mode
          </div>
        </div>

        <!-- NAT Status -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                 :class="natStatus?.enabled ? 'bg-[#8b5cf620]' : 'bg-theme-tertiary'">
              <Icon name="ArrowLeftRight" :size="20" :class="natStatus?.enabled ? 'text-[#8b5cf6]' : 'text-theme-muted'" />
            </div>
            <div>
              <p class="text-sm text-theme-tertiary">Internet Sharing</p>
              <p class="font-semibold" :class="natStatus?.enabled ? 'text-[#8b5cf6]' : 'text-theme-muted'">
                {{ natStatus?.enabled ? 'Enabled' : 'Disabled' }}
              </p>
            </div>
          </div>
          <button 
            @click="toggleNAT"
            class="w-full mt-2 px-3 py-2 text-sm rounded-lg transition-colors"
            :class="natStatus?.enabled 
              ? 'bg-[#8b5cf620] text-[#8b5cf6] hover:opacity-80'
              : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-tertiary'"
          >
            {{ natStatus?.enabled ? 'Disable NAT' : 'Enable NAT' }}
          </button>
        </div>

        <!-- Firewall (summary card linking to /firewall) -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-[#f59e0b20] flex items-center justify-center">
              <Icon name="Shield" :size="20" class="text-[#f59e0b]" />
            </div>
            <div>
              <p class="text-sm text-theme-tertiary">Firewall</p>
              <p class="font-semibold text-theme-primary">
                {{ firewallStatus?.ip_forward ? 'IP Fwd On' : 'IP Fwd Off' }}
              </p>
            </div>
          </div>
          <div class="text-sm">
            <div class="flex items-center justify-between">
              <span class="text-theme-muted">IP Forward</span>
              <span :class="firewallStatus?.ip_forward ? 'text-success' : 'text-theme-muted'">
                {{ firewallStatus?.ip_forward ? 'On' : 'Off' }}
              </span>
            </div>
            <div class="flex items-center justify-between mt-1">
              <span class="text-theme-muted">Rules</span>
              <span class="text-theme-secondary">{{ firewallStatus?.filter_rules?.length || 0 }}</span>
            </div>
          </div>
          <button 
            @click="router.push('/firewall')"
            class="w-full mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:bg-theme-card transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="ExternalLink" :size="14" />
            Manage Firewall
          </button>
        </div>
      </div>

      <!-- Network Mode Selector -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <NetworkModeSelector 
          @modeChanged="fetchAll" 
          @showWifiConnect="showWiFiConnector = true" 
        />
      </div>

      <!-- Interfaces -->
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary">
          <h3 class="font-semibold text-theme-primary">Network Interfaces</h3>
        </div>
        <div class="divide-y divide-[color:var(--border-primary)]">
          <div v-for="iface in interfaces" :key="iface.name" class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
                <Icon :name="iface.type === 'wifi' ? 'Wifi' : 'Monitor'" :size="16" class="text-theme-tertiary" />
              </div>
              <div>
                <p class="font-medium text-theme-primary">{{ iface.name }}</p>
                <p class="text-sm text-theme-muted">{{ iface.ipv4 || iface.ip || 'No IP' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div v-if="iface.rx_bytes || iface.tx_bytes" class="text-xs text-theme-muted text-right hidden sm:block">
                <span>↓ {{ formatBytes(iface.rx_bytes) }}</span>
                <span class="mx-1">↑ {{ formatBytes(iface.tx_bytes) }}</span>
              </div>
              <span class="px-2 py-1 text-xs rounded-full"
                    :class="iface.state === 'up' || iface.state === 'UP'
                      ? 'bg-success-muted text-success'
                      : 'bg-theme-tertiary text-theme-muted'">
                {{ iface.state || 'unknown' }}
              </span>
            </div>
          </div>
          <div v-if="interfaces.length === 0" class="px-4 py-8 text-center text-theme-muted">
            No interfaces found
          </div>
        </div>
      </div>

      <!-- Advanced Network Settings (collapsible) -->
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <button 
          @click="showNetworkSettings = !showNetworkSettings; if (showNetworkSettings && !networkStore.networkSettings) loadNetworkSettings()"
          class="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div class="flex items-center gap-2">
            <Icon name="Sliders" :size="16" class="text-theme-muted" />
            <h3 class="font-semibold text-theme-primary text-sm">Advanced Settings</h3>
          </div>
          <Icon :name="showNetworkSettings ? 'ChevronUp' : 'ChevronDown'" :size="16" class="text-theme-muted" />
        </button>
        <div v-if="showNetworkSettings" class="px-4 pb-4 border-t border-theme-primary pt-4">
          <div v-if="settingsLoading" class="flex items-center justify-center py-6">
            <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
          </div>
          <div v-else-if="networkStore.networkSettings" class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-theme-muted">MTU</span>
              <span class="text-theme-secondary font-mono">{{ networkStore.networkSettings.mtu || 'Default' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-theme-muted">IP Forwarding</span>
              <span :class="networkStore.networkSettings.ip_forward ? 'text-success' : 'text-theme-muted'">
                {{ networkStore.networkSettings.ip_forward ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div v-if="networkStore.networkSettings.dns_server" class="flex items-center justify-between">
              <span class="text-theme-muted">DNS Server</span>
              <span class="text-theme-secondary font-mono">{{ networkStore.networkSettings.dns_server }}</span>
            </div>
          </div>
          <div v-else class="py-4 text-center text-theme-muted text-sm">
            No settings available
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== WiFi Tab ==================== -->
    <div v-if="activeTab === 'wifi'" class="space-y-6">
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
            >
              <Icon name="WifiOff" :size="14" />
              Disconnect
            </button>
            <button
              @click="showWiFiConnector = true"
              class="px-3 py-1.5 text-xs font-medium rounded-lg btn-accent flex items-center gap-1.5"
            >
              <Icon name="Search" :size="14" />
              Scan & Connect
            </button>
          </div>
        </div>
      </div>

      <!-- Saved Networks -->
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary flex items-center justify-between">
          <h3 class="font-semibold text-theme-primary">Saved Networks</h3>
          <button
            @click="networkStore.fetchSavedNetworks()"
            class="text-xs text-accent hover:underline"
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
            <button
              @click="networkStore.forgetNetwork(net.ssid)"
              class="px-2.5 py-1 text-xs text-error hover:bg-error-muted rounded-lg transition-colors"
            >
              Forget
            </button>
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
      </div>
    </div>

    <!-- ==================== DNS Tab ==================== -->
    <div v-if="activeTab === 'dns'" class="space-y-6">
      <div class="bg-theme-card rounded-xl border border-theme-primary p-4 sm:p-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
            <Icon name="Globe" :size="20" class="text-accent" />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">DNS Configuration</h3>
            <p class="text-sm text-theme-muted">Upstream DNS servers for name resolution</p>
          </div>
        </div>

        <div class="space-y-4 max-w-lg">
          <!-- Primary DNS -->
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1.5">Primary DNS Server</label>
            <input 
              v-model="dnsPrimary"
              type="text"
              placeholder="e.g. 1.1.1.1"
              class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary placeholder-theme-muted focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono"
            >
          </div>

          <!-- Secondary DNS -->
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1.5">Secondary DNS Server</label>
            <input 
              v-model="dnsSecondary"
              type="text"
              placeholder="e.g. 8.8.8.8"
              class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary placeholder-theme-muted focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono"
            >
          </div>

          <!-- Pi-hole indicator -->
          <div class="flex items-center gap-2 p-3 bg-theme-secondary rounded-lg text-sm">
            <Icon name="Info" :size="16" class="text-theme-muted shrink-0" />
            <p class="text-theme-muted">DNS resolution is managed by Pi-hole. These upstream servers are used when Pi-hole forwards queries.</p>
          </div>

          <!-- Save button -->
          <div class="flex items-center gap-3">
            <button 
              @click="saveDNS"
              :disabled="dnsLoading"
              class="px-4 py-2 btn-accent rounded-lg hover:bg-[color:var(--accent-hover)] disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
            >
              <Icon v-if="dnsLoading" name="Loader2" :size="16" class="animate-spin" />
              Save DNS Settings
            </button>
            <span v-if="dnsSaveSuccess" class="text-success text-sm flex items-center gap-1">
              <Icon name="Check" :size="16" />
              Saved
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Clients Tab ==================== -->
    <div v-if="activeTab === 'clients'" class="space-y-4">
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 class="font-semibold text-theme-primary">Connected Clients</h3>
            <p class="text-sm text-theme-muted">
              {{ clientsStore.activeCount }} active{{ clientsStore.blockedCount ? `, ${clientsStore.blockedCount} blocked` : '' }}
            </p>
          </div>
          <button 
            @click="clientsStore.fetchClients()" 
            :disabled="clientsStore.loading"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:bg-theme-card flex items-center gap-1.5"
          >
            <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': clientsStore.loading }" />
            Refresh
          </button>
        </div>
        
        <!-- Active Clients -->
        <div class="divide-y divide-[color:var(--border-primary)]">
          <div v-for="client in clientsStore.activeClients" :key="client.mac || client.mac_address" class="px-4 py-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 sm:gap-4 min-w-0">
                <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
                  <Icon name="Smartphone" :size="20" class="text-theme-tertiary" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-theme-primary truncate">
                    {{ client.hostname || 'Unknown Device' }}
                  </p>
                  <p class="text-sm text-theme-muted">{{ client.ip || client.ip_address || 'No IP' }}</p>
                  <p class="text-xs text-theme-muted font-mono hidden sm:block">{{ client.mac || client.mac_address }}</p>
                </div>
              </div>
              
              <div class="flex items-center gap-2 sm:gap-4 shrink-0">
                <!-- Signal strength -->
                <div v-if="client.signal_percent" class="text-center hidden sm:block">
                  <div class="flex items-center gap-1">
                    <Icon name="Wifi" :size="14" :class="signalColor(client.signal_percent)" />
                    <span class="text-xs" :class="signalColor(client.signal_percent)">{{ client.signal_percent }}%</span>
                  </div>
                </div>
                
                <!-- Connected duration -->
                <div v-if="client.connected_seconds" class="text-xs text-theme-muted text-right hidden sm:block">
                  {{ formatDuration(client.connected_seconds) }}
                </div>
                
                <!-- Block action -->
                <button 
                  @click="clientsStore.blockClient(client.mac || client.mac_address)"
                  class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-theme-tertiary transition-colors"
                  title="Block client"
                >
                  <Icon name="Ban" :size="18" />
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="clientsStore.activeClients.length === 0 && clientsStore.blockedClients.length === 0" class="px-4 py-12 text-center">
            <Icon name="Wifi" :size="48" class="mx-auto text-theme-muted mb-4" />
            <p class="text-theme-muted">No clients connected</p>
          </div>
        </div>
      </div>

      <!-- Blocked Clients -->
      <div v-if="clientsStore.blockedClients.length > 0" class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary">
          <h3 class="font-semibold text-theme-primary">Blocked Clients</h3>
        </div>
        <div class="divide-y divide-[color:var(--border-primary)]">
          <div v-for="client in clientsStore.blockedClients" :key="client.mac || client.mac_address" class="px-4 py-3 opacity-60">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-error-muted flex items-center justify-center shrink-0">
                  <Icon name="Ban" :size="16" class="text-error" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-theme-primary truncate">{{ client.hostname || 'Unknown Device' }}</p>
                  <p class="text-xs text-theme-muted font-mono">{{ client.mac || client.mac_address }}</p>
                </div>
              </div>
              <button 
                @click="clientsStore.unblockClient(client.mac || client.mac_address)"
                class="px-3 py-1 text-xs font-medium text-accent hover:bg-accent-muted rounded-lg transition-colors"
              >
                Unblock
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Traffic Tab ==================== -->
    <div v-if="activeTab === 'traffic'" class="space-y-4">
      <!-- Interface selector -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <div class="flex flex-wrap items-center gap-4">
          <label class="text-sm font-medium text-theme-secondary">Interface:</label>
          <select 
            v-model="selectedTrafficInterface" 
            @change="fetchTrafficHistory"
            class="px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary"
          >
            <option v-for="iface in physicalInterfaces" :key="iface.name" :value="iface.name">
              {{ iface.name }} ({{ iface.state }})
            </option>
          </select>
          <button 
            @click="fetchTrafficHistory" 
            class="px-3 py-2 bg-theme-tertiary rounded-lg hover:bg-theme-tertiary text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
      
      <!-- Current Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-success-muted flex items-center justify-center">
              <Icon name="ArrowDown" :size="20" class="text-success" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Download</h3>
              <p class="text-sm text-theme-muted">Incoming traffic</p>
            </div>
          </div>
          <div class="text-3xl font-bold text-theme-primary">
            {{ formatBytes(currentTrafficStats?.rx_bytes || 0) }}
          </div>
          <div v-if="currentTrafficStats?.rx_rate_bps" class="text-sm text-success mt-1">
            {{ formatRate(currentTrafficStats.rx_rate_bps) }}/s
          </div>
        </div>
        
        <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Icon name="ArrowUp" :size="20" class="text-accent" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Upload</h3>
              <p class="text-sm text-theme-muted">Outgoing traffic</p>
            </div>
          </div>
          <div class="text-3xl font-bold text-theme-primary">
            {{ formatBytes(currentTrafficStats?.tx_bytes || 0) }}
          </div>
          <div v-if="currentTrafficStats?.tx_rate_bps" class="text-sm text-accent mt-1">
            {{ formatRate(currentTrafficStats.tx_rate_bps) }}/s
          </div>
        </div>
      </div>
      
      <!-- Traffic History Graph -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <h3 class="font-semibold text-theme-primary mb-4">Traffic History (Last 60 minutes)</h3>
        
        <div v-if="trafficHistory.length > 0" class="space-y-4">
          <div class="h-48 flex items-end gap-0.5">
            <div 
              v-for="(point, idx) in normalizedTrafficHistory" 
              :key="idx"
              class="flex-1 flex flex-col justify-end gap-0.5"
              :title="`RX: ${formatRate(point.rx_rate_bps)}/s, TX: ${formatRate(point.tx_rate_bps)}/s`"
            >
              <div 
                class="bg-success rounded-t transition-all"
                :style="{ height: `${point.rxHeight}%` }"
              ></div>
              <div 
                class="bg-accent rounded-t transition-all"
                :style="{ height: `${point.txHeight}%` }"
              ></div>
            </div>
          </div>
          
          <div class="flex items-center justify-center gap-6 text-sm">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-success rounded"></span>
              <span class="text-theme-tertiary">Download</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-accent rounded"></span>
              <span class="text-theme-tertiary">Upload</span>
            </div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-theme-primary text-sm">
            <div>
              <p class="text-theme-muted">Max Download</p>
              <p class="font-medium text-theme-primary">{{ formatRate(maxRxRate) }}/s</p>
            </div>
            <div>
              <p class="text-theme-muted">Max Upload</p>
              <p class="font-medium text-theme-primary">{{ formatRate(maxTxRate) }}/s</p>
            </div>
            <div>
              <p class="text-theme-muted">Avg Download</p>
              <p class="font-medium text-theme-primary">{{ formatRate(avgRxRate) }}/s</p>
            </div>
            <div>
              <p class="text-theme-muted">Avg Upload</p>
              <p class="font-medium text-theme-primary">{{ formatRate(avgTxRate) }}/s</p>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-12 text-theme-muted">
          <Icon name="BarChart3" :size="48" class="mx-auto text-theme-muted mb-4" />
          <p>No traffic history available yet</p>
          <p class="text-sm mt-1">Data collection starts when the page loads</p>
        </div>
      </div>
    </div>

    <!-- WiFi Connector Modal -->
    <WiFiConnector 
      :show="showWiFiConnector" 
      @close="showWiFiConnector = false" 
      @connected="showWiFiConnector = false; fetchAll()"
    />

    <!-- WiFi AP Config Modal -->
    <Teleport to="body">
      <div v-if="showAPConfigModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showAPConfigModal = false">
        <div class="bg-theme-card rounded-2xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
            <h3 class="text-lg font-semibold text-theme-primary">WiFi Access Point Settings</h3>
            <button @click="showAPConfigModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg">
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
