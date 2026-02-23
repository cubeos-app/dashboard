<script setup>
/**
 * RegistryTab.vue — Batch 6 Component
 *
 * Advanced-only tab in Settings for registry & update management.
 *
 * Sections:
 *   - Registry status: online/offline, disk usage, image count
 *   - Auto-update toggle: reads/writes auto_update setting
 *   - Check for updates: triggers sync, shows spinner + last result
 *   - Storage cleanup: runs GC with confirmation dialog
 *   - System images panel: lists all images by type (core/curated/user)
 */
import { onMounted, onUnmounted } from 'vue'
import { useRegistryStore } from '@/stores/registry'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SystemImagesPanel from './SystemImagesPanel.vue'

const registry = useRegistryStore()

onMounted(() => {
  registry.fetchStatus()
  registry.fetchSettings()
  registry.fetchSyncStatus()
  registry.fetchSystemImages()
  registry.acknowledgeUpdates()
})

onUnmounted(() => {
  registry.stopSyncPolling()
})

async function toggleAutoUpdate() {
  await registry.updateSettings({
    auto_update: !registry.settings.auto_update,
  })
}

async function handleSync() {
  try {
    await registry.triggerSync()
  } catch {
    // Sync start failed — error is logged in store
  }
}

async function handleCleanup() {
  if (!await confirm({
    title: 'Registry Cleanup',
    message: 'Run garbage collection? This removes old image tags and reclaims disk space.',
    confirmText: 'Clean Up',
    variant: 'warning'
  })) return

  try {
    await registry.runCleanup(2, false)
  } catch {
    // Cleanup failed — error is logged in store
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never'
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Registry Status -->
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Archive" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Local Registry</h2>
          <p class="text-xs text-theme-tertiary">Docker image registry status</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center gap-3">
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :class="registry.isOnline ? 'bg-success' : 'bg-error'"
          />
          <div>
            <p class="text-sm font-medium text-theme-primary">
              {{ registry.isOnline ? 'Online' : 'Offline' }}
            </p>
            <p v-if="registry.status" class="text-xs text-theme-tertiary mt-0.5">
              {{ registry.status.image_count ?? registry.imageCount }} images
              <template v-if="registry.status.disk_usage">
                · {{ registry.status.disk_usage }}
              </template>
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Auto-update toggle -->
    <section class="animate-fade-in" style="animation-delay: 50ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="RefreshCw" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Auto-update</h2>
          <p class="text-xs text-theme-tertiary">Automatic image update behavior</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-theme-primary">Auto-update images</p>
            <p class="text-xs text-theme-tertiary mt-0.5">
              Automatically check for newer versions of core and curated images when online
            </p>
          </div>
          <button
            @click="toggleAutoUpdate"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4"
            :class="registry.settings.auto_update ? 'bg-accent' : 'bg-theme-tertiary'"
            role="switch"
            :aria-checked="registry.settings.auto_update"
            aria-label="Toggle auto-update"
          >
            <span
              class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
              :class="registry.settings.auto_update ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>
    </section>

    <!-- Check for updates -->
    <section class="animate-fade-in" style="animation-delay: 100ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Download" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Check for Updates</h2>
          <p class="text-xs text-theme-tertiary">Sync images from upstream registries</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-theme-primary">Manual sync</p>
            <p class="text-xs text-theme-tertiary mt-0.5">
              <template v-if="registry.syncStatus.last_result">
                Last checked: {{ formatDate(registry.syncStatus.last_result.completed_at) }}
                · {{ registry.syncStatus.last_result.checked ?? 0 }} checked
                · {{ registry.syncStatus.last_result.updated ?? 0 }} updated
                <template v-if="registry.syncStatus.last_result.failed > 0">
                  · {{ registry.syncStatus.last_result.failed }} failed
                </template>
              </template>
              <template v-else>Never synced</template>
            </p>
          </div>
          <button
            @click="handleSync"
            :disabled="registry.syncing || !registry.isOnline"
            class="px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 flex-shrink-0 ml-4"
            :class="registry.syncing || !registry.isOnline
              ? 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              : 'btn-accent'"
          >
            <Icon
              v-if="registry.syncing"
              name="Loader2"
              :size="14"
              class="animate-spin"
            />
            <Icon v-else name="RefreshCw" :size="14" />
            {{ registry.syncing ? 'Syncing...' : 'Check now' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Storage cleanup -->
    <section class="animate-fade-in" style="animation-delay: 150ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-warning-muted flex items-center justify-center">
          <Icon name="Trash2" :size="16" class="text-warning" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Storage Cleanup</h2>
          <p class="text-xs text-theme-tertiary">Reclaim disk space from old images</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-theme-primary">Garbage collection</p>
            <p class="text-xs text-theme-tertiary mt-0.5">
              Remove old image tags and run garbage collection to reclaim disk space
            </p>
          </div>
          <button
            @click="handleCleanup"
            class="px-4 py-2 rounded-lg bg-warning-muted text-warning text-xs font-medium hover:opacity-80 transition-colors flex items-center gap-2 flex-shrink-0 ml-4"
          >
            <Icon name="Trash2" :size="14" />
            Clean up
          </button>
        </div>
      </div>
    </section>

    <!-- System Images Panel -->
    <section class="animate-fade-in" style="animation-delay: 200ms">
      <SystemImagesPanel />
    </section>
  </div>
</template>
