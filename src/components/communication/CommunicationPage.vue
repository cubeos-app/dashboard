<script setup>
/**
 * CommunicationPage.vue — S09 Component
 *
 * Shell that renders GPS + Cellular (both modes) and
 * Meshtastic / Iridium / Bluetooth tabs (Advanced only).
 * Hidden from nav when HAL reports no communication hardware.
 *
 * Pattern: Shell → tab components (following S08 SystemPage pattern)
 *
 * Standard tabs: GPS, Cellular
 * Advanced tabs: GPS, Cellular, Meshtastic, Iridium, Bluetooth
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCommunicationStore } from '@/stores/communication'
import { useHardwareStore } from '@/stores/hardware'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'

import GPSTab from './GPSTab.vue'
import CellularTab from './CellularTab.vue'
import MeshtasticTab from './MeshtasticTab.vue'
import IridiumTab from './IridiumTab.vue'
import BluetoothTab from './BluetoothTab.vue'

const route = useRoute()
const router = useRouter()
const communicationStore = useCommunicationStore()
const hardwareStore = useHardwareStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'gps', label: 'GPS', icon: 'MapPin' },
    { key: 'cellular', label: 'Cellular', icon: 'Signal' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'meshtastic', label: 'Meshtastic', icon: 'Radio' },
      { key: 'iridium', label: 'Iridium', icon: 'Satellite' },
      { key: 'bluetooth', label: 'Bluetooth', icon: 'Bluetooth' }
    )
  }
  return tabs
})

const activeTab = ref('gps')

// Read ?tab= from route for backward-compat
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'gps' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'gps'
  }
})

function setTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Shared Data ─────────────────────────────────────────────
const loading = ref(false)
const error = ref(null)

async function refresh() {
  loading.value = true
  error.value = null
  // Clear hardware-absent cache so absent endpoints are re-checked
  communicationStore.clearUnavailableCache()
  try {
    const s = signal()
    if (activeTab.value === 'gps') {
      await communicationStore.fetchGPSDevices({ signal: s })
    } else if (activeTab.value === 'cellular') {
      await Promise.all([
        communicationStore.fetchCellularStatus({ signal: s }),
        communicationStore.fetchCellularModems({ signal: s }),
        communicationStore.fetchAndroidTethering({ signal: s })
      ])
    } else if (activeTab.value === 'bluetooth') {
      await Promise.all([
        communicationStore.fetchBluetooth({ signal: s }),
        communicationStore.fetchBluetoothDevices({ signal: s })
      ])
    } else if (activeTab.value === 'meshtastic') {
      await Promise.all([
        communicationStore.fetchMeshtasticDevices({ signal: s }),
        communicationStore.fetchMeshtasticStatus({ signal: s }),
        communicationStore.fetchMeshtasticNodes({ signal: s })
      ])
    } else if (activeTab.value === 'iridium') {
      await Promise.all([
        communicationStore.fetchIridiumDevices({ signal: s }),
        communicationStore.fetchIridiumStatus({ signal: s }),
        communicationStore.fetchIridiumSignal({ signal: s }),
        communicationStore.fetchIridiumMessages({ signal: s })
      ])
    }
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
})

// T11: Suppress hardware-absent errors (404/503) from page-level banner
// Individual tabs handle missing hardware with friendly messages
const displayError = computed(() => {
  const e = error.value || communicationStore.error
  if (!e) return null
  // Filter out absent-hardware errors
  if (/\b(404|503)\b/.test(e) || /not found/i.test(e) || /service unavailable/i.test(e)) return null
  return e
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Radio"
      title="Communication"
      subtitle="GPS, cellular, mesh networking, and satellite communication"
    >
      <template #actions>
        <button
          @click="refresh"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          aria-label="Refresh communication data"
        >
          <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
    </PageHeader>

    <!-- Error Alert (suppresses hardware-absent 404/503 errors) -->
    <div v-if="displayError" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ displayError }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary overflow-x-auto scrollbar-hide">
      <nav class="flex gap-1 sm:gap-4 min-w-max" role="tablist" aria-label="Communication channels">
        <button
          v-for="tab in TAB_DEFS"
          :key="tab.key"
          @click="setTab(tab.key)"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.key
            ? 'border-[color:var(--accent-primary)] text-accent'
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          <Icon :name="tab.icon" :size="16" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <GPSTab
      v-if="activeTab === 'gps'"
    />

    <CellularTab
      v-if="activeTab === 'cellular'"
    />

    <MeshtasticTab
      v-if="activeTab === 'meshtastic'"
    />

    <IridiumTab
      v-if="activeTab === 'iridium'"
    />

    <BluetoothTab
      v-if="activeTab === 'bluetooth'"
    />
  </div>
</template>
