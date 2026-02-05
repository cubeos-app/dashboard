<script setup>
/**
 * NetworkModeSelector.vue - Sprint 2 Enhanced
 * 
 * UI for selecting network mode (OFFLINE/ONLINE_ETH/ONLINE_WIFI).
 * Sprint 2: Fetches available modes from GET /network/modes API instead
 * of hardcoded list. Shows only modes supported by current hardware
 * (e.g., no ONLINE_WIFI if no USB WiFi dongle detected).
 * Falls back to hardcoded modes if API is unavailable.
 */
import { computed, ref, onMounted } from 'vue'
import { useNetworkStore, NETWORK_MODES } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['modeChanged', 'showWifiConnect'])

const networkStore = useNetworkStore()

// Hardcoded fallback modes (used if API fetch fails)
const fallbackModes = [
  {
    id: NETWORK_MODES.OFFLINE,
    name: 'Offline',
    description: 'Air-gapped mode. AP only, no internet.',
    icon: 'WifiOff',
    color: 'text-neutral',
    bgColor: 'bg-theme-tertiary',
    available: true
  },
  {
    id: NETWORK_MODES.ONLINE_ETH,
    name: 'Ethernet',
    description: 'Internet via Ethernet. NAT for AP clients.',
    icon: 'Cable',
    color: 'text-accent',
    bgColor: 'bg-accent-muted',
    available: true
  },
  {
    id: NETWORK_MODES.ONLINE_WIFI,
    name: 'WiFi Client',
    description: 'Connect to upstream WiFi via USB dongle.',
    icon: 'Wifi',
    color: 'text-success',
    bgColor: 'bg-success-muted',
    available: true
  }
]

// Mode metadata for icons/colors (API modes won't have these)
const modeMetadata = {
  [NETWORK_MODES.OFFLINE]: { icon: 'WifiOff', color: 'text-neutral', bgColor: 'bg-theme-tertiary' },
  [NETWORK_MODES.ONLINE_ETH]: { icon: 'Cable', color: 'text-accent', bgColor: 'bg-accent-muted' },
  [NETWORK_MODES.ONLINE_WIFI]: { icon: 'Wifi', color: 'text-success', bgColor: 'bg-success-muted' }
}

const modesLoaded = ref(false)

// Compute displayed modes: prefer API modes, fallback to hardcoded
const displayModes = computed(() => {
  if (networkStore.modes.length > 0) {
    return networkStore.modes.map(apiMode => {
      const id = apiMode.id || apiMode.mode || apiMode
      const meta = modeMetadata[id] || { icon: 'Network', color: 'text-theme-secondary', bgColor: 'bg-theme-tertiary' }
      return {
        id,
        name: apiMode.name || apiMode.label || id,
        description: apiMode.description || '',
        icon: meta.icon,
        color: meta.color,
        bgColor: meta.bgColor,
        available: apiMode.available !== false
      }
    })
  }
  return fallbackModes
})

// Only show available modes
const availableModes = computed(() => displayModes.value.filter(m => m.available))

const selectedMode = ref(null)
const changingMode = ref(false)

const currentMode = computed(() => networkStore.currentMode)

onMounted(async () => {
  await networkStore.fetchModes()
  modesLoaded.value = true
})

async function selectMode(mode) {
  if (mode.id === currentMode.value) return
  
  selectedMode.value = mode.id
  
  // For WiFi client mode, show the WiFi connector
  if (mode.id === NETWORK_MODES.ONLINE_WIFI) {
    emit('showWifiConnect')
    selectedMode.value = null
    return
  }
  
  // For other modes, apply directly
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
    
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button
        v-for="mode in availableModes"
        :key="mode.id"
        @click="selectMode(mode)"
        :disabled="changingMode || !mode.available"
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
        <!-- Loading indicator -->
        <div 
          v-if="changingMode && selectedMode === mode.id"
          class="absolute inset-0 flex items-center justify-center bg-theme-card/80 rounded-xl"
        >
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>
        
        <!-- Mode content -->
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
              >
                Active
              </span>
            </div>
            <p class="text-xs text-theme-tertiary mt-1 leading-relaxed">
              {{ mode.description }}
            </p>
          </div>
        </div>
      </button>
    </div>
    
    <!-- Unavailable modes hint -->
    <div 
      v-if="displayModes.some(m => !m.available)"
      class="flex items-center gap-2 text-xs text-theme-muted"
    >
      <Icon name="Info" :size="14" />
      <span>Some modes are unavailable due to missing hardware (e.g., no USB WiFi dongle detected)</span>
    </div>

    <!-- Error message -->
    <div 
      v-if="networkStore.error" 
      class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
    >
      <Icon name="AlertCircle" :size="16" />
      {{ networkStore.error }}
    </div>
  </div>
</template>
