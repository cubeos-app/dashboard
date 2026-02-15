<script setup>
/**
 * LogsView.vue
 *
 * Sprint 7 Group 4: Extended log viewer.
 * Adds boot, file, HAL hardware, HAL journal, and HAL kernel tabs
 * to the existing system, container, kernel, and errors tabs.
 *
 * Migrated from inline api.get() to the centralized logsStore.
 *
 * Tabs:
 *   - System      → logsStore.fetchJournal (existing)
 *   - Container   → logsStore.fetchContainerLog (existing)
 *   - Kernel      → logsStore.fetchKernel (existing)
 *   - Errors      → logsStore.fetchErrors (existing)
 *   - Boot        → logsStore.fetchBoot (NEW)
 *   - File        → logsStore.fetchFile (NEW)
 *   - HAL Hardware → logsStore.fetchHALHardware / fetchHALCategory (NEW)
 *   - HAL Journal → logsStore.fetchHALJournal (NEW)
 *   - HAL Kernel  → logsStore.fetchHALKernel (NEW)
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/api/client'
import { useLogsStore } from '@/stores/logs'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const logsStore = useLogsStore()
const { signal, abort } = useAbortOnUnmount()

// ==========================================
// State
// ==========================================

// Sprint 5: Removed localLoading/localError — store handles loading/error state.
// localLogs retained for post-processing (store entries → display format).
const localLogs = ref([])

// Filters
const activeTab = ref('system')
const selectedUnit = ref('')
const selectedContainer = ref('')
const searchQuery = ref('')
const logLevel = ref('all')
const lineCount = ref(100)
const filePath = ref('/var/log/syslog')
const halCategory = ref('')

// Available options
const units = ref([])
const containers = ref([])

// ==========================================
// Tabs
// ==========================================

const tabs = [
  { id: 'system', label: 'System', icon: 'Monitor' },
  { id: 'container', label: 'Container', icon: 'Box' },
  { id: 'kernel', label: 'Kernel', icon: 'Cpu' },
  { id: 'errors', label: 'Errors', icon: 'AlertTriangle' },
  { id: 'boot', label: 'Boot', icon: 'Power' },
  { id: 'file', label: 'File', icon: 'FileText' },
  { id: 'hal-hardware', label: 'HAL Hardware', icon: 'Wrench' },
  { id: 'hal-journal', label: 'HAL Journal', icon: 'ScrollText' },
  { id: 'hal-kernel', label: 'HAL Kernel', icon: 'Terminal' }
]

const logLevels = [
  { value: 'all', label: 'All Levels' },
  { value: '0', label: 'Emergency' },
  { value: '1', label: 'Alert' },
  { value: '2', label: 'Critical' },
  { value: '3', label: 'Error' },
  { value: '4', label: 'Warning' },
  { value: '5', label: 'Notice' },
  { value: '6', label: 'Info' },
  { value: '7', label: 'Debug' }
]

const halCategories = [
  { value: '', label: 'All Categories' },
  { value: 'power', label: 'Power' },
  { value: 'network', label: 'Network' },
  { value: 'storage', label: 'Storage' },
  { value: 'sensors', label: 'Sensors' },
  { value: 'gpio', label: 'GPIO' },
  { value: 'i2c', label: 'I2C' },
  { value: 'watchdog', label: 'Watchdog' },
  { value: 'rtc', label: 'RTC' }
]

const commonLogFiles = [
  '/var/log/syslog',
  '/var/log/auth.log',
  '/var/log/kern.log',
  '/var/log/daemon.log',
  '/var/log/dpkg.log',
  '/var/log/apt/history.log'
]

// ==========================================
// Computed
// ==========================================

/** Whether the active tab supports log-level filtering */
const supportsLevelFilter = computed(() => {
  return ['system', 'kernel', 'errors', 'hal-journal', 'hal-kernel'].includes(activeTab.value)
})

/** Whether the active tab is container (needs container selector) */
const isContainerTab = computed(() => activeTab.value === 'container')

/** Whether the active tab is system (needs unit selector) */
const isSystemTab = computed(() => activeTab.value === 'system')

/** Whether the active tab is file (needs path input) */
const isFileTab = computed(() => activeTab.value === 'file')

/** Whether the active tab is HAL hardware (has category filter) */
const isHALHardwareTab = computed(() => activeTab.value === 'hal-hardware')

// ==========================================
// Data fetching
// ==========================================

