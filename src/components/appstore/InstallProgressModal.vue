<script setup>
/**
 * InstallProgressModal.vue
 *
 * Batch 2: Added sseBasePath prop so registry installs can use
 * /api/v1/apps/jobs/ instead of /api/v1/appstore/jobs/.
 * Added REGISTRY_INSTALL_STEPS for registry-specific progress labels.
 */
import { ref, computed, onUnmounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { safeGetRaw } from '@/utils/storage'

const props = defineProps({
  /** App display name */
  appName: { type: String, required: true },
  /** App icon URL */
  appIcon: { type: String, default: '' },
  /** "install" or "uninstall" */
  jobType: { type: String, default: 'install' },
  /** Job ID from the API */
  jobId: { type: String, required: true },
  /**
   * Batch 2: SSE base path for job progress streaming.
   * Store installs use /api/v1/appstore/jobs/ (default).
   * Registry installs use /api/v1/apps/jobs/.
   */
  sseBasePath: { type: String, default: '/api/v1/appstore/jobs/' },
})

const emit = defineEmits(['done', 'error', 'close'])

// ==========================================
// Step definitions
// ==========================================

const INSTALL_STEPS = [
  { key: 'validate', label: 'Validating manifest' },
  { key: 'manifest', label: 'Reading configuration' },
  { key: 'directories', label: 'Creating directories' },
  { key: 'compose', label: 'Preparing containers' },
  { key: 'port', label: 'Allocating port' },
  { key: 'volumes', label: 'Configuring volumes' },
  { key: 'deploy', label: 'Deploying containers' },
  { key: 'services', label: 'Starting services' },
  { key: 'dns', label: 'Configuring DNS' },
  { key: 'proxy', label: 'Setting up access' },
  { key: 'database', label: 'Saving configuration' },
  { key: 'health_check', label: 'Verifying accessibility' },
  { key: 'complete', label: 'Ready!' },
]

/**
 * Batch 2: Registry installs emit different step keys from the
 * Orchestrator.InstallFromRegistryWithProgress() pipeline.
 */
const REGISTRY_INSTALL_STEPS = [
  { key: 'setup', label: 'Creating app directories' },
  { key: 'port', label: 'Allocating port' },
  { key: 'manifest', label: 'Detecting container port' },
  { key: 'compose', label: 'Generating configuration' },
  { key: 'database', label: 'Saving to database' },
  { key: 'deploy', label: 'Deploying containers' },
  { key: 'dns', label: 'Configuring DNS' },
  { key: 'proxy', label: 'Setting up access' },
  { key: 'complete', label: 'Ready!' },
]

const UNINSTALL_STEPS = [
  { key: 'validate', label: 'Validating app' },
  { key: 'stop', label: 'Stopping services' },
  { key: 'remove_stack', label: 'Removing containers' },
  { key: 'remove_dns', label: 'Removing DNS entry' },
  { key: 'remove_proxy', label: 'Removing proxy' },
  { key: 'cleanup', label: 'Cleaning up files' },
  { key: 'database', label: 'Removing configuration' },
  { key: 'complete', label: 'Uninstalled' },
]

/**
 * Determine which step set to use based on job type and SSE path.
 * Registry installs are identified by the /apps/jobs/ SSE path.
 */
const isRegistryInstall = computed(() =>
  props.sseBasePath.includes('/apps/jobs/')
)

const steps = computed(() => {
  if (props.jobType === 'uninstall') return UNINSTALL_STEPS
  if (isRegistryInstall.value) return REGISTRY_INSTALL_STEPS
  return INSTALL_STEPS
})

// ==========================================
// State
// ==========================================

const currentStep = ref('')
const progress = ref(0)
const detail = ref('')
const isDone = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const completedSteps = ref(new Set())

let eventSource = null

// ==========================================
// SSE connection
// ==========================================

function connect() {
  // Build SSE URL using the configurable base path.
  // Auth token is sent via query param since EventSource
  // doesn't support custom headers.
  const token = safeGetRaw('cubeos_access_token') || ''
  const basePath = props.sseBasePath.endsWith('/') ? props.sseBasePath : props.sseBasePath + '/'
  const url = `${basePath}${encodeURIComponent(props.jobId)}${token ? '?token=' + encodeURIComponent(token) : ''}`

  eventSource = new EventSource(url)

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      handleEvent(event)
    } catch (err) {
      console.warn('Failed to parse SSE event:', err)
    }
  }

  eventSource.onerror = () => {
    // EventSource auto-reconnects, but if we're done, just close
    if (isDone.value || hasError.value) {
      closeConnection()
      return
    }
    // If connection drops before completion, mark as error after a delay
    setTimeout(() => {
      if (!isDone.value && !hasError.value && eventSource?.readyState === EventSource.CLOSED) {
        hasError.value = true
        errorMessage.value = 'Connection to server lost'
        emit('error', errorMessage.value)
      }
    }, 5000)
  }
}

