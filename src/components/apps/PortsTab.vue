<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const store = useAppManagerStore()

// Fetch port data when tab mounts — appManagerStore.init() is not called
// by AppsPage.vue, so PortsTab must fetch its own data.
onMounted(async () => {
  await Promise.all([
    store.fetchPorts(),
    store.fetchPortStats(),
    store.fetchReservedPorts()
  ])
})

const showAllocateModal = ref(false)
const allocating = ref(false)
const newPort = ref({ app_name: '', port: null, protocol: 'tcp', description: '' })
const showReservedPorts = ref(false)

// Stats percentages for proportion bar
const usedPercent = computed(() => {
  if (!store.portStats.total) return 0
  return Math.round((store.portStats.used / store.portStats.total) * 100)
})

const reservedPercent = computed(() => {
  if (!store.portStats.total) return 0
  return Math.round((store.reservedPortCount / store.portStats.total) * 100)
})

const RESERVED_PORTS = [22, 53, 67, 68, 80, 123, 443, 5000]
const RESERVED_RANGES = [[6000, 6099]]

function isReservedPort(port) {
  if (!port) return false
  if (RESERVED_PORTS.includes(port)) return true
  return RESERVED_RANGES.some(([min, max]) => port >= min && port <= max)
}

async function allocatePort() {
  if (newPort.value.port && isReservedPort(newPort.value.port)) {
    store.error = `Port ${newPort.value.port} is reserved by CubeOS infrastructure`
    return
  }
  allocating.value = true
  try {
    await store.allocatePort(newPort.value)
    showAllocateModal.value = false
    newPort.value = { app_name: '', port: null, protocol: 'tcp', description: '' }
  } catch (e) {}
  finally { allocating.value = false }
}

async function findNextPort() {
  const port = await store.getAvailablePort('user')
  if (port) newPort.value.port = port
}

async function releasePort(port, protocol) {
  if (!await confirm({
    title: 'Release Port',
    message: `Release port ${port}/${protocol}?`,
    confirmText: 'Release',
    variant: 'warning'
  })) return
  try { await store.releasePort(port, protocol) } catch (e) {}
}
</script>

