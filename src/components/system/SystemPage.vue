<script setup>
/**
 * SystemPage.vue — S08 Component
 *
 * Shell that renders Overview tab (both modes) and
 * Monitoring / Processes / Logs / Hardware tabs (Advanced only).
 * Handles shared data fetching and polling.
 *
 * Pattern: Shell → tab components (following S07 StoragePage pattern)
 *
 * Standard tabs: Overview
 * Advanced tabs: Overview, Monitoring, Processes, Logs, Hardware
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useHardwareStore } from '@/stores/hardware'
import { useMonitoringStore } from '@/stores/monitoring'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

import SystemOverviewTab from './SystemOverviewTab.vue'
import MonitoringTab from './MonitoringTab.vue'
import ProcessesTab from './ProcessesTab.vue'
import LogsTab from './LogsTab.vue'
import HardwareTab from './HardwareTab.vue'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const hardwareStore = useHardwareStore()
const monitoringStore = useMonitoringStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'Monitor' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'monitoring', label: 'Monitoring', icon: 'Activity', badge: monitoringStore.alertCount > 0 ? monitoringStore.alertCount : null },
      { key: 'processes', label: 'Processes', icon: 'Terminal' },
      { key: 'logs', label: 'Logs', icon: 'FileText' },
      { key: 'hardware', label: 'Hardware', icon: 'Cpu' }
    )
  }
  return tabs
})

const activeTab = ref('overview')

// Read ?tab= from route for backward-compat
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.value.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

// Reset to 'overview' if current tab becomes invalid (e.g., mode switch)
watch(TAB_DEFS, (tabs) => {
  if (!tabs.some(t => t.key === activeTab.value)) {
    activeTab.value = 'overview'
  }
})

function setTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Shared Data ─────────────────────────────────────────────
const loading = ref(true)
const error = ref(null)

// Power status from HAL (fetched directly)
const powerStatus = ref(null)

async function fetchPowerStatus() {
  try {
    const data = await api.get('/hardware/battery', {}, { signal: signal() })
    if (data === null) return

    let status = 'unknown'
    if (data.is_critical) status = 'critical'
    else if (data.is_low) status = 'low'
    else if (data.is_charging) status = 'charging'
    else if (data.ac_present) status = 'plugged_in'
    else if (data.available) status = 'discharging'
    else status = 'unavailable'

    powerStatus.value = {
      available: data.available ?? false,
      battery_percent: data.percentage ?? 0,
      status,
      is_charging: data.is_charging ?? false,
      ac_present: data.ac_present ?? false,
      voltage: data.voltage ?? 0
    }
  } catch {
    powerStatus.value = { available: false }
  }
}

async function fetchSharedData() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    await Promise.all([
      systemStore.fetchAll({ signal: s }),
      fetchPowerStatus()
    ])
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
}

// ─── Polling ─────────────────────────────────────────────────
let pollInterval = null

function startPolling() {
  if (!pollInterval) pollInterval = setInterval(fetchSharedData, 15000)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else {
    fetchSharedData()
    startPolling()
  }
}

onMounted(() => {
  fetchSharedData()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Monitor"
      title="System"
      subtitle="System information, monitoring, and management"
    >
      <template #actions>
        <button
          @click="fetchSharedData"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          aria-label="Refresh system"
        >
          <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
    </PageHeader>

    <!-- Error Alert -->
    <div v-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ error }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary overflow-x-auto scrollbar-hide">
      <nav class="flex gap-1 sm:gap-4 min-w-max" role="tablist" aria-label="System sections">
        <button
          v-for="tab in TAB_DEFS"
          :key="tab.key"
          @click="setTab(tab.key)"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.key
            ? 'border-[color:var(--accent-primary)] text-accent'
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          {{ tab.label }}
          <span
            v-if="tab.badge"
            class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
            :class="activeTab === tab.key ? 'bg-accent text-on-accent' : 'bg-error-muted text-error'"
          >
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <SystemOverviewTab
      v-if="activeTab === 'overview'"
      :loading="loading"
      :power-status="powerStatus"
      @refresh="fetchSharedData"
      @navigate-tab="setTab"
    />

    <MonitoringTab
      v-if="activeTab === 'monitoring'"
    />

    <ProcessesTab
      v-if="activeTab === 'processes'"
    />

    <LogsTab
      v-if="activeTab === 'logs'"
    />

    <HardwareTab
      v-if="activeTab === 'hardware'"
    />
  </div>
</template>
