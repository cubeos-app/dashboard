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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'
import SignalSparkline from '@/components/ui/SignalSparkline.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const actionLoading = ref({})

// Send form
const sbdMessage = ref('')
const sbdFormat = ref('text')
const messageSent = ref(false)
let messageSentTimeout = null

// In-component error display
const localError = ref(null)
let errorTimeout = null

// Signal auto-refresh
let signalPollInterval = null
const SIGNAL_POLL_MS = 10000   // 10s — uses fast cached AT+CSQF endpoint
const signalRefreshing = ref(false) // true while blocking AT+CSQ is in progress

// SBD limits — AT+SBDWT allows max 120 chars, AT+SBDWB allows max 340 bytes
const SBD_TEXT_MAX_CHARS = 120
const SBD_BINARY_MAX_BYTES = 340

// ==========================================
// Signal history
// ==========================================
const signalHistoryRange = ref('24h')
const signalHistoryLoading = ref(false)

const HISTORY_RANGES = [
  { label: '24h', seconds: 86400 },
  { label: '7d',  seconds: 7 * 86400 },
  { label: '30d', seconds: 30 * 86400 },
  { label: '3m',  seconds: 90 * 86400 }
]

function historyInterval(label) {
  if (label === '24h') return 'raw'
  if (label === '7d')  return 'hour'
  return 'day'
}

// ==========================================
// Credits
// ==========================================
const creditsLoading = ref(false)
const showBudgetForm = ref(false)
const budgetInput = ref('')
const warnInput = ref('')
const budgetSaving = ref(false)

// ==========================================
// MT inbox read/unread tracking + filter
// ==========================================
const readMessageIds = ref(new Set())
const messageFilter = ref('all') // 'all' | 'inbox' | 'sent'

// ==========================================
// Offline queue (3d)
// ==========================================
const queueLoading = ref(false)
const showQueueCompose = ref(false)
const queueMessage = ref('')
const queuePriority = ref(1) // 0=critical,1=normal,2=low
const PRIORITY_LABELS = ['Critical', 'Normal', 'Low']
const PRIORITY_COLORS = ['text-error', 'text-theme-primary', 'text-theme-muted']

// ==========================================
// Pass predictor (Priority 4)
// ==========================================
const passesLoading = ref(false)
const selectedLocationId = ref(null)
const passHours = ref(24)
const smartPolling = ref(false)
const showAddLocation = ref(false)
const newLocName = ref('')
const newLocLat = ref('')
const newLocLon = ref('')
const locSaving = ref(false)

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

