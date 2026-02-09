<script setup>
/**
 * IridiumTab.vue
 *
 * Iridium satellite communication panel with lifecycle UI.
 * Lifecycle pattern: discover → connect → operate → disconnect.
 *
 * States:
 *   loading      — initial device scan in progress
 *   no-devices   — no Iridium modems found
 *   devices      — modems discovered, not yet connected
 *   connecting   — connection in progress
 *   connected    — modem active, operational panels visible
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

// Send form
const sbdMessage = ref('')
const sbdFormat = ref('text')
const messageSent = ref(false)
let messageSentTimeout = null

const SBD_MAX_BYTES = 340

// ==========================================
// Computed — lifecycle state
// ==========================================

const devices = computed(() => {
  const raw = communicationStore.iridiumDevices
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
})

const status = computed(() => {
  const s = communicationStore.iridiumStatus
  if (!s) return null

  const connected = s.connected ?? s.online ?? s.status === 'connected'
  const registered = s.registered ?? s.registration ?? s.network_status ?? null
  const imei = s.imei ?? s.serial ?? null
  const model = s.model ?? s.device ?? s.name ?? null
  const networkAvailable = s.network_available ?? s.network ?? null

  let registrationState = 'unknown'
  if (registered !== null) {
    const val = String(registered).toLowerCase()
    if (val === 'true' || val === 'registered' || val === '1' || val === 'yes') registrationState = 'registered'
    else if (val === 'false' || val === 'not registered' || val === '0' || val === 'no') registrationState = 'not_registered'
    else if (val === 'registering' || val === 'searching') registrationState = 'registering'
    else registrationState = val
  }

  return { connected, registrationState, imei, model, networkAvailable, _raw: s }
})

const isConnected = computed(() => status.value?.connected === true)
const isConnecting = computed(() => communicationStore.iridiumConnecting)

const lifecycleState = computed(() => {
  if (loading.value) return 'loading'
  if (isConnecting.value) return 'connecting'
  if (isConnected.value) return 'connected'
  if (devices.value.length > 0) return 'devices'
  return 'no-devices'
})

const registrationBadge = computed(() => {
  if (!status.value) return { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  const map = {
    registered: { text: 'Registered', bg: 'bg-success-muted', fg: 'text-success' },
    not_registered: { text: 'Not Registered', bg: 'bg-error-muted', fg: 'text-error' },
    registering: { text: 'Registering', bg: 'bg-warning-muted', fg: 'text-warning' },
    unknown: { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  }
  return map[status.value.registrationState] || map.unknown
})

// ==========================================
// Computed — signal bars (0–5)
// ==========================================

const signalData = computed(() => {
  return communicationStore.iridiumSignal ?? null
})

const signalBars = computed(() => {
  const data = signalData.value
  if (!data) return 0
  if (data.bars !== undefined && data.bars !== null) {
    return Math.min(5, Math.max(0, Math.round(Number(data.bars))))
  }
  const raw = data.signal ?? data.signal_strength ?? data.strength ?? null
  if (raw !== null && raw !== undefined) {
    return Math.min(5, Math.max(0, Math.round(Number(raw))))
  }
  return 0
})

function barColor(count) {
  if (count <= 1) return 'bg-error'
  if (count <= 2) return 'bg-warning'
  return 'bg-success'
}

// ==========================================
// Computed — SBD messages
// ==========================================

const messages = computed(() => {
  const raw = communicationStore.iridiumMessages
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.messages || raw.items || [])
  return list.map(m => ({
    id: m.id ?? m.momsn ?? m.mtmsn ?? null,
    direction: m.direction ?? m.type ?? (m.momsn !== undefined ? 'MO' : m.mtmsn !== undefined ? 'MT' : null),
    status: m.status ?? m.state ?? null,
    timestamp: m.timestamp ?? m.time ?? m.created_at ?? null,
    data: m.data ?? m.payload ?? m.message ?? m.text ?? null,
    size: m.size ?? m.length ?? m.bytes ?? null,
    _raw: m
  }))
})

// ==========================================
// Computed — byte counter for send form
// ==========================================

const byteCount = computed(() => {
  return new TextEncoder().encode(sbdMessage.value).length
})

const bytesRemaining = computed(() => SBD_MAX_BYTES - byteCount.value)

const byteCountColor = computed(() => {
  if (bytesRemaining.value < 0) return 'text-error'
  if (bytesRemaining.value < 50) return 'text-warning'
  return 'text-theme-muted'
})

// ==========================================
// Format helpers
// ==========================================

function formatTimestamp(value) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return String(value)
  }
}

function formatDirection(dir) {
  if (!dir) return null
  const d = String(dir).toUpperCase()
  if (d === 'MO' || d === 'MOBILE_ORIGINATED' || d === 'OUTBOUND' || d === 'SENT') return 'MO'
  if (d === 'MT' || d === 'MOBILE_TERMINATED' || d === 'INBOUND' || d === 'RECEIVED') return 'MT'
  return d
}

function truncatePreview(text, maxLen = 60) {
  if (!text) return '—'
  const s = String(text)
  if (s.length <= maxLen) return s
  return s.substring(0, maxLen) + '...'
}

function deviceLabel(device) {
  if (device.name) return device.name
  if (device.port) return device.port
  if (device.path) return device.path
  return 'Unknown modem'
}

// ==========================================
// Actions — lifecycle
// ==========================================

async function handleScanDevices() {
  actionLoading.value = { ...actionLoading.value, scan: true }
  try {
    await communicationStore.fetchIridiumDevices({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, scan: false }
  }
}

async function handleConnect(device = null) {
  const payload = {}
  if (device && device.port) {
    payload.port = device.port
  }

  try {
    await communicationStore.connectIridium(payload)
    // On successful connect, start SSE and fetch operational data
    startSSE()
    const s = signal()
    await Promise.all([
      communicationStore.fetchIridiumSignal({ signal: s }),
      communicationStore.fetchIridiumMessages({ signal: s })
    ])
  } catch {
    // Store sets error
  }
}

async function handleDisconnect() {
  const ok = await confirm({
    title: 'Disconnect Modem',
    message: 'Disconnect from the Iridium satellite modem? You will stop receiving satellite messages.',
    confirmText: 'Disconnect',
    variant: 'warning'
  })
  if (!ok) return

  try {
    await communicationStore.disconnectIridium()
    // Re-scan for devices
    await communicationStore.fetchIridiumDevices({ signal: signal() })
  } catch {
    // Store sets error
  }
}

// ==========================================
// Actions — SSE
// ==========================================

function startSSE() {
  communicationStore.connectIridiumSSE(
    (event) => {
      const type = event?.type ?? event?.event ?? ''
      // Auto-refresh on relevant events
      if (type === 'signal' || type === 'signal_change') {
        communicationStore.fetchIridiumSignal()
      } else if (type === 'message' || type === 'mt' || type === 'sbd') {
        communicationStore.fetchIridiumMessages()
      } else if (type === 'status' || type === 'registration') {
        communicationStore.fetchIridiumStatus()
      }
    },
    (err) => {
      console.warn('Iridium SSE error:', err)
    }
  )
}

// ==========================================
// Actions — operational
// ==========================================

async function handleSendSBD() {
  if (!sbdMessage.value.trim() || byteCount.value > SBD_MAX_BYTES) return

  const ok = await confirm({
    title: 'Send SBD Message',
    message: `Send this ${byteCount.value}-byte message via Iridium satellite? Satellite transmission costs may apply.`,
    confirmText: 'Send',
    variant: 'info'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, send: true }
  messageSent.value = false
  try {
    await communicationStore.sendIridiumSBD({
      text: sbdMessage.value.trim(),
      format: sbdFormat.value
    })
    sbdMessage.value = ''
    messageSent.value = true
    if (messageSentTimeout) clearTimeout(messageSentTimeout)
    messageSentTimeout = setTimeout(() => { messageSent.value = false }, 3000)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, send: false }
  }
}

async function handleCheckMailbox() {
  actionLoading.value = { ...actionLoading.value, mailbox: true }
  try {
    await communicationStore.checkIridiumMailbox({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, mailbox: false }
  }
}

async function handleReceiveMessage() {
  actionLoading.value = { ...actionLoading.value, receive: true }
  try {
    await communicationStore.receiveIridiumMessage({ signal: signal() })
    // Refresh messages after receive
    await communicationStore.fetchIridiumMessages({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, receive: false }
  }
}

async function handleClearBuffers(buffer) {
  const labels = { mo: 'outgoing (MO)', mt: 'incoming (MT)', both: 'all (MO + MT)' }
  const ok = await confirm({
    title: 'Clear Buffers',
    message: `Clear ${labels[buffer] || buffer} message buffers? This cannot be undone.`,
    confirmText: 'Clear',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, clear: true }
  try {
    await communicationStore.clearIridiumBuffers({ buffer })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, clear: false }
  }
}

async function handleRefreshSignal() {
  actionLoading.value = { ...actionLoading.value, signal: true }
  try {
    await communicationStore.fetchIridiumSignal({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, signal: false }
  }
}

async function handleRefreshMessages() {
  actionLoading.value = { ...actionLoading.value, messages: true }
  try {
    await communicationStore.fetchIridiumMessages({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, messages: false }
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    const s = signal()
    // Discover devices and check if already connected
    await Promise.all([
      communicationStore.fetchIridiumDevices({ signal: s }),
      communicationStore.fetchIridiumStatus({ signal: s })
    ])

    // If already connected (page refresh), load operational data + start SSE
    if (isConnected.value) {
      startSSE()
      await Promise.all([
        communicationStore.fetchIridiumSignal({ signal: s }),
        communicationStore.fetchIridiumMessages({ signal: s })
      ])
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (messageSentTimeout) clearTimeout(messageSentTimeout)
  // Close SSE stream on tab switch / component destroy
  communicationStore.closeIridiumSSE()
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
        <Icon name="Satellite" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Iridium Modem Detected</p>
        <p class="text-sm text-theme-muted mb-4">
          Connect an Iridium satellite modem (e.g., RockBLOCK 9603) via USB to enable satellite communication.
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
          Scan for Modems
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
              <Icon name="Satellite" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Available Modems</h2>
              <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent">
                {{ devices.length }}
              </span>
            </div>
            <button
              @click="handleScanDevices"
              :disabled="actionLoading.scan"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Rescan"
              aria-label="Rescan for modems"
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
            :key="device.port || idx"
            class="px-5 py-4 flex items-center justify-between hover:bg-theme-secondary transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
                <Icon name="Satellite" :size="16" class="text-theme-secondary" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-theme-primary truncate">{{ deviceLabel(device) }}</p>
                <p v-if="device.description" class="text-xs text-theme-muted">{{ device.description }}</p>
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
        <p class="text-theme-secondary font-medium mb-1">Connecting to Iridium Modem</p>
        <p class="text-sm text-theme-muted">Establishing satellite connection...</p>
      </div>
    </template>

    <!-- ======================================== -->
    <!-- Connected — operational panels -->
    <!-- ======================================== -->
    <template v-else-if="lifecycleState === 'connected'">

      <!-- ======================================== -->
      <!-- Status Card + Signal + Disconnect -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center',
                status.registrationState === 'registered' ? 'bg-success-muted' : 'bg-neutral-muted'
              ]"
            >
              <Icon
                name="Satellite"
                :size="20"
                :class="status.registrationState === 'registered' ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-lg font-semibold text-theme-primary">Iridium</h2>
                <span
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    registrationBadge.bg,
                    registrationBadge.fg
                  ]"
                >
                  {{ registrationBadge.text }}
                </span>
                <span
                  v-if="status.networkAvailable !== null"
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    status.networkAvailable ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-muted'
                  ]"
                >
                  {{ status.networkAvailable ? 'Network Available' : 'No Network' }}
                </span>
              </div>
              <div class="flex items-center gap-4 mt-0.5 flex-wrap">
                <span v-if="status.model" class="text-sm text-theme-secondary">{{ status.model }}</span>
                <span v-if="status.imei" class="text-xs font-mono text-theme-muted">IMEI: {{ status.imei }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Signal bars -->
            <div class="flex items-center gap-2">
              <div class="flex items-end gap-0.5 h-5">
                <div
                  v-for="bar in 5"
                  :key="bar"
                  :class="[
                    'w-1.5 rounded-sm transition-colors',
                    bar <= signalBars
                      ? barColor(signalBars)
                      : 'bg-theme-tertiary'
                  ]"
                  :style="{ height: `${bar * 4}px` }"
                />
              </div>
              <span class="text-xs text-theme-muted">{{ signalBars }}/5</span>
              <button
                @click="handleRefreshSignal"
                :disabled="actionLoading.signal"
                class="p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
                title="Refresh signal"
                aria-label="Refresh signal strength"
              >
                <Icon
                  name="RefreshCw" :size="12"
                  :class="{ 'animate-spin': actionLoading.signal }"
                />
              </button>
            </div>

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
      <!-- Send SBD Form -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Send" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Send SBD Message</h2>
        </div>

        <div class="space-y-3">
          <textarea
            v-model="sbdMessage"
            rows="3"
            placeholder="Type your Short Burst Data message..."
            aria-label="SBD message text"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none font-mono"
          />

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span :class="['text-xs font-medium', byteCountColor]">
                {{ byteCount }}/{{ SBD_MAX_BYTES }} bytes
              </span>
              <span v-if="bytesRemaining < 0" class="text-xs text-error">
                ({{ Math.abs(bytesRemaining) }} bytes over limit)
              </span>
              <select
                v-model="sbdFormat"
                class="text-xs px-2 py-1 rounded border border-theme-primary bg-theme-secondary text-theme-secondary"
                aria-label="Message format"
              >
                <option value="text">Text</option>
                <option value="binary">Binary</option>
              </select>
            </div>

            <button
              @click="handleSendSBD"
              :disabled="!sbdMessage.trim() || byteCount > SBD_MAX_BYTES || actionLoading.send"
              aria-label="Send SBD message via satellite"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Icon
                v-if="actionLoading.send"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              <Icon v-else name="Send" :size="14" class="inline-block mr-1.5" />
              Send SBD
            </button>
          </div>

          <!-- Success flash -->
          <div
            v-if="messageSent"
            class="flex items-center gap-2 text-sm text-success"
          >
            <Icon name="CheckCircle" :size="14" />
            <span>SBD message queued for satellite transmission</span>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Messages Table -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Icon name="Inbox" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Messages</h2>
              <span
                v-if="messages.length"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
              >
                {{ messages.length }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Receive pending MT -->
              <button
                @click="handleReceiveMessage"
                :disabled="actionLoading.receive"
                aria-label="Receive pending message"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
              >
                <Icon
                  v-if="actionLoading.receive"
                  name="Loader2" :size="12"
                  class="inline-block animate-spin mr-1"
                />
                <Icon v-else name="Download" :size="12" class="inline-block mr-1" />
                Receive
              </button>

              <!-- Check Mailbox -->
              <button
                @click="handleCheckMailbox"
                :disabled="actionLoading.mailbox"
                aria-label="Check Iridium mailbox"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
              >
                <Icon
                  v-if="actionLoading.mailbox"
                  name="Loader2" :size="12"
                  class="inline-block animate-spin mr-1"
                />
                <Icon v-else name="MailCheck" :size="12" class="inline-block mr-1" />
                Check Mailbox
              </button>

              <!-- Refresh messages -->
              <button
                @click="handleRefreshMessages"
                :disabled="actionLoading.messages"
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                title="Refresh messages"
                aria-label="Refresh messages"
              >
                <Icon
                  name="RefreshCw" :size="14"
                  :class="{ 'animate-spin': actionLoading.messages }"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- No messages -->
        <div v-if="!messages.length" class="p-8 text-center">
          <Icon name="Inbox" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">No SBD Messages</p>
          <p class="text-xs text-theme-muted mt-1">
            Click "Check Mailbox" to retrieve incoming messages from the Iridium gateway
          </p>
        </div>

        <!-- Messages list -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-theme-primary">
                <th class="text-left px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">Direction</th>
                <th class="text-left px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">Message</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider hidden sm:table-cell">Size</th>
                <th class="text-left px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th class="text-right px-5 py-3 text-xs font-medium text-theme-muted uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-theme-primary">
              <tr
                v-for="(msg, idx) in messages"
                :key="msg.id ?? idx"
                class="hover:bg-theme-secondary transition-colors"
              >
                <td class="px-5 py-3">
                  <span
                    v-if="formatDirection(msg.direction)"
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      formatDirection(msg.direction) === 'MO'
                        ? 'bg-accent-muted text-accent'
                        : 'bg-success-muted text-success'
                    ]"
                  >
                    {{ formatDirection(msg.direction) === 'MO' ? 'Sent' : 'Received' }}
                  </span>
                  <span v-else class="text-xs text-theme-muted">—</span>
                </td>
                <td class="px-5 py-3 text-theme-primary font-mono text-xs max-w-xs truncate">
                  {{ truncatePreview(msg.data) }}
                </td>
                <td class="px-5 py-3 text-right text-theme-muted hidden sm:table-cell">
                  <span v-if="msg.size !== null">{{ msg.size }} B</span>
                  <span v-else>—</span>
                </td>
                <td class="px-5 py-3 hidden sm:table-cell">
                  <span
                    v-if="msg.status"
                    class="text-xs text-theme-muted"
                  >
                    {{ msg.status }}
                  </span>
                  <span v-else class="text-xs text-theme-muted">—</span>
                </td>
                <td class="px-5 py-3 text-right text-xs text-theme-muted">
                  {{ formatTimestamp(msg.timestamp) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Buffer Management -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="Trash2" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Buffer Management</h2>
        </div>
        <p class="text-sm text-theme-muted mb-4">
          Clear message buffers on the Iridium modem. This removes messages from the modem's internal storage.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            @click="handleClearBuffers('mo')"
            :disabled="actionLoading.clear"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
          >
            <Icon
              v-if="actionLoading.clear"
              name="Loader2" :size="12"
              class="inline-block animate-spin mr-1"
            />
            Clear Outgoing (MO)
          </button>
          <button
            @click="handleClearBuffers('mt')"
            :disabled="actionLoading.clear"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
          >
            Clear Incoming (MT)
          </button>
          <button
            @click="handleClearBuffers('both')"
            :disabled="actionLoading.clear"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:bg-error-subtle transition-colors disabled:opacity-50"
          >
            Clear All Buffers
          </button>
        </div>
      </div>

    </template>
  </div>
</template>
