<script setup>
/**
 * NetworkModeSelector.vue — Batch 4 / T19
 *
 * Network mode selector with connection-aware safety warnings.
 * Shows all 5 modes in a 3+2 grid.
 *
 * Batch 4 change: All 4 client modes (ONLINE_ETH, ONLINE_WIFI, SERVER_ETH,
 * SERVER_WIFI) now open NetworkConfigDialog instead of switching directly.
 * Only OFFLINE mode switches immediately (no upstream interface to configure).
 *
 * The old `showWifiConnect` emit is replaced by the integrated dialog.
 */
import { computed, ref, onMounted } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import NetworkConfigDialog from '@/components/network/NetworkConfigDialog.vue'

const emit = defineEmits(['modeChanged'])

const networkStore = useNetworkStore()

// Mode metadata: icons, colors, and connection characteristics
const modeMetadata = {
  [NETWORK_MODES.OFFLINE]:       { icon: 'WifiOff',     color: 'text-warning', bgColor: 'bg-warning-muted', label: 'Offline (AP Only)',       desc: 'Air-gapped access point mode',       hasAP: true,  uplink: null },
  [NETWORK_MODES.ONLINE_ETH]:    { icon: 'Cable',       color: 'text-accent',  bgColor: 'bg-accent-muted',  label: 'Online via Ethernet',     desc: 'AP + NAT via Ethernet uplink',       hasAP: true,  uplink: 'eth0' },
  [NETWORK_MODES.ONLINE_WIFI]:   { icon: 'Wifi',        color: 'text-success', bgColor: 'bg-success-muted', label: 'Online via WiFi',         desc: 'AP + NAT via USB WiFi dongle',       hasAP: true,  uplink: 'wifi' },
  [NETWORK_MODES.ONLINE_TETHER]: { icon: 'Smartphone',  color: 'text-success', bgColor: 'bg-success-muted', label: 'Online via Tethering',    desc: 'AP + NAT via Android USB tethering', hasAP: true,  uplink: 'usb' },
  [NETWORK_MODES.SERVER_ETH]:    { icon: 'Server',      color: 'text-accent',  bgColor: 'bg-accent-muted',  label: 'Server via Ethernet',     desc: 'No AP, direct Ethernet connection',  hasAP: false, uplink: 'eth0' },
  [NETWORK_MODES.SERVER_WIFI]:   { icon: 'Server',      color: 'text-success', bgColor: 'bg-success-muted', label: 'Server via WiFi',         desc: 'No AP, direct WiFi connection',      hasAP: false, uplink: 'wifi' },
}

// Fallback mode IDs if API unavailable
const fallbackModeList = [
  NETWORK_MODES.OFFLINE, NETWORK_MODES.ONLINE_ETH, NETWORK_MODES.ONLINE_WIFI,
  NETWORK_MODES.ONLINE_TETHER, NETWORK_MODES.SERVER_ETH, NETWORK_MODES.SERVER_WIFI
]

const modesLoaded = ref(false)
const selectedMode = ref(null)
const changingMode = ref(false)

// Config dialog state (Batch 4)
const showConfigDialog = ref(false)
const configDialogTarget = ref('')

const currentMode = computed(() => networkStore.currentMode)

// Build display modes from API response or fallback
const displayModes = computed(() => {
  const source = networkStore.modes.length > 0
    ? networkStore.modes.map(m => m.id || m.mode || m)
    : fallbackModeList
  
  return source.map(id => {
    const meta = modeMetadata[id] || { icon: 'Network', color: 'text-theme-secondary', bgColor: 'bg-theme-tertiary', label: id, desc: '', hasAP: false, uplink: null }
    const apiMode = networkStore.modes.find(m => (m.id || m.mode) === id)
    return {
      id,
      name: apiMode?.name || meta.label,
      description: apiMode?.description || meta.desc,
      icon: meta.icon,
      color: meta.color,
      bgColor: meta.bgColor,
      hasAP: meta.hasAP,
      uplink: meta.uplink,
      available: apiMode ? apiMode.available !== false : true
    }
  })
})

// Split into AP modes (top row, 3 cols) and Server modes (bottom row, 2 cols)
const apModes = computed(() => displayModes.value.filter(m => m.hasAP))
const serverModes = computed(() => displayModes.value.filter(m => !m.hasAP))

onMounted(async () => {
  await networkStore.fetchModes()
  modesLoaded.value = true
})

// Infer how the user is connected based on current mode
function getUserConnectionInfo() {
  const cur = currentMode.value
  const curMeta = modeMetadata[cur]
  if (!curMeta) return { via: 'the network', isAP: false }
  
  if (curMeta.hasAP) {
    return { via: 'the CubeOS WiFi access point (wlan0)', isAP: true }
  }
  if (cur === NETWORK_MODES.SERVER_ETH) {
    return { via: 'Ethernet (eth0)', isAP: false }
  }
  if (cur === NETWORK_MODES.SERVER_WIFI) {
    return { via: 'WiFi (wlan0)', isAP: false }
  }
  return { via: 'the network', isAP: false }
}

