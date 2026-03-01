<script setup>
/**
 * MeshtasticNodes.vue
 *
 * Mesh node table sub-tab with signal quality badges and admin actions.
 * Uses MeshSat nodes (enriched with signal_quality, RSSI, env telemetry)
 * when available, falls back to HAL nodes.
 */
import { ref, computed, onMounted } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const props = defineProps({
  meshsatAvailable: { type: Boolean, default: false }
})

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const refreshing = ref(false)
const actionLoading = ref({})
const expandedNode = ref(null)

// ==========================================
// Computed
// ==========================================

const nodes = computed(() => {
  const raw = props.meshsatAvailable
    ? communicationStore.meshsatNodes
    : communicationStore.meshtasticNodes
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.nodes || raw.items || [])
  return list.map(n => ({
    id: n.id ?? n.node_id ?? n.num ?? 'unknown',
    name: n.name ?? n.long_name ?? null,
    shortName: n.short_name ?? null,
    hwModel: n.hw_model ?? n.hardware ?? null,
    snr: n.snr ?? n.signal_strength ?? null,
    rssi: n.rssi ?? null,
    signalQuality: n.signal_quality ?? null,
    battery: n.battery ?? n.battery_level ?? null,
    voltage: n.voltage ?? null,
    temperature: n.temperature ?? null,
    humidity: n.humidity ?? null,
    lastHeard: n.last_heard ?? n.last_seen ?? n.updated_at ?? null,
    diagnosticNotes: n.diagnostic_notes ?? n.notes ?? null,
    _raw: n
  }))
})

const columns = computed(() => {
  const cols = [
    { key: 'name', label: 'Node' },
    { key: 'shortName', label: 'Short' },
    { key: 'hwModel', label: 'HW Model' },
    { key: 'snr', label: 'SNR', align: 'right' },
    { key: 'rssi', label: 'RSSI', align: 'right' },
    { key: 'signalQuality', label: 'Signal', align: 'center' },
    { key: 'battery', label: 'Battery', align: 'right' },
    { key: 'lastHeard', label: 'Last Heard', align: 'right' }
  ]
  return cols
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

function formatBattery(value) {
  if (value === null || value === undefined) return '—'
  return `${Math.round(Number(value))}%`
}

function signalBadgeClass(quality) {
  if (!quality) return 'bg-theme-tertiary text-theme-muted'
  const q = quality.toUpperCase()
  if (q === 'GOOD') return 'bg-emerald-500/15 text-emerald-400'
  if (q === 'FAIR') return 'bg-amber-500/15 text-amber-400'
  return 'bg-red-500/15 text-red-400'
}

// ==========================================
// Actions
// ==========================================

async function handleRefresh() {
  refreshing.value = true
  try {
    if (props.meshsatAvailable) {
      await communicationStore.fetchMeshsatNodes({ signal: signal() })
    } else {
      await communicationStore.fetchMeshtasticNodes({ signal: signal() })
    }
  } finally {
    refreshing.value = false
  }
}

async function handleReboot(node) {
  const ok = await confirm({
    title: 'Reboot Node',
    message: `Reboot node "${node.name || node.id}"? The node will restart in 5 seconds.`,
    confirmText: 'Reboot',
    variant: 'warning'
  })
  if (!ok) return

  actionLoading.value = { ...actionLoading.value, [`reboot-${node.id}`]: true }
  try {
    await communicationStore.meshsatAdminReboot({
      node_id: Number(node.id) || node.id,
      delay_secs: 5
    })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`reboot-${node.id}`]: false }
  }
}

async function handleFactoryReset(node) {
  const ok = await confirm({
    title: 'Factory Reset Node',
    message: `Factory reset node "${node.name || node.id}"? This will erase ALL settings and data on the node. This action cannot be undone.`,
    confirmText: 'Factory Reset',
    variant: 'danger'
  })
  if (!ok) return

  const secondConfirm = await confirm({
    title: 'Are you absolutely sure?',
    message: `This will permanently erase all configuration on node "${node.name || node.id}".`,
    confirmText: 'Yes, Factory Reset',
    variant: 'danger'
  })
  if (!secondConfirm) return

  actionLoading.value = { ...actionLoading.value, [`reset-${node.id}`]: true }
  try {
    await communicationStore.meshsatAdminFactoryReset({
      node_id: Number(node.id) || node.id
    })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`reset-${node.id}`]: false }
  }
}

async function handleTraceroute(node) {
  actionLoading.value = { ...actionLoading.value, [`trace-${node.id}`]: true }
  try {
    await communicationStore.meshsatAdminTraceroute({
      node_id: Number(node.id) || node.id
    })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`trace-${node.id}`]: false }
  }
}

