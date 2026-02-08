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
 *   connected    — radio active, operational panels visible
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore (lifecycle-based, no port keys)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const actionLoading = ref({})

// Message form
const messageText = ref('')
const messageTo = ref('')
const messageChannel = ref('')
const messageSent = ref(false)
let messageSentTimeout = null

// Channel config form
const channelName = ref('')
const channelPSK = ref('')
const channelIndex = ref(0)
const channelRole = ref('PRIMARY')
const showChannelForm = ref(false)

// SSE events log
const sseEvents = ref([])
const MAX_SSE_EVENTS = 50

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
  const channelPsk = s.psk ?? s.channel_psk ?? null
  const nodeId = s.node_id ?? s.id ?? s.my_id ?? null
  const name = s.name ?? s.long_name ?? s.device ?? null

  return { connected, firmware, battery, channel, channelPsk, nodeId, name, _raw: s }
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
// Computed — mesh node table
// ==========================================

const nodes = computed(() => {
  const raw = communicationStore.meshtasticNodes
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.nodes || raw.items || [])
  return list.map(n => ({
    id: n.id ?? n.node_id ?? n.num ?? 'unknown',
    name: n.name ?? n.long_name ?? n.short_name ?? null,
    shortName: n.short_name ?? null,
    snr: n.snr ?? n.signal_strength ?? null,
    lastHeard: n.last_heard ?? n.last_seen ?? n.updated_at ?? null,
    distance: n.distance ?? n.dist ?? null,
    battery: n.battery ?? n.battery_level ?? null,
    hops: n.hops ?? n.hop_count ?? null,
    _raw: n
  }))
})

// ==========================================
// Computed — position
// ==========================================

const position = computed(() => {
  const p = communicationStore.meshtasticPosition
  if (!p) return null
  return {
    latitude: p.latitude ?? p.lat ?? null,
    longitude: p.longitude ?? p.lon ?? p.lng ?? null,
    altitude: p.altitude ?? p.alt ?? null,
    satsInView: p.sats_in_view ?? p.satellites ?? p.sats ?? null,
    fixType: p.fix_type ?? p.fix ?? null,
    time: p.time ?? p.timestamp ?? null
  }
})

// ==========================================
// Computed — message history
// ==========================================

const messageHistory = computed(() => {
  const raw = communicationStore.meshtasticMessages
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.messages || raw.items || [])
  return list.map(m => ({
    id: m.id ?? m.packet_id ?? null,
    from: m.from ?? m.sender ?? m.from_id ?? null,
    to: m.to ?? m.recipient ?? m.to_id ?? null,
    text: m.text ?? m.message ?? m.payload ?? null,
    channel: m.channel ?? null,
    timestamp: m.timestamp ?? m.time ?? m.rx_time ?? null,
    _raw: m
  }))
})

// ==========================================
// Format helpers
// ==========================================

function formatLastHeard(value) {
  if (!value) return '—'
  try {
    const ts = typeof value === 'number' && value < 1e12 ? value * 1000 : value
    const d = new Date(ts)
    if (isNaN(d.getTime())) return String(value)
    const now = Date.now()
    const diff = Math.floor((now - d.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString()
  } catch {
    return String(value)
  }
}

function formatDistance(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (isNaN(num)) return null
  if (num < 1000) return `${Math.round(num)} m`
  return `${(num / 1000).toFixed(1)} km`
}

function formatBattery(value) {
  if (value === null || value === undefined) return null
  return `${Math.round(Number(value))}%`
}

function formatCoord(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toFixed(6)
}

function formatTimestamp(value) {
  if (!value) return '—'
  try {
    const ts = typeof value === 'number' && value < 1e12 ? value * 1000 : value
    const d = new Date(ts)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return String(value)
  }
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
    // On successful connect, start SSE and fetch operational data
    startSSE()
    const s = signal()
    await Promise.all([
      communicationStore.fetchMeshtasticNodes({ signal: s }),
      communicationStore.fetchMeshtasticPosition({ signal: s }),
      communicationStore.fetchMeshtasticMessages({ signal: s }),
      communicationStore.fetchMeshtasticConfig({ signal: s })
    ])
  } catch {
    // Store sets error
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
    await communicationStore.disconnectMeshtastic()
    sseEvents.value = []
    // Re-scan for devices
    await communicationStore.fetchMeshtasticDevices({ signal: signal() })
  } catch {
    // Store sets error
  }
}

// ==========================================
// Actions — SSE
// ==========================================

function startSSE() {
  communicationStore.connectMeshtasticSSE(
    (event) => {
      sseEvents.value = [
        { data: event, time: new Date().toLocaleTimeString() },
        ...sseEvents.value
      ].slice(0, MAX_SSE_EVENTS)

      // Auto-refresh data on relevant events
      const type = event?.type ?? event?.event ?? ''
      if (type === 'message' || type === 'text') {
        communicationStore.fetchMeshtasticMessages()
      } else if (type === 'node' || type === 'nodeinfo') {
        communicationStore.fetchMeshtasticNodes()
      } else if (type === 'position') {
        communicationStore.fetchMeshtasticPosition()
      }
    },
    (err) => {
      console.warn('Meshtastic SSE error:', err)
    }
  )
}

// ==========================================
// Actions — operational
// ==========================================

async function handleSendMessage() {
  if (!messageText.value.trim()) return

  actionLoading.value = { ...actionLoading.value, send: true }
  messageSent.value = false
  try {
    const payload = { text: messageText.value.trim() }
    if (messageTo.value.trim()) payload.to = Number(messageTo.value.trim()) || 0
    if (messageChannel.value !== '') payload.channel = Number(messageChannel.value)
    await communicationStore.sendMeshtasticMessage(payload)
    messageText.value = ''
    messageSent.value = true
    if (messageSentTimeout) clearTimeout(messageSentTimeout)
    messageSentTimeout = setTimeout(() => { messageSent.value = false }, 3000)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, send: false }
  }
}

