<script setup>
/**
 * BluetoothTab.vue
 *
 * Sprint 8 Group 2: Bluetooth management panel.
 * Displays adapter status, scan for devices, device table with
 * per-row actions (pair/connect/disconnect/remove), and power toggle.
 *
 * Lazy-loaded by CommunicationView.
 * Store: useCommunicationStore — fetchBluetooth, scanBluetooth, etc.
 */
import { ref, computed, onMounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const actionLoading = ref({})

// ==========================================
// Computed — defensive parsing
// ==========================================

/** Adapter power state */
const isPowered = computed(() => {
  const bt = communicationStore.bluetooth
  if (!bt) return false
  return bt.powered ?? bt.power ?? bt.enabled ?? false
})

/** Adapter name */
const adapterName = computed(() => {
  const bt = communicationStore.bluetooth
  if (!bt) return null
  return bt.adapter ?? bt.controller ?? bt.name ?? null
})

/** Adapter MAC address */
const adapterMAC = computed(() => {
  const bt = communicationStore.bluetooth
  if (!bt) return null
  return bt.address ?? bt.mac ?? bt.mac_address ?? null
})

/** Discoverable state */
const isDiscoverable = computed(() => {
  const bt = communicationStore.bluetooth
  if (!bt) return false
  return bt.discoverable ?? false
})

/** Devices list normalised */
const devices = computed(() => {
  const raw = communicationStore.bluetoothDevices
  if (!raw) return []
  // Swagger returns { available: [...], paired: [...] } — merge both arrays
  const list = Array.isArray(raw)
    ? raw
    : [...(raw.available || []), ...(raw.paired || raw.devices || raw.items || [])]
  return list.map(d => ({
    address: d.address ?? d.mac ?? d.mac_address ?? 'unknown',
    name: d.name ?? d.alias ?? d.label ?? d.address ?? 'Unknown Device',
    type: d.type ?? d.icon ?? d.device_type ?? null,
    paired: d.paired ?? d.bonded ?? false,
    connected: d.connected ?? d.active ?? false,
    rssi: d.rssi ?? d.signal ?? d.signal_strength ?? null,
    _raw: d
  }))
})

/** Whether BT data has loaded at least once */
const hasData = computed(() => communicationStore.bluetooth !== null)

// ==========================================
// Actions
// ==========================================

async function handleScan() {
  actionLoading.value = { ...actionLoading.value, scan: true }
  try {
    await communicationStore.scanBluetooth({ signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, scan: false }
  }
}

async function handlePair(address) {
  const ok = await confirm({
    title: 'Pair Device',
    message: `Pair with Bluetooth device ${address}?`,
    confirmText: 'Pair',
    variant: 'info'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, [`pair-${address}`]: true }
  try {
    await communicationStore.pairBluetooth(address)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`pair-${address}`]: false }
  }
}

async function handleConnect(address) {
  actionLoading.value = { ...actionLoading.value, [`connect-${address}`]: true }
  try {
    await communicationStore.connectBluetooth(address)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`connect-${address}`]: false }
  }
}

async function handleDisconnect(address) {
  actionLoading.value = { ...actionLoading.value, [`disconnect-${address}`]: true }
  try {
    await communicationStore.disconnectBluetooth(address)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`disconnect-${address}`]: false }
  }
}

async function handleRemove(address) {
  const ok = await confirm({
    title: 'Remove Device',
    message: `Remove paired device ${address}? You will need to pair again to use it.`,
    confirmText: 'Remove',
    variant: 'danger'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, [`remove-${address}`]: true }
  try {
    await communicationStore.removeBluetooth(address)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`remove-${address}`]: false }
  }
}

