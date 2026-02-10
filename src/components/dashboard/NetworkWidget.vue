<script setup>
/**
 * NetworkWidget.vue — S13 Network Mini-Widget
 *
 * Compact network status card for Standard dashboard.
 * Shows: AP SSID, connected clients, network mode, internet status.
 * Clicking navigates to /network.
 *
 * Pairs with SystemVitals in a side-by-side layout.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import { useSystemStore } from '@/stores/system'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const networkStore = useNetworkStore()
const systemStore = useSystemStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Computed data ──────────────────────────────────────────────
const apSSID = computed(() => networkStore.apSSID)
const apClients = computed(() => networkStore.apClients)
const wifiClients = computed(() => systemStore.wifiClients ?? apClients.value)
const isOnline = computed(() => networkStore.isOnline)
const currentMode = computed(() => networkStore.currentMode)

const modeLabel = computed(() => {
  const labels = {
    [NETWORK_MODES.OFFLINE]: 'Offline',
    [NETWORK_MODES.ONLINE_ETH]: 'Ethernet',
    [NETWORK_MODES.ONLINE_WIFI]: 'WiFi Client'
  }
  return labels[currentMode.value] || 'Unknown'
})

const modeIcon = computed(() => {
  const icons = {
    [NETWORK_MODES.OFFLINE]: 'WifiOff',
    [NETWORK_MODES.ONLINE_ETH]: 'Cable',
    [NETWORK_MODES.ONLINE_WIFI]: 'Wifi'
  }
  return icons[currentMode.value] || 'Globe'
})

const internetLabel = computed(() => isOnline.value ? 'Connected' : 'No Internet')
const internetColor = computed(() => isOnline.value ? 'text-emerald-400' : 'text-theme-muted')
const internetDot = computed(() => isOnline.value ? 'bg-success' : 'bg-neutral')

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer h-full"
    @click="router.push('/network')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
          <Icon name="Wifi" :size="14" class="text-indigo-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Network</span>
      </div>

      <!-- Internet status badge -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
        :class="isOnline
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-theme-tertiary border-theme-primary'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="internetDot" />
        <span class="text-[11px] font-medium" :class="internetColor">
          {{ internetLabel }}
        </span>
      </div>
    </div>

    <!-- Network info rows -->
    <div class="space-y-3">
      <!-- AP SSID -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Icon name="Radio" :size="12" class="text-theme-muted" />
          <span class="text-xs text-theme-secondary">Access Point</span>
        </div>
        <span class="text-xs font-semibold text-theme-primary">{{ apSSID }}</span>
      </div>

      <!-- Connected clients -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Icon name="Smartphone" :size="12" class="text-theme-muted" />
          <span class="text-xs text-theme-secondary">Clients</span>
        </div>
        <span class="text-xs font-semibold text-theme-primary tabular-nums">
          {{ wifiClients }} connected
        </span>
      </div>

      <!-- Network mode -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Icon :name="modeIcon" :size="12" class="text-theme-muted" />
          <span class="text-xs text-theme-secondary">Mode</span>
        </div>
        <span class="text-xs font-semibold text-theme-primary">{{ modeLabel }}</span>
      </div>
    </div>
  </button>
</template>