async function fetchOptions() {
  try {
    const s = signal()
    const [, servicesResp] = await Promise.all([
      logsStore.fetchUnits({ signal: s }),
      api.get('/apps', {}, { signal: s }).catch(() => ({ apps: [] }))
    ])
    units.value = logsStore.units || []
    const appsList = servicesResp?.apps || []
    containers.value = appsList
      .filter(s => s.status?.running || s.state === 'running')
      .map(s => s.name)
  } catch {
    // Options fetch failed silently
  }
}

async function fetchLogs() {
  // Reset store error before new fetch
  logsStore.error = null

  abort()
  const s = signal()

  try {
    const params = { lines: lineCount.value }
    if (searchQuery.value) params.grep = searchQuery.value
    if (logLevel.value !== 'all' && supportsLevelFilter.value) {
      params.priority = logLevel.value
    }

    switch (activeTab.value) {
      case 'system':
        if (selectedUnit.value) params.unit = selectedUnit.value
        await logsStore.fetchJournal(params, { signal: s })
        break

      case 'container':
        if (!selectedContainer.value) {
          localLogs.value = []
          return
        }
        await logsStore.fetchContainerLog(selectedContainer.value, params, { signal: s })
        break

      case 'kernel':
        await logsStore.fetchKernel(params, { signal: s })
        break

      case 'errors':
        params.hours = 24
        await logsStore.fetchErrors(params, { signal: s })
        break

      case 'boot':
        await logsStore.fetchBoot(params, { signal: s })
        break

      case 'file':
        if (!filePath.value) {
          localLogs.value = []
          return
        }
        await logsStore.fetchFile(filePath.value, params, { signal: s })
        break

      case 'hal-hardware':
        if (halCategory.value) {
          await logsStore.fetchHALCategory(halCategory.value, params, { signal: s })
        } else {
          await logsStore.fetchHALHardware(params, { signal: s })
        }
        break

      case 'hal-journal':
        await logsStore.fetchHALJournal(params, { signal: s })
        break

      case 'hal-kernel':
        await logsStore.fetchHALKernel(params, { signal: s })
        break
    }

    // Post-process from store entries
    processEntries()

  } catch (e) {
    if (e.name === 'AbortError') return
    logsStore.error = e.message
    localLogs.value = []
  }
}

/**
 * Process raw store entries into a uniform display format.
 * Container and kernel logs need special parsing.
 */
function processEntries() {
  const raw = logsStore.entries || []

  if (activeTab.value === 'container') {
    localLogs.value = raw.map(line => {
      const match = typeof line === 'string'
        ? line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*(.*)$/)
        : null
      if (match) return { timestamp: match[1], message: match[2], container: selectedContainer.value }
      if (typeof line === 'object') return line
      return { timestamp: '', message: line, container: selectedContainer.value }
    })
  } else if (activeTab.value === 'kernel' || activeTab.value === 'hal-kernel') {
    localLogs.value = raw.map(line => {
      if (typeof line === 'object') return line
      const match = typeof line === 'string'
        ? (line.match(/^\[?\s*(\d+\.?\d*)\]?\s*(.*)$/) || line.match(/^(\S+\s+\d+\s+\d+:\d+:\d+)\s+\S+\s+kernel:\s*(.*)$/))
        : null
      return {
        timestamp: match ? match[1] : '',
        message: match ? match[2] : line,
        level: typeof line === 'string' && line.toLowerCase().includes('error') ? 'err' :
               typeof line === 'string' && line.toLowerCase().includes('warn') ? 'warn' : 'info'
      }
    })
  } else {
    // System, errors, boot, file, HAL logs — entries are usually objects already
    localLogs.value = raw.map(entry => {
      if (typeof entry === 'object') return entry
      return { timestamp: '', message: entry }
    })
  }
}

// ==========================================
// Auto-refresh
// ==========================================

let refreshInterval = null
const autoRefresh = ref(false)

watch(autoRefresh, (val) => {
  if (val) {
    refreshInterval = setInterval(fetchLogs, 5000)
  } else {
    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = null
  }
})

