<script setup>
/**
 * CellularTab.vue
 *
 * Sprint 8 Group 2: Cellular modem management panel.
 * Displays overall status, modem cards with signal bars and
 * connect/disconnect actions, plus Android tethering toggle.
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore — fetchCellularModems, connectModem, etc.
 */
import { ref, computed, onMounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()
const { isAdvanced } = useMode()

const loading = ref(true)
const actionLoading = ref({})

// APN form state — keyed by modem ID
const apnForms = ref({})
const apnFormVisible = ref({})

function getApnForm(modemId) {
  if (!apnForms.value[modemId]) {
    apnForms.value[modemId] = { apn: '', username: '', password: '' }
  }
  return apnForms.value[modemId]
}

function toggleApnForm(modemId) {
  apnFormVisible.value = {
    ...apnFormVisible.value,
    [modemId]: !apnFormVisible.value[modemId]
  }
}

// ==========================================
// Computed — cellular status
// ==========================================

/** Overall connection status */
const connectionStatus = computed(() => {
  const s = communicationStore.cellularStatus
  if (!s) return null
  // Swagger CellularStatus has `connected` boolean — check first
  if (typeof s.connected === 'boolean') return s.connected ? 'connected' : 'disconnected'
  const state = (s.state ?? s.status ?? s.connection ?? '').toLowerCase()
  if (state === 'connected' || state === 'active' || state === 'online') return 'connected'
  if (state === 'connecting' || state === 'registering') return 'connecting'
  if (state === 'disconnected' || state === 'inactive' || state === 'offline') return 'disconnected'
  return state || 'unknown'
})

const connectionStatusBadge = computed(() => {
  const map = {
    connected: { text: 'Connected', bg: 'bg-success-muted', fg: 'text-success' },
    connecting: { text: 'Connecting', bg: 'bg-warning-muted', fg: 'text-warning' },
    disconnected: { text: 'Disconnected', bg: 'bg-neutral-muted', fg: 'text-theme-muted' },
    unknown: { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  }
  return map[connectionStatus.value] || map.unknown
})

/** Active connection details */
const connectionInfo = computed(() => {
  const s = communicationStore.cellularStatus
  if (!s) return null
  return {
    operator: s.operator ?? s.network ?? s.carrier ?? null,
    technology: s.technology ?? s.access_tech ?? s.mode ?? null,
    ip: s.ip ?? s.ip_address ?? s.address ?? null,
    apn: s.apn ?? null
  }
})

// ==========================================
// Computed — modems list
// ==========================================

const modems = computed(() => {
  const raw = communicationStore.cellularModems
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.modems || raw.devices || raw.items || [])
  return list.map(m => ({
    id: m.id ?? m.modem ?? m.index ?? m.path ?? 'unknown',
    name: m.name ?? m.model ?? m.manufacturer ?? m.label ?? 'Unknown Modem',
    model: m.model ?? null,
    manufacturer: m.manufacturer ?? null,
    imei: m.imei ?? m.equipment_id ?? null,
    state: (m.connected ?? m.state ?? m.status ?? '').toString().toLowerCase(),
    signalData: null,
    _raw: m
  }))
})

/** Check if a modem is connected */
function isModemConnected(modem) {
  const s = modem.state
  return s === 'true' || s === 'connected' || s === 'active' || s === 'online'
}

// ==========================================
// Computed — signal bars
// ==========================================

/**
 * Convert signal data to bar count (0–5).
 * Handles bars, rssi (dBm), or percentage.
 */
function signalToBars(signalData) {
  if (!signalData) return 0
  // Direct bars value
  if (signalData.bars !== undefined && signalData.bars !== null) {
    return Math.min(5, Math.max(0, Math.round(Number(signalData.bars))))
  }
  // RSSI in dBm (typical range: -120 to -50)
  const rssi = signalData.rssi ?? signalData.signal_strength ?? signalData.signal ?? null
  if (rssi !== null && rssi !== undefined) {
    const val = Number(rssi)
    if (val <= -110) return 0
    if (val <= -100) return 1
    if (val <= -85) return 2
    if (val <= -70) return 3
    if (val <= -55) return 4
    return 5
  }
  // Percentage
  const pct = signalData.percent ?? signalData.quality ?? signalData.strength ?? null
  if (pct !== null && pct !== undefined) {
    const p = Number(pct)
    if (p <= 0) return 0
    if (p <= 20) return 1
    if (p <= 40) return 2
    if (p <= 60) return 3
    if (p <= 80) return 4
    return 5
  }
  return 0
}

/** Bar color class based on count */
function barColor(barCount) {
  if (barCount <= 1) return 'bg-error'
  if (barCount <= 2) return 'bg-warning'
  return 'bg-success'
}

// ==========================================
// Computed — Android tethering
// ==========================================

const tetheringStatus = computed(() => {
  const t = communicationStore.androidTethering
  if (!t) return null
  return {
    enabled: t.connected ?? t.enabled ?? t.active ?? t.tethering ?? false,
    device: t.device ?? t.interface ?? t.name ?? null,
    ip: t.ip ?? t.ip_address ?? null
  }
})

// ==========================================
// Actions
// ==========================================

async function handleConnect(modemId) {
  actionLoading.value = { ...actionLoading.value, [`connect-${modemId}`]: true }
  try {
    const form = apnForms.value[modemId]
    const connectionData = {}
    if (form?.apn) connectionData.apn = form.apn
    if (form?.username) connectionData.username = form.username
    if (form?.password) connectionData.password = form.password
    await communicationStore.connectModem(modemId, connectionData)
    await communicationStore.fetchCellularStatus({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`connect-${modemId}`]: false }
  }
}

async function handleDisconnect(modemId) {
  const ok = await confirm({
    title: 'Disconnect Modem',
    message: 'Disconnect from the cellular network? Active connections may be interrupted.',
    confirmText: 'Disconnect',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, [`disconnect-${modemId}`]: true }
  try {
    await communicationStore.disconnectModem(modemId)
    await communicationStore.fetchCellularStatus({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`disconnect-${modemId}`]: false }
  }
}

async function handleFetchSignal(modemId) {
  actionLoading.value = { ...actionLoading.value, [`signal-${modemId}`]: true }
  try {
    await communicationStore.fetchModemSignal(modemId)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`signal-${modemId}`]: false }
  }
}

