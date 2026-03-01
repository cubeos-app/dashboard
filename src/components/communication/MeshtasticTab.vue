<script setup>
/**
 * MeshtasticTab.vue
 *
 * Meshtastic mesh networking management panel with lifecycle UI.
 * Lifecycle pattern: discover → connect → operate → disconnect.
 *
 * States:
 *   loading      — initial device scan in progress
 *   no-devices   — no Meshtastic radios found
 *   devices      — radios discovered, not yet connected
 *   connecting   — connection in progress
 *   connected    — radio active, sub-tab navigation visible
 *
 * When connected, checks MeshSat coreapp availability. If available,
 * uses MeshSat endpoints for persistent data. Falls back to HAL SSE otherwise.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import TabBar from '@/components/ui/TabBar.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import MeshtasticMessages from './meshtastic/MeshtasticMessages.vue'
import MeshtasticNodes from './meshtastic/MeshtasticNodes.vue'
import MeshtasticMap from './meshtastic/MeshtasticMap.vue'
import MeshtasticTelemetry from './meshtastic/MeshtasticTelemetry.vue'
import MeshtasticConfig from './meshtastic/MeshtasticConfig.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const actionLoading = ref({})
const meshsatAvailable = ref(false)
const meshSubTab = ref('messages')

const MESH_SUB_TABS = [
  { key: 'messages', label: 'Messages', icon: 'MessageSquare' },
  { key: 'nodes', label: 'Nodes', icon: 'Users' },
  { key: 'map', label: 'Map', icon: 'Map' },
  { key: 'telemetry', label: 'Telemetry', icon: 'Activity' },
  { key: 'config', label: 'Config', icon: 'Settings' }
]

// ==========================================
// Computed — lifecycle state
// ==========================================

const devices = computed(() => {
  const raw = communicationStore.meshtasticDevices
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
})

const status = computed(() => {
  const s = communicationStore.meshtasticStatus
  if (!s) return null

  const connected = s.connected ?? s.online ?? s.status === 'connected'
  const firmware = s.firmware ?? s.firmware_version ?? s.version ?? null
  const battery = s.battery ?? s.battery_level ?? s.batt ?? null
  const channel = s.channel ?? s.channel_name ?? null
  const nodeId = s.node_id ?? s.id ?? s.my_id ?? null
  const name = s.name ?? s.long_name ?? s.device ?? null

  return { connected, firmware, battery, channel, nodeId, name, _raw: s }
})

const isConnected = computed(() => status.value?.connected === true)
const isConnecting = computed(() => communicationStore.meshtasticConnecting)

const lifecycleState = computed(() => {
  if (loading.value) return 'loading'
  if (isConnecting.value) return 'connecting'
  if (isConnected.value) return 'connected'
  if (devices.value.length > 0) return 'devices'
  return 'no-devices'
})

// ==========================================
// Format helpers
// ==========================================

function formatBattery(value) {
  if (value === null || value === undefined) return null
  return `${Math.round(Number(value))}%`
}

function deviceLabel(device) {
  if (device.name) return device.name
  if (device.port) return device.port
  if (device.address) return device.address
  return 'Unknown device'
}

function deviceTransport(device) {
  if (device.transport) return device.transport
  if (device.port && device.port.includes('tty')) return 'serial'
  if (device.address && device.address.includes(':')) return 'ble'
  return null
}

// ==========================================
// Actions — lifecycle
// ==========================================

async function handleScanDevices() {
  actionLoading.value = { ...actionLoading.value, scan: true }
  try {
    await communicationStore.fetchMeshtasticDevices({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, scan: false }
  }
}

async function handleConnect(device = null) {
  const payload = {}
  if (device) {
    const transport = deviceTransport(device)
    if (transport === 'serial' && device.port) {
      payload.transport = 'serial'
      payload.port = device.port
    } else if (transport === 'ble' && device.address) {
      payload.transport = 'ble'
      payload.address = device.address
    }
  }

  try {
    await communicationStore.connectMeshtastic(payload)
    await checkMeshsatAndStartSSE()
  } catch {
    // Store sets error
  }
}

async function checkMeshsatAndStartSSE() {
  // Check MeshSat coreapp availability
  try {
    const result = await communicationStore.fetchMeshsatStatus({ signal: signal() })
    meshsatAvailable.value = result !== null
  } catch {
    meshsatAvailable.value = false
  }

  if (meshsatAvailable.value) {
    // Use MeshSat SSE for persistent data
    communicationStore.connectMeshsatSSE(
      (event) => {
        const type = event?.type ?? event?.event ?? ''
        if (type === 'message' || type === 'text') {
          communicationStore.fetchMeshsatMessages()
        } else if (type === 'node' || type === 'nodeinfo') {
          communicationStore.fetchMeshsatNodes()
        } else if (type === 'position') {
          communicationStore.fetchMeshsatPositions()
        } else if (type === 'telemetry') {
          communicationStore.fetchMeshsatTelemetry()
        }
      },
      () => {} // SSE errors handled silently
    )
  } else {
    // Fall back to HAL SSE
    communicationStore.connectMeshtasticSSE(
      (event) => {
        const type = event?.type ?? event?.event ?? ''
        if (type === 'message' || type === 'text') {
          communicationStore.fetchMeshtasticMessages()
        } else if (type === 'node' || type === 'nodeinfo') {
          communicationStore.fetchMeshtasticNodes()
        } else if (type === 'position') {
          communicationStore.fetchMeshtasticPosition()
        }
      },
      () => {}
    )
  }
}

async function handleDisconnect() {
  const ok = await confirm({
    title: 'Disconnect Radio',
    message: 'Disconnect from the Meshtastic radio? You will stop receiving mesh messages and position updates.',
    confirmText: 'Disconnect',
    variant: 'warning'
  })
  if (!ok) return

  try {
    communicationStore.closeMeshsatSSE()
    await communicationStore.disconnectMeshtastic()
    meshsatAvailable.value = false
    await communicationStore.fetchMeshtasticDevices({ signal: signal() })
  } catch {
    // Store sets error
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    const s = signal()
    await Promise.all([
      communicationStore.fetchMeshtasticDevices({ signal: s }),
      communicationStore.fetchMeshtasticStatus({ signal: s })
    ])

    if (isConnected.value) {
      await checkMeshsatAndStartSSE()
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  communicationStore.closeMeshtasticSSE()
  communicationStore.closeMeshsatSSE()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="lifecycleState === 'loading'">
      <SkeletonLoader variant="card" :count="2" />
    </template>

    <!-- No Devices Found -->
    <template v-else-if="lifecycleState === 'no-devices'">
      <div class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
        <Icon name="Radio" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Meshtastic Devices Detected</p>
        <p class="text-sm text-theme-muted mb-4">
          Connect a Meshtastic-compatible LoRa radio (e.g., T-Beam, Heltec) via USB to enable mesh networking.
        </p>
        <button
          @click="handleScanDevices"
          :disabled="actionLoading.scan"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="actionLoading.scan"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          <Icon v-else name="Search" :size="14" class="inline-block mr-1.5" />
          Scan for Devices
        </button>
      </div>
    </template>

    <!-- Devices Found — pick one to connect -->
    <template v-else-if="lifecycleState === 'devices'">
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="Radio" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Available Devices</h2>
              <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent">
                {{ devices.length }}
              </span>
            </div>
            <button
              @click="handleScanDevices"
              :disabled="actionLoading.scan"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Rescan"
              aria-label="Rescan for devices"
            >
              <Icon
                name="RefreshCw" :size="14"
                :class="{ 'animate-spin': actionLoading.scan }"
              />
            </button>
          </div>
        </div>

        <div class="divide-y divide-theme-primary">
          <div
            v-for="(device, idx) in devices"
            :key="device.port || device.address || idx"
            class="px-5 py-4 flex items-center justify-between hover:bg-theme-secondary transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
                <Icon name="Radio" :size="16" class="text-theme-secondary" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-theme-primary truncate">{{ deviceLabel(device) }}</p>
                <p class="text-xs text-theme-muted">
                  <span v-if="deviceTransport(device)" class="capitalize">{{ deviceTransport(device) }}</span>
                  <span v-if="device.description"> · {{ device.description }}</span>
                </p>
              </div>
            </div>
            <button
              @click="handleConnect(device)"
              :disabled="isConnecting"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50 shrink-0 ml-3"
            >
              Connect
            </button>
          </div>
        </div>
      </div>

      <div class="text-center">
        <button
          @click="handleConnect()"
          :disabled="isConnecting"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="isConnecting"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Auto-detect and Connect
        </button>
      </div>
    </template>

    <!-- Connecting -->
    <template v-else-if="lifecycleState === 'connecting'">
      <div class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
        <Icon name="Loader2" :size="40" class="text-accent mx-auto mb-3 animate-spin" />
        <p class="text-theme-secondary font-medium mb-1">Connecting to Meshtastic Radio</p>
        <p class="text-sm text-theme-muted">Establishing connection...</p>
      </div>
    </template>

    <!-- Connected — status card + sub-tab navigation -->
    <template v-else-if="lifecycleState === 'connected'">

      <!-- Status Card + Disconnect -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-success-muted">
              <Icon name="Radio" :size="20" class="text-success" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-lg font-semibold text-theme-primary">Meshtastic</h2>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-muted text-success">
                  Connected
                </span>
                <span
                  v-if="meshsatAvailable"
                  class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
                >
                  MeshSat
                </span>
              </div>
              <div class="flex items-center gap-4 mt-0.5 flex-wrap">
                <span v-if="status.name" class="text-sm text-theme-secondary">
                  {{ status.name }}
                </span>
                <span v-if="status.firmware" class="text-xs text-theme-muted bg-theme-tertiary px-1.5 py-0.5 rounded">
                  v{{ status.firmware }}
                </span>
                <span v-if="status.battery !== null" class="text-sm text-theme-muted">
                  {{ formatBattery(status.battery) }} battery
                </span>
                <span v-if="status.channel" class="text-sm text-theme-muted">
                  Ch: {{ status.channel }}
                </span>
                <span v-if="status.nodeId" class="text-xs font-mono text-theme-muted">
                  {{ status.nodeId }}
                </span>
              </div>
            </div>
          </div>

          <button
            @click="handleDisconnect"
            class="px-3 py-2 text-sm font-medium rounded-lg bg-error-muted text-error hover:bg-error-subtle transition-colors shrink-0"
          >
            <Icon name="XCircle" :size="14" class="inline-block mr-1.5" />
            Disconnect
          </button>
        </div>
      </div>

      <!-- Sub-tab navigation -->
      <TabBar v-model="meshSubTab" :tabs="MESH_SUB_TABS" variant="pill" />

      <!-- Sub-tab content -->
      <MeshtasticMessages
        v-if="meshSubTab === 'messages'"
        :meshsat-available="meshsatAvailable"
      />
      <MeshtasticNodes
        v-if="meshSubTab === 'nodes'"
        :meshsat-available="meshsatAvailable"
      />
      <MeshtasticMap
        v-if="meshSubTab === 'map'"
        :meshsat-available="meshsatAvailable"
      />
      <MeshtasticTelemetry
        v-if="meshSubTab === 'telemetry'"
        :meshsat-available="meshsatAvailable"
      />
      <MeshtasticConfig
        v-if="meshSubTab === 'config'"
        :meshsat-available="meshsatAvailable"
      />

    </template>
  </div>
</template>
