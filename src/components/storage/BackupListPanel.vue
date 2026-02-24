<script setup>
/**
 * BackupListPanel.vue — Backup list with actions
 *
 * Table on desktop, cards on mobile. Columns: Name, Scope, Size, Date,
 * Destination, Status. Actions: Download, Verify, Restore, Delete.
 * Scope badge (Tier 1/2/3), encryption indicator, config snapshot indicator.
 */
import { ref, computed } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['restore', 'verify'])

const backupsStore = useBackupsStore()
const { isMobile } = useBreakpoint()
const { isAdvanced } = useMode()

const expandedBackup = ref(null)
const actionError = ref(null)

function toggleExpand(id) {
  expandedBackup.value = expandedBackup.value === id ? null : id
}

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

    <!-- Desktop Table -->
    <div v-else-if="!isMobile" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-theme-primary">
            <th class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider text-left">Name</th>
            <th class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider text-left">Scope</th>
            <th class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider text-right">Size</th>
            <th class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider text-left">Date</th>
            <th v-if="isAdvanced" class="px-3 py-2 text-xs font-medium text-theme-tertiary uppercase tracking-wider text-left">Destination</th>
            <th class="w-10"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="backup in backupsStore.backups" :key="backup.id">
            <tr class="border-b border-theme-primary hover:bg-theme-secondary/50 transition-colors">
              <td class="px-3 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-theme-primary font-medium truncate max-w-[200px]">{{ backup.filename || backup.id }}</span>
                  <!-- Encryption indicator -->
                  <span v-if="isEncrypted(backup)" :title="encryptionTooltip(backup)" class="text-theme-muted">
                    <Icon name="Lock" :size="12" />
                  </span>
                  <!-- Config snapshot indicator -->
                  <span title="Includes system config snapshot" class="text-theme-muted">
                    <Icon name="Settings" :size="12" />
                  </span>
                </div>
                <p v-if="backup.description" class="text-xs text-theme-muted mt-0.5 truncate max-w-[200px]">{{ backup.description }}</p>
              </td>
              <td class="px-3 py-3">
                <span class="px-2 py-0.5 text-[10px] font-semibold rounded uppercase" :class="scopeBadgeClass(backup)">
                  {{ scopeLabel(backup) }}
                </span>
                <span class="text-xs text-theme-muted ml-1 hidden lg:inline">{{ scopeDescription(backup) }}</span>
              </td>
              <td class="px-3 py-3 text-right text-theme-secondary">
                {{ backup.size_human || formatBytes(backup.size_bytes) }}
              </td>
              <td class="px-3 py-3 text-theme-secondary text-xs">
                {{ formatDate(backup.created_at) }}
              </td>
              <td v-if="isAdvanced" class="px-3 py-3 text-theme-secondary text-xs">
                {{ destinationLabel(backup) }}
              </td>
              <td class="px-2 text-right">
                <div class="flex items-center gap-1 justify-end">
                  <button @click="downloadBackup(backup)" class="p-1.5 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Download">
                    <Icon name="Download" :size="14" />
                  </button>
                  <button v-if="isAdvanced" @click="verifyBackup(backup)" class="p-1.5 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Verify">
                    <Icon name="ShieldCheck" :size="14" />
                  </button>
                  <button @click="restoreBackup(backup)" class="p-1.5 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted" title="Restore">
                    <Icon name="RotateCcw" :size="14" />
                  </button>
                  <button @click="deleteBackup(backup)" class="p-1.5 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted" title="Delete">
                    <Icon name="Trash2" :size="14" />
                  </button>
                  <button @click="toggleExpand(backup.id)" class="p-1.5 text-theme-muted hover:text-theme-secondary rounded-lg" :aria-expanded="expandedBackup === backup.id">
                    <Icon name="ChevronDown" :size="14" class="transition-transform" :class="{ 'rotate-180': expandedBackup === backup.id }" />
                  </button>
                </div>
              </td>
            </tr>
            <!-- Expanded detail row -->
            <tr v-if="expandedBackup === backup.id">
              <td :colspan="isAdvanced ? 6 : 5" class="px-4 pb-4 border-b border-theme-primary/50">
                <div class="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span class="text-xs text-theme-muted block">Type</span>
                    <span class="text-theme-primary capitalize">{{ backup.type }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-theme-muted block">Compressed</span>
                    <span class="text-theme-primary">{{ backup.compressed ? 'Yes' : 'No' }}</span>
                  </div>
                  <div v-if="isEncrypted(backup)">
                    <span class="text-xs text-theme-muted block">Encryption</span>
                    <span class="text-theme-primary">{{ encryptionTooltip(backup) }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-theme-muted block">ID</span>
                    <span class="text-theme-primary font-mono text-xs">{{ backup.id }}</span>
                  </div>
                  <div v-if="backup.includes?.length">
                    <span class="text-xs text-theme-muted block">Includes</span>
                    <span class="text-theme-primary text-xs">{{ backup.includes.join(', ') }}</span>
                  </div>
                  <div v-if="backup.checksum">
                    <span class="text-xs text-theme-muted block">Checksum</span>
                    <span class="text-theme-primary font-mono text-xs truncate block max-w-[200px]">{{ backup.checksum }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div v-else class="space-y-2">
      <div
        v-for="backup in backupsStore.backups"
        :key="backup.id"
        class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
      >
        <div class="p-3" @click="toggleExpand(backup.id)">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded uppercase flex-shrink-0" :class="scopeBadgeClass(backup)">
                {{ scopeLabel(backup) }}
              </span>
              <span v-if="isEncrypted(backup)" :title="encryptionTooltip(backup)" class="text-theme-muted flex-shrink-0">
                <Icon name="Lock" :size="12" />
              </span>
              <span title="Includes system config snapshot" class="text-theme-muted flex-shrink-0">
                <Icon name="Settings" :size="12" />
              </span>
            </div>
            <span class="text-xs text-theme-muted flex-shrink-0">{{ backup.size_human || formatBytes(backup.size_bytes) }}</span>
          </div>
          <h4 class="font-medium text-theme-primary text-sm truncate">{{ backup.filename || backup.id }}</h4>
          <p class="text-xs text-theme-muted mt-0.5">{{ formatDate(backup.created_at) }}</p>
          <p v-if="backup.description" class="text-xs text-theme-muted mt-0.5 truncate">{{ backup.description }}</p>
        </div>

        <!-- Expanded detail -->
        <div v-if="expandedBackup === backup.id" class="px-3 pb-2 border-t border-theme-primary/50">
          <div class="pt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="text-theme-muted block">Type</span>
              <span class="text-theme-primary capitalize">{{ backup.type }}</span>
            </div>
            <div v-if="isAdvanced">
              <span class="text-theme-muted block">Destination</span>
              <span class="text-theme-primary">{{ destinationLabel(backup) }}</span>
            </div>
            <div v-if="isEncrypted(backup)">
              <span class="text-theme-muted block">Encryption</span>
              <span class="text-theme-primary">{{ encryptionTooltip(backup) }}</span>
            </div>
            <div>
              <span class="text-theme-muted block">ID</span>
              <span class="text-theme-primary font-mono truncate block">{{ backup.id }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-1 px-3 pb-3 pt-1">
          <button @click.stop="downloadBackup(backup)" class="p-2 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Download">
            <Icon name="Download" :size="14" />
          </button>
          <button v-if="isAdvanced" @click.stop="verifyBackup(backup)" class="p-2 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted" title="Verify">
            <Icon name="ShieldCheck" :size="14" />
          </button>
          <button @click.stop="restoreBackup(backup)" class="p-2 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted" title="Restore">
            <Icon name="RotateCcw" :size="14" />
          </button>
          <button @click.stop="deleteBackup(backup)" class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted" title="Delete">
            <Icon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
