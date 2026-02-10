<script setup>
/**
 * StoragePage.vue — S07 Component
 *
 * Shell that renders Overview / USB / Backups tabs (both modes)
 * and Devices / Network Mounts / SMB Shares tabs (Advanced only).
 * Handles shared data fetching and polling.
 *
 * Pattern: Shell → tab components (following S06 NetworkPage pattern)
 *
 * Standard tabs: Overview, USB, Backups
 * Advanced tabs: Overview, USB, Backups, Devices, Network Mounts, SMB Shares
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useStorageStore } from '@/stores/storage'
import { useSMBStore } from '@/stores/smb'
import { useBackupsStore } from '@/stores/backups'
import { useMode } from '@/composables/useMode'
import { useWallpaper } from '@/composables/useWallpaper'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

import StorageOverviewTab from './StorageOverviewTab.vue'
import USBTab from './USBTab.vue'
import BackupsTab from './BackupsTab.vue'
import DevicesTab from './DevicesTab.vue'
import NetworkMountsTab from './NetworkMountsTab.vue'
import SMBSharesTab from './SMBSharesTab.vue'

const route = useRoute()
const router = useRouter()
const storageHalStore = useStorageHalStore()
const storageStore = useStorageStore()
const smbStore = useSMBStore()
const backupsStore = useBackupsStore()
const { isAdvanced } = useMode()
const { isActive: wallpaperActive, panelClass } = useWallpaper()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = computed(() => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'HardDrive' },
    { key: 'usb', label: 'USB', icon: 'Usb', badge: storageHalStore.usbDeviceCount || null },
    { key: 'backups', label: 'Backups', icon: 'Archive', badge: backupsStore.backupCount || null },
  ]
  if (isAdvanced.value) {
    tabs.push(
      { key: 'devices', label: 'Devices', icon: 'HardDrive', badge: storageHalStore.deviceCount || null },
      { key: 'network-mounts', label: 'Network Mounts', icon: 'FolderOpen', badge: storageHalStore.networkMountCount || null },
      { key: 'smb', label: 'SMB Shares', icon: 'Share2', badge: smbStore.shareCount || null }
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

// Docker usage (fetched directly — not in a store)
const dockerUsage = ref(null)

async function fetchSharedData() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    const opts = { signal: s }
    const [, , dockerInfo] = await Promise.all([
      storageHalStore.fetchUsage(opts),
      storageStore.fetchAll(opts),
      api.get('/docker/disk-usage', {}, opts).catch(() => null)
    ])

    if (dockerInfo) {
      dockerUsage.value = {
        images_size: dockerInfo.images_size,
        containers_size: dockerInfo.containers_size,
        volumes_size: dockerInfo.volumes_size,
        build_cache_size: dockerInfo.build_cache_size,
        total_size: dockerInfo.total_size,
        images_count: dockerInfo.images_count,
        containers_count: dockerInfo.containers_count,
        volumes_count: dockerInfo.volumes_count
      }
    }

    // Fetch backup last-run info for overview
    await backupsStore.fetchBackups(true)
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
      icon="HardDrive"
      title="Storage"
      subtitle="Manage disks, USB devices, backups, and file shares"
    >
      <template #actions>
        <button
          @click="fetchSharedData"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          aria-label="Refresh storage"
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
      <nav class="flex gap-1 sm:gap-4 min-w-max" role="tablist" aria-label="Storage sections">
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
            :class="activeTab === tab.key ? 'bg-accent text-on-accent' : 'bg-theme-tertiary text-theme-secondary'"
          >
            {{ tab.badge }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <StorageOverviewTab
      v-if="activeTab === 'overview'"
      :loading="loading"
      :docker-usage="dockerUsage"
      :last-backup="backupsStore.lastBackup"
      @refresh="fetchSharedData"
      @navigate-tab="setTab"
    />

    <USBTab
      v-if="activeTab === 'usb'"
    />

    <BackupsTab
      v-if="activeTab === 'backups'"
    />

    <DevicesTab
      v-if="activeTab === 'devices'"
    />

    <NetworkMountsTab
      v-if="activeTab === 'network-mounts'"
    />

    <SMBSharesTab
      v-if="activeTab === 'smb'"
    />
  </div>
</template>
