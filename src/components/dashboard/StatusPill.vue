<script setup>
/**
 * StatusPill.vue — S13
 *
 * Single-line health summary for Standard dashboard.
 * Replaces the 4 large gauge rings with a compact status indicator.
 *
 * Status levels:
 *   Green  — Everything normal
 *   Amber  — Warning threshold (temp >70°C, disk >85%, memory >90%)
 *   Red    — Critical (temp >80°C, disk >95%, core service down)
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useNetworkStore } from '@/stores/network'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const networkStore = useNetworkStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Thresholds ──────────────────────────────────────────────────
const THRESHOLDS = {
  temp: { warning: 70, critical: 80 },
  disk: { warning: 85, critical: 95 },
  memory: { warning: 90, critical: 95 }
}

// ─── Computed values ─────────────────────────────────────────────
const temp = computed(() => systemStore.temperature ?? 0)
const disk = computed(() => systemStore.diskUsage ?? 0)
const memory = computed(() => systemStore.memoryUsage ?? 0)
const runningCount = computed(() => appsStore.runningCount)
const appCount = computed(() => appsStore.appCount)

const networkModeLabel = computed(() => {
  const mode = networkStore.currentMode
  const labels = {
    offline: 'Offline',
    online_eth: 'Online (ETH)',
    online_wifi: 'Online (WiFi)'
  }
  return labels[mode] || 'Unknown'
})

// ─── Status computation ──────────────────────────────────────────
const issues = computed(() => {
  const problems = []

  if (temp.value > THRESHOLDS.temp.critical) {
    problems.push({ severity: 'critical', text: `Temperature critical (${Math.round(temp.value)}°C)` })
  } else if (temp.value > THRESHOLDS.temp.warning) {
    problems.push({ severity: 'warning', text: `High temperature (${Math.round(temp.value)}°C)` })
  }

  if (disk.value > THRESHOLDS.disk.critical) {
    problems.push({ severity: 'critical', text: `Disk almost full (${disk.value}%)` })
  } else if (disk.value > THRESHOLDS.disk.warning) {
    problems.push({ severity: 'warning', text: `Disk usage high (${disk.value}%)` })
  }

  if (memory.value > THRESHOLDS.memory.critical) {
    problems.push({ severity: 'critical', text: `Memory critical (${memory.value}%)` })
  } else if (memory.value > THRESHOLDS.memory.warning) {
    problems.push({ severity: 'warning', text: `Memory usage high (${memory.value}%)` })
  }

  return problems
})

const status = computed(() => {
  const hasCritical = issues.value.some(i => i.severity === 'critical')
  const hasWarning = issues.value.some(i => i.severity === 'warning')

  if (hasCritical) return 'critical'
  if (hasWarning) return 'warning'
  return 'healthy'
})

const dotClass = computed(() => ({
  'bg-success': status.value === 'healthy',
  'bg-warning': status.value === 'warning',
  'bg-error': status.value === 'critical'
}))

const statusText = computed(() => {
  if (status.value === 'critical') {
    const issue = issues.value.find(i => i.severity === 'critical')
    return `System attention needed \u00B7 ${issue?.text}`
  }
  if (status.value === 'warning') {
    const issue = issues.value.find(i => i.severity === 'warning')
    return issue?.text || 'Warning'
  }
  return 'All systems healthy'
})

const summaryText = computed(() => {
  const parts = [statusText.value]
  parts.push(`${runningCount.value} app${runningCount.value !== 1 ? 's' : ''} running`)
  parts.push(networkModeLabel.value)
  return parts.join(' \u00B7 ')
})

// ─── Card class ──────────────────────────────────────────────────
function cardClass() {
  return wallpaperActive.value ? 'glass' : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all hover:ring-2 hover:ring-accent/20 animate-fade-in"
    @click="router.push('/system')"
    :title="'View system details'"
  >
    <!-- Status dot -->
    <span
      class="w-2.5 h-2.5 rounded-full shrink-0"
      :class="dotClass"
    />

    <!-- Summary text -->
    <span class="text-xs text-theme-secondary truncate">
      {{ summaryText }}
    </span>

    <!-- Chevron -->
    <Icon name="ChevronRight" :size="14" class="ml-auto text-theme-muted shrink-0" />
  </button>
</template>
