<script setup>
/**
 * ProfileSwitchProgressModal.vue
 *
 * Polls GET /api/v1/workflows/{jobId} to show access profile switch progress.
 * Uses polling (not SSE) since workflow runs don't have SSE endpoints.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  jobId: { type: String, required: true },
  fromProfile: { type: String, default: '' },
  toProfile: { type: String, default: '' }
})

const emit = defineEmits(['done', 'error', 'close'])

const STEPS = [
  { key: 'validate_transition', label: 'Validating transition' },
  { key: 'pause_app_updates', label: 'Preparing migration' },
  { key: 'teardown_old_access', label: 'Removing old access entries' },
  { key: 'update_profile_db', label: 'Updating profile' },
  { key: 'configure_new_services', label: 'Configuring services' },
  { key: 'migrate_app_entries', label: 'Migrating app entries' },
  { key: 'verify_access', label: 'Verifying access' },
  { key: 'resume_app_updates', label: 'Finalizing' },
  { key: 'complete', label: 'Profile switch complete' }
]

const PROGRESS_MAP = {
  validate_transition: 10,
  pause_app_updates: 15,
  teardown_old_access: 25,
  update_profile_db: 35,
  configure_new_services: 45,
  migrate_app_entries: 80,
  verify_access: 95,
  resume_app_updates: 99
}

const currentStep = ref('')
const progress = ref(0)
const isDone = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const completedSteps = ref(new Set())

let pollTimer = null

const profileLabel = {
  standard: 'Standard',
  advanced: 'Advanced',
  all_in_one: 'All-in-One'
}

const title = computed(() => {
  if (isDone.value) return 'Profile Switch Complete'
  if (hasError.value) return 'Profile Switch Failed'
  return `Switching to ${profileLabel[props.toProfile] || props.toProfile}`
})

function stepStatus(stepKey) {
  if (completedSteps.value.has(stepKey)) return 'done'
  if (currentStep.value === stepKey) {
    if (hasError.value) return 'error'
    return 'active'
  }
  return 'pending'
}

async function poll() {
  try {
    const data = await api.get(`/workflows/${props.jobId}`)
    if (!data || !data.steps) return

    // Update step statuses
    for (const step of data.steps) {
      if (step.status === 'completed') {
        completedSteps.value.add(step.step_name)
        progress.value = Math.max(progress.value, PROGRESS_MAP[step.step_name] || 50)
      } else if (step.status === 'running') {
        currentStep.value = step.step_name
        progress.value = PROGRESS_MAP[step.step_name] || 50
      } else if (step.status === 'failed') {
        currentStep.value = step.step_name
        hasError.value = true
        errorMessage.value = step.error || 'Step failed'
        stopPolling()
        emit('error', errorMessage.value)
        return
      }
    }

    // Check workflow-level terminal state
    if (data.current_state === 'completed') {
      isDone.value = true
      progress.value = 100
      completedSteps.value.add('complete')
      stopPolling()
      emit('done')
    } else if (data.current_state === 'failed' || data.current_state === 'compensated') {
      hasError.value = true
      errorMessage.value = data.error || `Workflow ${data.current_state}`
      stopPolling()
      emit('error', errorMessage.value)
    }
  } catch (err) {
    // Network errors: keep polling, don't mark as failed yet
    console.warn('Profile switch poll error:', err)
  }
}

function startPolling() {
  poll()
  pollTimer = setInterval(poll, 1000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleClose() {
  stopPolling()
  emit('close')
}

onMounted(() => { startPolling() })
onUnmounted(() => { stopPolling() })
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"></div>

    <!-- Modal -->
    <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-3 p-5 border-b border-theme-primary">
        <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
          <Icon name="ArrowRightLeft" :size="24" class="text-theme-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-theme-primary truncate">{{ title }}</h2>
          <p class="text-xs text-theme-muted mt-0.5">
            {{ profileLabel[fromProfile] || fromProfile }} &rarr; {{ profileLabel[toProfile] || toProfile }}
          </p>
        </div>
        <button
          v-if="isDone || hasError"
          @click="handleClose"
          aria-label="Close"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- Progress bar -->
      <div class="h-1.5 bg-theme-tertiary">
        <div
          class="h-full transition-all duration-500 ease-out rounded-r-full"
          :class="hasError ? 'bg-error' : isDone ? 'bg-success' : 'bg-accent'"
          :style="{ width: progress + '%' }"
        ></div>
      </div>

      <!-- Steps list -->
      <div class="p-5 space-y-2.5 max-h-80 overflow-y-auto">
        <div
          v-for="step in STEPS"
          :key="step.key"
          class="flex items-center gap-3 text-sm"
          :class="{
            'text-theme-muted': stepStatus(step.key) === 'pending',
            'text-theme-primary font-medium': stepStatus(step.key) === 'active',
            'text-success': stepStatus(step.key) === 'done',
            'text-error': stepStatus(step.key) === 'error',
          }"
        >
          <div class="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <div
              v-if="stepStatus(step.key) === 'pending'"
              class="w-3 h-3 rounded-full border-2 border-theme-tertiary"
            ></div>
            <Icon
              v-else-if="stepStatus(step.key) === 'active'"
              name="Loader2"
              :size="16"
              class="animate-spin text-accent"
            />
            <Icon
              v-else-if="stepStatus(step.key) === 'done'"
              name="CheckCircle"
              :size="16"
              class="text-success"
            />
            <Icon
              v-else-if="stepStatus(step.key) === 'error'"
              name="XCircle"
              :size="16"
              class="text-error"
            />
          </div>
          <span>{{ step.label }}</span>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="hasError" class="px-5 pb-4">
        <div class="p-3 rounded-lg bg-error/10 border border-error/20">
          <p class="text-sm text-error font-medium">Error</p>
          <p class="text-xs text-error/80 mt-1">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-theme-primary bg-theme-secondary">
        <template v-if="isDone || hasError">
          <button
            @click="handleClose"
            class="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isDone
              ? 'btn-accent'
              : 'border border-theme-primary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'"
          >
            {{ isDone ? 'Done' : 'Close' }}
          </button>
        </template>
        <span v-else class="text-xs text-theme-muted">
          {{ progress }}% complete
        </span>
      </div>
    </div>
  </div>
</template>
