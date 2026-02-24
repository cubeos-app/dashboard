<script setup>
/**
 * BackupSchedulePanel.vue — Schedule management
 *
 * List of schedules with CRUD, frequency picker with presets + custom cron,
 * scope/destination/encryption selectors, retention policy.
 */
import { ref, computed, onMounted } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { confirm } from '@/utils/confirmDialog'
import { cronToHuman, CRON_PRESETS } from '@/utils/cron'
import BackupDestinationPicker from './BackupDestinationPicker.vue'
import Icon from '@/components/ui/Icon.vue'

const backupsStore = useBackupsStore()
const { isMobile } = useBreakpoint()

const showForm = ref(false)
const editingSchedule = ref(null)
const formError = ref(null)
const submitting = ref(false)
const triggeringId = ref(null)

// Form state
const formName = ref('')
const formCronPreset = ref('0 2 * * *')
const formCustomCron = ref('')
const formUseCustom = ref(false)
const formScope = ref(1)
const formDestination = ref({ type: 'local' })
const formEncrypt = ref(false)
const formEncryptionMode = ref('device')
const formRetention = ref(5)
const formEnabled = ref(true)

const formCron = computed(() => formUseCustom.value ? formCustomCron.value : formCronPreset.value)

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (!formName.value.trim()) return false
  if (!formCron.value.trim()) return false
  return true
})

function resetForm() {
  formName.value = ''
  formCronPreset.value = '0 2 * * *'
  formCustomCron.value = ''
  formUseCustom.value = false
  formScope.value = 1
  formDestination.value = { type: 'local' }
  formEncrypt.value = false
  formEncryptionMode.value = 'device'
  formRetention.value = 5
  formEnabled.value = true
  editingSchedule.value = null
  formError.value = null
}

function openCreateForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(schedule) {
  editingSchedule.value = schedule
  formName.value = schedule.name || ''
  formEnabled.value = schedule.enabled !== false

  // Check if cron matches a preset
  const preset = CRON_PRESETS.find(p => p.value === schedule.cron)
  if (preset) {
    formCronPreset.value = preset.value
    formUseCustom.value = false
  } else {
    formCustomCron.value = schedule.cron || ''
    formUseCustom.value = true
  }

  formScope.value = schedule.scope || 1
  formDestination.value = schedule.destination || { type: 'local' }
  formEncrypt.value = !!schedule.encrypt
  formEncryptionMode.value = schedule.encryption_mode || 'device'
  formRetention.value = schedule.retention || 5
  formError.value = null
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  resetForm()
}