async function handleSetChannel() {
  if (!channelName.value.trim()) return

  const ok = await confirm({
    title: 'Set Channel',
    message: `Change channel ${channelIndex.value} to "${channelName.value.trim()}" (${channelRole.value})? All nodes must use the same channel and PSK to communicate.`,
    confirmText: 'Set Channel',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, channel: true }
  try {
    const payload = {
      index: Number(channelIndex.value),
      name: channelName.value.trim(),
      role: channelRole.value
    }
    if (channelPSK.value.trim()) {
      payload.psk = channelPSK.value.trim()
    }
    await communicationStore.setMeshtasticChannel(payload)
    channelName.value = ''
    channelPSK.value = ''
    showChannelForm.value = false
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, channel: false }
  }
}

async function handleRefreshNodes() {
  actionLoading.value = { ...actionLoading.value, nodes: true }
  try {
    await communicationStore.fetchMeshtasticNodes({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, nodes: false }
  }
}

async function handleRefreshMessages() {
  actionLoading.value = { ...actionLoading.value, messages: true }
  try {
    await communicationStore.fetchMeshtasticMessages({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, messages: false }
  }
}

async function handleRefreshPosition() {
  actionLoading.value = { ...actionLoading.value, position: true }
  try {
    await communicationStore.fetchMeshtasticPosition({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, position: false }
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    const s = signal()
    // First: discover devices and check if already connected
    await Promise.all([
      communicationStore.fetchMeshtasticDevices({ signal: s }),
      communicationStore.fetchMeshtasticStatus({ signal: s })
    ])

    // If already connected (e.g., page refresh), load operational data + start SSE
    if (isConnected.value) {
      startSSE()
      await Promise.all([
        communicationStore.fetchMeshtasticNodes({ signal: s }),
        communicationStore.fetchMeshtasticPosition({ signal: s }),
        communicationStore.fetchMeshtasticMessages({ signal: s }),
        communicationStore.fetchMeshtasticConfig({ signal: s })
      ])
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (messageSentTimeout) clearTimeout(messageSentTimeout)
  // Close SSE stream on tab switch / component destroy
  communicationStore.closeSSE(communicationStore.meshtasticEventSource)
})
</script>

<template>
  <div class="space-y-6">
    <!-- ======================================== -->
    <!-- Loading skeleton -->
    <!-- ======================================== -->
    <template v-if="lifecycleState === 'loading'">
      <SkeletonLoader variant="card" :count="2" />
    </template>

    <!-- ======================================== -->
    <!-- No Devices Found -->
    <!-- ======================================== -->
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

    <!-- ======================================== -->
    <!-- Devices Found — pick one to connect -->
    <!-- ======================================== -->
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

      <!-- Auto-detect connect -->
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

    <!-- ======================================== -->
    <!-- Connecting -->
    <!-- ======================================== -->
    <template v-else-if="lifecycleState === 'connecting'">
      <div class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center">
        <Icon name="Loader2" :size="40" class="text-accent mx-auto mb-3 animate-spin" />
        <p class="text-theme-secondary font-medium mb-1">Connecting to Meshtastic Radio</p>
        <p class="text-sm text-theme-muted">Establishing connection...</p>
      </div>
    </template>

    <!-- ======================================== -->
    <!-- Connected — operational panels -->
    <!-- ======================================== -->
    <template v-else-if="lifecycleState === 'connected'">

      <!-- ======================================== -->
      <!-- Status Card + Disconnect -->
      <!-- ======================================== -->
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

          <div class="flex items-center gap-2">
            <!-- Channel config toggle -->
            <button
              @click="showChannelForm = !showChannelForm"
              :aria-label="showChannelForm ? 'Hide channel configuration' : 'Show channel configuration'"
              class="px-3 py-2 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors"
            >
              <Icon name="Settings" :size="14" class="inline-block mr-1.5" />
              Config
            </button>
            <!-- Disconnect -->
            <button
              @click="handleDisconnect"
              class="px-3 py-2 text-sm font-medium rounded-lg bg-error-muted text-error hover:bg-error-subtle transition-colors"
            >
              <Icon name="XCircle" :size="14" class="inline-block mr-1.5" />
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Channel Config Form (collapsible) -->
      <!-- ======================================== -->
      <div
        v-if="showChannelForm"
        class="bg-theme-card border border-theme-primary rounded-xl p-5"
      >
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Settings" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Channel Configuration</h2>
        </div>

        <div class="space-y-4 max-w-lg">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="meshtastic-channel-index" class="block text-sm font-medium text-theme-secondary mb-1">Index (0–7)</label>
              <input
                id="meshtastic-channel-index"
                v-model.number="channelIndex"
                type="number"
                min="0"
                max="7"
                class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label for="meshtastic-channel-role" class="block text-sm font-medium text-theme-secondary mb-1">Role</label>
              <select
                id="meshtastic-channel-role"
                v-model="channelRole"
                class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              >
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
          </div>

          <div>
            <label for="meshtastic-channel-name" class="block text-sm font-medium text-theme-secondary mb-1">Channel Name</label>
            <input
              id="meshtastic-channel-name"
              v-model="channelName"
              type="text"
              placeholder="e.g., CubeOS-Mesh"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          <div>
            <label for="meshtastic-channel-psk" class="block text-sm font-medium text-theme-secondary mb-1">PSK (Pre-Shared Key)</label>
            <input
              id="meshtastic-channel-psk"
              v-model="channelPSK"
              type="text"
              placeholder="Leave blank for default"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
            />
            <p class="text-xs text-theme-muted mt-1">All nodes on the same channel must share this key</p>
          </div>

          <div v-if="status.channelPsk" class="text-xs text-theme-muted">
            Current PSK: <span class="font-mono">{{ status.channelPsk }}</span>
          </div>

          <button
            @click="handleSetChannel"
            :disabled="!channelName.trim() || actionLoading.channel"
            aria-label="Set Meshtastic channel"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Icon
              v-if="actionLoading.channel"
              name="Loader2" :size="14"
              class="inline-block animate-spin mr-1.5"
            />
            Set Channel
          </button>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Position Panel -->
      <!-- ======================================== -->
      <div v-if="position" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Icon name="MapPin" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">Position</h2>
          </div>
          <button
            @click="handleRefreshPosition"
            :disabled="actionLoading.position"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            title="Refresh position"
            aria-label="Refresh GPS position"
          >
            <Icon
              name="RefreshCw" :size="14"
              :class="{ 'animate-spin': actionLoading.position }"
            />
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-theme-muted mb-0.5">Latitude</p>
            <p class="text-sm font-mono text-theme-primary">{{ formatCoord(position.latitude) }}</p>
          </div>
          <div>
            <p class="text-xs text-theme-muted mb-0.5">Longitude</p>
            <p class="text-sm font-mono text-theme-primary">{{ formatCoord(position.longitude) }}</p>
          </div>
          <div>
            <p class="text-xs text-theme-muted mb-0.5">Altitude</p>
            <p class="text-sm font-mono text-theme-primary">
              {{ position.altitude !== null ? `${Math.round(position.altitude)} m` : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-theme-muted mb-0.5">Satellites</p>
            <p class="text-sm text-theme-primary">
              {{ position.satsInView ?? '—' }}
              <span v-if="position.fixType" class="text-xs text-theme-muted ml-1">({{ position.fixType }})</span>
            </p>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Mesh Nodes Table -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="Users" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Mesh Nodes</h2>
              <span
                v-if="nodes.length"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
              >
                {{ nodes.length }}
              </span>
            </div>
            <button
              @click="handleRefreshNodes"
              :disabled="actionLoading.nodes"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Refresh nodes"
              aria-label="Refresh mesh nodes"
            >
              <Icon
                name="RefreshCw" :size="14"
                :class="{ 'animate-spin': actionLoading.nodes }"
              />
            </button>
          </div>
        </div>

        <!-- No nodes -->
        <div v-if="!nodes.length" class="p-8 text-center">
          <Icon name="Users" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">No Mesh Nodes Discovered</p>
          <p class="text-xs text-theme-muted mt-1">
            Other Meshtastic devices on the same channel will appear here
          </p>
        </div>

        <!-- Node list -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-theme-primary">
                <th class="text-left px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">Node</th>
                <th class="text-left px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">ID</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">SNR</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider hidden sm:table-cell">Distance</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider hidden sm:table-cell">Battery</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider hidden md:table-cell">Hops</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">Last Heard</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-theme-primary">
              <tr
                v-for="node in nodes"
                :key="node.id"
                class="hover:bg-theme-secondary transition-colors"
              >
                <td class="px-5 py-3">
                  <span class="font-medium text-theme-primary">{{ node.name || node.shortName || '—' }}</span>
                  <span v-if="node.name && node.shortName" class="text-xs text-theme-muted ml-1.5">({{ node.shortName }})</span>
                </td>
                <td class="px-5 py-3 font-mono text-xs text-theme-muted">{{ node.id }}</td>
                <td class="px-5 py-3 text-right">
                  <span
                    v-if="node.snr !== null"
                    :class="[
                      'text-xs font-medium',
                      Number(node.snr) >= 5 ? 'text-success' : Number(node.snr) >= 0 ? 'text-warning' : 'text-error'
                    ]"
                  >
                    {{ Number(node.snr).toFixed(1) }} dB
                  </span>
                  <span v-else class="text-xs text-theme-muted">—</span>
                </td>
                <td class="px-5 py-3 text-right text-theme-muted hidden sm:table-cell">
                  {{ formatDistance(node.distance) || '—' }}
                </td>
                <td class="px-5 py-3 text-right text-theme-muted hidden sm:table-cell">
                  {{ formatBattery(node.battery) || '—' }}
                </td>
                <td class="px-5 py-3 text-right text-theme-muted hidden md:table-cell">
                  {{ node.hops !== null ? node.hops : '—' }}
                </td>
                <td class="px-5 py-3 text-right text-xs text-theme-muted">
                  {{ formatLastHeard(node.lastHeard) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Message History -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="MessageSquare" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Messages</h2>
              <span
                v-if="messageHistory.length"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
              >
                {{ messageHistory.length }}
              </span>
            </div>
            <button
              @click="handleRefreshMessages"
              :disabled="actionLoading.messages"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Refresh messages"
              aria-label="Refresh message history"
            >
              <Icon
                name="RefreshCw" :size="14"
                :class="{ 'animate-spin': actionLoading.messages }"
              />
            </button>
          </div>
        </div>

        <div v-if="!messageHistory.length" class="p-8 text-center">
          <Icon name="MessageSquare" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">No Messages</p>
          <p class="text-xs text-theme-muted mt-1">
            Incoming and outgoing mesh messages will appear here
          </p>
        </div>

        <div v-else class="divide-y divide-theme-primary max-h-64 overflow-y-auto">
          <div
            v-for="(msg, idx) in messageHistory"
            :key="msg.id ?? idx"
            class="px-5 py-3 hover:bg-theme-secondary transition-colors"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-theme-muted">
                  {{ msg.from ?? 'Unknown' }}
                </span>
                <span v-if="msg.to" class="text-xs text-theme-muted">
                  → {{ msg.to === 0 || msg.to === '0' || msg.to === 'broadcast' ? 'Broadcast' : msg.to }}
                </span>
                <span v-if="msg.channel !== null && msg.channel !== undefined" class="text-xs text-theme-muted bg-theme-tertiary px-1.5 py-0.5 rounded">
                  Ch {{ msg.channel }}
                </span>
              </div>
              <span class="text-xs text-theme-muted">{{ formatTimestamp(msg.timestamp) }}</span>
            </div>
            <p class="text-sm text-theme-primary">{{ msg.text || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Send Message Form -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Send" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Send Message</h2>
        </div>

        <div class="space-y-3">
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              v-model="messageText"
              type="text"
              placeholder="Type a message to broadcast..."
              maxlength="237"
              aria-label="Message text"
              @keyup.enter="handleSendMessage"
              class="flex-1 px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <button
              @click="handleSendMessage"
              :disabled="!messageText.trim() || actionLoading.send"
              aria-label="Send message to mesh network"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Icon
                v-if="actionLoading.send"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              <Icon v-else name="Send" :size="14" class="inline-block mr-1.5" />
              Send
            </button>
          </div>

          <!-- Optional destination + channel -->
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1">
              <input
                v-model="messageTo"
                type="text"
                placeholder="Destination node ID (empty = broadcast)"
                aria-label="Destination node ID"
                class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
              />
            </div>
            <div class="w-full sm:w-32">
              <input
                v-model="messageChannel"
                type="number"
                min="0"
                max="7"
                placeholder="Ch (0)"
                aria-label="Channel index"
                class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          <!-- Success flash -->
          <div
            v-if="messageSent"
            class="flex items-center gap-2 text-sm text-success"
          >
            <Icon name="CheckCircle" :size="14" />
            <span>Message sent to mesh network</span>
          </div>

          <p class="text-xs text-theme-muted">
            {{ messageText.length }}/237 characters — broadcasts to all nodes on the current channel
          </p>
        </div>
      </div>

    </template>
  </div>
</template>
