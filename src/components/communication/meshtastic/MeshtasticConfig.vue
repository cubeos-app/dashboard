<script setup>
/**
 * MeshtasticConfig.vue
 *
 * Configuration sub-tab: channel config, radio config, module config,
 * and waypoint management.
 */
import { ref, onMounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  meshsatAvailable: { type: Boolean, default: false }
})

// Gateway status
const gwLoading = ref(false)

async function loadGateways() {
  gwLoading.value = true
  try {
    await communicationStore.fetchMeshsatGateways()
  } finally {
    gwLoading.value = false
  }
}

async function toggleGateway(gw) {
  try {
    if (gw.connected) {
      await communicationStore.stopMeshsatGateway(gw.type)
    } else {
      await communicationStore.startMeshsatGateway(gw.type)
    }
  } catch {
    // error handled by store
  }
}

onMounted(() => {
  if (props.meshsatAvailable) loadGateways()
})

const communicationStore = useCommunicationStore()

// Channel config
const channelIndex = ref(0)
const channelName = ref('')
const channelRole = ref('PRIMARY')
const channelPSK = ref('')
const channelLoading = ref(false)

// Radio config
const radioSection = ref('lora')
const radioConfigJSON = ref('{}')
const radioLoading = ref(false)

// Module config
const moduleSection = ref('mqtt')
const moduleConfigJSON = ref('{}')
const moduleLoading = ref(false)

// Waypoint
const waypointName = ref('')
const waypointDescription = ref('')
const waypointLat = ref('')
const waypointLon = ref('')
const waypointIcon = ref(0)
const waypointExpire = ref('')
const waypointLoading = ref(false)
const waypointSent = ref(false)
let waypointSentTimeout = null

const RADIO_SECTIONS = [
  { key: 'lora', label: 'LoRa' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'device', label: 'Device' },
  { key: 'display', label: 'Display' },
  { key: 'network', label: 'Network' },
  { key: 'position', label: 'Position' },
  { key: 'power', label: 'Power' }
]

const MODULE_SECTIONS = [
  { key: 'mqtt', label: 'MQTT' },
  { key: 'serial', label: 'Serial' },
  { key: 'external_notification', label: 'External Notification' },
  { key: 'store_forward', label: 'Store & Forward' },
  { key: 'range_test', label: 'Range Test' },
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'canned_message', label: 'Canned Message' }
]

// ==========================================
// Channel config
// ==========================================

async function handleSetChannel() {
  if (!channelName.value.trim()) return

  const ok = await confirm({
    title: 'Set Channel',
    message: `Change channel ${channelIndex.value} to "${channelName.value.trim()}" (${channelRole.value})? All nodes must use the same channel and PSK to communicate.`,
    confirmText: 'Set Channel',
    variant: 'warning'
  })
  if (!ok) return

  channelLoading.value = true
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
  } catch {
    // Store sets error
  } finally {
    channelLoading.value = false
  }
}

// ==========================================
// Radio config
// ==========================================

async function handleSetRadioConfig() {
  let config
  try {
    config = JSON.parse(radioConfigJSON.value)
  } catch {
    return
  }

  radioLoading.value = true
  try {
    await communicationStore.meshsatConfigRadio({
      section: radioSection.value,
      config
    })
  } catch {
    // Store sets error
  } finally {
    radioLoading.value = false
  }
}

// ==========================================
// Module config
// ==========================================

async function handleSetModuleConfig() {
  let config
  try {
    config = JSON.parse(moduleConfigJSON.value)
  } catch {
    return
  }

  moduleLoading.value = true
  try {
    await communicationStore.meshsatConfigModule({
      section: moduleSection.value,
      config
    })
  } catch {
    // Store sets error
  } finally {
    moduleLoading.value = false
  }
}

// ==========================================
// Waypoints
// ==========================================

async function handleSendWaypoint() {
  if (!waypointName.value.trim() || !waypointLat.value || !waypointLon.value) return

  waypointLoading.value = true
  waypointSent.value = false
  try {
    const payload = {
      name: waypointName.value.trim(),
      description: waypointDescription.value.trim() || undefined,
      latitude: Number(waypointLat.value),
      longitude: Number(waypointLon.value),
      icon: Number(waypointIcon.value) || 0
    }
    if (waypointExpire.value) {
      payload.expire = Math.floor(new Date(waypointExpire.value).getTime() / 1000)
    }
    await communicationStore.meshsatSendWaypoint(payload)
    waypointName.value = ''
    waypointDescription.value = ''
    waypointLat.value = ''
    waypointLon.value = ''
    waypointSent.value = true
    if (waypointSentTimeout) clearTimeout(waypointSentTimeout)
    waypointSentTimeout = setTimeout(() => { waypointSent.value = false }, 3000)
  } catch {
    // Store sets error
  } finally {
    waypointLoading.value = false
  }
}

