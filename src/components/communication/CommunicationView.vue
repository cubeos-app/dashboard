<script setup>
/**
 * CommunicationView.vue
 *
 * Sprint 8 Group 2: Main communication management page.
 * Tabbed layout with Bluetooth, Cellular, GPS, Meshtastic, Iridium.
 *
 * Bluetooth + Cellular tabs built here (G2).
 * GPS / Meshtastic / Iridium lazy-loaded from G3.
 *
 * Uses communicationStore (G1) for all communication data.
 * Mirrors HardwareView tab architecture.
 */
import { ref, defineAsyncComponent } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

// Inline tab panels — G2
import BluetoothTab from './BluetoothTab.vue'
import CellularTab from './CellularTab.vue'

// Lazy tab panels — G3 will create these files
const GPSTab = defineAsyncComponent(() => import('./GPSTab.vue'))
const MeshtasticTab = defineAsyncComponent(() => import('./MeshtasticTab.vue'))
const IridiumTab = defineAsyncComponent(() => import('./IridiumTab.vue'))

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

// ==========================================
// Tabs
// ==========================================

const tabs = [
  { id: 'bluetooth', name: 'Bluetooth', icon: 'Bluetooth' },
  { id: 'cellular', name: 'Cellular', icon: 'Signal' },
  { id: 'gps', name: 'GPS', icon: 'MapPin' },
  { id: 'meshtastic', name: 'Meshtastic', icon: 'Radio' },
  { id: 'iridium', name: 'Iridium', icon: 'Satellite' }
]

const activeTab = ref('bluetooth')
const refreshing = ref(false)

// ==========================================
// Data loading
// ==========================================

async function refresh() {
  refreshing.value = true
  try {
    const s = signal()
    if (activeTab.value === 'bluetooth') {
      await Promise.all([
        communicationStore.fetchBluetooth({ signal: s }),
        communicationStore.fetchBluetoothDevices({ signal: s })
      ])
    } else if (activeTab.value === 'cellular') {
      await Promise.all([
        communicationStore.fetchCellularStatus({ signal: s }),
        communicationStore.fetchCellularModems({ signal: s }),
        communicationStore.fetchAndroidTethering({ signal: s })
      ])
    } else if (activeTab.value === 'gps') {
      await communicationStore.fetchGPSDevices({ signal: s })
    } else if (activeTab.value === 'meshtastic') {
      await Promise.all([
        communicationStore.fetchMeshtasticStatus({ signal: s }),
        communicationStore.fetchMeshtasticNodes({ signal: s })
      ])
    } else if (activeTab.value === 'iridium') {
      await Promise.all([
        communicationStore.fetchIridiumStatus({ signal: s }),
        communicationStore.fetchIridiumSignal({ signal: s }),
        communicationStore.fetchIridiumMessages({ signal: s })
      ])
    }
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-theme-primary">
    <!-- Header -->
    <div class="bg-theme-secondary border-b border-theme-primary">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-theme-primary">Communication</h1>
            </div>
            <p class="mt-1 text-sm text-theme-secondary">
              Bluetooth, cellular, GPS, mesh networking, and satellite
            </p>
          </div>

          <!-- Header actions -->
          <div class="flex items-center gap-3">
            <!-- Error indicator -->
            <div
              v-if="communicationStore.error"
              class="hidden sm:flex items-center gap-2 text-sm text-error"
              :title="communicationStore.error"
            >
              <Icon name="AlertCircle" :size="14" />
              <span>Error</span>
            </div>

            <!-- Refresh -->
            <button
              @click="refresh"
              :disabled="refreshing"
              class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Refresh"
              aria-label="Refresh communication data"
            >
              <Icon name="RefreshCw" :size="18" :class="{ 'animate-spin': refreshing }" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="border-b border-theme-primary overflow-x-auto">
        <nav class="-mb-px flex space-x-8" role="tablist" aria-label="Communication channels">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-secondary hover:text-theme-primary hover:border-theme-tertiary',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
            ]"
          >
            <Icon :name="tab.icon" :size="16" />
            <span>{{ tab.name }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab content -->
      <div class="py-6">
        <!-- Store error banner -->
        <div
          v-if="communicationStore.error"
          class="mb-4 bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2"
        >
          <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5 shrink-0" />
          <span class="text-sm text-error">{{ communicationStore.error }}</span>
        </div>

        <!-- ======================================== -->
        <!-- BLUETOOTH TAB (G2) -->
        <!-- ======================================== -->
        <BluetoothTab v-if="activeTab === 'bluetooth'" />

        <!-- ======================================== -->
        <!-- CELLULAR TAB (G2) -->
        <!-- ======================================== -->
        <CellularTab v-else-if="activeTab === 'cellular'" />

        <!-- ======================================== -->
        <!-- GPS TAB (G3) -->
        <!-- ======================================== -->
        <Suspense v-else-if="activeTab === 'gps'">
          <GPSTab />
          <template #fallback>
            <SkeletonLoader variant="card" :count="2" />
          </template>
        </Suspense>

        <!-- ======================================== -->
        <!-- MESHTASTIC TAB (G3) -->
        <!-- ======================================== -->
        <Suspense v-else-if="activeTab === 'meshtastic'">
          <MeshtasticTab />
          <template #fallback>
            <SkeletonLoader variant="card" :count="2" />
          </template>
        </Suspense>

        <!-- ======================================== -->
        <!-- IRIDIUM TAB (G3) -->
        <!-- ======================================== -->
        <Suspense v-else-if="activeTab === 'iridium'">
          <IridiumTab />
          <template #fallback>
            <SkeletonLoader variant="card" :count="2" />
          </template>
        </Suspense>
      </div>
    </div>
  </div>
</template>
