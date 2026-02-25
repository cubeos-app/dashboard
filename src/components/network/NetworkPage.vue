<script setup>
/**
 * NetworkPage.vue — S06 Component
 *
 * Shell that renders Overview / WiFi tabs (both modes)
 * and Firewall / VPN / DNS / Clients / Traffic tabs (Advanced only).
 * Handles shared data fetching and ?tab= query param for backward-compat
 * redirects from /firewall → /network?tab=firewall, /vpn → /network?tab=vpn.
 *
 * Pattern: Shell → tab components (following S04 AppsPage pattern)
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNetworkStore } from '@/stores/network'
import { useFirewallStore } from '@/stores/firewall'
import { useClientsStore } from '@/stores/clients'
import { useVPNStore } from '@/stores/vpn'
import { useMode } from '@/composables/useMode'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useWallpaper } from '@/composables/useWallpaper'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { usePolling } from '@/composables/usePolling'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import TabBar from '@/components/ui/TabBar.vue'

import NetworkOverviewTab from './NetworkOverviewTab.vue'
import WiFiTab from './WiFiTab.vue'
import FirewallTab from './FirewallTab.vue'
import VPNTab from './VPNTab.vue'
import DNSTab from './DNSTab.vue'
import ClientsTab from './ClientsTab.vue'
import TrafficTab from './TrafficTab.vue'

const route = useRoute()
const router = useRouter()
const networkStore = useNetworkStore()
const firewallStore = useFirewallStore()
const clientsStore = useClientsStore()
const vpnStore = useVPNStore()
const { isAdvanced } = useMode()
const { isMobile } = useBreakpoint()
const { isActive: wallpaperActive, panelClass } = useWallpaper()
const { signal, abort } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'Globe' },
    { key: 'wifi', label: 'WiFi', icon: 'Wifi' },
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'firewall', label: 'Firewall', icon: 'Shield' },
      { key: 'vpn', label: 'VPN', icon: 'Lock', badge: vpnStore.isConnected ? null : null },
      { key: 'dns', label: 'DNS', icon: 'Globe' },
      { key: 'clients', label: 'Clients', icon: 'Users', badge: clientsStore.count || null },
      { key: 'traffic', label: 'Traffic', icon: 'BarChart3' }
    )
  }
  return tabs
})

const activeTab = ref('overview')

// Read ?tab= from route for backward-compat redirects
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'overview' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'overview'
  }
})

function setTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Shared Data ─────────────────────────────────────────────
const loading = ref(true)
const error = ref(null)

// Shared state for overview/wifi tabs
const apStatus = ref(null)
const interfaces = ref([])
const natStatus = ref(null)
const internetStatus = ref(null)
const firewallStatus = ref(null)
const networkMode = ref(null)

// AP hardware detection
const apHardwareChecked = ref(false)
const apHardwarePresent = ref(true)

// Normalized mode for case-insensitive comparison (backend sends lowercase)
const normalizedMode = computed(() => (networkMode.value?.mode || '').toLowerCase())
const modeLabelDisplay = computed(() => {
  switch (normalizedMode.value) {
    case 'offline_hotspot': return 'Offline Hotspot'
    case 'wifi_router': return 'WiFi Router'
    case 'wifi_bridge': return 'WiFi Bridge'
    case 'eth_client': return 'Ethernet Client'
    case 'wifi_client': return 'WiFi Client'
    case 'android_tether': return 'Android Tether'
    default: return networkMode.value?.mode || 'Unknown'
  }
})

async function fetchSharedData() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    const opts = { signal: s }
    const apPromise = apHardwarePresent.value
      ? networkStore.fetchAPStatus(opts)
      : Promise.resolve(null)

    const [ap, ifacesResp, nat, internet, , mode] = await Promise.all([
      apPromise,
      networkStore.fetchDetailedInterfaces(opts),
      firewallStore.fetchNatStatus(opts),
      networkStore.fetchInternetStatus(opts),
      firewallStore.fetchStatus(true, opts),
      networkStore.fetchNetworkMode(opts)
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
      if (!name) return false
      if (name.startsWith('veth')) return false
      if (name.startsWith('br-')) return false
      if (name.startsWith('docker')) return false
      if (name === 'lo') return false
      if (name === 'ingress_sbox') return false
      if (name.startsWith('cali')) return false
      if (name.startsWith('flannel')) return false
      if (name.startsWith('cni')) return false
      return true
    })
    natStatus.value = nat
    internetStatus.value = internet
    // fetchStatus stores result in firewallStore.status (doesn't return it)
    firewallStatus.value = firewallStore.status

    // Also fetch connectivity and VPN mode
    networkStore.checkConnectivity()
    networkStore.getVPNMode()
    clientsStore.fetchCount()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// ─── Polling ─────────────────────────────────────────────────
usePolling(fetchSharedData, 10000, { immediate: true, pauseWhenHidden: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Globe"
      title="Network"
      subtitle="Manage network interfaces, connectivity, and security"
    >
      <template #actions>
        <button
          @click="fetchSharedData"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          aria-label="Refresh network status"
        >
          <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
    </PageHeader>

    <!-- Error Alert -->
    <div v-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ error }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Network Mode Banner -->
    <div v-if="networkMode" class="bg-theme-secondary rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div class="flex items-center gap-4 min-w-0">
        <div>
          <span class="text-xs font-medium text-theme-muted uppercase tracking-wide">Network Mode</span>
          <p class="text-theme-primary font-semibold mt-0.5">
            {{ modeLabelDisplay }}
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="networkStore.isOnline ? 'bg-success-muted text-success' : normalizedMode === 'offline_hotspot' ? 'bg-warning-muted text-warning' : 'bg-error-muted text-error'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="networkStore.isOnline ? 'bg-success' : normalizedMode === 'offline_hotspot' ? 'bg-warning' : 'bg-error'"></span>
          {{ networkStore.isOnline ? 'Online' : normalizedMode === 'offline_hotspot' ? 'Air-gapped' : 'No Internet' }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <!-- VPN mode indicator -->
        <div v-if="networkStore.vpnMode" class="flex items-center gap-2">
          <Icon name="Shield" :size="14" class="text-theme-muted" />
          <span class="text-xs text-theme-muted">VPN: {{ networkStore.vpnMode.mode || 'Off' }}</span>
        </div>
        <!-- VPN status (Standard mode quick indicator) -->
        <span
          v-if="vpnStore.isConnected"
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-muted text-success"
        >
          <Icon name="ShieldCheck" :size="12" />
          VPN Active
        </span>
      </div>
    </div>

    <!-- Tabs -->
    <TabBar
      :model-value="activeTab"
      @update:model-value="setTab"
      :tabs="TAB_DEFS"
      aria-label="Network sections"
    />

    <!-- Tab Content -->
    <NetworkOverviewTab
      v-if="activeTab === 'overview'"
      :loading="loading"
      :ap-status="apStatus"
      :interfaces="interfaces"
      :nat-status="natStatus"
      :internet-status="internetStatus"
      :firewall-status="firewallStatus"
      :network-mode="networkMode"
      :ap-hardware-present="apHardwarePresent"
      @refresh="fetchSharedData"
    />

    <WiFiTab
      v-if="activeTab === 'wifi'"
      :ap-status="apStatus"
      :ap-hardware-present="apHardwarePresent"
      @refresh="fetchSharedData"
    />

    <FirewallTab
      v-if="activeTab === 'firewall'"
    />

    <VPNTab
      v-if="activeTab === 'vpn'"
    />

    <DNSTab
      v-if="activeTab === 'dns'"
    />

    <ClientsTab
      v-if="activeTab === 'clients'"
    />

    <TrafficTab
      v-if="activeTab === 'traffic'"
      :interfaces="interfaces"
    />
  </div>
</template>
