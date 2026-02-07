<script setup>
/**
 * MeshtasticTab.vue
 *
 * Sprint 8 Group 3: Meshtastic mesh networking management panel.
 * Displays device status (firmware, battery, channel), mesh node table,
 * message send form, and channel configuration with confirm.
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore — fetchMeshtasticStatus, fetchMeshtasticNodes,
 *        sendMeshtasticMessage, setMeshtasticChannel
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

// Port — for now we support a single Meshtastic device
// The store uses keyed objects, we extract the first port from status
const devicePort = ref(null)

// Message form
const messageText = ref('')
const messageSent = ref(false)
let messageSentTimeout = null

// Channel config form
const channelName = ref('')
const channelPSK = ref('')
const showChannelForm = ref(false)

// ==========================================
// Computed — status
// ==========================================

const status = computed(() => {
  const port = devicePort.value
  if (!port) return null
  const s = communicationStore.meshtasticStatuses[port]
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

// ==========================================
// Computed — node mesh table
// ==========================================

const nodes = computed(() => {
  const port = devicePort.value
  if (!port) return []
  const raw = communicationStore.meshtasticNodes[port]
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
// Format helpers
// ==========================================

function formatLastHeard(value) {
  if (!value) return '—'
  try {
    // Handle Unix timestamps (seconds)
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

// ==========================================
// Actions
// ==========================================

async function handleSendMessage() {
  const port = devicePort.value
  if (!port || !messageText.value.trim()) return

  actionLoading.value = { ...actionLoading.value, send: true }
  messageSent.value = false
  try {
    await communicationStore.sendMeshtasticMessage(port, { text: messageText.value.trim() })
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
  const port = devicePort.value
  if (!port || !channelName.value.trim()) return

  const ok = await confirm({
    title: 'Set Channel',
    message: `Change the Meshtastic channel to "${channelName.value.trim()}"? All nodes must use the same channel and PSK to communicate.`,
    confirmText: 'Set Channel',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, channel: true }
  try {
    const payload = { name: channelName.value.trim() }
    if (channelPSK.value.trim()) {
      payload.psk = channelPSK.value.trim()
    }
    await communicationStore.setMeshtasticChannel(port, payload)
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
  const port = devicePort.value
  if (!port) return

  actionLoading.value = { ...actionLoading.value, nodes: true }
  try {
    await communicationStore.fetchMeshtasticNodes(port, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, nodes: false }
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    // Try to discover device port from stored status keys or fetch with a default
    // The store uses keyed objects; for now we use 'default' as the port
    // In practice, the API may return a device listing in the future
    const port = 'default'
    devicePort.value = port
    const s = signal()
    await Promise.all([
      communicationStore.fetchMeshtasticStatus(port, { signal: s }),
      communicationStore.fetchMeshtasticNodes(port, { signal: s })
    ])
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (messageSentTimeout) clearTimeout(messageSentTimeout)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !status">
      <SkeletonLoader variant="card" :count="3" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Empty state — no Meshtastic device -->
      <!-- ======================================== -->
      <div
        v-if="!status"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="Radio" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Meshtastic Device Detected</p>
        <p class="text-sm text-theme-muted">
          Connect a Meshtastic-compatible LoRa radio (e.g., T-Beam, Heltec) via USB to enable mesh networking.
        </p>
      </div>

      <template v-else>
        <!-- ======================================== -->
        <!-- Status Card -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  isConnected ? 'bg-success-muted' : 'bg-neutral-muted'
                ]"
              >
                <Icon
                  name="Radio"
                  :size="20"
                  :class="isConnected ? 'text-success' : 'text-theme-muted'"
                />
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-lg font-semibold text-theme-primary">Meshtastic</h2>
                  <span
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      isConnected ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
                    ]"
                  >
                    {{ isConnected ? 'Connected' : 'Disconnected' }}
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

            <!-- Channel config toggle -->
            <button
              @click="showChannelForm = !showChannelForm"
              :aria-label="showChannelForm ? 'Hide channel configuration' : 'Show channel configuration'"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors"
            >
              <Icon name="Settings" :size="14" class="inline-block mr-1.5" />
              Channel Config
            </button>
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
              class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
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
        <!-- Send Message Form -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="MessageSquare" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">Send Message</h2>
          </div>

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
              class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
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

          <!-- Success flash -->
          <div
            v-if="messageSent"
            class="mt-3 flex items-center gap-2 text-sm text-success"
          >
            <Icon name="CheckCircle" :size="14" />
            <span>Message sent to mesh network</span>
          </div>

          <p class="text-xs text-theme-muted mt-2">
            {{ messageText.length }}/237 characters — broadcasts to all nodes on the current channel
          </p>
        </div>
      </template>
    </template>
  </div>
</template>
