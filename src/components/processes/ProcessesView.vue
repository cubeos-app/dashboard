<script setup>
/**
 * ProcessesView.vue
 *
 * Sprint 4 G3: Full process manager with search, sortable table,
 * top consumers, detail panel, kill/terminate actions.
 *
 * Features:
 * - Debounced search (300ms)
 * - Client-side sortable columns (PID, Name, CPU%, Memory%)
 * - Top CPU/Memory collapsible sections with bar visualization
 * - Process detail panel with terminate/kill
 * - Desktop table + mobile cards (responsive)
 * - 10s polling with cleanup on unmount
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProcessesStore } from '@/stores/processes'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const processesStore = useProcessesStore()
const { signal } = useAbortOnUnmount()

// ==========================================
// Loading & refresh state
// ==========================================

const initialLoaded = ref(false)
const refreshing = ref(false)

// ==========================================
// Search (debounced 300ms)
// ==========================================

const localSearch = ref('')
let searchTimeout = null

function onSearchInput(value) {
  localSearch.value = value
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!value.trim()) {
    processesStore.clearSearch()
    return
  }

  searchTimeout = setTimeout(() => {
    processesStore.searchProcesses(value)
  }, 300)
}

function clearSearch() {
  localSearch.value = ''
  processesStore.clearSearch()
}

// ==========================================
// Sorting (client-side)
// ==========================================

const sortField = ref('cpu')
const sortDir = ref('desc')

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'desc'
  }
}

const sortedProcesses = computed(() => {
  const list = [...processesStore.processes]
  const dir = sortDir.value === 'asc' ? 1 : -1

  return list.sort((a, b) => {
    let aVal, bVal
    switch (sortField.value) {
      case 'pid':
        aVal = a.pid ?? 0; bVal = b.pid ?? 0; break
      case 'name':
        aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase()
        return dir * aVal.localeCompare(bVal)
      case 'cpu':
        aVal = a.cpu_percent ?? a.cpu ?? 0; bVal = b.cpu_percent ?? b.cpu ?? 0; break
      case 'memory':
        aVal = a.memory_percent ?? a.memory ?? 0; bVal = b.memory_percent ?? b.memory ?? 0; break
      default:
        return 0
    }
    return dir * (aVal - bVal)
  })
})

const displayedProcesses = computed(() => {
  if (processesStore.searchQuery) return processesStore.searchResults
  return sortedProcesses.value
})

// ==========================================
// Top consumers (collapsible)
// ==========================================

const showTopCpu = ref(true)
const showTopMemory = ref(true)

// ==========================================
// Process detail panel
// ==========================================

async function selectProcess(proc) {
  if (processesStore.selectedProcess?.pid === proc.pid) {
    processesStore.clearSelected()
    return
  }
  await processesStore.fetchProcess(proc.pid)
}

// ==========================================
// Helpers
// ==========================================

function stateClass(state) {
  if (!state) return 'text-theme-muted'
  const s = state.toLowerCase()
  if (s === 'running') return 'text-success'
  if (s === 'sleeping' || s === 'idle') return 'text-theme-tertiary'
  if (s === 'zombie') return 'text-error'
  if (s === 'stopped') return 'text-warning'
  return 'text-theme-muted'
}

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function cpuVal(proc) {
  return proc.cpu_percent ?? proc.cpu ?? 0
}

function memVal(proc) {
  return proc.memory_percent ?? proc.memory ?? 0
}

// ==========================================
// Polling & lifecycle
// ==========================================

let pollInterval = null

onMounted(async () => {
  const s = signal()
  await processesStore.loadAll({ signal: s })
  initialLoaded.value = true

  pollInterval = setInterval(() => {
    processesStore.fetchAll()
    processesStore.fetchStats()
  }, 10000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (searchTimeout) clearTimeout(searchTimeout)
  processesStore.clearSelected()
  processesStore.clearSearch()
})

async function refresh() {
  refreshing.value = true
  try {
    await processesStore.loadAll()
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-theme-primary">Processes</h1>
        <p class="text-sm text-theme-tertiary mt-1">System process management</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-theme-muted">
          {{ processesStore.totalCount }} total
        </span>
        <button
          @click="refresh"
          :disabled="refreshing"
          class="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': refreshing }" />
        </button>
      </div>
    </div>

    <!-- Skeleton loading on initial load -->
    <SkeletonLoader v-if="!initialLoaded && processesStore.loading" variant="list" :count="6" />

    <!-- Error state -->
    <div
      v-else-if="processesStore.error && !initialLoaded"
      class="p-6 rounded-xl bg-error-muted border border-error/20 text-center"
    >
      <Icon name="AlertTriangle" :size="24" class="text-error mx-auto mb-2" />
      <p class="text-sm text-error font-medium mb-1">Failed to load processes</p>
      <p class="text-xs text-theme-tertiary mb-3">{{ processesStore.error }}</p>
      <button
        @click="refresh"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-card border border-theme-primary text-sm text-theme-primary hover:bg-theme-secondary transition-colors"
      >
        <Icon name="RefreshCw" :size="14" />
        Retry
      </button>
    </div>

    <!-- Main content (after initial load) -->
    <template v-else-if="initialLoaded">
      <!-- Search bar -->
      <div class="relative">
        <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted z-10" />
        <input
          :value="localSearch"
          @input="onSearchInput($event.target.value)"
          type="text"
          placeholder="Search processes by name..."
          class="w-full pl-9 pr-9 py-2.5 rounded-xl border border-theme-primary bg-theme-card text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
        />
        <button
          v-if="localSearch"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-theme-muted hover:text-theme-primary transition-colors"
        >
          <Icon name="X" :size="14" />
        </button>
      </div>

      <!-- Stats summary row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 rounded-xl bg-theme-card border border-theme-primary">
          <span class="text-xs text-theme-tertiary block mb-1">Total</span>
          <span class="text-lg font-semibold text-theme-primary">{{ processesStore.totalCount }}</span>
        </div>
        <div class="p-3 rounded-xl bg-theme-card border border-theme-primary">
          <span class="text-xs text-theme-tertiary block mb-1">Running</span>
          <span class="text-lg font-semibold text-success">{{ processesStore.runningCount }}</span>
        </div>
        <div class="p-3 rounded-xl bg-theme-card border border-theme-primary">
          <span class="text-xs text-theme-tertiary block mb-1">Sleeping</span>
          <span class="text-lg font-semibold text-theme-secondary">{{ processesStore.sleepingCount }}</span>
        </div>
        <div class="p-3 rounded-xl bg-theme-card border border-theme-primary">
          <span class="text-xs text-theme-tertiary block mb-1">Zombie</span>
          <span class="text-lg font-semibold" :class="processesStore.zombieCount > 0 ? 'text-error' : 'text-theme-secondary'">
            {{ processesStore.zombieCount }}
          </span>
        </div>
      </div>

      <!-- Top Consumers -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Top CPU -->
        <div class="rounded-xl bg-theme-card border border-theme-primary overflow-hidden">
          <button
            @click="showTopCpu = !showTopCpu"
            class="w-full flex items-center justify-between p-4 text-left hover:bg-theme-secondary transition-colors"
          >
            <div class="flex items-center gap-2">
              <Icon name="Cpu" :size="16" class="text-accent" />
              <span class="text-sm font-medium text-theme-secondary">Top CPU Consumers</span>
            </div>
            <Icon
              name="ChevronRight" :size="16"
              class="text-theme-muted transition-transform duration-200"
              :class="{ 'rotate-90': showTopCpu }"
            />
          </button>
          <div v-if="showTopCpu" class="px-4 pb-4 space-y-2">
            <div
              v-for="proc in processesStore.topCpu.slice(0, 5)"
              :key="'tcpu-' + proc.pid"
              class="flex items-center gap-3 cursor-pointer hover:bg-theme-secondary rounded-lg px-1 py-0.5 transition-colors"
              @click="selectProcess(proc)"
            >
              <span class="text-xs font-mono text-theme-muted w-12 text-right">{{ proc.pid }}</span>
              <span class="text-sm text-theme-primary truncate flex-1">{{ proc.name }}</span>
              <div class="w-24 h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
                <div
                  class="h-full rounded-full bg-accent"
                  :style="{ width: `${Math.min(cpuVal(proc), 100)}%` }"
                ></div>
              </div>
              <span class="text-xs font-medium text-theme-secondary w-12 text-right">
                {{ cpuVal(proc).toFixed(1) }}%
              </span>
            </div>
            <p v-if="!processesStore.topCpu.length" class="text-xs text-theme-muted py-2 text-center">
              No data available
            </p>
          </div>
        </div>

        <!-- Top Memory -->
        <div class="rounded-xl bg-theme-card border border-theme-primary overflow-hidden">
          <button
            @click="showTopMemory = !showTopMemory"
            class="w-full flex items-center justify-between p-4 text-left hover:bg-theme-secondary transition-colors"
          >
            <div class="flex items-center gap-2">
              <Icon name="Server" :size="16" class="text-success" />
              <span class="text-sm font-medium text-theme-secondary">Top Memory Consumers</span>
            </div>
            <Icon
              name="ChevronRight" :size="16"
              class="text-theme-muted transition-transform duration-200"
              :class="{ 'rotate-90': showTopMemory }"
            />
          </button>
          <div v-if="showTopMemory" class="px-4 pb-4 space-y-2">
            <div
              v-for="proc in processesStore.topMemory.slice(0, 5)"
              :key="'tmem-' + proc.pid"
              class="flex items-center gap-3 cursor-pointer hover:bg-theme-secondary rounded-lg px-1 py-0.5 transition-colors"
              @click="selectProcess(proc)"
            >
              <span class="text-xs font-mono text-theme-muted w-12 text-right">{{ proc.pid }}</span>
              <span class="text-sm text-theme-primary truncate flex-1">{{ proc.name }}</span>
              <div class="w-24 h-1.5 rounded-full bg-theme-tertiary overflow-hidden">
                <div
                  class="h-full rounded-full bg-success"
                  :style="{ width: `${Math.min(memVal(proc), 100)}%` }"
                ></div>
              </div>
              <span class="text-xs font-medium text-theme-secondary w-12 text-right">
                {{ memVal(proc).toFixed(1) }}%
              </span>
            </div>
            <p v-if="!processesStore.topMemory.length" class="text-xs text-theme-muted py-2 text-center">
              No data available
            </p>
          </div>
        </div>
      </div>

      <!-- Process Table: Desktop -->
      <div class="hidden md:block rounded-xl bg-theme-card border border-theme-primary overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-theme-primary bg-theme-secondary">
                <th
                  @click="toggleSort('pid')"
                  class="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wide cursor-pointer hover:text-theme-secondary select-none"
                >
                  <span class="inline-flex items-center gap-1">
                    PID
                    <Icon
                      v-if="sortField === 'pid'"
                      :name="sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'"
                      :size="12"
                      class="text-accent"
                    />
                    <Icon v-else name="ArrowUpDown" :size="12" class="text-theme-muted" />
                  </span>
                </th>
                <th
                  @click="toggleSort('name')"
                  class="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wide cursor-pointer hover:text-theme-secondary select-none"
                >
                  <span class="inline-flex items-center gap-1">
                    Name
                    <Icon
                      v-if="sortField === 'name'"
                      :name="sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'"
                      :size="12"
                      class="text-accent"
                    />
                    <Icon v-else name="ArrowUpDown" :size="12" class="text-theme-muted" />
                  </span>
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wide">
                  User
                </th>
                <th
                  @click="toggleSort('cpu')"
                  class="px-4 py-3 text-right text-xs font-medium text-theme-tertiary uppercase tracking-wide cursor-pointer hover:text-theme-secondary select-none"
                >
                  <span class="inline-flex items-center gap-1 justify-end">
                    CPU%
                    <Icon
                      v-if="sortField === 'cpu'"
                      :name="sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'"
                      :size="12"
                      class="text-accent"
                    />
                    <Icon v-else name="ArrowUpDown" :size="12" class="text-theme-muted" />
                  </span>
                </th>
                <th
                  @click="toggleSort('memory')"
                  class="px-4 py-3 text-right text-xs font-medium text-theme-tertiary uppercase tracking-wide cursor-pointer hover:text-theme-secondary select-none"
                >
                  <span class="inline-flex items-center gap-1 justify-end">
                    Memory%
                    <Icon
                      v-if="sortField === 'memory'"
                      :name="sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'"
                      :size="12"
                      class="text-accent"
                    />
                    <Icon v-else name="ArrowUpDown" :size="12" class="text-theme-muted" />
                  </span>
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wide">
                  State
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-theme-tertiary uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="proc in displayedProcesses"
                :key="proc.pid"
                @click="selectProcess(proc)"
                class="border-b border-theme-primary last:border-b-0 cursor-pointer hover:bg-theme-secondary transition-colors"
                :class="{ 'bg-theme-secondary': processesStore.selectedProcess?.pid === proc.pid }"
              >
                <td class="px-4 py-2.5 text-theme-muted font-mono text-xs">{{ proc.pid }}</td>
                <td class="px-4 py-2.5 text-theme-primary font-medium truncate max-w-[200px]">{{ proc.name }}</td>
                <td class="px-4 py-2.5 text-theme-tertiary text-xs">{{ proc.user || '-' }}</td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-xs font-medium" :class="cpuVal(proc) > 50 ? 'text-warning' : 'text-theme-secondary'">
                    {{ cpuVal(proc).toFixed(1) }}%
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-xs font-medium" :class="memVal(proc) > 50 ? 'text-warning' : 'text-theme-secondary'">
                    {{ memVal(proc).toFixed(1) }}%
                  </span>
                </td>
                <td class="px-4 py-2.5">
                  <span class="text-xs capitalize" :class="stateClass(proc.state)">{{ proc.state || '-' }}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      @click.stop="processesStore.terminateProcess(proc.pid, proc.name)"
                      class="p-1 rounded text-theme-muted hover:text-warning hover:bg-warning-muted transition-colors"
                      title="Terminate (SIGTERM)"
                    >
                      <Icon name="AlertTriangle" :size="14" />
                    </button>
                    <button
                      @click.stop="processesStore.killProcess(proc.pid, proc.name)"
                      class="p-1 rounded text-theme-muted hover:text-error hover:bg-error-muted transition-colors"
                      title="Kill (SIGKILL)"
                    >
                      <Icon name="Skull" :size="14" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty state (desktop) -->
        <div
          v-if="displayedProcesses.length === 0"
          class="py-12 text-center"
        >
          <Icon name="Search" :size="24" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-tertiary">
            {{ processesStore.searchQuery ? 'No processes match your search' : 'No processes found' }}
          </p>
        </div>
      </div>

      <!-- Process Cards: Mobile -->
      <div class="md:hidden space-y-2">
        <div
          v-for="proc in displayedProcesses"
          :key="'m-' + proc.pid"
          @click="selectProcess(proc)"
          class="p-3 rounded-xl bg-theme-card border border-theme-primary cursor-pointer"
          :class="{ 'border-accent': processesStore.selectedProcess?.pid === proc.pid }"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-mono text-theme-muted">{{ proc.pid }}</span>
              <span class="text-sm font-medium text-theme-primary truncate">{{ proc.name }}</span>
            </div>
            <span class="text-xs capitalize" :class="stateClass(proc.state)">{{ proc.state || '-' }}</span>
          </div>
          <div class="flex items-center gap-4 text-xs">
            <div class="flex items-center gap-1.5 flex-1">
              <span class="text-theme-muted">CPU</span>
              <div class="flex-1 h-1 rounded-full bg-theme-tertiary overflow-hidden">
                <div class="h-full rounded-full bg-accent" :style="{ width: `${Math.min(cpuVal(proc), 100)}%` }"></div>
              </div>
              <span class="text-theme-secondary font-medium w-10 text-right">{{ cpuVal(proc).toFixed(1) }}%</span>
            </div>
            <div class="flex items-center gap-1.5 flex-1">
              <span class="text-theme-muted">Mem</span>
              <div class="flex-1 h-1 rounded-full bg-theme-tertiary overflow-hidden">
                <div class="h-full rounded-full bg-success" :style="{ width: `${Math.min(memVal(proc), 100)}%` }"></div>
              </div>
              <span class="text-theme-secondary font-medium w-10 text-right">{{ memVal(proc).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <!-- Empty state (mobile) -->
        <div
          v-if="displayedProcesses.length === 0"
          class="py-12 text-center"
        >
          <Icon name="Search" :size="24" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-tertiary">
            {{ processesStore.searchQuery ? 'No processes match your search' : 'No processes found' }}
          </p>
        </div>
      </div>

      <!-- Process Detail Panel -->
      <div
        v-if="processesStore.hasSelected"
        class="p-5 rounded-xl bg-theme-card border border-theme-primary"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Icon name="Terminal" :size="16" class="text-accent" />
            <h3 class="text-sm font-medium text-theme-primary">
              {{ processesStore.selectedProcess.name }}
              <span class="text-theme-muted font-mono ml-1">PID {{ processesStore.selectedProcess.pid }}</span>
            </h3>
          </div>
          <button
            @click="processesStore.clearSelected()"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            <Icon name="X" :size="16" />
          </button>
        </div>

        <!-- Detail grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">User</span>
            <span class="text-theme-primary font-medium">{{ processesStore.selectedProcess.user || '-' }}</span>
          </div>
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">State</span>
            <span class="text-theme-primary font-medium capitalize">{{ processesStore.selectedProcess.state || processesStore.selectedProcess.status || '-' }}</span>
          </div>
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">CPU</span>
            <span class="text-theme-primary font-medium">{{ cpuVal(processesStore.selectedProcess).toFixed(1) }}%</span>
          </div>
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">Memory</span>
            <span class="text-theme-primary font-medium">{{ memVal(processesStore.selectedProcess).toFixed(1) }}%</span>
          </div>
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">Threads</span>
            <span class="text-theme-primary font-medium">{{ processesStore.selectedProcess.threads ?? processesStore.selectedProcess.num_threads ?? '-' }}</span>
          </div>
          <div class="flex justify-between p-2 rounded-lg bg-theme-secondary">
            <span class="text-theme-tertiary">Started</span>
            <span class="text-theme-primary font-medium">{{ formatTimestamp(processesStore.selectedProcess.started_at ?? processesStore.selectedProcess.create_time) }}</span>
          </div>
        </div>

        <!-- Command line -->
        <div v-if="processesStore.selectedProcess.cmdline || processesStore.selectedProcess.command" class="mb-4">
          <span class="text-xs text-theme-tertiary block mb-1">Command</span>
          <div class="p-2 rounded-lg bg-theme-secondary font-mono text-xs text-theme-secondary overflow-x-auto whitespace-nowrap">
            {{ processesStore.selectedProcess.cmdline || processesStore.selectedProcess.command || '-' }}
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <button
            @click="processesStore.terminateProcess(processesStore.selectedProcess.pid, processesStore.selectedProcess.name)"
            :disabled="processesStore.terminating"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning-muted text-warning text-sm font-medium
                   hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Icon v-if="processesStore.terminating" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="AlertTriangle" :size="14" />
            Terminate
          </button>
          <button
            @click="processesStore.killProcess(processesStore.selectedProcess.pid, processesStore.selectedProcess.name)"
            :disabled="processesStore.killing"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-muted text-error text-sm font-medium
                   hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Icon v-if="processesStore.killing" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Skull" :size="14" />
            Kill
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
