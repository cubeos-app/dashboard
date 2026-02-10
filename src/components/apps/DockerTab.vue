<script setup>
/**
 * DockerTab.vue — S05 Component
 *
 * Advanced-only tab for Docker system management.
 * Displays Docker disk usage breakdown and provides system prune.
 *
 * Wires:
 *   - GET /docker/disk-usage
 *   - POST /docker/prune
 */
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

// ─── State ────────────────────────────────────────────────────
const loading = ref(false)
const pruning = ref(false)
const error = ref(null)
const diskUsage = ref(null)
const pruneResult = ref(null)

// ─── Computed ─────────────────────────────────────────────────

const totalSize = computed(() => {
  if (!diskUsage.value) return 0
  const d = diskUsage.value
  return (d.images?.total_size || 0) +
    (d.containers?.total_size || 0) +
    (d.volumes?.total_size || 0) +
    (d.build_cache?.total_size || 0)
})

const sections = computed(() => {
  if (!diskUsage.value) return []
  const d = diskUsage.value
  return [
    {
      key: 'images',
      label: 'Images',
      icon: 'Layers',
      count: d.images?.count ?? d.images?.total_count ?? 0,
      size: d.images?.total_size ?? d.images?.size ?? 0,
      reclaimable: d.images?.reclaimable_size ?? 0,
      color: 'text-accent',
      bgColor: 'bg-accent'
    },
    {
      key: 'containers',
      label: 'Containers',
      icon: 'Box',
      count: d.containers?.count ?? d.containers?.total_count ?? 0,
      size: d.containers?.total_size ?? d.containers?.size ?? 0,
      reclaimable: d.containers?.reclaimable_size ?? 0,
      color: 'text-success',
      bgColor: 'bg-success'
    },
    {
      key: 'volumes',
      label: 'Volumes',
      icon: 'Database',
      count: d.volumes?.count ?? d.volumes?.total_count ?? 0,
      size: d.volumes?.total_size ?? d.volumes?.size ?? 0,
      reclaimable: d.volumes?.reclaimable_size ?? 0,
      color: 'text-warning',
      bgColor: 'bg-warning'
    },
    {
      key: 'build_cache',
      label: 'Build Cache',
      icon: 'Archive',
      count: d.build_cache?.count ?? d.build_cache?.total_count ?? 0,
      size: d.build_cache?.total_size ?? d.build_cache?.size ?? 0,
      reclaimable: d.build_cache?.reclaimable_size ?? 0,
      color: 'text-error',
      bgColor: 'bg-error'
    }
  ].filter(s => s.count > 0 || s.size > 0)
})

const totalReclaimable = computed(() =>
  sections.value.reduce((sum, s) => sum + s.reclaimable, 0)
)

// ─── Data Fetching ────────────────────────────────────────────

onMounted(() => {
  fetchDiskUsage()
})

async function fetchDiskUsage() {
  loading.value = true
  error.value = null
  pruneResult.value = null
  try {
    diskUsage.value = await api.get('/docker/disk-usage')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// ─── Actions ──────────────────────────────────────────────────

async function pruneDocker() {
  if (!await confirm({
    title: 'Prune Docker Resources',
    message: 'This will remove unused containers, networks, images, and optionally build cache. Running containers and their images are not affected.',
    confirmText: 'Prune',
    variant: 'warning'
  })) return

  pruning.value = true
  error.value = null
  pruneResult.value = null
  try {
    const result = await api.post('/docker/prune')
    pruneResult.value = result
    // Refresh disk usage after prune
    await fetchDiskUsage()
  } catch (e) {
    error.value = 'Prune failed: ' + e.message
  } finally {
    pruning.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = Number(bytes)
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

function sizePercent(size) {
  if (!totalSize.value || !size) return 0
  return Math.round((size / totalSize.value) * 100)
}
</script>

<template>
  <div class="space-y-6">

    <!-- Loading -->
    <div v-if="loading && !diskUsage" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
      <span class="ml-3 text-theme-secondary">Loading Docker disk usage...</span>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ error }}</p>
        <button @click="error = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- Prune Success -->
    <div v-if="pruneResult" class="bg-success-muted border border-success rounded-lg p-4 flex items-start gap-2">
      <Icon name="CheckCircle" :size="16" class="text-success flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-success">
          Docker cleanup completed.
          <span v-if="pruneResult.result?.space_reclaimed">
            Freed {{ formatBytes(pruneResult.result.space_reclaimed) }}.
          </span>
        </p>
        <button @click="pruneResult = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss">Dismiss</button>
      </div>
    </div>

    <template v-if="diskUsage">
      <!-- Total Usage Header -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Icon name="Container" :size="20" class="text-accent" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Docker Disk Usage</h3>
              <p class="text-sm text-theme-secondary mt-0.5">
                {{ formatBytes(totalSize) }} total
                <span v-if="totalReclaimable > 0" class="text-warning">
                  ({{ formatBytes(totalReclaimable) }} reclaimable)
                </span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              @click="pruneDocker"
              :disabled="pruning"
              class="px-4 py-2 text-sm bg-warning-muted text-warning rounded-lg hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
              aria-label="Prune unused Docker resources"
            >
              <Icon v-if="pruning" name="Loader2" :size="14" class="animate-spin" />
              <Icon v-else name="Trash2" :size="14" />
              {{ pruning ? 'Pruning...' : 'System Prune' }}
            </button>
            <button
              @click="fetchDiskUsage"
              :disabled="loading"
              class="p-2 bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh disk usage"
            >
              <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': loading }" class="text-theme-secondary" />
            </button>
          </div>
        </div>

        <!-- Stacked bar -->
        <div v-if="sections.length > 0" class="mt-4">
          <div class="h-3 bg-theme-tertiary rounded-full overflow-hidden flex">
            <div
              v-for="section in sections"
              :key="section.key"
              :class="section.bgColor"
              class="h-full transition-all duration-300"
              :style="{ width: sizePercent(section.size) + '%' }"
              :title="section.label + ': ' + formatBytes(section.size)"
            ></div>
          </div>
          <div class="flex flex-wrap gap-4 mt-2">
            <div v-for="section in sections" :key="'legend-' + section.key" class="flex items-center gap-1.5">
              <div :class="section.bgColor" class="w-2.5 h-2.5 rounded-full"></div>
              <span class="text-xs text-theme-muted">{{ section.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="section in sections"
          :key="'card-' + section.key"
          class="bg-theme-card rounded-xl border border-theme-primary p-5"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center">
              <Icon :name="section.icon" :size="18" :class="section.color" />
            </div>
            <div>
              <h4 class="text-sm font-semibold text-theme-primary">{{ section.label }}</h4>
              <p class="text-xs text-theme-muted">{{ section.count }} item{{ section.count !== 1 ? 's' : '' }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-theme-secondary">Size</span>
              <span class="text-theme-primary font-medium">{{ formatBytes(section.size) }}</span>
            </div>
            <div v-if="section.reclaimable > 0" class="flex justify-between text-sm">
              <span class="text-theme-secondary">Reclaimable</span>
              <span class="text-warning font-medium">{{ formatBytes(section.reclaimable) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-if="!loading && !diskUsage && !error" class="text-center py-12">
      <Icon name="Container" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No Docker Data</h3>
      <p class="mt-1 text-sm text-theme-secondary">Docker disk usage information is not available.</p>
    </div>
  </div>
</template>
