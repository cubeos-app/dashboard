<script setup>
/**
 * AlertBanner.vue — S13
 *
 * Conditional alert banner for Standard dashboard.
 * Only renders when there are actionable alerts from the monitoring store.
 * Shows the most severe/recent alert with action and dismiss buttons.
 * Dismiss hides for the current session (sessionStorage).
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMonitoringStore } from '@/stores/monitoring'
import { useAppsStore } from '@/stores/apps'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const monitoringStore = useMonitoringStore()
const appsStore = useAppsStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Dismissed alerts tracking (session only) ────────────────────
const dismissedIds = ref(new Set())

onMounted(() => {
  try {
    const stored = sessionStorage.getItem('cubeos-dismissed-alerts')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) dismissedIds.value = new Set(parsed)
    }
  } catch { /* ignore */ }
})

function persistDismissed() {
  try {
    sessionStorage.setItem('cubeos-dismissed-alerts', JSON.stringify([...dismissedIds.value]))
  } catch { /* ignore */ }
}

// ─── Alert computation ───────────────────────────────────────────
const activeAlerts = computed(() => {
  return monitoringStore.alerts
    .filter(a => !dismissedIds.value.has(alertId(a)))
    .sort((a, b) => {
      // Sort: critical first, then warning, then info
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      const aSev = severityOrder[a.severity] ?? 3
      const bSev = severityOrder[b.severity] ?? 3
      if (aSev !== bSev) return aSev - bSev
      // Then by timestamp (most recent first)
      return (b.timestamp || 0) - (a.timestamp || 0)
    })
})

// Show only the top alert
const topAlert = computed(() => activeAlerts.value[0] || null)

const hasAlert = computed(() => topAlert.value !== null)

// ─── Helpers ─────────────────────────────────────────────────────
function alertId(alert) {
  return alert.id || `${alert.type}-${alert.metric}-${alert.severity}`
}

function isCritical(alert) {
  return alert.severity === 'critical'
}

function alertIcon(alert) {
  if (alert.severity === 'critical') return 'XCircle'
  return 'AlertTriangle'
}

function alertMessage(alert) {
  // Build a human-friendly message from the alert
  if (alert.message) return alert.message

  const metric = alert.metric || alert.type || 'System'
  const value = alert.value != null ? ` (${alert.value})` : ''
  return `${metric} ${alert.severity}${value}`
}

function alertActionLabel(alert) {
  const type = alert.type || alert.metric || ''
  if (type.includes('service') || type.includes('app')) return 'Restart'
  if (type.includes('backup')) return 'View Details'
  if (type.includes('update')) return 'Update'
  return 'View Details'
}

function handleAction(alert) {
  const type = alert.type || alert.metric || ''

  if (type.includes('service') || type.includes('app')) {
    // Try to restart the affected app
    const appName = alert.app_name || alert.service
    if (appName) {
      appsStore.restartApp(appName)
    } else {
      router.push('/system')
    }
  } else if (type.includes('backup')) {
    router.push('/storage?tab=backups')
  } else if (type.includes('disk') || type.includes('storage')) {
    router.push('/storage')
  } else {
    router.push('/system?tab=monitoring')
  }

  dismiss(alert)
}

function dismiss(alert) {
  dismissedIds.value.add(alertId(alert))
  persistDismissed()
}

// ─── Card class ──────────────────────────────────────────────────
function bannerClass(alert) {
  const base = wallpaperActive.value ? 'glass' : 'bg-theme-card border'
  const border = isCritical(alert) ? 'border-error/40' : 'border-warning/40'
  return `${base} ${border}`
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="hasAlert"
      :class="bannerClass(topAlert)"
      class="flex items-center gap-3 px-4 py-3 rounded-2xl animate-fade-in"
    >
      <!-- Icon -->
      <Icon
        :name="alertIcon(topAlert)"
        :size="18"
        :class="isCritical(topAlert) ? 'text-error' : 'text-warning'"
        class="shrink-0"
      />

      <!-- Message -->
      <span class="flex-1 text-sm text-theme-primary truncate">
        {{ alertMessage(topAlert) }}
      </span>

      <!-- Action button -->
      <button
        class="shrink-0 px-3 py-1 text-xs font-medium rounded-lg transition-colors"
        :class="isCritical(topAlert)
          ? 'bg-error/10 text-error hover:bg-error/20'
          : 'bg-warning/10 text-warning hover:bg-warning/20'"
        @click="handleAction(topAlert)"
      >
        {{ alertActionLabel(topAlert) }}
      </button>

      <!-- Dismiss -->
      <button
        class="shrink-0 p-1 rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        @click="dismiss(topAlert)"
        title="Dismiss"
      >
        <Icon name="X" :size="14" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: all 0.2s ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
