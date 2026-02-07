<script setup>
/**
 * IridiumTab.vue
 *
 * Sprint 8 Group 3: Iridium satellite communication panel.
 * Displays modem status (registration, IMEI), signal bars (0–5),
 * SBD message list, send form with byte counter (max 340), and mailbox check.
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore — fetchIridiumStatus, fetchIridiumSignal,
 *        fetchIridiumMessages, sendIridiumSBD, checkIridiumMailbox
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

// Port — single Iridium modem expected
const devicePort = ref(null)

// Send form
const sbdMessage = ref('')
const messageSent = ref(false)
let messageSentTimeout = null

const SBD_MAX_BYTES = 340

// ==========================================
// Computed — status
// ==========================================

const status = computed(() => {
  const port = devicePort.value
  if (!port) return null
  const s = communicationStore.iridiumStatuses[port]
  if (!s) return null

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

  return { registrationState, imei, model, networkAvailable, _raw: s }
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
  const port = devicePort.value
  if (!port) return null
  return communicationStore.iridiumSignals[port] ?? null
})

const signalBars = computed(() => {
  const data = signalData.value
  if (!data) return 0

  // Direct bars (Iridium reports 0–5 natively)
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
  const port = devicePort.value
  if (!port) return []
  const raw = communicationStore.iridiumMessages[port]
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

// ==========================================
// Actions
// ==========================================

async function handleSendSBD() {
  const port = devicePort.value
  if (!port || !sbdMessage.value.trim() || byteCount.value > SBD_MAX_BYTES) return

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
    await communicationStore.sendIridiumSBD(port, { message: sbdMessage.value.trim() })
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
  const port = devicePort.value
  if (!port) return

  actionLoading.value = { ...actionLoading.value, mailbox: true }
  try {
    await communicationStore.checkIridiumMailbox(port, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, mailbox: false }
  }
}

async function handleRefreshSignal() {
  const port = devicePort.value
  if (!port) return

  actionLoading.value = { ...actionLoading.value, signal: true }
  try {
    await communicationStore.fetchIridiumSignal(port, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, signal: false }
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    const port = 'default'
    devicePort.value = port
    const s = signal()
    await Promise.all([
      communicationStore.fetchIridiumStatus(port, { signal: s }),
      communicationStore.fetchIridiumSignal(port, { signal: s }),
      communicationStore.fetchIridiumMessages(port, { signal: s })
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
      <!-- Empty state — no Iridium modem -->
      <!-- ======================================== -->
      <div
        v-if="!status"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="Satellite" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Iridium Modem Detected</p>
        <p class="text-sm text-theme-muted">
          Connect an Iridium satellite modem (e.g., RockBLOCK 9603) via USB to enable satellite communication.
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

            <!-- Signal bars + refresh -->
            <div class="flex items-center gap-4">
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
            <div class="flex items-center justify-between">
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

              <!-- Check Mailbox button -->
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
      </template>
    </template>
  </div>
</template>