function toggleExpand(node) {
  expandedNode.value = expandedNode.value === node.id ? null : node.id
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  await handleRefresh()
})
</script>

<template>
  <div class="space-y-4">
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
            @click="handleRefresh"
            :disabled="refreshing"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            title="Refresh nodes"
            aria-label="Refresh mesh nodes"
          >
            <Icon
              name="RefreshCw" :size="14"
              :class="{ 'animate-spin': refreshing }"
            />
          </button>
        </div>
      </div>

      <div v-if="!nodes.length" class="p-8 text-center">
        <Icon name="Users" :size="32" class="text-theme-muted mx-auto mb-2" />
        <p class="text-sm text-theme-secondary">No Mesh Nodes Discovered</p>
        <p class="text-xs text-theme-muted mt-1">
          Other Meshtastic devices on the same channel will appear here
        </p>
      </div>

      <ResponsiveTable
        v-else
        :columns="columns"
        :rows="nodes"
        row-key="id"
        compact
      >
        <template #cell-name="{ row }">
          <span class="font-medium text-theme-primary">{{ row.name || '—' }}</span>
        </template>
        <template #cell-shortName="{ row }">
          <span class="text-xs text-theme-muted">{{ row.shortName || '—' }}</span>
        </template>
        <template #cell-hwModel="{ row }">
          <span class="text-xs text-theme-muted">{{ row.hwModel || '—' }}</span>
        </template>
        <template #cell-snr="{ row }">
          <span
            v-if="row.snr !== null"
            :class="[
              'text-xs font-medium',
              Number(row.snr) >= 5 ? 'text-success' : Number(row.snr) >= 0 ? 'text-warning' : 'text-error'
            ]"
          >
            {{ Number(row.snr).toFixed(1) }} dB
          </span>
          <span v-else class="text-xs text-theme-muted">—</span>
        </template>
        <template #cell-rssi="{ row }">
          <span v-if="row.rssi !== null" class="text-xs text-theme-muted">
            {{ row.rssi }} dBm
          </span>
          <span v-else class="text-xs text-theme-muted">—</span>
        </template>
        <template #cell-signalQuality="{ row }">
          <span
            v-if="row.signalQuality"
            class="text-xs font-medium px-2 py-0.5 rounded-full"
            :class="signalBadgeClass(row.signalQuality)"
          >
            {{ row.signalQuality }}
          </span>
          <span v-else class="text-xs text-theme-muted">—</span>
        </template>
        <template #cell-battery="{ row }">
          <span class="text-theme-muted">{{ formatBattery(row.battery) }}</span>
        </template>
        <template #cell-lastHeard="{ row }">
          <span class="text-xs text-theme-muted">{{ formatLastHeard(row.lastHeard) }}</span>
        </template>
        <template #row-actions="{ row }">
          <div v-if="meshsatAvailable" class="flex items-center gap-1">
            <button
              @click.stop="handleTraceroute(row)"
              :disabled="actionLoading[`trace-${row.id}`]"
              class="p-1.5 rounded-lg text-theme-muted hover:text-accent hover:bg-theme-tertiary transition-colors"
              title="Traceroute"
            >
              <Icon
                :name="actionLoading[`trace-${row.id}`] ? 'Loader2' : 'Route'"
                :size="14"
                :class="{ 'animate-spin': actionLoading[`trace-${row.id}`] }"
              />
            </button>
            <button
              @click.stop="handleReboot(row)"
              :disabled="actionLoading[`reboot-${row.id}`]"
              class="p-1.5 rounded-lg text-theme-muted hover:text-warning hover:bg-theme-tertiary transition-colors"
              title="Reboot node"
            >
              <Icon
                :name="actionLoading[`reboot-${row.id}`] ? 'Loader2' : 'RotateCcw'"
                :size="14"
                :class="{ 'animate-spin': actionLoading[`reboot-${row.id}`] }"
              />
            </button>
            <button
              @click.stop="handleFactoryReset(row)"
              :disabled="actionLoading[`reset-${row.id}`]"
              class="p-1.5 rounded-lg text-theme-muted hover:text-error hover:bg-theme-tertiary transition-colors"
              title="Factory reset"
            >
              <Icon
                :name="actionLoading[`reset-${row.id}`] ? 'Loader2' : 'Trash2'"
                :size="14"
                :class="{ 'animate-spin': actionLoading[`reset-${row.id}`] }"
              />
            </button>
          </div>
        </template>
      </ResponsiveTable>
    </div>
  </div>
</template>
