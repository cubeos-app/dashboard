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
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useHardwareStore } from '@/stores/hardware'
import { useMonitoringStore } from '@/stores/monitoring'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { usePolling } from '@/composables/usePolling'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import TabBar from '@/components/ui/TabBar.vue'
import api from '@/api/client'

import SystemOverviewTab from './SystemOverviewTab.vue'
import MonitoringTab from './MonitoringTab.vue'
import ProcessesTab from './ProcessesTab.vue'
import LogsTab from './LogsTab.vue'
import HardwareTab from './HardwareTab.vue'

const { t } = useI18n()
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
    { key: 'overview', label: t('system.overview'), icon: 'Monitor' }
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'monitoring', label: t('system.monitoring'), icon: 'Activity', badge: monitoringStore.alertCount > 0 ? monitoringStore.alertCount : null, badgeVariant: 'alert' },
      { key: 'processes', label: t('system.processes'), icon: 'Terminal' },
      { key: 'logs', label: t('system.logs'), icon: 'FileText' },
      { key: 'hardware', label: t('system.hardwareTab'), icon: 'Cpu' }
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

async function fetchSharedData(isInitial = false) {
  // B47: Only show loading indicator on initial fetch, not during polling.
  // Setting loading=true during refresh caused PowerCard to flicker.
  if (isInitial) loading.value = true
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
    if (isInitial) loading.value = false
  }
}

// ─── Polling ─────────────────────────────────────────────────
usePolling(fetchSharedData, 15000, { immediate: false, pauseWhenHidden: true })

onMounted(() => {
  fetchSharedData(true)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Monitor"
      :title="t('system.title')"
      :subtitle="t('system.subtitle')"
    >
      <template #actions>
        <button
          @click="fetchSharedData"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          :aria-label="t('system.refresh')"
        >
          <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
    </PageHeader>

    <!-- Error Alert -->
    <div v-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ error }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" :aria-label="t('common.dismissError')">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Tabs -->
    <TabBar
      :model-value="activeTab"
      @update:model-value="setTab"
      :tabs="TAB_DEFS"
      :aria-label="t('system.tabsLabel')"
    />

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
