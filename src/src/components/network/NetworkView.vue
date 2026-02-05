<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'

const { signal, abort } = useAbortOnUnmount()

// State
const loading = ref(true)
const apStatus = ref(null)
const clients = ref([])
const interfaces = ref([])
const natStatus = ref(null)
const internetStatus = ref(null)
const firewallStatus = ref(null)
const networkMode = ref(null)
const error = ref(null)

// AP hardware detection — check once, cache result
const apHardwareChecked = ref(false)
const apHardwarePresent = ref(true) // assume present until checked

// Fix 2: Robust AP status detection - HAL may return different field shapes
const apIsActive = computed(() => {
  if (!apStatus.value) return false
  const s = apStatus.value
  // Check various HAL response shapes
  if (s.status === 'up' || s.status === 'active') return true
  if (s.state === 'active' || s.state === 'up') return true
  if (s.active === true) return true
  // If we have an SSID being broadcast, it's running
  if (s.ssid && s.ssid.length > 0) return true
  return false
})

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
    // Restart AP to apply changes
    await api.post('/network/wifi/ap/restart')
    showAPConfigModal.value = false
    // Wait a moment then refresh status
    setTimeout(() => fetchAll(), 2000)
  } catch (e) {
    alert('Failed to save AP config: ' + e.message)
  } finally {
    apConfigLoading.value = false
  }
}

// Tabs
const activeTab = ref('overview')
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'clients', label: 'Clients' },
  { id: 'firewall', label: 'Firewall' },
  { id: 'traffic', label: 'Traffic' }
]

// Firewall profiles
const firewallProfiles = [
  { id: 'offline', name: 'Offline Only', desc: 'No internet access, local services only', icon: 'Shield' },
  { id: 'lan', name: 'LAN Access', desc: 'Allow LAN traffic, block internet', icon: 'Network' },
  { id: 'full', name: 'Full Internet', desc: 'Full internet access with NAT', icon: 'Globe' },
  { id: 'custom', name: 'Custom', desc: 'Manual firewall rules', icon: 'Settings' }
]
const activeProfile = ref('offline')
const showDockerRules = ref(false)

// Computed: displayed firewall rules based on toggle
const displayedFirewallRules = computed(() => {
  if (showDockerRules.value) {
    return firewallStatus.value?.all_filter_rules || []
  }
  return firewallStatus.value?.filter_rules || []
})