async function handlePowerToggle() {
  if (isPowered.value) {
    const ok = await confirm({
      title: 'Power Off Bluetooth',
      message: 'This will disconnect all Bluetooth devices. Continue?',
      confirmText: 'Power Off',
      variant: 'warning'
    })
    if (!ok) return

    actionLoading.value = { ...actionLoading.value, power: true }
    try {
      await communicationStore.bluetoothPowerOff()
    } catch {
      // Store sets error
    } finally {
      actionLoading.value = { ...actionLoading.value, power: false }
    }
  } else {
    actionLoading.value = { ...actionLoading.value, power: true }
    try {
      await communicationStore.bluetoothPowerOn()
    } catch {
      // Store sets error
    } finally {
      actionLoading.value = { ...actionLoading.value, power: false }
    }
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
      communicationStore.fetchBluetooth({ signal: s }),
      communicationStore.fetchBluetoothDevices({ signal: s })
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !hasData">
      <SkeletonLoader variant="card" :count="2" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Empty state — no adapter detected -->
      <!-- ======================================== -->
      <div
        v-if="!communicationStore.bluetooth"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="Bluetooth" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Bluetooth Adapter Detected</p>
        <p class="text-sm text-theme-muted">
          Connect a USB Bluetooth dongle or enable the built-in adapter to manage devices.
        </p>
      </div>

      <template v-else>
        <!-- ======================================== -->
        <!-- Adapter Status Card -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  isPowered ? 'bg-accent-muted' : 'bg-neutral-muted'
                ]"
              >
                <Icon name="Bluetooth" :size="20" :class="isPowered ? 'text-accent' : 'text-theme-muted'" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-theme-primary">Bluetooth Adapter</h2>
                  <span
                    :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      isPowered ? 'bg-success-muted text-success' : 'bg-neutral-muted text-theme-muted'
                    ]"
                  >
                    {{ isPowered ? 'On' : 'Off' }}
                  </span>
                  <span
                    v-if="isPowered && isDiscoverable"
                    class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
                  >
                    Discoverable
                  </span>
                </div>
                <div class="flex items-center gap-3 mt-0.5">
                  <span v-if="adapterName" class="text-sm text-theme-secondary">{{ adapterName }}</span>
                  <span v-if="adapterMAC" class="text-sm font-mono text-theme-muted">{{ adapterMAC }}</span>
                </div>
              </div>
            </div>

            <!-- Power toggle -->
            <button
              @click="handlePowerToggle"
              :disabled="actionLoading.power"
              :aria-label="isPowered ? 'Power off Bluetooth' : 'Power on Bluetooth'"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50',
                isPowered
                  ? 'bg-error-muted text-error hover:bg-theme-tertiary'
                  : 'bg-success-muted text-success hover:bg-theme-tertiary'
              ]"
            >
              <Icon
                v-if="actionLoading.power"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              <Icon
                v-else
                :name="isPowered ? 'PowerOff' : 'Power'" :size="14"
                class="inline-block mr-1.5"
              />
              {{ isPowered ? 'Power Off' : 'Power On' }}
            </button>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Scan Section -->
        <!-- ======================================== -->
        <div
          v-if="isPowered"
          class="bg-theme-card border border-theme-primary rounded-xl p-5"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <Icon name="Search" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Device Discovery</h2>
              </div>
              <p class="mt-1 text-sm text-theme-secondary">
                Scan for nearby Bluetooth devices to pair and connect
              </p>
            </div>

            <button
              @click="handleScan"
              :disabled="actionLoading.scan || communicationStore.bluetoothScanning"
              aria-label="Scan for Bluetooth devices"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Icon
                v-if="actionLoading.scan || communicationStore.bluetoothScanning"
                name="Loader2" :size="14"
                class="inline-block animate-spin mr-1.5"
              />
              <Icon v-else name="Radar" :size="14" class="inline-block mr-1.5" />
              {{ communicationStore.bluetoothScanning ? 'Scanning...' : 'Scan for Devices' }}
            </button>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Devices Table -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon name="List" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Devices</h2>
                <span
                  v-if="devices.length"
                  class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
                >
                  {{ devices.length }}
                </span>
              </div>
            </div>
          </div>

          <!-- Empty devices -->
          <div v-if="!devices.length" class="p-8 text-center">
            <Icon name="BluetoothSearching" :size="32" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-secondary">No devices found</p>
            <p class="text-xs text-theme-muted mt-1">
              {{ isPowered ? 'Click "Scan for Devices" to discover nearby Bluetooth devices' : 'Power on the adapter to discover devices' }}
            </p>
          </div>

          <!-- Devices list -->
          <div v-else class="divide-y divide-theme-primary">
            <div
              v-for="device in devices"
              :key="device.address"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
            >
              <!-- Device info -->
              <div class="flex items-center gap-3 min-w-0">
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    device.connected ? 'bg-success-muted' : device.paired ? 'bg-accent-muted' : 'bg-neutral-muted'
                  ]"
                >
                  <Icon
                    :name="device.connected ? 'BluetoothConnected' : 'Bluetooth'"
                    :size="16"
                    :class="device.connected ? 'text-success' : device.paired ? 'text-accent' : 'text-theme-muted'"
                  />
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-theme-primary truncate">{{ device.name }}</span>
                    <span
                      v-if="device.type"
                      class="text-xs text-theme-muted bg-theme-tertiary px-1.5 py-0.5 rounded"
                    >
                      {{ device.type }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-0.5">
                    <span class="text-xs font-mono text-theme-muted">{{ device.address }}</span>
                    <span
                      v-if="device.paired"
                      class="text-xs font-medium text-accent"
                    >
                      Paired
                    </span>
                    <span
                      v-if="device.connected"
                      class="text-xs font-medium text-success"
                    >
                      Connected
                    </span>
                    <span
                      v-if="device.rssi !== null && device.rssi !== undefined"
                      class="text-xs text-theme-muted"
                    >
                      {{ device.rssi }} dBm
                    </span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 ml-11 sm:ml-0 flex-wrap">
                <!-- Pair (only if not yet paired) -->
                <button
                  v-if="!device.paired"
                  @click="handlePair(device.address)"
                  :disabled="actionLoading[`pair-${device.address}`]"
                  :aria-label="'Pair with ' + device.name"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`pair-${device.address}`]"
                    name="Loader2" :size="12"
                    class="inline-block animate-spin mr-1"
                  />
                  Pair
                </button>

                <!-- Connect (paired but not connected) -->
                <button
                  v-if="device.paired && !device.connected"
                  @click="handleConnect(device.address)"
                  :disabled="actionLoading[`connect-${device.address}`]"
                  :aria-label="'Connect to ' + device.name"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-success-muted text-success hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`connect-${device.address}`]"
                    name="Loader2" :size="12"
                    class="inline-block animate-spin mr-1"
                  />
                  Connect
                </button>

                <!-- Disconnect (currently connected) -->
                <button
                  v-if="device.connected"
                  @click="handleDisconnect(device.address)"
                  :disabled="actionLoading[`disconnect-${device.address}`]"
                  :aria-label="'Disconnect ' + device.name"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-warning-muted text-warning hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`disconnect-${device.address}`]"
                    name="Loader2" :size="12"
                    class="inline-block animate-spin mr-1"
                  />
                  Disconnect
                </button>

                <!-- Remove (paired device) -->
                <button
                  v-if="device.paired"
                  @click="handleRemove(device.address)"
                  :disabled="actionLoading[`remove-${device.address}`]"
                  :aria-label="'Remove ' + device.name"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-muted text-error hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                >
                  <Icon
                    v-if="actionLoading[`remove-${device.address}`]"
                    name="Loader2" :size="12"
                    class="inline-block animate-spin mr-1"
                  />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