// Build a context-aware warning for OFFLINE mode switch only
function buildWarningMessage(toMode) {
  const conn = getUserConnectionInfo()
  const fromMeta = modeMetadata[currentMode.value]
  const toMeta = modeMetadata[toMode]
  const lines = []
  
  if (fromMeta?.hasAP && !toMeta?.hasAP) {
    lines.push('This will disable the Access Point. All WiFi clients will be disconnected.')
    if (conn.isAP) {
      lines.push(`You are currently connected via ${conn.via} — you WILL lose access to this dashboard.`)
    }
  } else if (!fromMeta?.hasAP && toMeta?.hasAP) {
    lines.push('This will start the Access Point and reconfigure networking.')
    if (!conn.isAP) {
      lines.push(`Your current connection via ${conn.via} may be interrupted during reconfiguration.`)
      lines.push('Once complete, connect to the CubeOS WiFi network to access the dashboard.')
    }
  } else {
    lines.push('This will reconfigure networking. You may experience a brief interruption.')
  }
  
  return lines.join('\n\n')
}

async function selectMode(mode) {
  if (mode.id === currentMode.value) return
  
  // ── Batch 4: All 4 client modes open the config dialog ──
  if (mode.id !== NETWORK_MODES.OFFLINE) {
    configDialogTarget.value = mode.id
    showConfigDialog.value = true
    return
  }

  // ── OFFLINE: direct switch with warning (no upstream interface) ──
  const message = buildWarningMessage(mode.id)
  
  if (!await confirm({
    title: 'Switch to Offline Mode',
    message,
    confirmText: 'Switch to Offline',
    variant: 'warning'
  })) return
  
  selectedMode.value = mode.id
  changingMode.value = true
  try {
    const success = await networkStore.setMode(mode.id)
    if (success) {
      emit('modeChanged', mode.id)
    }
  } finally {
    changingMode.value = false
    selectedMode.value = null
  }
}

function handleDialogApplied(modeId) {
  showConfigDialog.value = false
  configDialogTarget.value = ''
  emit('modeChanged', modeId)
}

function handleDialogClose() {
  showConfigDialog.value = false
  configDialogTarget.value = ''
}

function isCurrentMode(modeId) {
  return currentMode.value === modeId
}
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-theme-secondary flex items-center gap-2">
      <Icon name="Network" :size="16" />
      Network Mode
    </h3>
    
    <!-- AP Modes (top row: 4 columns) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Network mode">
      <button
        v-for="mode in apModes"
        :key="mode.id"
        @click="selectMode(mode)"
        :disabled="changingMode || !mode.available"
        role="radio"
        :aria-checked="isCurrentMode(mode.id)"
        :aria-label="mode.name + ' — ' + mode.description"
        :class="[
          'relative p-4 rounded-xl border-2 text-left transition-all duration-200',
          isCurrentMode(mode.id)
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : mode.available
              ? 'border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary'
              : 'border-theme-primary opacity-50 cursor-not-allowed',
          { 'opacity-50 cursor-not-allowed': changingMode && selectedMode === mode.id }
        ]"
      >
        <div 
          v-if="changingMode && selectedMode === mode.id"
          class="absolute inset-0 flex items-center justify-center bg-theme-card/80 rounded-xl"
        >
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>
        
        <div class="flex items-start gap-3">
          <div :class="['p-2 rounded-lg', mode.bgColor]">
            <Icon :name="mode.icon" :size="20" :class="mode.color" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-theme-primary">{{ mode.name }}</span>
              <span 
                v-if="isCurrentMode(mode.id)"
                class="px-1.5 py-0.5 text-xs rounded-full bg-accent/20 text-accent"
              >Active</span>
            </div>
            <p class="text-xs text-theme-tertiary mt-1 leading-relaxed">{{ mode.description }}</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Server Modes (bottom row: 2 columns) -->
    <div v-if="serverModes.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="mode in serverModes"
        :key="mode.id"
        @click="selectMode(mode)"
        :disabled="changingMode || !mode.available"
        role="radio"
        :aria-checked="isCurrentMode(mode.id)"
        :aria-label="mode.name + ' — ' + mode.description"
        :class="[
          'relative p-4 rounded-xl border-2 text-left transition-all duration-200',
          isCurrentMode(mode.id)
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : mode.available
              ? 'border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary'
              : 'border-theme-primary opacity-50 cursor-not-allowed',
          { 'opacity-50 cursor-not-allowed': changingMode && selectedMode === mode.id }
        ]"
      >
        <div 
          v-if="changingMode && selectedMode === mode.id"
          class="absolute inset-0 flex items-center justify-center bg-theme-card/80 rounded-xl"
        >
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>
        
        <div class="flex items-start gap-3">
          <div :class="['p-2 rounded-lg', mode.bgColor]">
            <Icon :name="mode.icon" :size="20" :class="mode.color" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-theme-primary">{{ mode.name }}</span>
              <span 
                v-if="isCurrentMode(mode.id)"
                class="px-1.5 py-0.5 text-xs rounded-full bg-accent/20 text-accent"
              >Active</span>
            </div>
            <p class="text-xs text-theme-tertiary mt-1 leading-relaxed">{{ mode.description }}</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Error message -->
    <div 
      v-if="networkStore.error" 
      class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
    >
      <Icon name="AlertCircle" :size="16" />
      {{ networkStore.error }}
    </div>

    <!-- Network Config Dialog (Batch 4) -->
    <NetworkConfigDialog
      :show="showConfigDialog"
      :target-mode="configDialogTarget"
      :current-mode="currentMode"
      @applied="handleDialogApplied"
      @close="handleDialogClose"
    />
  </div>
</template>
