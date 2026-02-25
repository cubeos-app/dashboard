<script setup>
/**
 * BackupListPanel.vue — Backup list with actions
 *
 * Table on desktop, cards on mobile. Columns: Name, Scope, Size, Date,
 * Destination, Status. Actions: Download, Verify, Restore, Delete.
 * Scope badge (Tier 1/2/3), encryption indicator, config snapshot indicator.
 */
import { ref } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const emit = defineEmits(['restore', 'verify'])

const backupsStore = useBackupsStore()
const { isAdvanced } = useMode()

const expandedBackup = ref(null)
const actionError = ref(null)

// ─── Scope badge helpers ─────────────────────────────────────

function scopeLabel(backup) {
  const scope = backup.scope || backup.type
  if (!scope) return 'Tier 1'
  const s = String(scope).toLowerCase()
  if (s === '3' || s === 'full' || s === 'everything') return 'Tier 3'
  if (s === '2' || s === 'data' || s === 'system') return 'Tier 2'
  return 'Tier 1'
}

function scopeBadgeClass(backup) {
  const label = scopeLabel(backup)
  if (label === 'Tier 3') return 'bg-accent-muted text-accent'
  if (label === 'Tier 2') return 'bg-warning-muted text-warning'
  return 'bg-success-muted text-success'
}

function scopeDescription(backup) {
  const label = scopeLabel(backup)
  if (label === 'Tier 3') return 'Everything'
  if (label === 'Tier 2') return 'Full System Config'
  return 'Database & Config'
}

// ─── Helpers ─────────────────────────────────────────────────

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
  return new Date(dateStr).toLocaleString()
}

function destinationLabel(backup) {
  if (!backup.destination || backup.destination === 'local') return 'Local'
  const t = backup.destination.type || backup.destination
  if (t === 'usb') return 'USB'
  if (t === 'nfs') return 'NFS'
  if (t === 'smb') return 'SMB'
  return String(t)
}

function isEncrypted(backup) {
  return backup.encrypted || backup.encrypt
}

function encryptionTooltip(backup) {
  if (backup.encryption_mode === 'portable') return 'Portable-encrypted'
  return 'Device-encrypted'
}

// ─── Actions ────────────────────────────────────────────────

async function downloadBackup(backup) {
  backupsStore.downloadBackup(backup.id)
}

async function verifyBackup(backup) {
  emit('verify', backup)
}

async function restoreBackup(backup) {
  emit('restore', backup)
}

async function deleteBackup(backup) {
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
</script>

<template>
  <div>
    <!-- Error -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-3 flex items-start gap-2 mb-4">
      <Icon name="AlertTriangle" :size="14" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="backupsStore.loading && !backupsStore.backups.length" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading backups...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!backupsStore.backups.length" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Archive" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Backups Yet</h3>
      <p class="text-theme-muted">Create your first backup to protect your CubeOS configuration.</p>
    </div>

    <ResponsiveTable
      v-else
      :columns="[
        { key: 'filename', label: 'Name' },
        { key: 'scope', label: 'Scope' },
        { key: 'size', label: 'Size', align: 'right' },
        { key: 'created_at', label: 'Date' },
        ...(isAdvanced ? [{ key: 'destination', label: 'Destination' }] : [])
      ]"
      :rows="backupsStore.backups"
      row-key="id"
      v-model:expanded-key="expandedBackup"
      compact
    >
      <template #cell-filename="{ row }">
        <div class="flex items-center gap-2">
          <span class="text-theme-primary font-medium truncate max-w-[200px]">{{ row.filename || row.id }}</span>
          <span v-if="isEncrypted(row)" :title="encryptionTooltip(row)" class="text-theme-muted">
            <Icon name="Lock" :size="12" />
          </span>
          <span title="Includes system config snapshot" class="text-theme-muted">
            <Icon name="Settings" :size="12" />
          </span>
        </div>
      </template>
      <template #cell-scope="{ row }">
        <span class="px-2 py-0.5 text-[10px] font-semibold rounded uppercase" :class="scopeBadgeClass(row)">
          {{ scopeLabel(row) }}
        </span>
      </template>
      <template #cell-size="{ row }">
        <span class="text-theme-secondary">{{ row.size_human || formatBytes(row.size_bytes) }}</span>
      </template>
      <template #cell-created_at="{ row }">
        <span class="text-theme-secondary text-xs">{{ formatDate(row.created_at) }}</span>
      </template>
      <template #cell-destination="{ row }">
        <span class="text-theme-secondary text-xs">{{ destinationLabel(row) }}</span>
      </template>
      <template #row-actions="{ row }">
        <div class="flex items-center gap-1">
          <button @click.stop="downloadBackup(row)" class="p-1.5 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Download">
            <Icon name="Download" :size="14" />
          </button>
          <button v-if="isAdvanced" @click.stop="verifyBackup(row)" class="p-1.5 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Verify">
            <Icon name="ShieldCheck" :size="14" />
          </button>
          <button @click.stop="restoreBackup(row)" class="p-1.5 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted" title="Restore">
            <Icon name="RotateCcw" :size="14" />
          </button>
          <button @click.stop="deleteBackup(row)" class="p-1.5 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted" title="Delete">
            <Icon name="Trash2" :size="14" />
          </button>
        </div>
      </template>
      <template #row-expand="{ row }">
        <div class="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span class="text-xs text-theme-muted block">Type</span>
            <span class="text-theme-primary capitalize">{{ row.type }}</span>
          </div>
          <div>
            <span class="text-xs text-theme-muted block">Compressed</span>
            <span class="text-theme-primary">{{ row.compressed ? 'Yes' : 'No' }}</span>
          </div>
          <div v-if="isEncrypted(row)">
            <span class="text-xs text-theme-muted block">Encryption</span>
            <span class="text-theme-primary">{{ encryptionTooltip(row) }}</span>
          </div>
          <div>
            <span class="text-xs text-theme-muted block">ID</span>
            <span class="text-theme-primary font-mono text-xs">{{ row.id }}</span>
          </div>
          <div v-if="row.includes?.length">
            <span class="text-xs text-theme-muted block">Includes</span>
            <span class="text-theme-primary text-xs">{{ row.includes.join(', ') }}</span>
          </div>
          <div v-if="row.checksum">
            <span class="text-xs text-theme-muted block">Checksum</span>
            <span class="text-theme-primary font-mono text-xs truncate block max-w-[200px]">{{ row.checksum }}</span>
          </div>
        </div>
      </template>
    </ResponsiveTable>
  </div>
</template>
