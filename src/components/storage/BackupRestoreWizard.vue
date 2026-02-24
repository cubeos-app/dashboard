<script setup>
/**
 * BackupRestoreWizard.vue — Guided multi-step restore flow
 *
 * Steps:
 * 1. Select backup (pre-selected or pick from list)
 * 2. Review manifest (scope, date, apps, schema, encryption info)
 * 3. Confirm (explicit confirmation with passphrase if portable-encrypted)
 * 4. Progress (FlowEngine workflow progress via SSE)
 * 5. Complete (success/failure summary)
 */
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  /** Pre-selected backup to restore */
  backup: { type: Object, default: null }
})

const emit = defineEmits(['close', 'done'])

const backupsStore = useBackupsStore()
const { trapFocus } = useFocusTrap()

const modalRef = ref(null)
const step = ref(1)
const selectedBackup = ref(null)
const passphrase = ref('')
const restoreError = ref(null)
const restoreResult = ref(null)

// SSE progress
const progress = ref(0)
const progressDetail = ref('')
const progressSteps = ref([])
let eventSource = null

const totalSteps = 5

// Step labels
const STEP_LABELS = ['Select', 'Review', 'Confirm', 'Restoring', 'Done']

watch(() => props.show, (visible) => {
  if (visible) {
    resetWizard()
    if (props.backup) {
      selectedBackup.value = props.backup
      step.value = 2
    }
    nextTick(() => modalRef.value?.focus())
  }
})

function resetWizard() {
  step.value = 1
  selectedBackup.value = null
  passphrase.value = ''
  restoreError.value = null
  restoreResult.value = null
  progress.value = 0
  progressDetail.value = ''
  progressSteps.value = []
  closeSSE()
}

function selectBackup(backup) {
  selectedBackup.value = backup
  step.value = 2
}

function isEncrypted(backup) {
  return backup?.encrypted || backup?.encrypt
}

function isPortableEncrypted(backup) {
  return isEncrypted(backup) && backup?.encryption_mode === 'portable'
}

function isDeviceEncrypted(backup) {
  return isEncrypted(backup) && backup?.encryption_mode !== 'portable'
}

const canConfirm = computed(() => {
  if (!selectedBackup.value) return false
  if (isPortableEncrypted(selectedBackup.value) && !passphrase.value) return false
  return true
})

function scopeLabel(backup) {
  const scope = backup?.scope || backup?.type
  if (!scope) return 'Tier 1 — Database & Config'
  const s = String(scope).toLowerCase()
  if (s === '3' || s === 'full' || s === 'everything') return 'Tier 3 — Everything'
  if (s === '2' || s === 'data' || s === 'system') return 'Tier 2 — Full System Config'
  return 'Tier 1 — Database & Config'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = Number(bytes)
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

// ─── Restore Execution ──────────────────────────────────────

async function startRestore() {
  step.value = 4
  restoreError.value = null
  try {
    const payload = {}
    if (isPortableEncrypted(selectedBackup.value)) {
      payload.passphrase = passphrase.value
    }

    const result = await backupsStore.restoreBackup(selectedBackup.value.id, payload)

    if (result?.workflow_id) {
      trackProgress(result.workflow_id)
    } else {
      restoreResult.value = result
      step.value = 5
    }
  } catch (e) {
    restoreError.value = e.message
    step.value = 5
  }
}

function trackProgress(wfId) {
  const token = localStorage.getItem('cubeos_access_token') || ''
  const url = `/api/v1/workflows/${encodeURIComponent(wfId)}/progress${token ? '?token=' + encodeURIComponent(token) : ''}`

  eventSource = new EventSource(url)

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      progress.value = event.progress || 0
      progressDetail.value = event.detail || ''

      if (event.step) {
        const existing = progressSteps.value.find(s => s.key === event.step)
        if (existing) {
          existing.status = event.status || 'running'
        } else {
          // Mark previous steps done
          progressSteps.value.forEach(s => {
            if (s.status === 'running') s.status = 'done'
          })
          progressSteps.value.push({
            key: event.step,
            label: event.detail || event.step,
            status: event.status === 'done' ? 'done' : 'running'
          })
        }
      }

      if (event.status === 'done') {
        closeSSE()
        restoreResult.value = event
        step.value = 5
      } else if (event.status === 'error') {
        closeSSE()
        restoreError.value = event.error || event.detail || 'Restore failed'
        step.value = 5
      }
    } catch (err) {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    setTimeout(() => {
      if (eventSource?.readyState === EventSource.CLOSED && step.value === 4) {
        closeSSE()
        restoreError.value = 'Connection lost during restore'
        step.value = 5
      }
    }, 5000)
  }
}

function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function close() {
  if (step.value === 4) return // Don't close during restore
  closeSSE()
  emit('close')
  if (step.value === 5 && !restoreError.value) {
    emit('done')
  }
}