async function submitForm() {
  submitting.value = true
  formError.value = null
  try {
    const payload = {
      name: formName.value.trim(),
      cron: formCron.value.trim(),
      scope: formScope.value,
      destination: formDestination.value,
      encrypt: formEncrypt.value,
      encryption_mode: formEncrypt.value ? formEncryptionMode.value : undefined,
      retention: formRetention.value,
      enabled: formEnabled.value
    }

    if (editingSchedule.value) {
      await backupsStore.updateSchedule(editingSchedule.value.id, payload)
    } else {
      await backupsStore.createSchedule(payload)
    }
    closeForm()
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

async function deleteSchedule(schedule) {
  if (!await confirm({
    title: 'Delete Schedule',
    message: `Delete schedule "${schedule.name}"? This cannot be undone.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  try {
    await backupsStore.deleteSchedule(schedule.id)
  } catch (e) {
    formError.value = 'Delete failed: ' + e.message
  }
}

async function triggerSchedule(schedule) {
  triggeringId.value = schedule.id
  try {
    await backupsStore.triggerSchedule(schedule.id)
    await backupsStore.fetchBackups(true)
  } catch (e) {
    formError.value = 'Run failed: ' + e.message
  } finally {
    triggeringId.value = null
  }
}

async function toggleEnabled(schedule) {
  try {
    await backupsStore.updateSchedule(schedule.id, {
      ...schedule,
      enabled: !schedule.enabled
    })
  } catch (e) {
    formError.value = 'Update failed: ' + e.message
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function scopeLabel(s) {
  if (s === 3) return 'Tier 3'
  if (s === 2) return 'Tier 2'
  return 'Tier 1'
}

onMounted(() => {
  backupsStore.fetchSchedules()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-sm font-semibold text-theme-primary">Backup Schedules</h4>
        <p class="text-xs text-theme-muted">Automate regular backups on a schedule</p>
      </div>
      <button
        v-if="!showForm"
        @click="openCreateForm"
        class="px-3 py-1.5 border border-theme-secondary text-theme-secondary rounded-lg text-sm hover:bg-theme-tertiary flex items-center gap-1.5"
      >
        <Icon name="Plus" :size="14" />
        Add Schedule
      </button>
    </div>

    <!-- Error -->
    <div v-if="formError" class="bg-error-muted border border-error rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="14" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ formError }}</p>
        <button @click="formError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="backupsStore.schedulesLoading && !backupsStore.schedules.length" class="flex items-center justify-center py-8">
      <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
      <span class="ml-2 text-sm text-theme-muted">Loading schedules...</span>
    </div>

    <!-- Schedule list -->
    <div v-else-if="backupsStore.schedules.length && !showForm" class="space-y-2">
      <div
        v-for="schedule in backupsStore.schedules"
        :key="schedule.id"
        class="bg-theme-card rounded-xl border border-theme-primary p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h5 class="font-medium text-theme-primary text-sm">{{ schedule.name }}</h5>
              <span class="px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase" :class="schedule.enabled !== false ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'">
                {{ schedule.enabled !== false ? 'Active' : 'Paused' }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-theme-muted">
              <span class="flex items-center gap-1">
                <Icon name="Clock" :size="10" />
                {{ cronToHuman(schedule.cron) }}
              </span>
              <span>{{ scopeLabel(schedule.scope) }}</span>
              <span v-if="schedule.retention">Keep {{ schedule.retention }}</span>
              <span v-if="schedule.last_run" class="hidden sm:inline">Last: {{ formatDate(schedule.last_run) }}</span>
              <span v-if="schedule.next_run" class="hidden sm:inline">Next: {{ formatDate(schedule.next_run) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              @click="toggleEnabled(schedule)"
              class="p-1.5 rounded-lg transition-colors"
              :class="schedule.enabled !== false ? 'text-success hover:bg-success-muted' : 'text-theme-muted hover:bg-theme-tertiary'"
              :title="schedule.enabled !== false ? 'Pause schedule' : 'Enable schedule'"
            >
              <Icon :name="schedule.enabled !== false ? 'ToggleRight' : 'ToggleLeft'" :size="16" />
            </button>
            <button
              @click="triggerSchedule(schedule)"
              :disabled="triggeringId === schedule.id"
              class="p-1.5 text-theme-muted hover:text-accent rounded-lg hover:bg-accent-muted disabled:opacity-50"
              title="Run Now"
            >
              <Icon v-if="triggeringId === schedule.id" name="Loader2" :size="14" class="animate-spin" />
              <Icon v-else name="Play" :size="14" />
            </button>
            <button
              @click="openEditForm(schedule)"
              class="p-1.5 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary"
              title="Edit"
            >
              <Icon name="Pencil" :size="14" />
            </button>
            <button
              @click="deleteSchedule(schedule)"
              class="p-1.5 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted"
              title="Delete"
            >
              <Icon name="Trash2" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!showForm" class="bg-theme-card rounded-xl border border-theme-primary p-6 text-center">
      <Icon name="CalendarClock" :size="32" class="mx-auto text-theme-muted mb-3" />
      <p class="text-sm text-theme-muted mb-3">No backup schedules configured</p>
      <button @click="openCreateForm" class="px-3 py-1.5 btn-accent rounded-lg text-sm inline-flex items-center gap-1.5">
        <Icon name="Plus" :size="14" />
        Create Schedule
      </button>
    </div>

    <!-- Create/Edit Form -->
    <div v-if="showForm" class="bg-theme-card rounded-xl border border-theme-primary p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h5 class="text-sm font-semibold text-theme-primary">
          {{ editingSchedule ? 'Edit Schedule' : 'New Schedule' }}
        </h5>
        <button @click="closeForm" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg">
          <Icon name="X" :size="16" />
        </button>
      </div>

      <!-- Name -->
      <div>
        <label for="sched-name" class="block text-xs font-medium text-theme-secondary mb-1">Schedule Name</label>
        <input
          id="sched-name"
          v-model="formName"
          type="text"
          placeholder="Daily config backup"
          class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
        >
      </div>

      <!-- Frequency -->
      <div>
        <label class="block text-xs font-medium text-theme-secondary mb-1">Frequency</label>
        <div class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in CRON_PRESETS"
              :key="preset.value"
              type="button"
              @click="formCronPreset = preset.value; formUseCustom = false"
              class="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
              :class="!formUseCustom && formCronPreset === preset.value
                ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
                : 'border-theme-primary text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
            >
              {{ preset.label }}
            </button>
            <button
              type="button"
              @click="formUseCustom = true"
              class="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
              :class="formUseCustom
                ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
                : 'border-theme-primary text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
            >
              Custom...
            </button>
          </div>
          <input
            v-if="formUseCustom"
            v-model="formCustomCron"
            type="text"
            placeholder="0 */6 * * *"
            class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary font-mono text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
          >
          <p class="text-xs text-theme-muted">
            <Icon name="Clock" :size="10" class="inline" />
            {{ cronToHuman(formCron) }}
          </p>
        </div>
      </div>

      <!-- Scope -->
      <div>
        <label class="block text-xs font-medium text-theme-secondary mb-1">Backup Scope</label>
        <div class="flex gap-2">
          <button
            v-for="tier in [1, 2, 3]"
            :key="tier"
            type="button"
            @click="formScope = tier"
            class="flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-center"
            :class="formScope === tier
              ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
              : 'border-theme-primary text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
          >
            Tier {{ tier }}
          </button>
        </div>
        <p class="text-xs text-theme-muted mt-1">
          {{ formScope === 1 ? 'Database & Config (~2 MB)' : formScope === 2 ? 'Full System Config (~5-20 MB)' : 'Everything (~100 MB - 10 GB)' }}
        </p>
      </div>

      <!-- Destination -->
      <BackupDestinationPicker v-model="formDestination" />

      <!-- Encryption -->
      <div class="space-y-2">
        <label class="flex items-center gap-3 cursor-pointer">
          <input v-model="formEncrypt" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
          <span class="text-xs font-medium text-theme-secondary">Encrypt backups</span>
        </label>
        <div v-if="formEncrypt" class="ml-7 flex gap-2">
          <button
            type="button"
            @click="formEncryptionMode = 'device'"
            class="flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-center"
            :class="formEncryptionMode === 'device'
              ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
              : 'border-theme-primary text-theme-muted hover:bg-theme-tertiary'"
          >
            This device only
          </button>
          <button
            type="button"
            @click="formEncryptionMode = 'portable'"
            class="flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-center"
            :class="formEncryptionMode === 'portable'
              ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
              : 'border-theme-primary text-theme-muted hover:bg-theme-tertiary'"
          >
            Portable
          </button>
        </div>
        <p v-if="formEncrypt" class="text-xs text-theme-muted ml-7">
          {{ formEncryptionMode === 'device' ? 'Recommended for scheduled backups — no passphrase to store.' : 'Requires passphrase at restore time.' }}
        </p>
      </div>

      <!-- Retention -->
      <div>
        <label for="sched-retention" class="block text-xs font-medium text-theme-secondary mb-1">Retention (keep last N backups)</label>
        <input
          id="sched-retention"
          v-model.number="formRetention"
          type="number"
          min="1"
          max="100"
          class="w-24 px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
        >
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button @click="closeForm" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">
          Cancel
        </button>
        <button
          @click="submitForm"
          :disabled="!canSubmit"
          class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Icon v-if="submitting" name="Loader2" :size="14" class="animate-spin" />
          {{ editingSchedule ? 'Update' : 'Create' }} Schedule
        </button>
      </div>
    </div>
  </div>
</template>
