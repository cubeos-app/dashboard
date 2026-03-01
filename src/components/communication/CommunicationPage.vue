<script setup>
/**
 * CommunicationPage.vue — S09 Component
 *
 * Shell that renders Bluetooth + Cellular (both modes) and
 * GPS / Meshtastic / Iridium tabs (Advanced only).
 * Hidden from nav when HAL reports no communication hardware.
 *
 * Pattern: Shell → tab components (following S08 SystemPage pattern)
 *
 * Standard tabs: Bluetooth, Cellular
 * Advanced tabs: Bluetooth, Cellular, GPS, Meshtastic, Iridium
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCommunicationStore } from '@/stores/communication'
import { useHardwareStore } from '@/stores/hardware'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import TabBar from '@/components/ui/TabBar.vue'

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
    { key: 'bluetooth', label: 'Bluetooth', icon: 'Bluetooth' },
    { key: 'cellular', label: 'Cellular', icon: 'Signal' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'gps', label: 'GPS', icon: 'MapPin' },
      { key: 'meshtastic', label: 'Meshtastic', icon: 'Radio' },
      { key: 'iridium', label: 'Iridium', icon: 'Satellite' }
    )
  }
  return tabs
})

const activeTab = ref('bluetooth')

// Read ?tab= from route for backward-compat
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'bluetooth' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'bluetooth'
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

// T11: Suppress hardware-absent and transient connection errors from page-level banner
// Individual tabs handle missing hardware with friendly messages
const displayError = computed(() => {
  const e = error.value || communicationStore.error
  if (!e) return null
  // Filter out absent-hardware errors (404/503)
  if (/\b(404|503)\b/.test(e) || /not found/i.test(e) || /service unavailable/i.test(e)) return null
  // B105: Filter out SSE stream / transient connection errors
  if (/input stream/i.test(e) || /SSE/i.test(e) || /NS_BINDING/i.test(e)) return null
  if (/^HTTP error$/i.test(e) || /failed to fetch/i.test(e) || /network/i.test(e)) return null
  return e
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Radio"
      title="Communication"
      subtitle="Bluetooth, cellular, mesh networking, and satellite communication"
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
    <TabBar
      :model-value="activeTab"
      @update:model-value="setTab"
      :tabs="TAB_DEFS"
      aria-label="Communication channels"
    />

    <!-- Tab Content -->
    <BluetoothTab
      v-if="activeTab === 'bluetooth'"
    />

    <CellularTab
      v-if="activeTab === 'cellular'"
    />

    <GPSTab
      v-if="activeTab === 'gps'"
    />

    <MeshtasticTab
      v-if="activeTab === 'meshtastic'"
    />

    <IridiumTab
      v-if="activeTab === 'iridium'"
    />
  </div>
</template>