// Fetch data
async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    // Build fetch promises — skip AP calls if hardware not present
    const apPromise = apHardwarePresent.value
      ? api.get('/network/wifi/ap/status', {}, { signal: s }).catch(() => null)
      : Promise.resolve(null)
    const clientsPromise = apHardwarePresent.value
      ? api.get('/network/wifi/ap/clients', {}, { signal: s }).catch(() => ({ clients: [] }))
      : Promise.resolve({ clients: [] })

    const [ap, clientList, ifacesResp, nat, internet, fw, mode] = await Promise.all([
      apPromise,
      clientsPromise,
      api.get('/network/interfaces/detailed', {}, { signal: s }).catch(() => ({ interfaces: [] })),
      api.get('/firewall/nat', {}, { signal: s }).catch(() => ({ enabled: false })),
      api.get('/network/internet', {}, { signal: s }).catch(() => ({ connected: false })),
      api.get('/firewall/status', {}, { signal: s }).catch(() => null),
      api.get('/network/mode', {}, { signal: s }).catch(() => null)
    ])
    
    // Cache AP hardware detection result on first check
    if (!apHardwareChecked.value) {
      apHardwareChecked.value = true
      // If AP status returned null/error or explicitly indicates no hardware, mark as absent
      if (!ap || ap.error === 'no_hardware' || ap.error === 'not_found') {
        apHardwarePresent.value = false
      }
    }
    
    apStatus.value = ap
    networkMode.value = mode
    clients.value = clientList?.clients || []
    // Filter out Docker virtual interfaces - only show physical/relevant ones
    const allIfaces = ifacesResp?.interfaces || []
    interfaces.value = allIfaces.filter(iface => {
      const name = iface.name || ''
      // Skip Docker bridges, veth pairs, and loopback
      if (name.startsWith('veth')) return false
      if (name.startsWith('br-')) return false
      if (name === 'lo') return false
      return true
    })
    natStatus.value = nat
    internetStatus.value = internet
    firewallStatus.value = fw
    
    // Determine active profile based on NAT status
    if (nat?.enabled) {
      activeProfile.value = 'full'
    } else if (fw?.ip_forward) {
      activeProfile.value = 'lan'
    } else {
      activeProfile.value = 'offline'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Actions
async function toggleNAT() {
  try {
    if (natStatus.value?.enabled) {
      await api.post('/firewall/nat/disable')
    } else {
      await api.post('/firewall/nat/enable')
    }
    await fetchAll()
  } catch (e) {
    error.value = e.message
  }
}

async function applyFirewallProfile(profile) {
  try {
    loading.value = true
    if (profile === 'full') {
      await api.post('/firewall/nat/enable')
    } else {
      await api.post('/firewall/nat/disable')
    }
    activeProfile.value = profile
    await fetchAll()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function kickClient(mac) {
  if (!await confirm({
    title: 'Disconnect Client',
    message: `Disconnect client ${mac}?`,
    confirmText: 'Disconnect',
    variant: 'warning'
  })) return
  try {
    await api.post(`/network/wifi/ap/clients/${mac}/kick`)
    await fetchAll()
  } catch (e) {
    error.value = e.message
  }
}

async function blockClient(mac) {
  if (!await confirm({
    title: 'Block Client',
    message: `Block client ${mac}? They won't be able to reconnect.`,
    confirmText: 'Block',
    variant: 'danger'
  })) return
  try {
    await api.post(`/network/wifi/ap/clients/${mac}/block`)
    await fetchAll()
  } catch (e) {
    error.value = e.message
  }
}

// Poll data
let pollInterval = null
let trafficInterval = null

onMounted(() => {
  fetchAll()
  pollInterval = setInterval(fetchAll, 10000)
  // Start traffic history collection
  fetchTrafficHistory()
  trafficInterval = setInterval(fetchTrafficHistory, 5000)
})
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (trafficInterval) clearInterval(trafficInterval)
})

// Traffic history state
const selectedTrafficInterface = ref('')
const trafficHistory = ref([])
const currentTrafficStats = ref(null)

// Physical interfaces (for traffic selector)
const physicalInterfaces = computed(() => {
  return interfaces.value.filter(i => 
    i.name && !i.name.startsWith('veth') && !i.name.startsWith('br-') && i.name !== 'lo'
  )
})

// Fetch traffic history
async function fetchTrafficHistory() {
  try {
    const s = signal()
    // Get current stats first
    const stats = await api.get('/network/traffic', {}, { signal: s })
    if (stats?.stats?.length > 0) {
      // Auto-select first physical interface if not selected
      if (!selectedTrafficInterface.value) {
        const physical = stats.stats.find(s => 
          !s.interface.startsWith('veth') && 
          !s.interface.startsWith('br-') && 
          s.interface !== 'lo' &&
          s.interface !== 'docker0'
        )
        selectedTrafficInterface.value = physical?.interface || stats.stats[0].interface
      }
      
      // Get current stats for selected interface
      currentTrafficStats.value = stats.stats.find(s => s.interface === selectedTrafficInterface.value)
    }
    
    // Get history for selected interface
    if (selectedTrafficInterface.value) {
      const history = await api.get(`/network/traffic/${selectedTrafficInterface.value}/history`, { minutes: 60 }, { signal: s })
      trafficHistory.value = history?.history || []
    }
  } catch (e) {
    // Traffic history fetch failed silently
  }
}

// Normalized history for chart (max 60 points)
const normalizedTrafficHistory = computed(() => {
  const history = trafficHistory.value
  if (!history.length) return []
  
  // Sample to max 60 points
  const maxPoints = 60
  const step = Math.max(1, Math.floor(history.length / maxPoints))
  const sampled = history.filter((_, i) => i % step === 0).slice(-maxPoints)
  
  // Find max rate for normalization
  const maxRate = Math.max(
    ...sampled.map(p => p.rx_rate_bps || 0),
    ...sampled.map(p => p.tx_rate_bps || 0),
    1 // Prevent division by zero
  )
  
  return sampled.map(point => ({
    ...point,
    rxHeight: Math.max(2, ((point.rx_rate_bps || 0) / maxRate) * 100),
    txHeight: Math.max(2, ((point.tx_rate_bps || 0) / maxRate) * 100)
  }))
})

// Traffic stats
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
  if (pct >= 70) return 'text-green-500'
  if (pct >= 40) return 'text-yellow-500'
  return 'text-red-500'
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
        <svg class="w-5 h-5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="bg-error-muted border border-error rounded-lg p-4">
      <p class="text-error">{{ error }}</p>
    </div>

    <!-- Network Mode Banner -->
    <div v-if="networkMode" class="bg-theme-secondary rounded-xl p-4 flex items-center justify-between">
      <div>
        <span class="text-xs font-medium text-theme-muted uppercase tracking-wide">Network Mode</span>
        <p class="text-theme-primary font-semibold mt-0.5">
          {{ networkMode.mode === 'OFFLINE' ? 'Offline (AP Only)' : networkMode.mode === 'ONLINE_ETH' ? 'Online via Ethernet' : networkMode.mode === 'ONLINE_WIFI' ? 'Online via WiFi' : networkMode.mode || 'Unknown' }}
        </p>
      </div>
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        :class="networkMode.mode === 'OFFLINE' ? 'bg-warning-muted text-warning' : 'bg-success-muted text-success'">
        {{ networkMode.mode === 'OFFLINE' ? 'Air-gapped' : 'Connected' }}
      </span>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary">
      <nav class="flex gap-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="activeTab === tab.id 
            ? 'border-[color:var(--accent-primary)] text-accent' 
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Overview Tab -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <!-- Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- WiFi AP Status -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
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
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-theme-muted">Status</span>
            <span :class="apIsActive ? 'text-green-500' : 'text-red-500'">
              {{ apIsActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm mt-1">
            <span class="text-theme-muted">Clients</span>
            <span class="font-medium text-theme-primary">{{ clients.length }}</span>
          </div>
          <div class="flex items-center justify-between text-sm mt-1">
            <span class="text-theme-muted">Channel</span>
            <span class="text-theme-secondary">{{ apStatus?.channel || '-' }} ({{ apStatus?.frequency || '2.4GHz' }})</span>
          </div>
        </div>

        <!-- Internet Status -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                 :class="internetStatus?.connected ? 'bg-success-muted' : 'bg-theme-tertiary'">
              <svg class="w-5 h-5" :class="internetStatus?.connected ? 'text-success' : 'text-theme-muted'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
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
              <svg class="w-5 h-5" :class="natStatus?.enabled ? 'text-[#8b5cf6]' : 'text-theme-muted'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
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
              : 'bg-theme-tertiary text-theme-secondary hover:bg-gray-200'"
          >
            {{ natStatus?.enabled ? 'Disable NAT' : 'Enable NAT' }}
          </button>
        </div>

        <!-- Firewall -->
        <div class="bg-theme-card rounded-xl p-4 border border-theme-primary">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-[#f59e0b20] flex items-center justify-center">
              <svg class="w-5 h-5 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p class="text-sm text-theme-tertiary">Firewall</p>
              <p class="font-semibold text-theme-primary capitalize">{{ activeProfile }}</p>
            </div>
          </div>
          <div class="text-sm">
            <div class="flex items-center justify-between">
              <span class="text-theme-muted">IP Forward</span>
              <span :class="firewallStatus?.ip_forward ? 'text-green-500' : 'text-theme-muted'">
                {{ firewallStatus?.ip_forward ? 'On' : 'Off' }}
              </span>
            </div>
          </div>
        </div>
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
                <svg v-if="iface.type === 'wifi'" class="w-4 h-4 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                <svg v-else class="w-4 h-4 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-theme-primary">{{ iface.name }}</p>
                <p class="text-sm text-theme-muted">{{ iface.ipv4 || iface.ip || 'No IP' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div v-if="iface.rx_bytes || iface.tx_bytes" class="text-xs text-theme-muted text-right">
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

      <!-- Firewall Profiles -->
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary">
          <h3 class="font-semibold text-theme-primary">Firewall Profiles</h3>
          <p class="text-sm text-theme-muted mt-1">Quick presets for common network configurations</p>
        </div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            v-for="profile in firewallProfiles"
            :key="profile.id"
            @click="applyFirewallProfile(profile.id)"
            class="p-4 rounded-lg border-2 text-left transition-all"
            :class="activeProfile === profile.id 
              ? 'border-[color:var(--accent-primary)] bg-accent-muted' 
              : 'border-theme-primary hover:border-theme-secondary'"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
                <svg class="w-4 h-4 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span class="font-medium text-theme-primary">{{ profile.name }}</span>
            </div>
            <p class="text-sm text-theme-muted">{{ profile.desc }}</p>
            <div v-if="activeProfile === profile.id" class="mt-2">
              <span class="text-xs text-accent font-medium">Active</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Clients Tab -->
    <div v-if="activeTab === 'clients'" class="space-y-4">
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-theme-primary">Connected Clients</h3>
            <p class="text-sm text-theme-muted">{{ clients.length }} device{{ clients.length !== 1 ? 's' : '' }} connected</p>
          </div>
        </div>
        
        <div class="divide-y divide-[color:var(--border-primary)]">
          <div v-for="client in clients" :key="client.mac_address" class="px-4 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <!-- Device icon -->
                <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center">
                  <svg class="w-5 h-5 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                
                <!-- Client info -->
                <div>
                  <p class="font-medium text-theme-primary">
                    {{ client.hostname || 'Unknown Device' }}
                  </p>
                  <p class="text-sm text-theme-muted">{{ client.ip_address || 'No IP' }}</p>
                  <p class="text-xs text-theme-muted font-mono">{{ client.mac_address }}</p>
                </div>
              </div>
              
              <div class="flex items-center gap-4">
                <!-- Signal strength -->
                <div v-if="client.signal_percent" class="text-center">
                  <div class="flex items-center gap-1">
                    <svg class="w-4 h-4" :class="signalColor(client.signal_percent)" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3C7.46 3 3.34 4.78.29 7.67c-.18.18-.29.43-.29.71s.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.48 3-.73 4.6-.73s3.15.25 4.6.73v3.1c0 .4.23.74.56.9.98.49 1.87 1.12 2.67 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71s-.11-.53-.29-.71C20.66 4.78 16.54 3 12 3z" />
                    </svg>
                    <span class="text-sm" :class="signalColor(client.signal_percent)">{{ client.signal_percent }}%</span>
                  </div>
                  <p class="text-xs text-theme-muted">{{ client.signal_dbm }} dBm</p>
                </div>
                
                <!-- Traffic -->
                <div class="text-right text-sm">
                  <p class="text-theme-muted">↓ {{ formatBytes(client.rx_bytes) }}</p>
                  <p class="text-theme-muted">↑ {{ formatBytes(client.tx_bytes) }}</p>
                </div>
                
                <!-- Actions -->
                <div class="flex gap-2">
                  <button 
                    @click="kickClient(client.mac_address)"
                    class="p-2 text-theme-muted hover:text-yellow-500 rounded-lg hover:bg-theme-tertiary"
                    title="Disconnect"
                  >
                    <!-- WiFi off icon -->
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                    </svg>
                  </button>
                  <button 
                    @click="blockClient(client.mac_address)"
                    class="p-2 text-theme-muted hover:text-red-500 rounded-lg hover:bg-theme-tertiary"
                    title="Block"
                  >
                    <!-- Shield ban icon -->
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l9 4v6c0 5.25-3.75 9.74-9 11-5.25-1.26-9-5.75-9-11V6l9-4z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l6 0M9 12l6 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="clients.length === 0" class="px-4 py-12 text-center">
            <svg class="w-12 h-12 mx-auto text-theme-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <p class="text-theme-muted">No clients connected</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Firewall Tab -->
    <div v-if="activeTab === 'firewall'" class="space-y-4">
      <div class="bg-theme-card rounded-xl border border-theme-primary">
        <div class="px-4 py-3 border-b border-theme-primary flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-theme-primary">Firewall Rules</h3>
            <p class="text-sm text-theme-muted">User-defined firewall rules</p>
          </div>
          <label class="flex items-center gap-2 text-sm text-theme-tertiary">
            <input type="checkbox" v-model="showDockerRules" class="rounded border-theme-secondary">
            Show Docker rules
          </label>
        </div>
        <div class="p-4">
          <div v-if="displayedFirewallRules?.length" class="space-y-2">
            <div v-for="(rule, idx) in displayedFirewallRules" :key="idx" 
                 class="flex items-center justify-between p-3 bg-theme-secondary rounded-lg text-sm">
              <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 rounded text-xs font-medium"
                      :class="rule.target === 'ACCEPT' ? 'bg-success-muted text-success' : 
                              rule.target === 'DROP' ? 'bg-error-muted text-error' : 
                              rule.target === 'MASQUERADE' ? 'bg-accent-muted text-accent' :
                              'bg-theme-tertiary text-theme-secondary'">
                  {{ rule.target }}
                </span>
                <span class="text-theme-secondary font-mono text-xs">{{ rule.chain }}</span>
              </div>
              <div class="text-theme-muted text-xs space-x-2">
                <span v-if="rule.protocol && rule.protocol !== 'all'">{{ rule.protocol }}</span>
                <span v-if="rule.port">:{{ rule.port }}</span>
                <span v-if="rule.interface_in && rule.interface_in !== '*'">in:{{ rule.interface_in }}</span>
                <span v-if="rule.interface_out && rule.interface_out !== '*'">out:{{ rule.interface_out }}</span>
                <span v-if="rule.source && rule.source !== '0.0.0.0/0'">from {{ rule.source }}</span>
                <span v-if="rule.destination && rule.destination !== '0.0.0.0/0'">to {{ rule.destination }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-theme-muted">
            <svg class="w-12 h-12 mx-auto text-theme-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p>No custom firewall rules configured</p>
            <p class="text-sm mt-1">The system is using default rules</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Traffic Tab -->
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
            class="px-3 py-2 bg-theme-tertiary rounded-lg hover:bg-theme-tertiary"
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
              <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
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
              <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
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
          <!-- Simple bar chart visualization -->
          <div class="h-48 flex items-end gap-0.5">
            <div 
              v-for="(point, idx) in normalizedTrafficHistory" 
              :key="idx"
              class="flex-1 flex flex-col justify-end gap-0.5"
              :title="`RX: ${formatRate(point.rx_rate_bps)}/s, TX: ${formatRate(point.tx_rate_bps)}/s`"
            >
              <div 
                class="bg-green-500 rounded-t transition-all"
                :style="{ height: `${point.rxHeight}%` }"
              ></div>
              <div 
                class="bg-blue-500 rounded-t transition-all"
                :style="{ height: `${point.txHeight}%` }"
              ></div>
            </div>
          </div>
          
          <!-- Legend -->
          <div class="flex items-center justify-center gap-6 text-sm">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-green-500 rounded"></span>
              <span class="text-theme-tertiary">Download</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-blue-500 rounded"></span>
              <span class="text-theme-tertiary">Upload</span>
            </div>
          </div>
          
          <!-- Stats summary -->
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
          <svg class="w-12 h-12 mx-auto text-theme-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No traffic history available yet</p>
          <p class="text-sm mt-1">Data collection starts when the page loads</p>
        </div>
      </div>
    </div>
    
    <!-- WiFi AP Config Modal -->
    <Teleport to="body">
      <div v-if="showAPConfigModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showAPConfigModal = false">
        <div class="bg-theme-card rounded-2xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
            <h3 class="text-lg font-semibold text-theme-primary">WiFi Access Point Settings</h3>
            <button @click="showAPConfigModal = false" class="p-1 text-theme-muted hover:text-gray-500 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="p-6 space-y-4">
            <!-- SSID -->
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
            
            <!-- Password -->
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
            
            <!-- Channel -->
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
            
            <!-- Hidden -->
            <div class="flex items-center gap-3">
              <input 
                v-model="apConfig.hidden"
                type="checkbox"
                id="ap-hidden"
                class="w-4 h-4 rounded border-gray-300 text-accent focus:ring-[color:var(--accent-primary)]"
              >
              <label for="ap-hidden" class="text-sm text-theme-secondary">
                Hide network (don't broadcast SSID)
              </label>
            </div>
            
            <!-- Warning -->
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
              <svg v-if="apConfigLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Save & Restart AP
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
