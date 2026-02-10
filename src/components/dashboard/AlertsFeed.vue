<script setup>
/**
 * AlertsFeed.vue
 *
 * S03 — Compact feed of recent monitoring alerts.
 * Shows severity icon, message, and timestamp.
 * Advanced mode only (used in DashboardAdvanced).
 *
 * Usage:
 *   <AlertsFeed :alerts="monitoringStore.alerts" :limit="5" />
 */
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Array of alert objects from monitoring store */
  alerts: {
    type: Array,
    default: () => []
  },
  /** Max alerts to display */
  limit: {
    type: Number,
    default: 5
  },
  /** Show loading state */
  loading: {
    type: Boolean,
    default: false
  }
})

function severityIcon(severity) {
  if (severity === 'critical') return 'AlertOctagon'
  if (severity === 'warning') return 'AlertTriangle'
  return 'Info'
}

function severityClass(severity) {
  if (severity === 'critical') return 'text-error'
  if (severity === 'warning') return 'text-warning'
  return 'text-accent'
}

function severityBg(severity) {
  if (severity === 'critical') return 'bg-error-muted'
  if (severity === 'warning') return 'bg-warning-muted'
  return 'bg-accent-muted'
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="rounded-xl border border-theme-primary bg-theme-card">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-theme-primary">
      <div class="flex items-center gap-2">
        <Icon name="Bell" :size="14" class="text-accent" />
        <h3 class="text-sm font-semibold text-theme-primary">Alerts</h3>
      </div>
      <span
        v-if="alerts.length > 0"
        class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
        :class="alerts.some(a => a.severity === 'critical') ? 'bg-error-muted text-error' : 'bg-warning-muted text-warning'"
      >
        {{ alerts.length }}
      </span>
    </div>

    <!-- Alert list -->
    <div class="divide-y divide-theme-primary">
      <!-- Loading -->
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 3" :key="i" class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-theme-tertiary animate-pulse"></div>
          <div class="flex-1">
            <div class="h-3 w-3/4 bg-theme-tertiary rounded animate-pulse mb-1"></div>
            <div class="h-2.5 w-1/3 bg-theme-tertiary rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="alerts.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <Icon name="CheckCircle2" :size="24" class="text-success mb-2" />
        <p class="text-sm text-theme-secondary">All clear</p>
        <p class="text-xs text-theme-muted">No active alerts</p>
      </div>

      <!-- Alerts -->
      <div
        v-else
        v-for="alert in alerts.slice(0, limit)"
        :key="alert.id || alert.message"
        class="flex items-start gap-3 px-4 py-3 hover:bg-theme-tertiary transition-colors"
      >
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          :class="severityBg(alert.severity)"
        >
          <Icon :name="severityIcon(alert.severity)" :size="14" :class="severityClass(alert.severity)" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-theme-primary leading-tight">{{ alert.message }}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[10px] text-theme-muted">{{ formatTime(alert.timestamp || alert.created_at) }}</span>
            <span
              class="text-[10px] font-medium uppercase tracking-wider"
              :class="severityClass(alert.severity)"
            >
              {{ alert.severity }}
            </span>
          </div>
        </div>
      </div>

      <!-- "More" link -->
      <div
        v-if="alerts.length > limit"
        class="px-4 py-2 text-center"
      >
        <router-link
          to="/system?tab=monitoring"
          class="text-xs text-accent hover:underline"
        >
          View all {{ alerts.length }} alerts
        </router-link>
      </div>
    </div>
  </div>
</template>