// Re-fetch on filter changes (debounced to prevent rapid fire)
let filterDebounce = null
watch([activeTab, selectedUnit, selectedContainer, logLevel, lineCount, halCategory], () => {
  if (filterDebounce) clearTimeout(filterDebounce)
  filterDebounce = setTimeout(() => fetchLogs(), 150)
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(() => {
  fetchOptions()
  fetchLogs()
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  if (filterDebounce) clearTimeout(filterDebounce)
})

// ==========================================
// Helpers
// ==========================================

function formatTimestamp(ts) {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ts
    return date.toLocaleString()
  } catch {
    return ts
  }
}

function levelBadgeClass(level) {
  if (!level) return 'bg-theme-tertiary text-theme-secondary'
  const l = level.toString().toLowerCase()
  if (l.includes('err') || l.includes('crit') || l.includes('alert') || l.includes('emerg') || l === '0' || l === '1' || l === '2' || l === '3') {
    return 'bg-error-muted text-error'
  }
  if (l.includes('warn') || l === '4') {
    return 'bg-warning-muted text-warning'
  }
  if (l.includes('notice') || l === '5') {
    return 'bg-accent-muted text-accent'
  }
  if (l.includes('info') || l === '6') {
    return 'bg-success-muted text-success'
  }
  return 'bg-theme-tertiary text-theme-tertiary'
}

function downloadLogs() {
  const content = localLogs.value
    .map(l => `${l.timestamp || ''} [${l.priority || l.level || ''}] ${l.unit || l.container || ''}: ${l.message || ''}`)
    .join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cubeos-logs-${activeTab.value}-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function handleFileSubmit() {
  if (filePath.value) fetchLogs()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-theme-primary">System Logs</h1>
        <p class="text-theme-tertiary mt-1">View and search system, container, and hardware logs</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Auto-refresh toggle -->
        <label class="flex items-center gap-2 text-sm text-theme-tertiary cursor-pointer">
          <div
            @click="autoRefresh = !autoRefresh"
            role="switch"
            :aria-checked="autoRefresh"
            aria-label="Auto-refresh logs"
            :class="[
              'relative w-9 h-5 rounded-full transition-colors cursor-pointer',
              autoRefresh ? 'bg-accent' : 'bg-theme-tertiary'
            ]"
          >
            <div
              :class="[
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-theme-primary transition-transform',
                autoRefresh ? 'translate-x-4' : 'translate-x-0'
              ]"
            />
          </div>
          Auto
        </label>

        <!-- Refresh -->
        <button
          @click="fetchLogs"
          :disabled="logsStore.loading"
          class="p-2 rounded-lg bg-theme-tertiary hover:bg-theme-secondary/20 transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh logs"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': logsStore.loading }" class="text-theme-secondary" />
        </button>

        <!-- Download -->
        <button
          @click="downloadLogs"
          :disabled="localLogs.length === 0"
          class="px-4 py-2 text-sm font-medium rounded-lg btn-accent hover:bg-[color:var(--accent-hover)] transition-colors disabled:opacity-50"
          aria-label="Download logs"
        >
          <Icon name="Download" :size="14" class="inline-block mr-1.5" />
          Download
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="logsStore.error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <p class="text-sm text-error">{{ logsStore.error }}</p>
    </div>

    <!-- Tabs (horizontal scrollable on mobile) -->
    <div class="border-b border-theme-primary overflow-x-auto">
      <nav class="flex gap-1 min-w-max" role="tablist" aria-label="Log sources">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-label="tab.label + ' logs'"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
          :class="activeTab === tab.id
            ? 'border-[color:var(--accent-primary)] text-accent'
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          <Icon :name="tab.icon" :size="14" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <!-- Unit selector (system tab) -->
      <div v-if="isSystemTab" class="flex-1 min-w-[180px]">
        <label for="log-service-unit" class="block text-xs font-medium text-theme-secondary mb-1">Service Unit</label>
        <select id="log-service-unit" v-model="selectedUnit" class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary">
          <option value="">All Services</option>
          <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </div>

      <!-- Container selector (container tab) -->
      <div v-if="isContainerTab" class="flex-1 min-w-[180px]">
        <label for="log-container" class="block text-xs font-medium text-theme-secondary mb-1">Container</label>
        <select id="log-container" v-model="selectedContainer" class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary">
          <option value="">Select a container...</option>
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- File path input (file tab) -->
      <div v-if="isFileTab" class="flex-1 min-w-[220px]">
        <label for="log-file-path" class="block text-xs font-medium text-theme-secondary mb-1">Log File Path</label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              id="log-file-path"
              v-model="filePath"
              type="text"
              placeholder="/var/log/syslog"
              @keyup.enter="handleFileSubmit"
              class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary font-mono"
            />
          </div>
          <button
            @click="handleFileSubmit"
            :disabled="!filePath || logsStore.loading"
            class="px-3 py-2 text-sm font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors disabled:opacity-50 shrink-0"
            aria-label="Load log file"
          >
            Load
          </button>
        </div>
        <!-- Quick file picks -->
        <div class="flex flex-wrap gap-1 mt-1.5">
          <button
            v-for="f in commonLogFiles"
            :key="f"
            @click="filePath = f; fetchLogs()"
            :aria-label="'Load ' + f"
            :class="[
              'px-2 py-0.5 text-xs rounded-full transition-colors',
              filePath === f
                ? 'bg-accent-muted text-accent'
                : 'bg-theme-tertiary text-theme-muted hover:text-theme-primary'
            ]"
          >
            {{ f.split('/').pop() }}
          </button>
        </div>
      </div>

      <!-- HAL category selector (hal-hardware tab) -->
      <div v-if="isHALHardwareTab" class="min-w-[150px]">
        <label for="log-hal-category" class="block text-xs font-medium text-theme-secondary mb-1">Category</label>
        <select id="log-hal-category" v-model="halCategory" class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary">
          <option v-for="cat in halCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>

      <!-- Log level (applicable tabs) -->
      <div v-if="supportsLevelFilter" class="min-w-[130px]">
        <label for="log-level" class="block text-xs font-medium text-theme-secondary mb-1">Level</label>
        <select id="log-level" v-model="logLevel" class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary">
          <option v-for="level in logLevels" :key="level.value" :value="level.value">{{ level.label }}</option>
        </select>
      </div>

      <!-- Line count -->
      <div class="min-w-[100px]">
        <label for="log-line-count" class="block text-xs font-medium text-theme-secondary mb-1">Lines</label>
        <select id="log-line-count" v-model="lineCount" class="w-full px-3 py-2 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
          <option :value="1000">1000</option>
        </select>
      </div>

      <!-- Search -->
      <div class="flex-1 min-w-[180px]">
        <label for="log-search" class="block text-xs font-medium text-theme-secondary mb-1">Search</label>
        <div class="relative">
          <input
            id="log-search"
            v-model="searchQuery"
            @keyup.enter="fetchLogs"
            type="text"
            placeholder="Search logs..."
            aria-label="Search logs"
            class="w-full px-3 py-2 pl-9 text-sm rounded-lg border border-theme-secondary bg-theme-input text-theme-primary"
          />
          <Icon name="Search" :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
        </div>
      </div>
    </div>

    <!-- Logs display -->
    <div class="bg-theme-card rounded-xl border border-theme-primary">
      <div class="px-4 py-3 border-b border-theme-primary flex items-center justify-between">
        <span class="text-sm text-theme-muted">{{ localLogs.length }} log entries</span>
        <span v-if="logsStore.loading" class="flex items-center gap-1.5 text-sm text-theme-muted">
          <Icon name="Loader2" :size="14" class="animate-spin" />
          Loading...
        </span>
      </div>

      <div class="max-h-[600px] overflow-y-auto font-mono text-sm">
        <!-- Empty state -->
        <div v-if="localLogs.length === 0 && !logsStore.loading" class="flex flex-col items-center justify-center py-12 text-center">
          <Icon name="FileText" :size="36" class="text-theme-muted mb-3" />
          <p class="text-sm text-theme-tertiary">No log entries found</p>
          <p v-if="isContainerTab && !selectedContainer" class="text-xs text-theme-muted mt-1">
            Select a container to view its logs
          </p>
          <p v-if="isFileTab && !filePath" class="text-xs text-theme-muted mt-1">
            Enter a file path and click Load
          </p>
          <template v-if="isSystemTab && !logsStore.error">
            <p class="text-xs text-theme-muted mt-2 max-w-sm">
              The system journal may not be accessible from the API container.
              Try the Boot or Kernel tabs which use alternative log sources.
            </p>
            <a
              href="//dozzle.cubeos.cube"
              target="_blank"
              rel="noopener"
              class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-muted text-accent hover:bg-theme-tertiary transition-colors"
            >
              <Icon name="ExternalLink" :size="12" />
              Open Dozzle for container logs
            </a>
          </template>
        </div>

        <!-- Log entries -->
        <div v-else class="divide-y divide-[color:var(--border-primary)]/50">
          <div
            v-for="(log, idx) in localLogs"
            :key="idx"
            class="px-4 py-2 hover:bg-theme-tertiary/30 transition-colors"
          >
            <div class="flex items-start gap-3">
              <!-- Timestamp -->
              <span class="text-theme-muted text-xs whitespace-nowrap shrink-0">
                {{ formatTimestamp(log.timestamp) }}
              </span>

              <!-- Level badge -->
              <span
                v-if="log.priority || log.level"
                class="px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap shrink-0"
                :class="levelBadgeClass(log.priority || log.level)"
              >
                {{ log.priority || log.level }}
              </span>

              <!-- Unit / container / category -->
              <span
                v-if="log.unit || log.container || log.category"
                class="text-accent text-xs whitespace-nowrap shrink-0"
              >
                {{ log.unit || log.container || log.category }}
              </span>

              <!-- Message -->
              <span class="text-theme-secondary break-all min-w-0">
                {{ log.message }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
