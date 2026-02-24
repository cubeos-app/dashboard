<script setup>
/**
 * BackupsTab.vue — S07 Component (Enhanced)
 *
 * Mode-aware backup management container:
 *
 * Standard mode:
 *   - Quick Backup button (Tier 1, local, no encryption)
 *   - Backup list with download/delete/restore
 *   - Active schedule indicator (if any)
 *
 * Advanced mode:
 *   - Everything in Standard, plus:
 *   - Custom backup creation with scope/destination/encryption
 *   - Schedule management (CRUD)
 *   - Backup verification
 *   - Detailed backup metadata
 *   - Stats panel
 *
 * Delegates to sub-components:
 *   BackupListPanel, BackupCreateModal, BackupSchedulePanel,
 *   BackupRestoreWizard, BackupDestinationPicker
 */
import { ref, computed, onMounted } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import { cronToHuman } from '@/utils/cron'
import SectionPanel from '@/components/ui/SectionPanel.vue'
import Icon from '@/components/ui/Icon.vue'
import BackupListPanel from './BackupListPanel.vue'
import BackupCreateModal from './BackupCreateModal.vue'
import BackupSchedulePanel from './BackupSchedulePanel.vue'
import BackupRestoreWizard from './BackupRestoreWizard.vue'

const backupsStore = useBackupsStore()
const { isAdvanced } = useMode()

// ─── State ──────────────────────────────────────────────────

const actionError = ref(null)
const showCreateModal = ref(false)
const showRestoreWizard = ref(false)
const restoreTarget = ref(null)
const verifyingId = ref(null)
const verifyResult = ref(null)

// ─── Computed ───────────────────────────────────────────────

const activeSchedules = computed(() => {
  return backupsStore.schedules.filter(s => s.enabled !== false)
})

const nextScheduledRun = computed(() => {
  const active = activeSchedules.value
  if (!active.length) return null
  const withNext = active.filter(s => s.next_run)
  if (!withNext.length) return active[0]
  return withNext.reduce((earliest, s) =>
    new Date(s.next_run) < new Date(earliest.next_run) ? s : earliest
  )
})

// ─── Data Fetching ──────────────────────────────────────────

async function fetchAll() {
  actionError.value = null
  await backupsStore.fetchAll()
  // Fetch schedules in parallel (non-blocking)
  backupsStore.fetchSchedules()
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

function handleRestore(backup) {
  restoreTarget.value = backup
  showRestoreWizard.value = true
}

function handleRestoreDone() {
  showRestoreWizard.value = false
  restoreTarget.value = null
  backupsStore.fetchBackups(true)
}

async function handleVerify(backup) {
  verifyingId.value = backup.id
  verifyResult.value = null
  try {
    const result = await backupsStore.verifyBackup(backup.id)
    verifyResult.value = { id: backup.id, success: true, message: result?.message || 'Backup integrity verified' }
  } catch (e) {
    verifyResult.value = { id: backup.id, success: false, message: e.message || 'Verification failed' }
  } finally {
    verifyingId.value = null
  }
}

function handleCreated() {
  showCreateModal.value = false
  backupsStore.fetchBackups(true)
}

function dismissVerifyResult() {
  verifyResult.value = null
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
        <!-- Active schedule indicator -->
        <p v-if="nextScheduledRun" class="text-xs text-theme-muted mt-0.5 flex items-center gap-1">
          <Icon name="CalendarClock" :size="10" />
          <span>
            Next: {{ nextScheduledRun.name }}
            <span v-if="nextScheduledRun.cron"> ({{ cronToHuman(nextScheduledRun.cron) }})</span>
          </span>
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
          @click="showCreateModal = true"
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

    <!-- Verify result toast -->
    <div v-if="verifyResult" class="rounded-lg p-3 flex items-start gap-2" :class="verifyResult.success ? 'bg-success-muted border border-success' : 'bg-error-muted border border-error'">
      <Icon :name="verifyResult.success ? 'ShieldCheck' : 'ShieldAlert'" :size="16" :class="verifyResult.success ? 'text-success' : 'text-error'" class="flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm" :class="verifyResult.success ? 'text-success' : 'text-error'">{{ verifyResult.message }}</p>
        <button @click="dismissVerifyResult" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
      </div>
    </div>

    <!-- Stats (Advanced) -->
    <SectionPanel v-if="isAdvanced && backupsStore.stats" advanced>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
    </SectionPanel>

    <!-- Backup List -->
    <BackupListPanel
      @restore="handleRestore"
      @verify="handleVerify"
    />

    <!-- Schedules (Advanced) -->
    <SectionPanel advanced>
      <BackupSchedulePanel />
    </SectionPanel>

    <!-- Create Backup Modal (Advanced) -->
    <BackupCreateModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @created="handleCreated"
    />

    <!-- Restore Wizard -->
    <BackupRestoreWizard
      :show="showRestoreWizard"
      :backup="restoreTarget"
      @close="showRestoreWizard = false"
      @done="handleRestoreDone"
    />
  </div>
</template>