function isValidJSON(str) {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Channel Configuration -->
    <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="Hash" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Channel Configuration</h2>
      </div>

      <div class="space-y-4 max-w-lg">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Index (0-7)</label>
            <input
              v-model.number="channelIndex"
              type="number"
              min="0"
              max="7"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Role</label>
            <select
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
          <label class="block text-sm font-medium text-theme-secondary mb-1">Channel Name</label>
          <input
            v-model="channelName"
            type="text"
            placeholder="e.g., CubeOS-Mesh"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">PSK (Pre-Shared Key)</label>
          <input
            v-model="channelPSK"
            type="text"
            placeholder="Leave blank for default"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
          />
          <p class="text-xs text-theme-muted mt-1">All nodes on the same channel must share this key</p>
        </div>

        <button
          @click="handleSetChannel"
          :disabled="!channelName.trim() || channelLoading"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="channelLoading"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Set Channel
        </button>
      </div>
    </div>

    <!-- Radio Configuration (MeshSat only) -->
    <div v-if="meshsatAvailable" class="bg-theme-card border border-theme-primary rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="Radio" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Radio Configuration</h2>
      </div>

      <div class="space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Section</label>
          <select
            v-model="radioSection"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          >
            <option v-for="s in RADIO_SECTIONS" :key="s.key" :value="s.key">
              {{ s.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Configuration (JSON)</label>
          <textarea
            v-model="radioConfigJSON"
            rows="4"
            placeholder='{"region": "EU_868", "modem_preset": "LONG_FAST"}'
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
            :class="{ 'border-error': radioConfigJSON && !isValidJSON(radioConfigJSON) }"
          />
          <p v-if="radioConfigJSON && !isValidJSON(radioConfigJSON)" class="text-xs text-error mt-1">
            Invalid JSON
          </p>
        </div>

        <button
          @click="handleSetRadioConfig"
          :disabled="!isValidJSON(radioConfigJSON) || radioLoading"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="radioLoading"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Apply Radio Config
        </button>
      </div>
    </div>

    <!-- Module Configuration (MeshSat only) -->
    <div v-if="meshsatAvailable" class="bg-theme-card border border-theme-primary rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="Puzzle" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Module Configuration</h2>
      </div>

      <div class="space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Module</label>
          <select
            v-model="moduleSection"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          >
            <option v-for="s in MODULE_SECTIONS" :key="s.key" :value="s.key">
              {{ s.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Configuration (JSON)</label>
          <textarea
            v-model="moduleConfigJSON"
            rows="4"
            placeholder='{"enabled": true, "address": "mqtt.example.com"}'
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
            :class="{ 'border-error': moduleConfigJSON && !isValidJSON(moduleConfigJSON) }"
          />
          <p v-if="moduleConfigJSON && !isValidJSON(moduleConfigJSON)" class="text-xs text-error mt-1">
            Invalid JSON
          </p>
        </div>

        <button
          @click="handleSetModuleConfig"
          :disabled="!isValidJSON(moduleConfigJSON) || moduleLoading"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="moduleLoading"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Apply Module Config
        </button>
      </div>
    </div>

    <!-- Waypoints (MeshSat only) -->
    <div v-if="meshsatAvailable" class="bg-theme-card border border-theme-primary rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="MapPin" :size="18" class="text-accent" />
        <h2 class="text-lg font-semibold text-theme-primary">Send Waypoint</h2>
      </div>

      <div class="space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Name</label>
          <input
            v-model="waypointName"
            type="text"
            placeholder="Waypoint name"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-theme-secondary mb-1">Description</label>
          <input
            v-model="waypointDescription"
            type="text"
            placeholder="Optional description"
            class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Latitude</label>
            <input
              v-model="waypointLat"
              type="number"
              step="0.000001"
              placeholder="e.g., 37.7749"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Longitude</label>
            <input
              v-model="waypointLon"
              type="number"
              step="0.000001"
              placeholder="e.g., -122.4194"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent font-mono"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Icon (0-255)</label>
            <input
              v-model.number="waypointIcon"
              type="number"
              min="0"
              max="255"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-secondary mb-1">Expires</label>
            <input
              v-model="waypointExpire"
              type="datetime-local"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-primary bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        <div
          v-if="waypointSent"
          class="flex items-center gap-2 text-sm text-success"
        >
          <Icon name="CheckCircle" :size="14" />
          <span>Waypoint sent to mesh network</span>
        </div>

        <button
          @click="handleSendWaypoint"
          :disabled="!waypointName.trim() || !waypointLat || !waypointLon || waypointLoading"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Icon
            v-if="waypointLoading"
            name="Loader2" :size="14"
            class="inline-block animate-spin mr-1.5"
          />
          Send Waypoint
        </button>
      </div>
    </div>

    <!-- Gateway Status Section -->
    <div v-if="meshsatAvailable" class="card">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-secondary">Gateways</h3>
        <button
          @click="loadGateways"
          :disabled="gwLoading"
          class="text-xs text-tertiary hover:text-secondary transition-colors"
        >
          {{ gwLoading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>

      <div v-if="!communicationStore.meshsatGateways?.length" class="text-xs text-tertiary">
        No gateways configured. Open MeshSat UI at :6050/gateways to configure.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="gw in communicationStore.meshsatGateways"
          :key="gw.type"
          class="flex items-center justify-between p-2.5 rounded-lg bg-surface-alt"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-2 h-2 rounded-full"
              :class="gw.connected ? 'bg-green-400' : 'bg-gray-500'"
            />
            <span class="text-sm text-secondary capitalize">{{ gw.type }}</span>
            <span class="text-xs text-tertiary">
              {{ gw.messages_in ?? 0 }} in / {{ gw.messages_out ?? 0 }} out
            </span>
          </div>
          <button
            @click="toggleGateway(gw)"
            class="px-2.5 py-1 text-xs rounded-md transition-colors"
            :class="gw.connected ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-accent/20 text-accent hover:bg-accent/30'"
          >
            {{ gw.connected ? 'Stop' : 'Start' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