const signalDescription = computed(() => {
  const data = signalData.value
  return data?.description || null
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
// Computed — byte/char counter for send form
// ==========================================

const currentLimit = computed(() => {
  return sbdFormat.value === 'text' ? SBD_TEXT_MAX_CHARS : SBD_BINARY_MAX_BYTES
})

const currentCount = computed(() => {
  if (sbdFormat.value === 'text') {
    return sbdMessage.value.length
  }
  return new TextEncoder().encode(sbdMessage.value).length
})

const countRemaining = computed(() => currentLimit.value - currentCount.value)

const countLabel = computed(() => {
  return sbdFormat.value === 'text' ? 'chars' : 'bytes'
})

const countColor = computed(() => {
  if (countRemaining.value < 0) return 'text-error'
  if (countRemaining.value < 20) return 'text-warning'
  return 'text-theme-muted'
})

const canSend = computed(() => {
  if (!sbdMessage.value.trim()) return false
  if (currentCount.value > currentLimit.value) return false
  if (signalBars.value === 0) return false
  if (actionLoading.value.send) return false
  return true
})

// ==========================================
// Signal history computeds
// ==========================================

const signalHistoryPoints = computed(() => {
  const h = communicationStore.iridiumSignalHistory
  if (!h) return []
  const list = Array.isArray(h) ? h : (h.points || h.data || [])
  return list
    .filter(p => p && p.timestamp != null && p.value != null)
    .map(p => ({ timestamp: Number(p.timestamp), value: Number(p.value) }))
})

const signalHistoryEmpty = computed(() => {
  return !signalHistoryLoading.value && signalHistoryPoints.value.length < 2
})

// ==========================================
// Credits computeds
// ==========================================

const credits = computed(() => communicationStore.iridiumCredits)

const creditsBudgetPct = computed(() => {
  const c = credits.value
  if (!c || !c.budget) return 0
  return Math.min(100, Math.round((c.this_month / c.budget) * 100))
})

const creditsBudgetColor = computed(() => {
  const pct = creditsBudgetPct.value
  const c = credits.value
  const warn = c?.warning_threshold || 80
  if (pct >= 100) return 'bg-error'
  if (pct >= warn) return 'bg-warning'
  return 'bg-success'
})

// ==========================================
// Inbox filter + read/unread computeds
// ==========================================

const filteredMessages = computed(() => {
  const all = messages.value
  if (messageFilter.value === 'inbox') return all.filter(m => formatDirection(m.direction) === 'MT')
  if (messageFilter.value === 'sent') return all.filter(m => formatDirection(m.direction) === 'MO')
  return all
})

const unreadCount = computed(() => {
  return messages.value
    .filter(m => formatDirection(m.direction) === 'MT' && !readMessageIds.value.has(m.id))
    .length
})

// ==========================================
// Diagnostics — derived from fetched data
// ==========================================

const lastOutboundMsg = computed(() => {
  const sent = messages.value.filter(m => formatDirection(m.direction) === 'MO')
  return sent.length ? sent[sent.length - 1] : null
})

const lastSuccessfulSend = computed(() => {
  // MO messages with status 0 (success) or no status (unknown = treat as sent)
  const sent = messages.value.filter(m => {
    if (formatDirection(m.direction) !== 'MO') return false
    return m.status == null || String(m.status) === '0' || String(m.status).toLowerCase() === 'sent'
  })
  return sent.length ? sent[sent.length - 1] : null
})

// ==========================================
// Computed — queue
// ==========================================

const queue = computed(() => {
  const q = communicationStore.iridiumQueue
  if (!q) return []
  return Array.isArray(q) ? q : (q.queue || [])
})

// ==========================================
// Computed — pass predictor
// ==========================================

const locations = computed(() => {
  const l = communicationStore.iridiumLocations
  if (!l) return []
  return Array.isArray(l) ? l : (l.locations || [])
})

const selectedLocation = computed(() => {
  if (selectedLocationId.value == null) return null
  return locations.value.find(l => l.id === selectedLocationId.value) || null
})

const passes = computed(() => {
  const p = communicationStore.iridiumPasses
  if (!p) return []
  return Array.isArray(p) ? p : (p.passes || [])
})

const nextPass = computed(() => {
  const now = Date.now()
  return passes.value.find(p => new Date(p.los).getTime() > now) || null
})

// inPassWindow: true when a pass is currently active (for smart polling gate)
const inPassWindow = computed(() => {
  return passes.value.some(p => p.is_active)
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
// Error helpers
// ==========================================

function showError(msg) {
  localError.value = msg
  if (errorTimeout) clearTimeout(errorTimeout)
  errorTimeout = setTimeout(() => { localError.value = null }, 8000)
}

function clearError() {
  localError.value = null
  if (errorTimeout) clearTimeout(errorTimeout)
}

// ==========================================
// Actions — lifecycle
// ==========================================

async function handleScanDevices() {
  actionLoading.value = { ...actionLoading.value, scan: true }
  clearError()
  try {
    await communicationStore.fetchIridiumDevices({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Failed to scan for devices')
  } finally {
    actionLoading.value = { ...actionLoading.value, scan: false }
  }
}

async function handleConnect(device = null) {
  const payload = {}
  if (device && device.port) {
    payload.port = device.port
  }

  clearError()
  try {
    await communicationStore.connectIridium(payload)
    // On successful connect, start SSE, polling, and fetch operational data
    startSSE()
    startSignalPolling()
    const s = signal()
    await Promise.all([
      communicationStore.fetchIridiumSignal({ signal: s }),
      communicationStore.fetchIridiumMessages({ signal: s })
    ])
    // Load dashboard extras
    await Promise.all([loadSignalHistory(), loadCredits(), loadQueue()])
    loadLocations().then(loadPasses)
  } catch (e) {
    showError(e?.message || 'Failed to connect to modem')
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

  clearError()
  stopSignalPolling()
  try {
    await communicationStore.disconnectIridium()
    // Re-scan for devices
    await communicationStore.fetchIridiumDevices({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Failed to disconnect')
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
      } else if (type === 'ring_alert') {
        communicationStore.fetchIridiumMessages()
      }
    },
    (err) => {
      console.warn('Iridium SSE error:', err)
    }
  )
}

// ==========================================
// Actions — signal polling
// ==========================================

function startSignalPolling() {
  stopSignalPolling()
  signalPollInterval = setInterval(async () => {
    if (!isConnected.value) {
      stopSignalPolling()
      return
    }
    if (signalRefreshing.value) return // skip tick while blocking refresh is running
    // Smart polling gate: skip when outside a pass window
    if (smartPolling.value && !inPassWindow.value) return
    try {
      await communicationStore.fetchIridiumSignal()
    } catch {
      // Silent — don't show error for background polling
    }
  }, SIGNAL_POLL_MS)
}

// Manual full refresh — blocking AT+CSQ (up to 60s), triggered by Refresh button
async function refreshSignalFull() {
  if (signalRefreshing.value) return
  signalRefreshing.value = true
  try {
    await communicationStore.fetchIridiumSignalFull()
  } catch {
    // Silent
  } finally {
    signalRefreshing.value = false
  }
}

function stopSignalPolling() {
  if (signalPollInterval) {
    clearInterval(signalPollInterval)
    signalPollInterval = null
  }
}

// ==========================================
// Actions — operational
// ==========================================

async function handleSendSBD() {
  if (!canSend.value) return

  const limitLabel = sbdFormat.value === 'text'
    ? `${currentCount.value}-character`
    : `${currentCount.value}-byte`

  const ok = await confirm({
    title: 'Send SBD Message',
    message: `Send this ${limitLabel} message via Iridium satellite? This will use satellite credits and may take up to 60 seconds.`,
    confirmText: 'Send',
    variant: 'info'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, send: true }
  messageSent.value = false
  clearError()
  try {
    await communicationStore.sendIridiumSBD({
      text: sbdMessage.value.trim(),
      format: sbdFormat.value
    })
    sbdMessage.value = ''
    messageSent.value = true
    if (messageSentTimeout) clearTimeout(messageSentTimeout)
    messageSentTimeout = setTimeout(() => { messageSent.value = false }, 5000)
    // Refresh credit count after send
    loadCredits()
  } catch (e) {
    showError(e?.message || 'Failed to send SBD message')
  } finally {
    actionLoading.value = { ...actionLoading.value, send: false }
  }
}

async function handleCheckMailbox() {
  actionLoading.value = { ...actionLoading.value, mailbox: true }
  clearError()
  try {
    await communicationStore.checkIridiumMailbox({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Mailbox check failed')
  } finally {
    actionLoading.value = { ...actionLoading.value, mailbox: false }
  }
}

async function handleReceiveMessage() {
  actionLoading.value = { ...actionLoading.value, receive: true }
  clearError()
  try {
    await communicationStore.receiveIridiumMessage({ signal: signal() })
    // Refresh messages after receive
    await communicationStore.fetchIridiumMessages({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Failed to receive message')
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
  clearError()
  try {
    await communicationStore.clearIridiumBuffers({ buffer })
  } catch (e) {
    showError(e?.message || 'Failed to clear buffers')
  } finally {
    actionLoading.value = { ...actionLoading.value, clear: false }
  }
}

async function handleRefreshSignal() {
  actionLoading.value = { ...actionLoading.value, signal: true }
  clearError()
  try {
    await communicationStore.fetchIridiumSignal({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Failed to refresh signal')
  } finally {
    actionLoading.value = { ...actionLoading.value, signal: false }
  }
}

async function handleRefreshMessages() {
  actionLoading.value = { ...actionLoading.value, messages: true }
  clearError()
  try {
    await communicationStore.fetchIridiumMessages({ signal: signal() })
  } catch (e) {
    showError(e?.message || 'Failed to refresh messages')
  } finally {
    actionLoading.value = { ...actionLoading.value, messages: false }
  }
}

// ==========================================
// Actions — signal history
// ==========================================

async function loadSignalHistory() {
  if (!isConnected.value) return
  signalHistoryLoading.value = true
  try {
    const now = Math.floor(Date.now() / 1000)
    const rangeInfo = HISTORY_RANGES.find(r => r.label === signalHistoryRange.value) || HISTORY_RANGES[0]
    const from = now - rangeInfo.seconds
    const interval = historyInterval(signalHistoryRange.value)
    await communicationStore.fetchIridiumSignalHistory({ from, to: now, interval })
  } catch {
    // Silent
  } finally {
    signalHistoryLoading.value = false
  }
}

// ==========================================
// Actions — credits
// ==========================================

async function loadCredits() {
  if (!isConnected.value) return
  creditsLoading.value = true
  try {
    await communicationStore.fetchIridiumCredits()
    const c = communicationStore.iridiumCredits
    if (c) {
      budgetInput.value = c.budget > 0 ? String(c.budget) : ''
      warnInput.value = c.warning_threshold > 0 ? String(c.warning_threshold) : ''
    }
  } catch {
    // Silent
  } finally {
    creditsLoading.value = false
  }
}

async function handleSetBudget() {
  const budget = parseInt(budgetInput.value) || 0
  const warn = parseInt(warnInput.value) || 0
  budgetSaving.value = true
  try {
    await communicationStore.setIridiumBudget(budget, warn)
    showBudgetForm.value = false
  } catch (e) {
    showError(e?.message || 'Failed to save budget')
  } finally {
    budgetSaving.value = false
  }
}

// ==========================================
// Actions — read/unread tracking
// ==========================================

function markRead(msg) {
  if (msg.id == null) return
  readMessageIds.value = new Set([...readMessageIds.value, msg.id])
}

function markAllRead() {
  const allIds = messages.value
    .filter(m => formatDirection(m.direction) === 'MT' && m.id != null)
    .map(m => m.id)
  readMessageIds.value = new Set([...readMessageIds.value, ...allIds])
}

// ==========================================
// Actions — offline queue (3d)
// ==========================================

async function loadQueue() {
  if (!isConnected.value) return
  queueLoading.value = true
  try {
    await communicationStore.fetchIridiumQueue({ silent: true })
  } catch {
    // Silent
  } finally {
    queueLoading.value = false
  }
}

async function handleQueueMessage() {
  if (!queueMessage.value.trim()) return
  try {
    await communicationStore.enqueueIridiumMessage(queueMessage.value.trim(), queuePriority.value)
    queueMessage.value = ''
    showQueueCompose.value = false
    await loadQueue()
  } catch (e) {
    showError(e?.message || 'Failed to queue message')
  }
}

async function handleCancelQueueItem(id) {
  try {
    await communicationStore.cancelQueueItem(id)
  } catch (e) {
    showError(e?.message || 'Failed to cancel')
  }
}

async function handleSetQueuePriority(id, priority) {
  try {
    await communicationStore.setQueueItemPriority(id, priority)
  } catch (e) {
    showError(e?.message || 'Failed to update priority')
  }
}

// "Send position + status" one-tap quick button
// Composes a compact payload using GPS position if available, falls back to zeros
async function handleSendPosition() {
  let lat = 0, lon = 0
  try {
    const pos = await communicationStore.fetchGPSPosition({ silent: true })
    if (pos?.latitude != null) { lat = pos.latitude; lon = pos.longitude }
  } catch { /* GPS unavailable */ }

  const bat = status.value?._raw?.battery_level ?? 0
  const ts = Math.floor(Date.now() / 1000)
  const payload = `POS:${lat.toFixed(4)},${lon.toFixed(4)},B${bat},T${ts}`
  const ok = await confirm({
    title: 'Send Position + Status',
    message: `Queue the following message for satellite send?\n\n${payload}`,
    confirmText: 'Queue',
    variant: 'info'
  })
  if (!ok) return
  try {
    await communicationStore.enqueueIridiumMessage(payload, 0) // critical priority
    await loadQueue()
  } catch (e) {
    showError(e?.message || 'Failed to queue position')
  }
}

// ==========================================
// Actions — pass predictor (Priority 4)
// ==========================================

async function loadLocations() {
  try {
    await communicationStore.fetchIridiumLocations({ silent: true })
    // Auto-select first location if none selected
    if (selectedLocationId.value == null && locations.value.length > 0) {
      selectedLocationId.value = locations.value[0].id
    }
  } catch { /* Silent */ }
}

async function loadPasses() {
  const loc = selectedLocation.value
  if (!loc) return
  passesLoading.value = true
  try {
    await communicationStore.fetchIridiumPasses(loc.lat, loc.lon, {
      hours: passHours.value,
      minElevation: 10,
      altM: loc.alt_m || 0
    })
  } catch { /* Silent */ } finally {
    passesLoading.value = false
  }
}

async function handleAddLocation() {
  const lat = parseFloat(newLocLat.value)
  const lon = parseFloat(newLocLon.value)
  if (!newLocName.value.trim() || isNaN(lat) || isNaN(lon)) {
    showError('Name, latitude, and longitude are required')
    return
  }
  locSaving.value = true
  try {
    await communicationStore.addIridiumLocation(newLocName.value.trim(), lat, lon)
    newLocName.value = ''; newLocLat.value = ''; newLocLon.value = ''
    showAddLocation.value = false
    await loadLocations()
  } catch (e) {
    showError(e?.message || 'Failed to add location')
  } finally {
    locSaving.value = false
  }
}

async function handleDeleteLocation(id) {
  const ok = await confirm({
    title: 'Delete Location',
    message: 'Remove this location from the pass predictor?',
    confirmText: 'Delete',
    variant: 'warning'
  })
  if (!ok) return
  try {
    await communicationStore.deleteIridiumLocation(id)
    if (selectedLocationId.value === id) selectedLocationId.value = null
    await loadLocations()
  } catch (e) {
    showError(e?.message || 'Failed to delete location')
  }
}

function formatPassTime(dt) {
  if (!dt) return '—'
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

function formatCountdown(dt) {
  if (!dt) return ''
  const diff = new Date(dt).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  if (h > 0) return `in ${h}h ${m % 60}m`
  return `in ${m}m`
}

// ==========================================
// Lifecycle
// ==========================================

// Start/stop signal polling when connection state changes
watch(isConnected, (connected) => {
  if (connected) {
    startSignalPolling()
  } else {
    stopSignalPolling()
  }
})

// Reload signal history when range selector changes
watch(signalHistoryRange, () => {
  if (isConnected.value) loadSignalHistory()
})

// Reload passes when location or hours changes
watch(selectedLocationId, () => { loadPasses() })
watch(passHours, () => { loadPasses() })

onMounted(async () => {
  loading.value = true
  try {
    const s = signal()
    // Discover devices and check if already connected
    await Promise.all([
      communicationStore.fetchIridiumDevices({ signal: s }),
      communicationStore.fetchIridiumStatus({ signal: s })
    ])

    // If already connected (page refresh), load operational data + start SSE + polling
    if (isConnected.value) {
      startSSE()
      startSignalPolling()
      await Promise.all([
        communicationStore.fetchIridiumSignal({ signal: s }),
        communicationStore.fetchIridiumMessages({ signal: s })
      ])
      // Load dashboard extras
      await Promise.all([loadSignalHistory(), loadCredits(), loadQueue()])
      loadLocations().then(loadPasses)
    } else {
      // Load locations even when disconnected (pass predictor can be used offline)
      await loadLocations()
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (messageSentTimeout) clearTimeout(messageSentTimeout)
  if (errorTimeout) clearTimeout(errorTimeout)
  stopSignalPolling()
  // Close SSE stream on tab switch / component destroy
  communicationStore.closeIridiumSSE()
})
</script>

<template>
  <div class="space-y-6">

    <!-- ======================================== -->
    <!-- In-component error banner -->
    <!-- ======================================== -->
    <div
      v-if="localError"
      class="flex items-start gap-3 p-4 rounded-xl bg-error-muted border border-error/20"
    >
      <Icon name="AlertTriangle" :size="18" class="text-error shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <p class="text-sm text-error font-medium">{{ localError }}</p>
      </div>
      <button
        @click="clearError"
        class="p-1 rounded text-error/60 hover:text-error transition-colors shrink-0"
        aria-label="Dismiss error"
      >
        <Icon name="X" :size="14" />
      </button>
    </div>

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
      <!-- Antenna Diagnostics Card (3a) -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

          <!-- Left: identity + status -->
          <div class="flex items-start gap-3 min-w-0">
            <div
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                status.registrationState === 'registered' ? 'bg-success-muted' : 'bg-neutral-muted'
              ]"
            >
              <Icon
                name="Satellite"
                :size="20"
                :class="status.registrationState === 'registered' ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div class="min-w-0">
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

              <!-- Diagnostics grid -->
              <div class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                <div v-if="status.model" class="flex gap-1 items-baseline">
                  <span class="text-xs text-theme-muted shrink-0">Model</span>
                  <span class="text-xs text-theme-secondary font-medium truncate">{{ status.model }}</span>
                </div>
                <div v-if="status.imei" class="flex gap-1 items-baseline">
                  <span class="text-xs text-theme-muted shrink-0">IMEI</span>
                  <span class="text-xs font-mono text-theme-secondary">{{ status.imei }}</span>
                </div>
                <div v-if="lastOutboundMsg" class="flex gap-1 items-baseline">
                  <span class="text-xs text-theme-muted shrink-0">Last SBDIX</span>
                  <span class="text-xs text-theme-secondary">{{ formatTimestamp(lastOutboundMsg.timestamp) }}</span>
                </div>
                <div v-if="lastSuccessfulSend" class="flex gap-1 items-baseline">
                  <span class="text-xs text-theme-muted shrink-0">Last success</span>
                  <span class="text-xs text-theme-secondary">{{ formatTimestamp(lastSuccessfulSend.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: signal + disconnect -->
          <div class="flex items-center gap-4 shrink-0">
            <!-- Signal bars -->
            <div class="flex items-center gap-2">
              <div
                class="flex items-end gap-0.5 h-5"
                :title="signalDescription || `Signal: ${signalBars}/5`"
              >
                <div
                  v-for="bar in 5"
                  :key="bar"
                  :class="[
                    'w-1.5 rounded-sm transition-colors',
                    bar <= signalBars ? barColor(signalBars) : 'bg-theme-tertiary'
                  ]"
                  :style="{ height: `${bar * 4}px` }"
                />
              </div>
              <span class="text-xs text-theme-muted">{{ signalBars }}/5</span>
              <button
                @click="refreshSignalFull"
                :disabled="signalRefreshing"
                class="p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
                title="Force refresh signal (blocking scan)"
                aria-label="Force refresh signal strength"
              >
                <Icon
                  name="RefreshCw" :size="12"
                  :class="{ 'animate-spin': signalRefreshing }"
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
      <!-- Signal History + Credits Row -->
      <!-- ======================================== -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Signal History sparkline (2/3 width on lg) -->
        <div class="lg:col-span-2 bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Icon name="Activity" :size="16" class="text-accent" />
              <h3 class="text-sm font-semibold text-theme-primary">Signal History</h3>
            </div>
            <!-- Range selector -->
            <div class="flex items-center gap-1">
              <button
                v-for="r in HISTORY_RANGES"
                :key="r.label"
                @click="signalHistoryRange = r.label"
                :class="[
                  'px-2 py-0.5 text-xs rounded transition-colors',
                  signalHistoryRange === r.label
                    ? 'bg-accent text-on-accent font-medium'
                    : 'text-theme-muted hover:text-theme-primary'
                ]"
              >
                {{ r.label }}
              </button>
              <button
                @click="loadSignalHistory"
                :disabled="signalHistoryLoading"
                class="p-1 ml-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
                title="Refresh signal history"
              >
                <Icon name="RefreshCw" :size="12" :class="{ 'animate-spin': signalHistoryLoading }" />
              </button>
            </div>
          </div>

          <SignalSparkline
            :points="signalHistoryPoints"
            :y-min="0"
            :y-max="5"
            :height="80"
            :loading="signalHistoryLoading"
            :empty="signalHistoryEmpty"
          />

          <!-- Summary below sparkline -->
          <div v-if="signalHistoryPoints.length >= 2" class="mt-2 flex items-center gap-4 text-xs text-theme-muted">
            <span>
              Avg:
              <span class="text-theme-secondary font-medium">
                {{ (signalHistoryPoints.reduce((s, p) => s + p.value, 0) / signalHistoryPoints.length).toFixed(1) }}/5
              </span>
            </span>
            <span>
              Min: <span class="text-theme-secondary font-medium">{{ Math.min(...signalHistoryPoints.map(p => p.value)) }}/5</span>
            </span>
            <span>
              Max: <span class="text-theme-secondary font-medium">{{ Math.max(...signalHistoryPoints.map(p => p.value)) }}/5</span>
            </span>
            <span>{{ signalHistoryPoints.length }} samples</span>
          </div>
        </div>

        <!-- SBD Credits card (1/3 width on lg) -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Icon name="CreditCard" :size="16" class="text-accent" />
              <h3 class="text-sm font-semibold text-theme-primary">SBD Credits</h3>
            </div>
            <button
              @click="loadCredits"
              :disabled="creditsLoading"
              class="p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
              title="Refresh credit usage"
            >
              <Icon name="RefreshCw" :size="12" :class="{ 'animate-spin': creditsLoading }" />
            </button>
          </div>

          <template v-if="credits">
            <!-- Usage stats -->
            <div class="space-y-1.5 mb-3">
              <div class="flex items-center justify-between text-xs">
                <span class="text-theme-muted">Today</span>
                <span class="font-medium text-theme-primary">{{ credits.today }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-theme-muted">This month</span>
                <span class="font-medium text-theme-primary">{{ credits.this_month }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-theme-muted">All time</span>
                <span class="font-medium text-theme-secondary">{{ credits.all_time }}</span>
              </div>
            </div>

            <!-- Budget progress -->
            <template v-if="credits.budget > 0">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-theme-muted">Monthly budget</span>
                <span class="font-medium text-theme-primary">{{ credits.this_month }} / {{ credits.budget }}</span>
              </div>
              <div class="w-full h-1.5 bg-theme-tertiary rounded-full overflow-hidden">
                <div
                  :class="['h-full rounded-full transition-all', creditsBudgetColor]"
                  :style="{ width: creditsBudgetPct + '%' }"
                />
              </div>
              <p class="text-xs text-theme-muted mt-1">{{ creditsBudgetPct }}% used</p>
            </template>

            <!-- Budget CTA -->
            <button
              @click="showBudgetForm = !showBudgetForm"
              class="mt-2 text-xs text-accent hover:underline"
            >
              {{ credits.budget > 0 ? 'Edit budget' : 'Set budget' }}
            </button>

            <!-- Budget form -->
            <div v-if="showBudgetForm" class="mt-3 space-y-2">
              <div>
                <label class="block text-xs text-theme-muted mb-1">Monthly limit (sends)</label>
                <input
                  v-model="budgetInput"
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  class="w-full px-2 py-1 text-xs rounded border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label class="block text-xs text-theme-muted mb-1">Warn at (%)</label>
                <input
                  v-model="warnInput"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 80"
                  class="w-full px-2 py-1 text-xs rounded border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div class="flex gap-2">
                <button
                  @click="handleSetBudget"
                  :disabled="budgetSaving"
                  class="flex-1 px-2 py-1 text-xs rounded bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  <Icon v-if="budgetSaving" name="Loader2" :size="10" class="inline-block animate-spin mr-1" />
                  Save
                </button>
                <button
                  @click="showBudgetForm = false"
                  class="px-2 py-1 text-xs rounded bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </template>

          <div v-else-if="creditsLoading" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-3 bg-theme-tertiary rounded animate-pulse" />
          </div>

          <p v-else class="text-xs text-theme-muted">Credit data unavailable</p>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Pass Predictor Card (Priority 4) -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Icon name="Radio" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Satellite Pass Predictor</h2>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Location selector -->
              <select
                v-model="selectedLocationId"
                class="text-xs px-2 py-1.5 rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary"
                aria-label="Select ground location"
              >
                <option :value="null" disabled>Select location...</option>
                <option v-for="loc in locations" :key="loc.id" :value="loc.id">
                  {{ loc.name }} ({{ loc.lat.toFixed(2) }}°, {{ loc.lon.toFixed(2) }}°)
                </option>
              </select>
              <!-- Hours selector -->
              <select
                v-model="passHours"
                class="text-xs px-2 py-1.5 rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary"
                aria-label="Pass prediction window"
              >
                <option :value="12">12h</option>
                <option :value="24">24h</option>
                <option :value="48">48h</option>
                <option :value="72">72h</option>
              </select>
              <!-- Refresh -->
              <button
                @click="loadPasses"
                :disabled="passesLoading || !selectedLocationId"
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                title="Refresh pass predictions"
              >
                <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': passesLoading }" />
              </button>
              <!-- Add location -->
              <button
                @click="showAddLocation = !showAddLocation"
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                title="Add custom location"
              >
                <Icon name="MapPin" :size="14" />
              </button>
            </div>
          </div>

          <!-- Smart polling toggle -->
          <div class="mt-3 flex items-center gap-2">
            <button
              @click="smartPolling = !smartPolling"
              :class="[
                'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                smartPolling ? 'bg-accent' : 'bg-theme-tertiary'
              ]"
              role="switch"
              :aria-checked="smartPolling"
              title="Smart scheduling: only poll for signal during overhead pass windows"
            >
              <span :class="['inline-block h-3 w-3 rounded-full bg-white transition-transform', smartPolling ? 'translate-x-3.5' : 'translate-x-0.5']" />
            </button>
            <span class="text-xs text-theme-muted">
              Smart scheduling — only poll during overhead windows
              <span v-if="smartPolling && inPassWindow" class="ml-1 text-success font-medium">Active pass</span>
              <span v-else-if="smartPolling && !inPassWindow && nextPass" class="ml-1 text-theme-muted">
                Next: {{ formatCountdown(nextPass.aos) }}
              </span>
            </span>
          </div>

          <!-- Add location form -->
          <div v-if="showAddLocation" class="mt-3 p-3 bg-theme-tertiary rounded-lg">
            <p class="text-xs font-medium text-theme-secondary mb-2">Add custom location</p>
            <div class="grid grid-cols-3 gap-2 mb-2">
              <input
                v-model="newLocName"
                placeholder="Name"
                class="px-2 py-1 text-xs rounded border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <input
                v-model="newLocLat"
                placeholder="Lat (e.g. 52.16)"
                type="number"
                step="0.001"
                class="px-2 py-1 text-xs rounded border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <input
                v-model="newLocLon"
                placeholder="Lon (e.g. 4.49)"
                type="number"
                step="0.001"
                class="px-2 py-1 text-xs rounded border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div class="flex gap-2">
              <button
                @click="handleAddLocation"
                :disabled="locSaving"
                class="px-3 py-1 text-xs rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <Icon v-if="locSaving" name="Loader2" :size="10" class="inline-block animate-spin mr-1" />
                Save
              </button>
              <button
                @click="showAddLocation = false"
                class="px-3 py-1 text-xs rounded-lg bg-theme-card text-theme-muted hover:text-theme-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Next pass highlight -->
        <div v-if="nextPass && !passesLoading" class="px-5 py-3 border-b border-theme-primary bg-accent-muted/20">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p class="text-xs text-theme-muted">Next pass</p>
              <p class="text-sm font-semibold text-theme-primary">
                {{ formatPassTime(nextPass.aos) }} — {{ formatCountdown(nextPass.aos) }}
              </p>
              <p class="text-xs text-theme-muted">
                {{ nextPass.duration_min.toFixed(0) }} min &middot; peak {{ nextPass.peak_elev_deg.toFixed(0) }}&deg;
                &middot; {{ nextPass.satellite }}
              </p>
            </div>
            <!-- Elevation bar -->
            <div class="flex items-center gap-2">
              <div class="w-24 h-2 bg-theme-tertiary rounded-full overflow-hidden">
                <div
                  class="h-full bg-success rounded-full"
                  :style="{ width: Math.min(100, (nextPass.peak_elev_deg / 90) * 100) + '%' }"
                />
              </div>
              <span class="text-xs text-theme-muted">{{ nextPass.peak_elev_deg.toFixed(0) }}&deg;</span>
            </div>
          </div>
        </div>

        <!-- No location or no passes -->
        <div v-else-if="!selectedLocationId" class="px-5 py-8 text-center">
          <Icon name="MapPin" :size="28" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">Select a location to predict passes</p>
        </div>
        <div v-else-if="passesLoading" class="px-5 py-6">
          <div class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-10 bg-theme-tertiary rounded animate-pulse" />
          </div>
        </div>
        <div v-else-if="!passes.length" class="px-5 py-8 text-center">
          <Icon name="CloudOff" :size="28" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">No passes found in the next {{ passHours }}h</p>
          <p class="text-xs text-theme-muted mt-1">Try lowering the minimum elevation or extending the window</p>
        </div>

        <!-- Pass list -->
        <div v-else class="divide-y divide-theme-primary max-h-64 overflow-y-auto">
          <div
            v-for="(pass, i) in passes.slice(0, 10)"
            :key="i"
            :class="[
              'px-5 py-2.5 flex items-center gap-4',
              pass.is_active ? 'bg-success-muted/30' : 'hover:bg-theme-secondary'
            ]"
          >
            <!-- Active indicator -->
            <div class="shrink-0 w-1.5 h-1.5 rounded-full" :class="pass.is_active ? 'bg-success' : 'bg-transparent'" />

            <!-- Time + satellite -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-theme-primary">
                {{ formatPassTime(pass.aos) }}
                <span v-if="pass.is_active" class="ml-1 text-success text-xs font-normal">Active</span>
              </p>
              <p class="text-xs text-theme-muted truncate">{{ pass.satellite }}</p>
            </div>

            <!-- Duration + elevation -->
            <div class="shrink-0 text-right">
              <p class="text-xs font-medium text-theme-primary">{{ pass.peak_elev_deg.toFixed(0) }}&deg;</p>
              <p class="text-xs text-theme-muted">{{ pass.duration_min.toFixed(0) }} min</p>
            </div>

            <!-- Elevation bar -->
            <div class="shrink-0 w-16 h-1.5 bg-theme-tertiary rounded-full overflow-hidden">
              <div
                :class="['h-full rounded-full', pass.peak_elev_deg >= 40 ? 'bg-success' : pass.peak_elev_deg >= 20 ? 'bg-warning' : 'bg-error']"
                :style="{ width: Math.min(100, (pass.peak_elev_deg / 90) * 100) + '%' }"
              />
            </div>
          </div>
        </div>

        <!-- Location management footer -->
        <div v-if="locations.length > 0" class="px-5 py-2 border-t border-theme-primary flex flex-wrap gap-2">
          <span
            v-for="loc in locations"
            :key="loc.id"
            :class="[
              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors',
              selectedLocationId === loc.id
                ? 'bg-accent text-on-accent'
                : 'bg-theme-tertiary text-theme-muted hover:text-theme-primary'
            ]"
            @click="selectedLocationId = loc.id"
          >
            {{ loc.name }}
            <button
              v-if="!loc.builtin"
              @click.stop="handleDeleteLocation(loc.id)"
              class="hover:text-error transition-colors"
              title="Remove location"
            >
              <Icon name="X" :size="10" />
            </button>
          </span>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Outbound Queue Card (3d) -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="ListOrdered" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Outbound Queue</h2>
              <span
                v-if="queue.length > 0"
                class="text-xs font-bold px-1.5 py-0.5 rounded-full bg-warning-muted text-warning"
              >
                {{ queue.length }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="handleSendPosition"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors"
                title="Queue compact position + battery status message (critical priority)"
              >
                <Icon name="MapPin" :size="12" class="inline-block mr-1" />
                Send Position
              </button>
              <button
                @click="showQueueCompose = !showQueueCompose"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  showQueueCompose
                    ? 'bg-accent text-on-accent'
                    : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
                ]"
                title="Compose a message to queue for when signal is available"
              >
                <Icon name="Plus" :size="12" class="inline-block mr-1" />
                Queue Message
              </button>
              <button
                @click="loadQueue"
                :disabled="queueLoading"
                class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                title="Refresh queue"
              >
                <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': queueLoading }" />
              </button>
            </div>
          </div>

          <!-- Compose form -->
          <div v-if="showQueueCompose" class="mt-4 space-y-2">
            <textarea
              v-model="queueMessage"
              rows="2"
              placeholder="Message to send opportunistically (max 340 bytes)..."
              maxlength="340"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none font-mono"
            />
            <div class="flex items-center gap-3 flex-wrap">
              <!-- Priority selector -->
              <div class="flex items-center gap-1">
                <span class="text-xs text-theme-muted">Priority:</span>
                <button
                  v-for="(label, idx) in PRIORITY_LABELS"
                  :key="idx"
                  @click="queuePriority = idx"
                  :class="[
                    'px-2 py-0.5 text-xs rounded transition-colors',
                    queuePriority === idx
                      ? 'bg-accent text-on-accent font-medium'
                      : 'text-theme-muted hover:text-theme-primary'
                  ]"
                >
                  {{ label }}
                </button>
              </div>
              <div class="flex items-center gap-2 ml-auto">
                <button
                  @click="showQueueCompose = false"
                  class="px-3 py-1.5 text-xs rounded-lg bg-theme-tertiary text-theme-muted hover:text-theme-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleQueueMessage"
                  :disabled="!queueMessage.trim()"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Queue
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Queue empty -->
        <div v-if="!queue.length && !queueLoading" class="px-5 py-6 text-center">
          <Icon name="CheckCircle" :size="24" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">No messages queued</p>
          <p class="text-xs text-theme-muted mt-1">
            Messages queued here are sent opportunistically when signal becomes available
          </p>
        </div>

        <!-- Queue list -->
        <div v-else-if="queue.length" class="divide-y divide-theme-primary">
          <div
            v-for="item in queue"
            :key="item.id"
            class="px-5 py-3 flex items-start gap-3 hover:bg-theme-secondary transition-colors"
          >
            <!-- Priority badge -->
            <span
              :class="[
                'shrink-0 text-xs font-medium px-1.5 py-0.5 rounded mt-0.5',
                item.priority === 0 ? 'bg-error-muted text-error' : item.priority === 2 ? 'bg-theme-tertiary text-theme-muted' : 'bg-theme-tertiary text-theme-secondary'
              ]"
            >
              {{ PRIORITY_LABELS[item.priority] ?? 'Normal' }}
            </span>

            <!-- Message preview -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono text-theme-primary truncate">{{ truncatePreview(item.payload ? atob(item.payload) : '—', 80) }}</p>
              <p class="text-xs text-theme-muted mt-0.5">
                Retries: {{ item.retries }}/{{ item.max_retries }}
                <span v-if="item.last_error" class="ml-2 text-warning">{{ item.last_error.substring(0, 40) }}</span>
              </p>
            </div>

            <!-- Actions -->
            <div class="shrink-0 flex items-center gap-1">
              <!-- Priority change -->
              <select
                :value="item.priority"
                @change="handleSetQueuePriority(item.id, parseInt($event.target.value))"
                class="text-xs px-1.5 py-0.5 rounded border border-theme-primary bg-theme-secondary text-theme-muted"
                title="Change priority"
              >
                <option v-for="(label, idx) in PRIORITY_LABELS" :key="idx" :value="idx">{{ label }}</option>
              </select>
              <!-- Cancel -->
              <button
                @click="handleCancelQueueItem(item.id)"
                class="p-1 rounded text-theme-muted hover:text-error transition-colors"
                title="Cancel this queued message"
              >
                <Icon name="X" :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Send SBD Form -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <Icon name="Send" :size="18" class="text-accent" />
          <h2 class="text-lg font-semibold text-theme-primary">Send SBD Message</h2>
        </div>

        <div class="space-y-3">
          <textarea
            v-model="sbdMessage"
            rows="3"
            :placeholder="sbdFormat === 'text'
              ? 'Type your Short Burst Data message (max 120 characters)...'
              : 'Enter base64-encoded binary data (max 340 bytes)...'"
            aria-label="SBD message text"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none font-mono"
          />

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3 flex-wrap">
              <span :class="['text-xs font-medium', countColor]">
                {{ currentCount }}/{{ currentLimit }} {{ countLabel }}
              </span>
              <span v-if="countRemaining < 0" class="text-xs text-error">
                ({{ Math.abs(countRemaining) }} over limit)
              </span>
              <select
                v-model="sbdFormat"
                class="text-xs px-2 py-1 rounded border border-theme-primary bg-theme-secondary text-theme-secondary"
                aria-label="Message format"
              >
                <option value="text">Text (max 120 chars)</option>
                <option value="binary">Binary (max 340 bytes)</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <!-- Signal warning -->
              <span
                v-if="signalBars === 0 && sbdMessage.trim()"
                class="text-xs text-warning"
                title="Signal strength is 0 — transmission will fail"
              >
                No signal
              </span>
              <button
                @click="handleSendSBD"
                :disabled="!canSend"
                aria-label="Send SBD message via satellite"
                :title="signalBars === 0
                  ? 'Cannot send — no satellite signal'
                  : 'Send message via Iridium satellite'"
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
      <!-- Messages Table (3b) -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            <!-- Header + unread badge + filter tabs -->
            <div class="flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <Icon name="Inbox" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Messages</h2>
                <span
                  v-if="unreadCount > 0"
                  class="text-xs font-bold px-1.5 py-0.5 rounded-full bg-accent text-on-accent"
                  title="Unread incoming messages"
                >
                  {{ unreadCount }}
                </span>
              </div>
              <!-- Filter tabs -->
              <div class="flex items-center gap-0.5 bg-theme-tertiary rounded-lg p-0.5">
                <button
                  v-for="f in [{ key: 'all', label: 'All' }, { key: 'inbox', label: 'Inbox' }, { key: 'sent', label: 'Sent' }]"
                  :key="f.key"
                  @click="messageFilter = f.key"
                  :class="[
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    messageFilter === f.key
                      ? 'bg-theme-card text-theme-primary font-medium shadow-sm'
                      : 'text-theme-muted hover:text-theme-primary'
                  ]"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Mark all read -->
              <button
                v-if="unreadCount > 0"
                @click="markAllRead"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors"
                title="Mark all incoming messages as read"
              >
                Mark all read
              </button>

              <!-- Receive pending MT — reads from local modem buffer -->
              <button
                @click="handleReceiveMessage"
                :disabled="actionLoading.receive"
                aria-label="Read message from modem buffer"
                title="Read message from modem buffer (instant, no satellite contact)"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
              >
                <Icon
                  v-if="actionLoading.receive"
                  name="Loader2" :size="12"
                  class="inline-block animate-spin mr-1"
                />
                <Icon v-else name="Download" :size="12" class="inline-block mr-1" />
                Read Buffer
              </button>

              <!-- Check Mailbox — contacts satellite gateway -->
              <button
                @click="handleCheckMailbox"
                :disabled="actionLoading.mailbox"
                aria-label="Check Iridium gateway for incoming messages"
                title="Contact satellite gateway for queued messages (uses 1 credit, 10-60s)"
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

        <!-- No messages for current filter -->
        <div v-if="!filteredMessages.length" class="p-8 text-center">
          <Icon name="Inbox" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">
            {{ messageFilter === 'inbox' ? 'No Incoming Messages' : messageFilter === 'sent' ? 'No Sent Messages' : 'No SBD Messages' }}
          </p>
          <p v-if="messageFilter === 'all'" class="text-xs text-theme-muted mt-1">
            Use "Check Mailbox" to download incoming messages from the Iridium gateway
          </p>
        </div>

        <!-- Messages list — click MT row to mark read -->
        <div v-else class="divide-y divide-theme-primary">
          <div
            v-for="row in filteredMessages"
            :key="row.id ?? filteredMessages.indexOf(row)"
            @click="formatDirection(row.direction) === 'MT' ? markRead(row) : undefined"
            :class="[
              'px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4',
              formatDirection(row.direction) === 'MT' && !readMessageIds.has(row.id)
                ? 'bg-accent-muted/20 cursor-pointer hover:bg-accent-muted/30'
                : 'hover:bg-theme-secondary',
              'transition-colors'
            ]"
          >
            <!-- Direction badge -->
            <div class="shrink-0 w-20">
              <span
                v-if="formatDirection(row.direction)"
                :class="[
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  formatDirection(row.direction) === 'MO'
                    ? 'bg-accent-muted text-accent'
                    : 'bg-success-muted text-success'
                ]"
              >
                {{ formatDirection(row.direction) === 'MO' ? 'Sent' : 'Received' }}
              </span>
              <!-- Unread dot for MT -->
              <span
                v-if="formatDirection(row.direction) === 'MT' && !readMessageIds.has(row.id)"
                class="inline-block w-1.5 h-1.5 rounded-full bg-accent ml-1 align-middle"
                title="Unread"
              />
            </div>

            <!-- Message preview -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono text-theme-primary truncate">{{ truncatePreview(row.data) }}</p>
            </div>

            <!-- Meta -->
            <div class="flex items-center gap-3 shrink-0 text-xs text-theme-muted">
              <span v-if="row.size !== null">{{ row.size }} B</span>
              <span v-if="row.status">{{ row.status }}</span>
              <span>{{ formatTimestamp(row.timestamp) }}</span>
            </div>
          </div>
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
