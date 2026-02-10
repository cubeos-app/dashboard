<script setup>
/**
 * RecentLogsWidget.vue — Session 3
 *
 * Shows last 8-10 log entries with severity coloring.
 * Uses /logs/journal endpoint via logsStore.
 * Severity badges (info/warn/error/critical). Click → navigates to Logs view.
 * Auto-refreshes every 15s.
 *
 * Design: Compact list. Each entry: relative timestamp, severity badge,
 * truncated message. Severity filter toggle at top. "View all" link.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()

// ─── State ────────────────────────────────────────────────────
const entries = ref([])
const loading = ref(false)
const error = ref(null)
const filter = ref('all') // 'all' | 'warning' | 'error'
const pollTimer = ref(null)

// ─── Severity config ──────────────────────────────────────────
const SEVERITY_CONFIG = {
  emerg:    { label: 'EMRG', color: 'bg-red-500/15 text-red-400',    order: 0 },
  alert:    { label: 'ALRT', color: 'bg-red-500/15 text-red-400',    order: 1 },
  crit:     { label: 'CRIT', color: 'bg-red-500/15 text-red-400',    order: 2 },
  critical: { label: 'CRIT', color: 'bg-red-500/15 text-red-400',    order: 2 },
  err:      { label: 'ERR',  color: 'bg-orange-500/15 text-orange-400', order: 3 },
  error:    { label: 'ERR',  color: 'bg-orange-500/15 text-orange-400', order: 3 },
  warning:  { label: 'WARN', color: 'bg-amber-500/15 text-amber-400',  order: 4 },
  warn:     { label: 'WARN', color: 'bg-amber-500/15 text-amber-400',  order: 4 },
  notice:   { label: 'NOTE', color: 'bg-sky-500/15 text-sky-400',     order: 5 },
  info:     { label: 'INFO', color: 'bg-theme-tertiary text-theme-muted', order: 6 },
  debug:    { label: 'DBG',  color: 'bg-theme-tertiary text-theme-muted', order: 7 },
}

function severityConfig(priority) {
  const key = String(priority || 'info').toLowerCase()
  return SEVERITY_CONFIG[key] || SEVERITY_CONFIG.info
}

function isWarningOrAbove(priority) {
  const cfg = severityConfig(priority)
  return cfg.order <= 4
}

function isErrorOrAbove(priority) {
  const cfg = severityConfig(priority)
  return cfg.order <= 3
}

// ─── Filtered entries ─────────────────────────────────────────
const filteredEntries = computed(() => {
  let data = entries.value
  if (filter.value === 'warning') {
    data = data.filter(e => isWarningOrAbove(e.priority || e.severity))
  } else if (filter.value === 'error') {
    data = data.filter(e => isErrorOrAbove(e.priority || e.severity))
  }
  return data.slice(0, 8)
})

const hasEntries = computed(() => filteredEntries.value.length > 0)

// ─── Relative time formatting ─────────────────────────────────
function relativeTime(timestamp) {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    const now = new Date()
    const diffMs = now - d
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  } catch {
    return ''
  }
}

// ─── Data fetching ────────────────────────────────────────────
async function fetchLogs() {
  loading.value = true
  error.value = null
  try {
    const data = await api.get('/logs/journal', { lines: 20 })
    if (data && data.entries) {
      entries.value = data.entries
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      error.value = e.message
    }
  } finally {
    loading.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  await fetchLogs()
  pollTimer.value = setInterval(fetchLogs, 15000) // 15s refresh
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})

function goToLogs() {
  router.push('/system?tab=logs')
}

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div
    :class="cardClass()"
    class="w-full rounded-2xl p-5 transition-all"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-slate-500/15 flex items-center justify-center">
          <Icon name="ScrollText" :size="14" class="text-slate-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Logs</span>
      </div>

      <!-- Filter selector -->
      <div class="flex gap-1">
        <button
          v-for="f in [
            { id: 'all', label: 'All' },
            { id: 'warning', label: 'Warn+' },
            { id: 'error', label: 'Err+' },
          ]"
          :key="f.id"
          class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors"
          :class="filter === f.id
            ? 'bg-accent/15 text-accent'
            : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
          @click="filter = f.id"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading && entries.length === 0"
      class="flex items-center justify-center py-6 text-[10px] text-theme-muted"
    >
      Loading logs...
    </div>

    <!-- Error state -->
    <div
      v-else-if="error && entries.length === 0"
      class="flex items-center justify-center py-6 text-[10px] text-error"
    >
      <Icon name="AlertTriangle" :size="12" class="mr-1" />
      {{ error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!hasEntries"
      class="flex items-center justify-center py-6 text-[10px] text-theme-muted"
    >
      No log entries {{ filter !== 'all' ? 'matching filter' : '' }}
    </div>

    <!-- Log entries -->
    <div v-else class="space-y-1.5">
      <div
        v-for="(entry, idx) in filteredEntries"
        :key="idx"
        class="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-theme-tertiary transition-colors cursor-pointer group"
        @click="goToLogs"
      >
        <!-- Severity badge -->
        <span
          class="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none"
          :class="severityConfig(entry.priority || entry.severity).color"
        >
          {{ severityConfig(entry.priority || entry.severity).label }}
        </span>

        <!-- Message -->
        <span class="text-[11px] text-theme-secondary leading-snug line-clamp-2 flex-1 min-w-0">
          {{ entry.message || entry.msg || '(no message)' }}
        </span>

        <!-- Timestamp -->
        <span class="shrink-0 text-[10px] text-theme-muted tabular-nums whitespace-nowrap">
          {{ relativeTime(entry.timestamp || entry.time || entry.__REALTIME_TIMESTAMP) }}
        </span>
      </div>
    </div>

    <!-- View all link -->
    <button
      class="w-full mt-3 pt-3 border-t border-theme-primary flex items-center justify-center gap-1.5
             text-[11px] text-theme-muted hover:text-accent transition-colors"
      @click="goToLogs"
    >
      <span>View all logs</span>
      <Icon name="ArrowRight" :size="12" />
    </button>
  </div>
</template>