onUnmounted(() => {
  closeSSE()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        ref="modalRef"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Restore Backup"
        tabindex="-1"
        @keydown.escape="close"
        @keydown="trapFocus"
      >
        <div class="absolute inset-0 bg-theme-overlay" @click="close"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-lg border border-theme-primary max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary flex-shrink-0">
            <h3 class="text-lg font-semibold text-theme-primary">Restore Backup</h3>
            <button
              v-if="step !== 4"
              @click="close"
              class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg"
              aria-label="Close"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Step indicator -->
          <div class="px-6 py-3 border-b border-theme-primary flex-shrink-0">
            <div class="flex items-center gap-1">
              <template v-for="(label, i) in STEP_LABELS" :key="i">
                <div class="flex items-center gap-1">
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    :class="step > (i + 1) ? 'bg-success text-on-accent' : step === (i + 1) ? 'bg-accent text-on-accent' : 'bg-theme-tertiary text-theme-muted'"
                  >
                    <Icon v-if="step > (i + 1)" name="Check" :size="12" />
                    <span v-else>{{ i + 1 }}</span>
                  </div>
                  <span class="text-xs hidden sm:inline" :class="step === (i + 1) ? 'text-accent font-medium' : 'text-theme-muted'">{{ label }}</span>
                </div>
                <div v-if="i < STEP_LABELS.length - 1" class="flex-1 h-px bg-theme-tertiary mx-1"></div>
              </template>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto flex-1">

            <!-- Step 1: Select backup -->
            <div v-if="step === 1" class="space-y-3">
              <p class="text-sm text-theme-muted mb-3">Select a backup to restore from:</p>
              <div
                v-for="b in backupsStore.backups"
                :key="b.id"
                @click="selectBackup(b)"
                class="flex items-center gap-3 p-3 rounded-lg border border-theme-primary hover:bg-theme-tertiary cursor-pointer transition-colors"
              >
                <Icon name="Archive" :size="16" class="text-theme-muted flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <h5 class="text-sm font-medium text-theme-primary truncate">{{ b.filename || b.id }}</h5>
                  <p class="text-xs text-theme-muted">{{ formatDate(b.created_at) }} · {{ b.size_human || formatBytes(b.size_bytes) }}</p>
                </div>
                <Icon name="ChevronRight" :size="14" class="text-theme-muted flex-shrink-0" />
              </div>
              <p v-if="!backupsStore.backups.length" class="text-sm text-theme-muted text-center py-4">No backups available.</p>
            </div>

            <!-- Step 2: Review -->
            <div v-if="step === 2 && selectedBackup" class="space-y-4">
              <h4 class="text-sm font-semibold text-theme-primary">Backup Details</h4>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-xs text-theme-muted block">Name</span>
                  <span class="text-theme-primary">{{ selectedBackup.filename || selectedBackup.id }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Scope</span>
                  <span class="text-theme-primary">{{ scopeLabel(selectedBackup) }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Created</span>
                  <span class="text-theme-primary">{{ formatDate(selectedBackup.created_at) }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Size</span>
                  <span class="text-theme-primary">{{ selectedBackup.size_human || formatBytes(selectedBackup.size_bytes) }}</span>
                </div>
                <div v-if="selectedBackup.schema_version">
                  <span class="text-xs text-theme-muted block">Schema Version</span>
                  <span class="text-theme-primary">{{ selectedBackup.schema_version }}</span>
                </div>
                <div v-if="selectedBackup.apps?.length">
                  <span class="text-xs text-theme-muted block">Apps</span>
                  <span class="text-theme-primary text-xs">{{ selectedBackup.apps.join(', ') }}</span>
                </div>
              </div>

              <!-- Config snapshot info -->
              <div class="flex items-center gap-2 p-2 rounded-lg bg-theme-tertiary text-xs text-theme-secondary">
                <Icon name="Settings" :size="12" class="flex-shrink-0" />
                <span>This backup includes a system config snapshot from {{ formatDate(selectedBackup.created_at) }}</span>
              </div>

              <!-- Encryption info -->
              <div v-if="isDeviceEncrypted(selectedBackup)" class="flex items-center gap-2 p-2 rounded-lg bg-accent-muted text-xs text-accent">
                <Icon name="Lock" :size="12" class="flex-shrink-0" />
                <span>This backup was encrypted for this device — no passphrase needed</span>
              </div>
              <div v-if="isPortableEncrypted(selectedBackup)" class="space-y-2">
                <div class="flex items-center gap-2 p-2 rounded-lg bg-warning-muted text-xs text-warning">
                  <Icon name="Key" :size="12" class="flex-shrink-0" />
                  <span>This backup is portable-encrypted — passphrase required</span>
                </div>
                <div>
                  <label for="restore-passphrase" class="block text-xs font-medium text-theme-secondary mb-1">Passphrase</label>
                  <input
                    id="restore-passphrase"
                    v-model="passphrase"
                    type="password"
                    placeholder="Enter the passphrase used to encrypt this backup"
                    class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  >
                </div>
              </div>

              <!-- Warnings -->
              <div v-if="selectedBackup.schema_version_mismatch" class="flex items-start gap-2 p-2 rounded-lg bg-warning-muted text-xs text-warning">
                <Icon name="AlertTriangle" :size="12" class="flex-shrink-0 mt-0.5" />
                <span>Schema version differs from current installation. Some data may need migration.</span>
              </div>
            </div>

            <!-- Step 3: Confirm -->
            <div v-if="step === 3" class="space-y-4 text-center">
              <div class="w-14 h-14 mx-auto rounded-full bg-warning-muted flex items-center justify-center">
                <Icon name="AlertTriangle" :size="28" class="text-warning" />
              </div>
              <h4 class="text-lg font-semibold text-theme-primary">Confirm Restore</h4>
              <p class="text-sm text-theme-muted">
                This will overwrite current data with the backup from
                <strong class="text-theme-primary">{{ formatDate(selectedBackup?.created_at) }}</strong>.
                The system may restart.
              </p>
              <p class="text-xs text-error font-medium">This action cannot be undone.</p>
            </div>

            <!-- Step 4: Progress -->
            <div v-if="step === 4" class="space-y-4">
              <div class="flex items-center gap-3 mb-4">
                <Icon name="Loader2" :size="20" class="animate-spin text-accent" />
                <span class="text-sm font-medium text-theme-primary">Restoring backup...</span>
              </div>
              <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
                <div class="h-full bg-accent rounded-full transition-all duration-500" :style="{ width: progress + '%' }"></div>
              </div>
              <p class="text-xs text-theme-muted">{{ progressDetail }}</p>

              <!-- Step list -->
              <div v-if="progressSteps.length" class="space-y-2 mt-4">
                <div v-for="s in progressSteps" :key="s.key" class="flex items-center gap-2 text-sm">
                  <div class="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <Icon v-if="s.status === 'running'" name="Loader2" :size="14" class="animate-spin text-accent" />
                    <Icon v-else-if="s.status === 'done'" name="CheckCircle" :size="14" class="text-success" />
                    <Icon v-else name="XCircle" :size="14" class="text-error" />
                  </div>
                  <span :class="s.status === 'running' ? 'text-theme-primary font-medium' : s.status === 'done' ? 'text-success' : 'text-error'">
                    {{ s.label }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Step 5: Complete -->
            <div v-if="step === 5" class="space-y-4 text-center">
              <template v-if="restoreError">
                <div class="w-14 h-14 mx-auto rounded-full bg-error-muted flex items-center justify-center">
                  <Icon name="XCircle" :size="28" class="text-error" />
                </div>
                <h4 class="text-lg font-semibold text-theme-primary">Restore Failed</h4>
                <div class="p-3 rounded-lg bg-error/10 border border-error/20">
                  <p class="text-sm text-error">{{ restoreError }}</p>
                </div>
              </template>
              <template v-else>
                <div class="w-14 h-14 mx-auto rounded-full bg-success-muted flex items-center justify-center">
                  <Icon name="CheckCircle" :size="28" class="text-success" />
                </div>
                <h4 class="text-lg font-semibold text-theme-primary">Restore Complete</h4>
                <p class="text-sm text-theme-muted">
                  Successfully restored from backup. {{ restoreResult?.message || 'The system may need to restart.' }}
                </p>
              </template>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-theme-primary flex-shrink-0">
            <div>
              <button
                v-if="step === 2"
                @click="step = 1; selectedBackup = null"
                class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm flex items-center gap-1"
              >
                <Icon name="ChevronLeft" :size="14" />
                Back
              </button>
              <button
                v-if="step === 3"
                @click="step = 2"
                class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm flex items-center gap-1"
              >
                <Icon name="ChevronLeft" :size="14" />
                Back
              </button>
            </div>
            <div class="flex items-center gap-3">
              <!-- Step 2: Next to Confirm -->
              <template v-if="step === 2">
                <button @click="close" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">Cancel</button>
                <button
                  @click="step = 3"
                  :disabled="!canConfirm"
                  class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
                >
                  Review
                  <Icon name="ChevronRight" :size="14" />
                </button>
              </template>

              <!-- Step 3: Confirm restore -->
              <template v-if="step === 3">
                <button @click="close" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">Cancel</button>
                <button
                  @click="startRestore"
                  class="px-4 py-2 rounded-lg text-sm font-medium btn-error flex items-center gap-2"
                >
                  <Icon name="RotateCcw" :size="14" />
                  Restore Now
                </button>
              </template>

              <!-- Step 4: In progress -->
              <template v-if="step === 4">
                <span class="text-xs text-theme-muted">{{ progress }}% complete</span>
              </template>

              <!-- Step 5: Done -->
              <template v-if="step === 5">
                <button @click="close" class="px-4 py-2 btn-accent rounded-lg text-sm">
                  {{ restoreError ? 'Close' : 'Done' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