async function handleEnableTethering() {
  const ok = await confirm({
    title: 'Enable Android Tethering',
    message: 'Enable USB tethering from a connected Android device?',
    confirmText: 'Enable',
    variant: 'info'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, tethering: true }
  try {
    await communicationStore.enableAndroidTethering()
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, tethering: false }
  }
}

async function handleDisableTethering() {
  const ok = await confirm({
    title: 'Disable Android Tethering',
    message: 'Disable USB tethering? Network connectivity through tethering will be lost.',
    confirmText: 'Disable',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, tethering: true }
  try {
    await communicationStore.disableAndroidTethering()
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, tethering: false }
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
      communicationStore.fetchCellularStatus({ signal: s }),
      communicationStore.fetchCellularModems({ signal: s }),
      communicationStore.fetchAndroidTethering({ signal: s })
    ])
    // Fetch signal for each modem
    for (const modem of modems.value) {
      communicationStore.fetchModemSignal(modem.id)
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !communicationStore.cellularStatus && !communicationStore.cellularModems">
      <SkeletonLoader variant="card" :count="3" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Cellular Status Card -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center',
                connectionStatus === 'connected' ? 'bg-success-muted' : 'bg-neutral-muted'
              ]"
            >
              <Icon
                name="Signal"
                :size="20"
                :class="connectionStatus === 'connected' ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-theme-primary">Cellular Status</h2>
                <span
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    connectionStatusBadge.bg,
                    connectionStatusBadge.fg
                  ]"
                >
                  {{ connectionStatusBadge.text }}
                </span>
              </div>
              <!-- Connection details -->
              <div v-if="connectionInfo" class="flex items-center gap-3 mt-0.5 flex-wrap">
                <span v-if="connectionInfo.operator" class="text-sm text-theme-secondary">
                  {{ connectionInfo.operator }}
                </span>
                <span v-if="connectionInfo.technology" class="text-xs font-medium text-theme-muted bg-theme-tertiary px-1.5 py-0.5 rounded">
                  {{ connectionInfo.technology }}
                </span>
                <span v-if="connectionInfo.ip" class="text-xs font-mono text-theme-muted">
                  {{ connectionInfo.ip }}
                </span>
                <span v-if="connectionInfo.apn" class="text-xs text-theme-muted">
                  APN: {{ connectionInfo.apn }}
                </span>
              </div>
              <p v-else class="text-sm text-theme-muted mt-0.5">No connection details available</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Modems List -->
      <!-- ======================================== -->
      <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-theme-primary">
          <div class="flex items-center gap-2">
            <Icon name="Smartphone" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">Modems</h2>
            <span
              v-if="modems.length"
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
            >
              {{ modems.length }}
            </span>
          </div>
          <p class="mt-1 text-sm text-theme-secondary">Detected cellular modems and their connection status</p>
        </div>

        <!-- No modems -->
        <div v-if="!modems.length" class="p-8 text-center">
          <Icon name="Smartphone" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">No Cellular Modem Detected</p>
          <p class="text-xs text-theme-muted mt-1">
            Connect a USB cellular modem (4G/LTE dongle) to enable mobile connectivity
          </p>
        </div>

        <!-- Modem cards -->
        <div v-else class="divide-y divide-theme-primary">
          <div
            v-for="modem in modems"
            :key="modem.id"
            class="p-5"
          >
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <!-- Modem info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-medium text-theme-primary">{{ modem.name }}</span>
                  <span
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      isModemConnected(modem) ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-muted'
                    ]"
                  >
                    {{ isModemConnected(modem) ? 'Connected' : 'Disconnected' }}
                  </span>
                </div>

                <div v-if="isAdvanced" class="flex items-center gap-4 mt-2 flex-wrap">
                  <span v-if="modem.manufacturer" class="text-xs text-theme-muted">
                    {{ modem.manufacturer }}
                  </span>
                  <span v-if="modem.model && modem.model !== modem.name" class="text-xs text-theme-muted">
                    {{ modem.model }}
                  </span>
                  <span v-if="modem.imei" class="text-xs font-mono text-theme-muted">
                    IMEI: {{ modem.imei }}
                  </span>
                </div>

                <!-- Signal strength bars -->
                <div class="flex items-center gap-3 mt-3">
                  <div class="flex items-end gap-0.5 h-5">
                    <div
                      v-for="bar in 5"
                      :key="bar"
                      :class="[
                        'w-1.5 rounded-sm transition-colors',
                        bar <= signalToBars(communicationStore.modemSignals[modem.id])
                          ? barColor(signalToBars(communicationStore.modemSignals[modem.id]))
                          : 'bg-theme-tertiary'
                      ]"
                      :style="{ height: `${bar * 4}px` }"
                    />
                  </div>

                  <span
                    v-if="communicationStore.modemSignals[modem.id]"
                    class="text-xs text-theme-muted"
                  >
                    <template v-if="communicationStore.modemSignals[modem.id].rssi != null">
                      {{ communicationStore.modemSignals[modem.id].rssi }} dBm
                    </template>
                    <template v-else-if="communicationStore.modemSignals[modem.id].percent != null">
                      {{ communicationStore.modemSignals[modem.id].percent }}%
                    </template>
                  </span>

                  <button
                    @click="handleFetchSignal(modem.id)"
                    :disabled="actionLoading[`signal-${modem.id}`]"
                    class="p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
                    title="Refresh signal"
                    :aria-label="'Refresh signal for ' + modem.name"
                  >
                    <Icon
                      name="RefreshCw"
                      :size="12"
                      :class="{ 'animate-spin': actionLoading[`signal-${modem.id}`] }"
                    />
                  </button>
                </div>
              </div>

              <!-- Modem actions -->
              <div class="flex items-center gap-2">
                <button
                  v-if="isAdvanced && !isModemConnected(modem)"
                  @click="toggleApnForm(modem.id)"
                  :aria-label="'Configure APN for ' + modem.name"
                  :aria-expanded="apnFormVisible[modem.id] ? 'true' : 'false'"
                  class="p-2 text-sm rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                  title="APN Settings"
                >
                  <Icon name="Settings" :size="16" />
                </button>
                <button
                  v-if="!isModemConnected(modem)"
                  @click="handleConnect(modem.id)"
                  :disabled="actionLoading[`connect-${modem.id}`]"
                  :aria-label="'Connect ' + modem.name"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-success-muted text-success hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`connect-${modem.id}`]"
                    name="Loader2" :size="14"
                    class="inline-block animate-spin mr-1.5"
                  />
                  Connect
                </button>
                <button
                  v-else
                  @click="handleDisconnect(modem.id)"
                  :disabled="actionLoading[`disconnect-${modem.id}`]"
                  :aria-label="'Disconnect ' + modem.name"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`disconnect-${modem.id}`]"
                    name="Loader2" :size="14"
                    class="inline-block animate-spin mr-1.5"
                  />
                  Disconnect
                </button>
              </div>
            </div>

            <!-- APN Configuration Form (Advanced, collapsible) -->
            <div
              v-if="isAdvanced && !isModemConnected(modem) && apnFormVisible[modem.id]"
              class="mt-4 p-4 bg-theme-tertiary rounded-lg space-y-3"
            >
              <p class="text-xs font-medium text-theme-secondary uppercase tracking-wider">APN Configuration</p>
              <div>
                <label
                  :for="'apn-name-' + modem.id"
                  class="block text-xs font-medium text-theme-secondary mb-1"
                >APN Name <span class="text-error">*</span></label>
                <input
                  :id="'apn-name-' + modem.id"
                  v-model="getApnForm(modem.id).apn"
                  type="text"
                  placeholder="e.g. internet, fast.t-mobile.com"
                  :aria-label="'APN name for ' + modem.name"
                  class="w-full px-3 py-2 text-sm bg-theme-input border border-theme-secondary rounded-lg text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    :for="'apn-username-' + modem.id"
                    class="block text-xs font-medium text-theme-secondary mb-1"
                  >Username</label>
                  <input
                    :id="'apn-username-' + modem.id"
                    v-model="getApnForm(modem.id).username"
                    type="text"
                    placeholder="Optional"
                    :aria-label="'APN username for ' + modem.name"
                    class="w-full px-3 py-2 text-sm bg-theme-input border border-theme-secondary rounded-lg text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    :for="'apn-password-' + modem.id"
                    class="block text-xs font-medium text-theme-secondary mb-1"
                  >Password</label>
                  <input
                    :id="'apn-password-' + modem.id"
                    v-model="getApnForm(modem.id).password"
                    type="password"
                    placeholder="Optional"
                    :aria-label="'APN password for ' + modem.name"
                    class="w-full px-3 py-2 text-sm bg-theme-input border border-theme-secondary rounded-lg text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================== -->
      <!-- Android Tethering Section (Advanced) -->
      <!-- ======================================== -->
      <div v-if="isAdvanced" class="bg-theme-card border border-theme-primary rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center',
                tetheringStatus?.enabled ? 'bg-success-muted' : 'bg-neutral-muted'
              ]"
            >
              <Icon
                name="Usb"
                :size="20"
                :class="tetheringStatus?.enabled ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-theme-primary">Android Tethering</h2>
                <span
                  v-if="tetheringStatus"
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    tetheringStatus.enabled ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-muted'
                  ]"
                >
                  {{ tetheringStatus.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
              <p class="text-sm text-theme-secondary mt-0.5">
                <template v-if="tetheringStatus?.device">
                  Interface: {{ tetheringStatus.device }}
                  <span v-if="tetheringStatus.ip" class="font-mono ml-2">{{ tetheringStatus.ip }}</span>
                </template>
                <template v-else>
                  Share mobile data from a connected Android device via USB
                </template>
              </p>
            </div>
          </div>

          <!-- Tethering toggle -->
          <div class="flex items-center gap-2">
            <button
              v-if="!tetheringStatus?.enabled"
              @click="handleEnableTethering"
              :disabled="actionLoading.tethering"
              aria-label="Enable Android tethering"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-success-muted text-success hover:bg-theme-tertiary transition-colors disabled:opacity-50"
            >
              <Icon
                v-if="actionLoading.tethering"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              Enable
            </button>
            <button
              v-else
              @click="handleDisableTethering"
              :disabled="actionLoading.tethering"
              aria-label="Disable Android tethering"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
            >
              <Icon
                v-if="actionLoading.tethering"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              Disable
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
