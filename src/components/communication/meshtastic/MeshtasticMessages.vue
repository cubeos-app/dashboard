<script setup>
/**
 * MeshtasticMessages.vue
 *
 * Message history sub-tab. When MeshSat is available, fetches persistent
 * message history with pagination. Falls back to HAL live messages otherwise.
 * Includes send message form and message statistics.
 */
import { ref, computed, onMounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  meshsatAvailable: { type: Boolean, default: false }
})

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const loadingMore = ref(false)
const offset = ref(0)
const limit = 50
const hasMore = ref(true)
const allMessages = ref([])

// Message form
const messageText = ref('')
const messageTo = ref('')
const messageChannel = ref('')
const messageSent = ref(false)
const sending = ref(false)
let messageSentTimeout = null

// Filter
const filterNode = ref('')

// Stats
const stats = ref(null)

// ==========================================
// Computed
// ==========================================

const messages = computed(() => {
  if (props.meshsatAvailable) {
    let list = allMessages.value
    if (filterNode.value) {
      const f = filterNode.value.toLowerCase()
      list = list.filter(m =>
        String(m.from ?? '').toLowerCase().includes(f) ||
        String(m.to ?? '').toLowerCase().includes(f)
      )
    }
    return list
  }

  // Fallback: HAL messages
  const raw = communicationStore.meshtasticMessages
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.messages || raw.items || [])
  return list.map(m => ({
    id: m.id ?? m.packet_id ?? null,
    from: m.from ?? m.sender ?? m.from_id ?? null,
    to: m.to ?? m.recipient ?? m.to_id ?? null,
    text: m.text ?? m.decoded_text ?? m.message ?? m.payload ?? null,
    channel: m.channel ?? null,
    portnum: m.portnum ?? null,
    transport: m.transport ?? null,
    snr: m.snr ?? m.rx_snr ?? null,
    timestamp: m.timestamp ?? m.time ?? m.rx_time ?? null
  }))
})

const nodeOptions = computed(() => {
  const nodes = props.meshsatAvailable
    ? communicationStore.meshsatNodes
    : communicationStore.meshtasticNodes
  if (!nodes) return []
  const list = Array.isArray(nodes) ? nodes : (nodes.nodes || nodes.items || [])
  return list.map(n => ({
    id: String(n.id ?? n.node_id ?? n.num ?? ''),
    name: n.name ?? n.long_name ?? n.short_name ?? String(n.id ?? '')
  }))
})

// ==========================================
// Actions
// ==========================================

async function loadMessages() {
  if (!props.meshsatAvailable) {
    await communicationStore.fetchMeshtasticMessages({ signal: signal() })
    return
  }

  const params = { limit, offset: 0 }
  if (filterNode.value) params.node = filterNode.value
  const data = await communicationStore.fetchMeshsatMessages(params, { signal: signal() })
  if (data) {
    const list = Array.isArray(data) ? data : (data.messages || data.items || [])
    allMessages.value = list.map(normalizeMessage)
    offset.value = list.length
    hasMore.value = list.length >= limit
  }
}

async function loadMore() {
  if (!props.meshsatAvailable || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const params = { limit, offset: offset.value }
    if (filterNode.value) params.node = filterNode.value
    const data = await communicationStore.fetchMeshsatMessages(params, { signal: signal() })
    if (data) {
      const list = Array.isArray(data) ? data : (data.messages || data.items || [])
      const normalized = list.map(normalizeMessage)
      allMessages.value = [...allMessages.value, ...normalized]
      offset.value += normalized.length
      hasMore.value = normalized.length >= limit
    }
  } finally {
    loadingMore.value = false
  }
}

function normalizeMessage(m) {
  return {
    id: m.id ?? m.packet_id ?? null,
    from: m.from ?? m.sender ?? m.from_id ?? null,
    to: m.to ?? m.recipient ?? m.to_id ?? null,
    text: m.text ?? m.decoded_text ?? m.message ?? m.payload ?? null,
    channel: m.channel ?? null,
    portnum: m.portnum ?? null,
    transport: m.transport ?? null,
    snr: m.snr ?? m.rx_snr ?? null,
    timestamp: m.timestamp ?? m.time ?? m.rx_time ?? null
  }
}

async function loadStats() {
  if (!props.meshsatAvailable) return
  const data = await communicationStore.fetchMeshsatMessageStats({ signal: signal() })
  if (data) stats.value = data
}

async function handleSendMessage() {
  if (!messageText.value.trim()) return
  sending.value = true
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
    sending.value = false
  }
}

function handleFilterChange() {
  offset.value = 0
  allMessages.value = []
  loadMessages()
}

// ==========================================
// Format helpers
// ==========================================

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

