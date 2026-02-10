<script setup>
/**
 * BackupsTab.vue — S07 Component
 *
 * Both modes:
 *   Standard: Backup list, quick backup button, restore, download
 *   Advanced: + Custom backup creation (type, description, docker volumes), stats
 *
 * Self-managed — uses backups store directly.
 *
 * Wires all 8 backup endpoints:
 *   GET    /backups, POST /backups, GET /backups/stats, POST /backups/quick
 *   GET    /backups/{id}, DELETE /backups/{id}, GET /backups/{id}/download
 *   POST   /backups/{id}/restore
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'

const backupsStore = useBackupsStore()
const { isAdvanced } = useMode()
const { trapFocus } = useFocusTrap()

// ─── State ──────────────────────────────────────────────────

const actionError = ref(null)
const expandedBackup = ref(null)

// Create backup modal
const showCreateModal = ref(false)
const createModalRef = ref(null)
const createForm = ref({
  type: 'config',
  description: '',
  include_docker_volumes: false,
  compress: true
})

// Restore state
const restoringId = ref(null)

// Focus modal when shown
watch(showCreateModal, (visible) => {
  if (visible) nextTick(() => createModalRef.value?.focus())
})

// ─── Data Fetching ──────────────────────────────────────────

async function fetchAll() {
  actionError.value = null
  await backupsStore.fetchAll()
}

onMounted(fetchAll)

// ─── Actions ────────────────────────────────────────────────

async function quickBackup() {
  actionError.value = null
  try {
    await backupsStore.quickBackup()
  } catch (e) {
    actionError.value = 'Quick backup failed: ' + e.message
  }
}

async function createBackup() {
  actionError.value = null
  try {
    await backupsStore.createBackup(createForm.value)
    showCreateModal.value = false
    createForm.value = { type: 'config', description: '', include_docker_volumes: false, compress: true }
  } catch (e) {
    actionError.value = 'Create backup failed: ' + e.message
  }
}

function openCreateModal() {
  createForm.value = { type: 'config', description: '', include_docker_volumes: false, compress: true }
  showCreateModal.value = true
}

async function deleteBackupItem(backup) {
  if (!await confirm({
    title: 'Delete Backup',
    message: `Delete "${backup.filename || backup.id}"? This cannot be undone.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  actionError.value = null
  try {
    await backupsStore.deleteBackup(backup.id)
    if (expandedBackup.value === backup.id) expandedBackup.value = null
  } catch (e) {
    actionError.value = 'Delete failed: ' + e.message
  }
}

async function restoreFromBackup(backup) {
  if (!await confirm({
    title: 'Restore Backup',
    message: `Restore from "${backup.filename || backup.id}"? This will overwrite current configuration. The system may restart.`,
    confirmText: 'Restore',
    variant: 'danger'
  })) return

  actionError.value = null
  restoringId.value = backup.id
  try {
    await backupsStore.restoreBackup(backup.id)
  } catch (e) {
    actionError.value = 'Restore failed: ' + e.message
  } finally {
    restoringId.value = null
  }
}

function downloadBackupItem(backup) {
  backupsStore.downloadBackup(backup.id)
}

function toggleExpand(id) {
  expandedBackup.value = expandedBackup.value === id ? null : id
}

// ─── Helpers ────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = Number(bytes)
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString()
}

function typeIcon(type) {
  if (!type) return 'Archive'
  const t = type.toLowerCase()
  if (t === 'full') return 'Package'
  if (t === 'config') return 'Settings'
  if (t === 'data') return 'Database'
  return 'Archive'
}

function typeBadgeClass(type) {
  if (!type) return 'bg-theme-tertiary text-theme-muted'
  const t = type.toLowerCase()
  if (t === 'full') return 'bg-accent-muted text-accent'
  if (t === 'config') return 'bg-success-muted text-success'
  if (t === 'data') return 'bg-warning-muted text-warning'
  return 'bg-theme-tertiary text-theme-secondary'
}
</script>

<template>
  <div class="space-y-6">

    <!-- Action Bar -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <p class="text-sm text-theme-muted">
          {{ backupsStore.backupCount }} backup{{ backupsStore.backupCount !== 1 ? 's' : '' }}
          <span v-if="backupsStore.totalSizeBytes"> · {{ backupsStore.totalSizeHuman }} total</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="quickBackup"
          :disabled="backupsStore.createLoading"
          class="px-4 py-2 btn-accent rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Icon v-if="backupsStore.createLoading" name="Loader2" :size="14" class="animate-spin" />
          <Icon v-else name="Zap" :size="14" />
          Quick Backup
        </button>
        <button
          v-if="isAdvanced"
          @click="openCreateModal"
          class="px-4 py-2 border border-theme-secondary text-theme-secondary rounded-lg text-sm hover:bg-theme-tertiary flex items-center gap-2"
        >
          <Icon name="Plus" :size="14" />
          Custom Backup
        </button>
        <button
          @click="fetchAll"
          :disabled="backupsStore.loading"
          class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
          aria-label="Refresh backups"
        >
          <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': backupsStore.loading }" />
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
      </div>
    </div>

    <!-- Stats (Advanced) -->
    <div v-if="isAdvanced && backupsStore.stats" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <p class="text-xs text-theme-muted mb-1">Total Backups</p>
        <p class="text-xl font-bold text-theme-primary">{{ backupsStore.stats.total_count ?? backupsStore.backupCount }}</p>
      </div>
      <div class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <p class="text-xs text-theme-muted mb-1">Total Size</p>
        <p class="text-xl font-bold text-theme-primary">{{ backupsStore.totalSizeHuman }}</p>
      </div>
      <div v-if="backupsStore.stats.by_type" class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <p class="text-xs text-theme-muted mb-1">Config Backups</p>
        <p class="text-xl font-bold text-theme-primary">{{ backupsStore.stats.by_type?.config ?? 0 }}</p>
      </div>
      <div v-if="backupsStore.stats.by_type" class="bg-theme-card rounded-xl border border-theme-primary p-4">
        <p class="text-xs text-theme-muted mb-1">Full Backups</p>
        <p class="text-xl font-bold text-theme-primary">{{ backupsStore.stats.by_type?.full ?? 0 }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="backupsStore.loading && !backupsStore.backups.length" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading backups...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!backupsStore.backups.length" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Archive" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Backups Yet</h3>
      <p class="text-theme-muted mb-4">Create your first backup to protect your CubeOS configuration.</p>
      <button @click="quickBackup" :disabled="backupsStore.createLoading" class="px-4 py-2 btn-accent rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-50">
        <Icon v-if="backupsStore.createLoading" name="Loader2" :size="14" class="animate-spin" />
        <Icon v-else name="Zap" :size="14" />
        Quick Backup
      </button>
    </div>

    <!-- Backup List -->
    <div v-else class="space-y-3">
      <div
        v-for="backup in backupsStore.backups"
        :key="backup.id"
        class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
      >
        <!-- Backup header row -->
        <div class="p-4 flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
            :class="typeBadgeClass(backup.type)"
            @click="toggleExpand(backup.id)"
          >
            <Icon :name="typeIcon(backup.type)" :size="20" />
          </div>
          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="toggleExpand(backup.id)"
          >
            <h4 class="font-medium text-theme-primary text-sm">{{ backup.filename || backup.id }}</h4>
            <p class="text-xs text-theme-muted">
              {{ formatDate(backup.created_at) }}
              <span v-if="backup.description"> · {{ backup.description }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold rounded uppercase" :class="typeBadgeClass(backup.type)">{{ backup.type }}</span>
            <span class="hidden sm:inline text-xs text-theme-muted">{{ backup.size_human || formatBytes(backup.size_bytes) }}</span>

            <!-- Download -->
            <button
              @click.stop="downloadBackupItem(backup)"
              class="p-2 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted"
              title="Download"
              :aria-label="'Download backup ' + (backup.filename || backup.id)"
            >
              <Icon name="Download" :size="14" />
            </button>

            <!-- Restore -->
            <button
              @click.stop="restoreFromBackup(backup)"
              :disabled="restoringId === backup.id"
              class="p-2 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted disabled:opacity-50"
              title="Restore"
              :aria-label="'Restore from backup ' + (backup.filename || backup.id)"
            >
              <Icon v-if="restoringId === backup.id" name="Loader2" :size="14" class="animate-spin" />
              <Icon v-else name="RotateCcw" :size="14" />
            </button>

            <!-- Delete -->
            <button
              @click.stop="deleteBackupItem(backup)"
              class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted"
              title="Delete"
              :aria-label="'Delete backup ' + (backup.filename || backup.id)"
            >
              <Icon name="Trash2" :size="14" />
            </button>

            <!-- Expand -->
            <button
              @click.stop="toggleExpand(backup.id)"
              class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg"
              :aria-label="'Toggle details for ' + (backup.filename || backup.id)"
              :aria-expanded="expandedBackup === backup.id"
            >
              <Icon
                name="ChevronDown"
                :size="14"
                class="transition-transform"
                :class="{ 'rotate-180': expandedBackup === backup.id }"
              />
            </button>
          </div>
        </div>

        <!-- Expanded detail panel -->
        <div v-if="expandedBackup === backup.id" class="px-4 pb-4 border-t border-theme-primary/50">
          <div class="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span class="text-xs text-theme-muted block">Type</span>
              <span class="text-theme-primary capitalize">{{ backup.type }}</span>
            </div>
            <div>
              <span class="text-xs text-theme-muted block">Size</span>
              <span class="text-theme-primary">{{ backup.size_human || formatBytes(backup.size_bytes) }}</span>
            </div>
            <div>
              <span class="text-xs text-theme-muted block">Compressed</span>
              <span class="text-theme-primary">{{ backup.compressed ? 'Yes' : 'No' }}</span>
            </div>
            <div>
              <span class="text-xs text-theme-muted block">Created</span>
              <span class="text-theme-primary">{{ formatDate(backup.created_at) }}</span>
            </div>
            <div>
              <span class="text-xs text-theme-muted block">ID</span>
              <span class="text-theme-primary font-mono text-xs">{{ backup.id }}</span>
            </div>
            <div v-if="backup.includes?.length">
              <span class="text-xs text-theme-muted block">Includes</span>
              <span class="text-theme-primary text-xs">{{ backup.includes.join(', ') }}</span>
            </div>
          </div>
          <p v-if="backup.description" class="mt-3 text-sm text-theme-muted">{{ backup.description }}</p>
          <!-- Mobile badges -->
          <div class="flex gap-2 mt-3 sm:hidden">
            <span class="px-2 py-0.5 text-[10px] font-semibold rounded uppercase" :class="typeBadgeClass(backup.type)">{{ backup.type }}</span>
            <span class="text-xs text-theme-muted">{{ backup.size_human || formatBytes(backup.size_bytes) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Create Backup Modal ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showCreateModal"
          ref="createModalRef"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create Backup"
          tabindex="-1"
          @keydown.escape="showCreateModal = false"
          @keydown="trapFocus"
        >
          <div class="absolute inset-0 bg-theme-overlay" @click="showCreateModal = false"></div>
          <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
              <h3 class="text-lg font-semibold text-theme-primary">Create Backup</h3>
              <button @click="showCreateModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
                <Icon name="X" :size="18" />
              </button>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-4">
              <!-- Type selector -->
              <div>
                <label id="backup-type-label" class="block text-sm font-medium text-theme-secondary mb-2">Backup Type</label>
                <div class="flex rounded-lg overflow-hidden border border-theme-primary" role="radiogroup" aria-labelledby="backup-type-label">
                  <button
                    @click="createForm.type = 'config'"
                    class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    :class="createForm.type === 'config'
                      ? 'bg-accent text-on-accent'
                      : 'text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary'"
                  >Config</button>
                  <button
                    @click="createForm.type = 'full'"
                    class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    :class="createForm.type === 'full'
                      ? 'bg-accent text-on-accent'
                      : 'text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary'"
                  >Full</button>
                </div>
                <p class="text-xs text-theme-muted mt-1">
                  {{ createForm.type === 'config' ? 'Backs up CubeOS configuration and databases.' : 'Full system backup including Docker volumes and app data.' }}
                </p>
              </div>

              <!-- Description -->
              <div>
                <label for="backup-desc" class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
                <input
                  id="backup-desc"
                  v-model="createForm.description"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="Pre-upgrade backup"
                >
              </div>

              <!-- Options -->
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="createForm.include_docker_volumes" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Include Docker volumes</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="createForm.compress" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Compress backup</span>
                </label>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary">
              <button @click="showCreateModal = false" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">
                Cancel
              </button>
              <button
                @click="createBackup"
                :disabled="backupsStore.createLoading"
                class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon v-if="backupsStore.createLoading" name="Loader2" :size="14" class="animate-spin" />
                Create Backup
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