<template>
  <div>
    <!-- Info Banner -->
    <div class="bg-accent-muted border border-accent/30 rounded-lg p-4 mb-6">
      <div class="flex items-start">
        <Icon name="Info" :size="20" class="text-accent mt-0.5" />
        <div class="ml-3 text-sm">
          <p class="text-theme-primary font-medium">Port Allocation Ranges</p>
          <p class="mt-1 text-theme-secondary">
            <strong>System apps:</strong> 6000-6099 | <strong>User apps:</strong> 6100-6999 | <strong>Reserved:</strong> 22, 53, 80, 443, 5000
          </p>
        </div>
      </div>
    </div>

    <!-- Port Stats Header -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <!-- Used -->
      <div class="p-3 rounded-lg border border-theme-primary bg-theme-card">
        <p class="text-[10px] text-theme-muted uppercase tracking-wider">Used</p>
        <p class="text-lg font-semibold text-accent">{{ store.portStats.used }}</p>
        <p class="text-[10px] text-theme-muted" v-if="store.portStats.total > 0">
          {{ usedPercent }}% of total
        </p>
      </div>
      <!-- Available -->
      <div class="p-3 rounded-lg border border-theme-primary bg-theme-card">
        <p class="text-[10px] text-theme-muted uppercase tracking-wider">Available</p>
        <p class="text-lg font-semibold text-success">{{ store.portStats.available }}</p>
        <p class="text-[10px] text-theme-muted" v-if="store.portStats.total > 0">
          {{ Math.round((store.portStats.available / store.portStats.total) * 100) }}% of total
        </p>
      </div>
      <!-- Reserved -->
      <div class="p-3 rounded-lg border border-theme-primary bg-theme-card">
        <p class="text-[10px] text-theme-muted uppercase tracking-wider">Reserved</p>
        <p class="text-lg font-semibold text-warning">{{ store.reservedPortCount }}</p>
        <p class="text-[10px] text-theme-muted" v-if="store.portStats.total > 0">
          {{ reservedPercent }}% of total
        </p>
      </div>
    </div>

    <!-- Proportion Bar -->
    <div v-if="store.portStats.total > 0" class="h-2 rounded-full bg-theme-tertiary overflow-hidden flex mb-4">
      <div class="h-full bg-accent transition-all duration-300"
        :style="{ width: usedPercent + '%' }"></div>
      <div class="h-full bg-warning transition-all duration-300"
        :style="{ width: reservedPercent + '%' }"></div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <span class="text-sm text-theme-secondary">{{ store.ports.length }} allocated ports</span>
      <button @click="showAllocateModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors">
        <Icon name="Plus" :size="16" />Allocate Port
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="store.ports.length === 0" class="text-center py-12">
      <Icon name="Plug" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No ports allocated</h3>
      <p class="mt-1 text-sm text-theme-secondary">Allocate ports to apps to manage network access</p>
    </div>

    <!-- Ports Table -->
    <ResponsiveTable
      v-else
      :columns="[
        { key: 'port', label: 'Port' },
        { key: 'protocol', label: 'Protocol' },
        { key: 'app_name', label: 'Application' },
        { key: 'description', label: 'Description' }
      ]"
      :rows="store.ports"
      :row-key="(row) => `${row.port}-${row.protocol}`"
      compact
    >
      <template #cell-port="{ row }">
        <span class="font-mono font-medium text-theme-primary">{{ row.port }}</span>
      </template>
      <template #cell-protocol="{ row }">
        <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase', row.protocol === 'tcp' ? 'bg-accent-muted text-accent' : 'bg-warning-muted text-warning']">{{ row.protocol }}</span>
      </template>
      <template #cell-app_name="{ row }">
        <span class="text-theme-primary">{{ row.app_name || '-' }}</span>
      </template>
      <template #cell-description="{ row }">
        <span class="text-theme-secondary">{{ row.description || '-' }}</span>
      </template>
      <template #row-actions="{ row }">
        <button @click="releasePort(row.port, row.protocol)" class="p-1.5 text-error hover:bg-error-muted rounded transition-colors" title="Release port" :aria-label="'Release port ' + row.port + '/' + row.protocol">
          <Icon name="Trash2" :size="14" />
        </button>
      </template>
    </ResponsiveTable>

    <!-- Reserved System Ports -->
    <div v-if="store.reservedPorts.length > 0" class="mt-6">
      <button
        @click="showReservedPorts = !showReservedPorts"
        class="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors w-full"
        :aria-expanded="showReservedPorts"
        aria-label="Toggle reserved system ports"
      >
        <Icon name="ChevronDown" :size="16"
          class="transition-transform duration-200"
          :class="{ 'rotate-180': showReservedPorts }" />
        <span class="font-medium">Reserved System Ports</span>
        <span class="text-[10px] text-theme-muted">({{ store.reservedPortCount }})</span>
      </button>

      <div v-show="showReservedPorts" class="mt-3 bg-theme-secondary rounded-lg border border-theme-primary overflow-hidden transition-all duration-200">
        <ResponsiveTable
          :columns="[
            { key: 'port', label: 'Port' },
            { key: 'protocol', label: 'Protocol' },
            { key: 'service', label: 'Service' },
            { key: 'description', label: 'Description' }
          ]"
          :rows="store.reservedPorts"
          :row-key="(row) => `reserved-${row.port}-${row.protocol}`"
          compact
        >
          <template #cell-port="{ row }">
            <span class="font-mono text-theme-muted">{{ row.port }}</span>
          </template>
          <template #cell-protocol="{ row }">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase bg-theme-tertiary text-theme-muted">{{ row.protocol }}</span>
          </template>
          <template #cell-service="{ row }">
            <span class="text-theme-muted">{{ row.service || '-' }}</span>
          </template>
          <template #cell-description="{ row }">
            <span class="text-theme-muted">{{ row.description || '-' }}</span>
          </template>
        </ResponsiveTable>
      </div>
    </div>

    <!-- Allocate Modal -->
    <div v-if="showAllocateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-theme-overlay backdrop-blur-sm" @click="showAllocateModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-label="Allocate Port">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Allocate Port</h3>
            <button @click="showAllocateModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="allocatePort" class="space-y-4">
            <div>
              <label for="alloc-app" class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <select id="alloc-app" v-model="newPort.app_name" required class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <option value="">Select an app...</option>
                <option v-for="app in store.apps" :key="app.id" :value="app.name">{{ app.display_name || app.name }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="alloc-port" class="block text-sm font-medium text-theme-secondary mb-1">Port</label>
                <div class="flex gap-2">
                  <input id="alloc-port" v-model.number="newPort.port" type="number" min="1024" max="65535" placeholder="Auto" class="flex-1 rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <button type="button" @click="findNextPort" class="px-3 py-2 text-xs font-medium text-accent hover:bg-accent-muted rounded-md transition-colors" title="Find next available" aria-label="Find next available port">
                    <Icon name="Search" :size="14" />
                  </button>
                </div>
              </div>
              <div>
                <label for="alloc-protocol" class="block text-sm font-medium text-theme-secondary mb-1">Protocol</label>
                <select id="alloc-protocol" v-model="newPort.protocol" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                </select>
              </div>
            </div>
            <div>
              <label for="alloc-description" class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
              <input id="alloc-description" v-model="newPort.description" type="text" placeholder="Web UI, API, etc." class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showAllocateModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="allocating" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">{{ allocating ? 'Allocating...' : 'Allocate' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