function transportBadgeClass(transport) {
  if (transport === 'mqtt') return 'bg-purple-500/15 text-purple-400'
  if (transport === 'satellite') return 'bg-amber-500/15 text-amber-400'
  return 'bg-teal-500/15 text-teal-400'
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  await Promise.all([loadMessages(), loadStats()])
})
</script>

<template>
  <div class="space-y-4">
    <!-- Stats summary (MeshSat only) -->
    <div
      v-if="stats"
      class="bg-theme-card border border-theme-primary rounded-xl p-4"
    >
      <div class="flex items-center gap-2 mb-3">
        <Icon name="BarChart2" :size="16" class="text-accent" />
        <span class="text-sm font-semibold text-theme-primary">Message Stats</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p class="text-xs text-theme-muted">Total</p>
          <p class="text-lg font-semibold text-theme-primary tabular-nums">{{ stats.total ?? 0 }}</p>
        </div>
        <div v-if="stats.by_transport">
          <p class="text-xs text-theme-muted">By Transport</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="(count, transport) in stats.by_transport"
              :key="transport"
              class="text-xs px-1.5 py-0.5 rounded"
              :class="transportBadgeClass(transport)"
            >
              {{ transport }}: {{ count }}
            </span>
          </div>
        </div>
        <div v-if="stats.by_portnum">
          <p class="text-xs text-theme-muted">By Type</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="(count, portnum) in stats.by_portnum"
              :key="portnum"
              class="text-xs px-1.5 py-0.5 rounded bg-theme-tertiary text-theme-secondary"
            >
              {{ portnum }}: {{ count }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-col sm:flex-row gap-3">
      <select
        v-if="nodeOptions.length"
        v-model="filterNode"
        @change="handleFilterChange"
        class="px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">All Nodes</option>
        <option v-for="n in nodeOptions" :key="n.id" :value="n.id">
          {{ n.name }}
        </option>
      </select>
    </div>

    <!-- Message history -->
    <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
      <div class="px-5 py-4 border-b border-theme-primary">
        <div class="flex items-center gap-2">
          <Icon name="MessageSquare" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Messages</h2>
          <span
            v-if="messages.length"
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
          >
            {{ messages.length }}
          </span>
        </div>
      </div>

      <div v-if="!messages.length" class="p-8 text-center">
        <Icon name="MessageSquare" :size="32" class="text-theme-muted mx-auto mb-2" />
        <p class="text-sm text-theme-secondary">No Messages</p>
        <p class="text-xs text-theme-muted mt-1">
          Incoming and outgoing mesh messages will appear here
        </p>
      </div>

      <div v-else class="divide-y divide-theme-primary max-h-96 overflow-y-auto">
        <div
          v-for="(msg, idx) in messages"
          :key="msg.id ?? idx"
          class="px-5 py-3 hover:bg-theme-secondary transition-colors"
        >
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-medium text-theme-muted">
                {{ msg.from ?? 'Unknown' }}
              </span>
              <span v-if="msg.to" class="text-xs text-theme-muted">
                → {{ msg.to === 0 || msg.to === '0' || msg.to === 'broadcast' ? 'Broadcast' : msg.to }}
              </span>
              <span
                v-if="msg.channel !== null && msg.channel !== undefined"
                class="text-xs text-theme-muted bg-theme-tertiary px-1.5 py-0.5 rounded"
              >
                Ch {{ msg.channel }}
              </span>
              <span
                v-if="msg.transport"
                class="text-xs px-1.5 py-0.5 rounded"
                :class="transportBadgeClass(msg.transport)"
              >
                {{ msg.transport }}
              </span>
              <span
                v-if="msg.snr !== null && msg.snr !== undefined"
                class="text-xs text-theme-muted"
              >
                {{ Number(msg.snr).toFixed(1) }} dB
              </span>
            </div>
            <span class="text-xs text-theme-muted shrink-0 ml-2">{{ formatTimestamp(msg.timestamp) }}</span>
          </div>
          <p class="text-sm text-theme-primary">{{ msg.text || '—' }}</p>
        </div>
      </div>

      <!-- Load More -->
      <div
        v-if="meshsatAvailable && hasMore && messages.length"
        class="px-5 py-3 border-t border-theme-primary text-center"
      >
        <button
          @click="loadMore"
          :disabled="loadingMore"
          class="text-sm text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="loadingMore"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Load More
        </button>
      </div>
    </div>

    <!-- Send Message Form -->
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
            :disabled="!messageText.trim() || sending"
            aria-label="Send message to mesh network"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Icon
              v-if="sending"
              name="Loader2" :size="14"
              class="inline-block animate-spin mr-1.5"
            />
            <Icon v-else name="Send" :size="14" class="inline-block mr-1.5" />
            Send
          </button>
        </div>

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
  </div>
</template>
