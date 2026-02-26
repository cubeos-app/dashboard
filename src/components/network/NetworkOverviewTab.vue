<script setup>
/**
 * NetworkOverviewTab.vue — S06 Component (Batch 4 updated)
 *
 * Network overview tab. Standard: connectivity status, AP card, internet status,
 * network mode selector, simplified interfaces. Advanced: + NAT toggle, firewall
 * summary card, detailed interface stats, advanced settings panel.
 *
 * Batch 4: Removed WiFiConnector — now integrated inside NetworkModeSelector
 * via NetworkConfigDialog. The @showWifiConnect emit is no longer needed.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNetworkStore } from '@/stores/network'
import { useFirewallStore } from '@/stores/firewall'
import { useClientsStore } from '@/stores/clients'
import { confirm } from '@/utils/confirmDialog'
import { useMode } from '@/composables/useMode'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'
import NetworkModeSelector from '@/components/network/NetworkModeSelector.vue'

const props = defineProps({
  loading: Boolean,
  apStatus: Object,
  interfaces: Array,
  natStatus: Object,
  internetStatus: Object,
  firewallStatus: Object,
  networkMode: Object,
  apHardwarePresent: Boolean
})

const emit = defineEmits(['refresh'])

const networkStore = useNetworkStore()
const firewallStore = useFirewallStore()
const clientsStore = useClientsStore()
const { isAdvanced } = useMode()
const { isActive: wallpaperActive, panelClass } = useWallpaper()
const { t } = useI18n()

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

// NAT status — normalize field name (HAL returns nat_enabled, frontend expected enabled)
const natEnabled = computed(() => {
  if (!props.natStatus) return false
  return props.natStatus.enabled === true || props.natStatus.nat_enabled === true
})

// B20: Internet sharing considers both NAT status and network mode.
// Docker's MASQUERADE rules cause natEnabled to be true even in OFFLINE mode.
// Only show as "sharing" when the mode actually provides upstream connectivity.
const isInternetSharing = computed(() => {
  if (!natEnabled.value) return false
  const mode = (props.networkMode?.mode || '').toLowerCase()
  return mode === 'wifi_router' || mode === 'wifi_bridge' || mode === 'android_tether'
})

// B75 fix: Detect OFFLINE mode — NAT toggle has no meaning without upstream
const isOfflineMode = computed(() => {
  const mode = (props.networkMode?.mode || '').toLowerCase()
  return mode === 'offline_hotspot' || mode === ''
})

// Firewall IP forward — normalize field name (API returns forwarding_enabled, not ip_forward)
const ipForwardEnabled = computed(() => {
  if (!props.firewallStatus) return false
  return props.firewallStatus.ip_forward === true ||
         props.firewallStatus.forwarding_enabled === true ||
         props.firewallStatus.ip_forwarding === true
})

// AP Start/Stop
const apActionLoading = ref(false)

async function handleStartAP() {
  apActionLoading.value = true
  try {
    await networkStore.startAP()
    emit('refresh')
  } catch (e) {
    // handled by store
  } finally {
    apActionLoading.value = false
  }
}

async function handleStopAP() {
  if (!await confirm({
    title: t('network.ap.stopTitle'),
    message: t('network.ap.stopMessage'),
    confirmText: t('network.ap.stopAP'),
    variant: 'warning'
  })) return

  apActionLoading.value = true
  try {
    await networkStore.stopAP()
    emit('refresh')
  } catch (e) {
    // handled by store
  } finally {
    apActionLoading.value = false
  }
}

// NAT toggle (Advanced)
async function toggleNAT() {
  const enabling = !natEnabled.value
  if (!await confirm({
    title: enabling ? t('network.natControl.enableNAT') : t('network.natControl.disableNAT'),
    message: enabling
      ? t('network.natControl.enableMessage')
      : t('network.natControl.disableMessage'),
    confirmText: enabling ? t('common.enable') : t('common.disable'),
    variant: enabling ? 'info' : 'warning'
  })) return

  try {
    if (natEnabled.value) {
      await firewallStore.disableNat()
    } else {
      await firewallStore.enableNat()
    }
    emit('refresh')
  } catch (e) {
    // handled by store
  }
}

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
</script>

<template>
  <div class="space-y-6">
    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2" :class="isAdvanced ? 'lg:grid-cols-4 gap-4' : 'gap-4'">
      <!-- WiFi AP Status -->
      <div class="rounded-xl p-4 border border-theme-primary" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Icon name="Wifi" :size="20" class="text-accent" />
            </div>
            <div>
              <p class="text-sm text-theme-tertiary">{{ $t('network.ap.title') }}</p>
              <p class="font-semibold text-theme-primary">{{ apStatus?.ssid || 'CubeOS' }}</p>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-theme-muted">{{ $t('network.ap.status') }}</span>
          <span :class="apIsActive ? 'text-success' : 'text-error'">
            {{ apIsActive ? $t('network.ap.active') : $t('network.ap.inactive') }}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm mt-1">
          <span class="text-theme-muted">{{ $t('network.ap.clients') }}</span>
          <span class="font-medium text-theme-primary">{{ clientsStore.count || 0 }}</span>
        </div>
        <div class="flex items-center justify-between text-sm mt-1">
          <span class="text-theme-muted">{{ $t('network.ap.channel') }}</span>
          <span class="text-theme-secondary">{{ apStatus?.channel || '-' }}</span>
        </div>
        <!-- AP Start/Stop -->
        <div class="mt-3 flex gap-2">
          <button
            v-if="!apIsActive"
            @click="handleStartAP"
            :disabled="apActionLoading"
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success-muted text-success hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
            :aria-label="$t('network.ap.startAccessPoint')"
          >
            <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Play" :size="14" />
            {{ $t('network.ap.startAP') }}
          </button>
          <button
            v-if="apIsActive"
            @click="handleStopAP"
            :disabled="apActionLoading"
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
            :aria-label="$t('network.ap.stopAccessPoint')"
          >
            <Icon v-if="apActionLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Square" :size="14" />
            {{ $t('network.ap.stopAP') }}
          </button>
        </div>
      </div>

      <!-- Internet Status -->
      <div class="rounded-xl p-4 border border-theme-primary" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
               :class="internetStatus?.connected ? 'bg-success-muted' : 'bg-theme-tertiary'">
            <Icon name="Globe" :size="20" :class="internetStatus?.connected ? 'text-success' : 'text-theme-muted'" />
          </div>
          <div>
            <p class="text-sm text-theme-tertiary">{{ $t('network.internetStatus.title') }}</p>
            <p class="font-semibold" :class="internetStatus?.connected ? 'text-success' : 'text-theme-muted'">
              {{ internetStatus?.connected ? $t('network.connected') : $t('network.offline') }}
            </p>
          </div>
        </div>
        <div v-if="internetStatus?.connected" class="text-sm">
          <div class="flex items-center justify-between">
            <span class="text-theme-muted">{{ $t('network.internetStatus.latency') }}</span>
            <span class="text-theme-secondary">{{ internetStatus?.rtt_ms?.toFixed(1) || '-' }} ms</span>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-theme-muted">{{ $t('network.internetStatus.target') }}</span>
            <span class="text-theme-secondary">{{ internetStatus?.target_name || '-' }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-theme-muted mt-2">
          {{ $t('network.internetStatus.offlineMode') }}
        </div>
      </div>

      <!-- NAT Status (Advanced, hidden in OFFLINE mode — B75 fix) -->
      <div v-if="isAdvanced && !isOfflineMode" class="rounded-xl p-4 border border-theme-primary" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
               :class="isInternetSharing ? 'bg-accent-muted' : 'bg-theme-tertiary'">
            <Icon name="ArrowLeftRight" :size="20" :class="isInternetSharing ? 'text-accent' : 'text-theme-muted'" />
          </div>
          <div>
            <p class="text-sm text-theme-tertiary">{{ $t('network.natControl.title') }}</p>
            <p class="font-semibold" :class="isInternetSharing ? 'text-accent' : 'text-theme-muted'">
              {{ isInternetSharing ? $t('common.enabled') : $t('common.disabled') }}
            </p>
          </div>
        </div>
        <button
          @click="toggleNAT"
          class="w-full mt-2 px-3 py-2 text-sm rounded-lg transition-colors"
          :class="natEnabled
            ? 'bg-accent-muted text-accent hover:opacity-80'
            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-card'"
          :aria-label="natEnabled ? $t('network.natControl.disableSharing') : $t('network.natControl.enableSharing')"
        >
          {{ natEnabled ? $t('network.natControl.disableNAT') : $t('network.natControl.enableNAT') }}
        </button>
      </div>

      <!-- Firewall Summary (Advanced) -->
      <div v-if="isAdvanced" class="rounded-xl p-4 border border-theme-primary" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-warning-muted flex items-center justify-center">
            <Icon name="Shield" :size="20" class="text-warning" />
          </div>
          <div>
            <p class="text-sm text-theme-tertiary">{{ $t('network.firewallSummary.title') }}</p>
            <p class="font-semibold text-theme-primary">
              {{ ipForwardEnabled ? $t('network.firewallSummary.ipFwdOn') : $t('network.firewallSummary.ipFwdOff') }}
            </p>
          </div>
        </div>
        <div class="text-sm">
          <div class="flex items-center justify-between">
            <span class="text-theme-muted">{{ $t('network.firewallSummary.ipForward') }}</span>
            <span :class="ipForwardEnabled ? 'text-success' : 'text-theme-muted'">
              {{ ipForwardEnabled ? $t('common.on') : $t('common.off') }}
            </span>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-theme-muted">{{ $t('network.firewallSummary.rules') }}</span>
            <span class="text-theme-secondary">{{ firewallStatus?.rules_count || firewallStatus?.filter_rules?.length || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Network Mode Selector (Batch 4: now includes NetworkConfigDialog internally) -->
    <div class="rounded-xl border border-theme-primary p-4" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
      <NetworkModeSelector
        @modeChanged="emit('refresh')"
      />
    </div>

    <!-- Interfaces -->
    <div class="rounded-xl border border-theme-primary" :class="wallpaperActive ? panelClass : 'bg-theme-card'">
      <div class="px-4 py-3 border-b border-theme-primary">
        <h3 class="font-semibold text-theme-primary">{{ $t('network.interfaceList.title') }}</h3>
      </div>
      <div class="divide-y divide-[color:var(--border-primary)]">
        <div v-for="iface in interfaces" :key="iface.name" class="px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
              <Icon :name="iface.type === 'wifi' ? 'Wifi' : 'Monitor'" :size="16" class="text-theme-tertiary" />
            </div>
            <div>
              <p class="font-medium text-theme-primary">{{ iface.name }}</p>
              <p class="text-sm" :class="(iface.ipv4_addresses && iface.ipv4_addresses[0]) || iface.ipv4 || iface.ip ? 'text-theme-muted' : 'text-theme-muted/50'">
                {{ (iface.ipv4_addresses && iface.ipv4_addresses[0]) || iface.ipv4 || iface.ip || ((iface.is_up === true || iface.state === 'up' || iface.state === 'UP') ? $t('network.interfaceList.upNoIP') : $t('network.interfaceList.notConnected')) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div v-if="isAdvanced && (iface.rx_bytes || iface.tx_bytes)" class="text-xs text-theme-muted text-right hidden sm:block">
              <span>↓ {{ formatBytes(iface.rx_bytes) }}</span>
              <span class="mx-1">↑ {{ formatBytes(iface.tx_bytes) }}</span>
            </div>
            <span class="px-2 py-1 text-xs rounded-full"
                  :class="(iface.is_up === true || iface.state === 'up' || iface.state === 'UP')
                    ? 'bg-success-muted text-success'
                    : 'bg-theme-tertiary text-theme-muted'">
              {{ iface.state || (iface.is_up === true ? 'up' : iface.is_up === false ? 'down' : 'unknown') }}
            </span>
          </div>
        </div>
        <div v-if="!interfaces?.length" class="px-4 py-8 text-center text-theme-muted">
          {{ $t('network.interfaceList.noInterfaces') }}
        </div>
      </div>
    </div>
  </div>
</template>
