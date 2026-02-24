<script setup>
/**
 * BackupCreateModal.vue — Custom backup creation dialog
 *
 * Modal with:
 * 1. Scope selector (Tier 1/2/3 cards)
 * 2. Destination picker
 * 3. Encryption section (device / portable mode)
 * 4. Description field
 * 5. Create button → submits, shows progress via SSE
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import { useFocusTrap } from '@/composables/useFocusTrap'
import BackupDestinationPicker from './BackupDestinationPicker.vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true }
})

const emit = defineEmits(['close', 'created'])

const backupsStore = useBackupsStore()
const { trapFocus } = useFocusTrap()

const modalRef = ref(null)

// Form state
const scope = ref(1)
const destination = ref({ type: 'local' })
const encrypt = ref(false)
const encryptionMode = ref('device')
const passphrase = ref('')
const description = ref('')
const creating = ref(false)
const createError = ref(null)

// SSE progress
const workflowId = ref(null)
const progress = ref(0)
const progressDetail = ref('')

const SCOPE_OPTIONS = [
  {
    tier: 1,
    label: 'Database & Config',
    description: 'CubeOS database, system configuration, and app metadata.',
    estimate: '~2 MB',
    icon: 'Database'
  },
  {
    tier: 2,
    label: 'Full System Config',
    description: 'Tier 1 + Docker compose files, DNS records, proxy rules.',
    estimate: '~5-20 MB',
    icon: 'Settings'
  },
  {
    tier: 3,
    label: 'Everything',
    description: 'Tier 2 + Docker volumes and all app data.',
    estimate: '~100 MB - 10 GB',
    icon: 'Package',
    warning: true
  }
]

const canCreate = computed(() => {
  if (creating.value) return false
  if (encrypt.value && encryptionMode.value === 'portable' && !passphrase.value) return false
  return true
})

const passphraseStrength = computed(() => {
  const p = passphrase.value
  if (!p) return { label: '', class: '' }
  if (p.length < 8) return { label: 'Weak', class: 'text-error' }
  if (p.length < 12) return { label: 'Fair', class: 'text-warning' }
  if (p.length >= 12 && /[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: 'Strong', class: 'text-success' }
  return { label: 'Good', class: 'text-accent' }
})

watch(() => props.show, (visible) => {
  if (visible) {
    resetForm()
    nextTick(() => modalRef.value?.focus())
  }
})

function resetForm() {
  scope.value = 1
  destination.value = { type: 'local' }
  encrypt.value = false
  encryptionMode.value = 'device'
  passphrase.value = ''
  description.value = ''
  creating.value = false
  createError.value = null
  workflowId.value = null
  progress.value = 0
  progressDetail.value = ''
}

async function handleCreate() {
  creating.value = true
  createError.value = null
  try {
    const config = {
      scope: scope.value,
      destination: destination.value,
      description: description.value,
      compress: true
    }
    // Map scope to type for backward compat
    if (scope.value === 1) config.type = 'config'
    else if (scope.value === 2) config.type = 'config'
    else config.type = 'full'

    if (encrypt.value) {
      config.encrypt = true
      config.encryption_mode = encryptionMode.value
      if (encryptionMode.value === 'portable') {
        config.passphrase = passphrase.value
      }
    }

    const result = await backupsStore.createBackup(config)

    // If API returned a workflow_id, track SSE progress
    if (result?.workflow_id) {
      workflowId.value = result.workflow_id
      trackProgress(result.workflow_id)
    } else {
      emit('created', result)
      emit('close')
    }
  } catch (e) {
    createError.value = e.message
    creating.value = false
  }
}

function trackProgress(wfId) {
  const token = localStorage.getItem('cubeos_access_token') || ''
  const url = `/api/v1/workflows/${encodeURIComponent(wfId)}/progress${token ? '?token=' + encodeURIComponent(token) : ''}`
  const es = new EventSource(url)

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      progress.value = event.progress || 0
      progressDetail.value = event.detail || ''

      if (event.status === 'done') {
        es.close()
        creating.value = false
        emit('created', event)
        emit('close')
      } else if (event.status === 'error') {
        es.close()
        creating.value = false
        createError.value = event.error || event.detail || 'Backup failed'
      }
    } catch (err) {
      // ignore parse errors
    }
  }

  es.onerror = () => {
    setTimeout(() => {
      if (es.readyState === EventSource.CLOSED && creating.value) {
        creating.value = false
        createError.value = 'Connection lost during backup'
      }
    }, 5000)
  }
}

function close() {
  if (!creating.value) {
    emit('close')
  }
}
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
        aria-label="Create Backup"
        tabindex="-1"
        @keydown.escape="close"
        @keydown="trapFocus"
      >
        <div class="absolute inset-0 bg-theme-overlay" @click="close"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-lg border border-theme-primary max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary flex-shrink-0">
            <h3 class="text-lg font-semibold text-theme-primary">Create Backup</h3>
            <button @click="close" :disabled="creating" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg disabled:opacity-50" aria-label="Close">
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-5 overflow-y-auto">
            <!-- Progress overlay when creating -->
            <div v-if="workflowId && creating" class="space-y-3">
              <div class="flex items-center gap-3">
                <Icon name="Loader2" :size="20" class="animate-spin text-accent" />
                <span class="text-sm text-theme-primary font-medium">Creating backup...</span>
              </div>
              <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
                <div class="h-full bg-accent rounded-full transition-all duration-500" :style="{ width: progress + '%' }"></div>
              </div>
              <p class="text-xs text-theme-muted">{{ progressDetail }}</p>
            </div>

            <template v-else>
              <!-- 1. Scope selector -->
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Backup Scope</label>
                <div class="space-y-2">
                  <button
                    v-for="opt in SCOPE_OPTIONS"
                    :key="opt.tier"
                    type="button"
                    @click="scope = opt.tier"
                    class="w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors"
                    :class="scope === opt.tier
                      ? 'border-[color:var(--accent-primary)] bg-accent-muted'
                      : 'border-theme-primary hover:bg-theme-tertiary'"
                  >
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :class="scope === opt.tier ? 'bg-accent text-on-accent' : 'bg-theme-tertiary text-theme-muted'">
                      <Icon :name="opt.icon" :size="16" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-medium" :class="scope === opt.tier ? 'text-accent' : 'text-theme-primary'">
                          Tier {{ opt.tier }}: {{ opt.label }}
                        </span>
                        <span class="text-xs text-theme-muted ml-2">{{ opt.estimate }}</span>
                      </div>
                      <p class="text-xs text-theme-muted mt-0.5">{{ opt.description }}</p>
                      <p v-if="opt.warning && scope === opt.tier" class="text-xs text-warning mt-1 flex items-center gap-1">
                        <Icon name="AlertTriangle" :size="10" />
                        Large backup — may take several minutes
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 2. Destination picker -->
              <BackupDestinationPicker v-model="destination" />

              <!-- 3. Encryption section -->
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="encrypt" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm font-medium text-theme-secondary">Encrypt backup</span>
                </label>

                <div v-if="encrypt" class="ml-7 space-y-3">
                  <!-- Mode selector -->
                  <div class="space-y-2">
                    <button
                      type="button"
                      @click="encryptionMode = 'device'"
                      class="w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors"
                      :class="encryptionMode === 'device'
                        ? 'border-[color:var(--accent-primary)] bg-accent-muted'
                        : 'border-theme-primary hover:bg-theme-tertiary'"
                    >
                      <Icon name="Cpu" :size="16" :class="encryptionMode === 'device' ? 'text-accent' : 'text-theme-muted'" class="mt-0.5" />
                      <div>
                        <span class="text-sm font-medium" :class="encryptionMode === 'device' ? 'text-accent' : 'text-theme-primary'">This device only</span>
                        <p class="text-xs text-theme-muted mt-0.5">Auto-encrypts with device key. No passphrase needed. Can only be restored on this Pi.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      @click="encryptionMode = 'portable'"
                      class="w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors"
                      :class="encryptionMode === 'portable'
                        ? 'border-[color:var(--accent-primary)] bg-accent-muted'
                        : 'border-theme-primary hover:bg-theme-tertiary'"
                    >
                      <Icon name="Key" :size="16" :class="encryptionMode === 'portable' ? 'text-accent' : 'text-theme-muted'" class="mt-0.5" />
                      <div>
                        <span class="text-sm font-medium" :class="encryptionMode === 'portable' ? 'text-accent' : 'text-theme-primary'">Portable</span>
                        <p class="text-xs text-theme-muted mt-0.5">Requires a passphrase. Can be restored on any CubeOS device.</p>
                      </div>
                    </button>
                  </div>

                  <!-- Passphrase (portable mode only) -->
                  <div v-if="encryptionMode === 'portable'" class="space-y-1">
                    <label for="backup-passphrase" class="block text-xs font-medium text-theme-secondary">Passphrase</label>
                    <input
                      id="backup-passphrase"
                      v-model="passphrase"
                      type="password"
                      placeholder="Enter a strong passphrase"
                      class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                    >
                    <p v-if="passphrase" class="text-xs" :class="passphraseStrength.class">
                      Strength: {{ passphraseStrength.label }}
                    </p>
                  </div>

                  <p class="text-xs text-warning flex items-start gap-1">
                    <Icon name="AlertTriangle" :size="10" class="flex-shrink-0 mt-0.5" />
                    <span>Device-mode backups can only be restored on this Pi. Use Portable mode if you might restore on a different device.</span>
                  </p>
                </div>
              </div>

              <!-- 4. Description -->
              <div>
                <label for="backup-create-desc" class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
                <input
                  id="backup-create-desc"
                  v-model="description"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="Pre-upgrade backup"
                >
              </div>
            </template>

            <!-- Error -->
            <div v-if="createError" class="bg-error-muted border border-error rounded-lg p-3 flex items-start gap-2">
              <Icon name="AlertTriangle" :size="14" class="text-error flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-error">{{ createError }}</p>
                <button @click="createError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary flex-shrink-0">
            <button @click="close" :disabled="creating" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm disabled:opacity-50">
              Cancel
            </button>
            <button
              @click="handleCreate"
              :disabled="!canCreate"
              class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon v-if="creating" name="Loader2" :size="14" class="animate-spin" />
              Create Backup
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