function handleEvent(event) {
  currentStep.value = event.step
  progress.value = event.progress || 0
  detail.value = event.detail || ''

  // Mark all previous steps as complete
  const stepKeys = steps.value.map(s => s.key)
  const currentIdx = stepKeys.indexOf(event.step)
  if (currentIdx > 0) {
    for (let i = 0; i < currentIdx; i++) {
      completedSteps.value.add(stepKeys[i])
    }
  }

  if (event.status === 'done') {
    completedSteps.value.add('complete')
    isDone.value = true
    closeConnection()
    emit('done')
  } else if (event.status === 'error') {
    hasError.value = true
    errorMessage.value = event.error || event.detail || 'Unknown error'
    closeConnection()
    emit('error', errorMessage.value)
  }
}

function closeConnection() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

// ==========================================
// Computed
// ==========================================

const title = computed(() => {
  if (isDone.value) {
    return props.jobType === 'uninstall' ? 'Uninstalled' : 'Installed'
  }
  if (hasError.value) {
    return props.jobType === 'uninstall' ? 'Uninstall Failed' : 'Installation Failed'
  }
  return props.jobType === 'uninstall'
    ? `Uninstalling ${props.appName}`
    : `Installing ${props.appName}`
})

function stepStatus(stepKey) {
  if (completedSteps.value.has(stepKey)) return 'done'
  if (currentStep.value === stepKey) {
    if (hasError.value) return 'error'
    return 'active'
  }
  return 'pending'
}

// ==========================================
// Lifecycle
// ==========================================

connect()

onUnmounted(() => {
  closeConnection()
})

function handleClose() {
  closeConnection()
  emit('close')
}
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
          <img
            v-if="appIcon"
            :src="appIcon"
            :alt="appName"
            class="w-9 h-9 rounded-lg object-contain"
          />
          <Icon v-else name="Package" :size="24" class="text-theme-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-theme-primary truncate">{{ title }}</h2>
          <p class="text-xs text-theme-muted mt-0.5">{{ detail }}</p>
        </div>
        <!-- Close only available when done or errored -->
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
          v-for="step in steps"
          :key="step.key"
          class="flex items-center gap-3 text-sm"
          :class="{
            'text-theme-muted': stepStatus(step.key) === 'pending',
            'text-theme-primary font-medium': stepStatus(step.key) === 'active',
            'text-success': stepStatus(step.key) === 'done',
            'text-error': stepStatus(step.key) === 'error',
          }"
        >
          <!-- Status indicator -->
          <div class="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <!-- Pending: empty circle -->
            <div
              v-if="stepStatus(step.key) === 'pending'"
              class="w-3 h-3 rounded-full border-2 border-theme-tertiary"
            ></div>
            <!-- Active: spinner -->
            <Icon
              v-else-if="stepStatus(step.key) === 'active'"
              name="Loader2"
              :size="16"
              class="animate-spin text-accent"
            />
            <!-- Done: checkmark -->
            <Icon
              v-else-if="stepStatus(step.key) === 'done'"
              name="CheckCircle"
              :size="16"
              class="text-success"
            />
            <!-- Error: X -->
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
        <button
          v-if="isDone || hasError"
          @click="handleClose"
          class="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="isDone
            ? 'btn-accent'
            : 'border border-theme-primary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'"
        >
          {{ isDone ? 'Done' : 'Close' }}
        </button>
        <span v-else class="text-xs text-theme-muted">
          {{ progress }}% complete
        </span>
      </div>
    </div>
  </div>
</template>
