<script setup>
/**
 * InstallFlow.vue
 *
 * Multi-step install wrapper that orchestrates the existing install modals:
 *   Step 1: Volume confirmation (InstallConfirmModal)
 *   Step 2: Install progress via SSE (InstallProgressModal)
 *
 * Standard mode: confirm → install
 * Advanced mode: confirm (with port/fqdn options visible) → install
 *
 * Props:
 *   storeId  – catalog store identifier
 *   appName  – app name within the store
 *   app      – full catalog app object (icon, title, etc.)
 *   options  – { port, fqdn } overrides from detail sheet (Advanced)
 *
 * Emits:
 *   done  – install completed successfully
 *   close – user cancelled at any step
 */
import { ref, computed, onMounted } from 'vue'
import InstallConfirmModal from '@/components/appstore/InstallConfirmModal.vue'
import InstallProgressModal from '@/components/appstore/InstallProgressModal.vue'
import { useAppStoreStore } from '@/stores/appstore'
import { useMode } from '@/composables/useMode'

const props = defineProps({
  storeId: { type: String, required: true },
  appName: { type: String, required: true },
  app: { type: Object, default: () => ({}) },
  options: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['done', 'close'])

const appStoreStore = useAppStoreStore()
const { isAdvanced } = useMode()

// ─── State ───────────────────────────────────────────────────
const step = ref('loading') // loading | confirm | progress | error
const volumes = ref([])
const loadError = ref('')
const jobId = ref('')
const installError = ref('')

// ─── Computed ────────────────────────────────────────────────
const appTitle = computed(() => {
  const t = props.app?.title
  return t?.en_us || t?.en_US || props.app?.name || props.appName
})

const appIcon = computed(() => {
  return props.app?.icon || ''
})

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  await loadVolumes()
})

async function loadVolumes() {
  step.value = 'loading'
  loadError.value = ''
  try {
    const result = await appStoreStore.previewVolumes(props.storeId, props.appName)
    const vols = result?.volumes ?? result
    volumes.value = Array.isArray(vols) ? vols : []
    // If no volumes to confirm, skip straight to install in Standard mode
    if (!isAdvanced.value && volumes.value.length === 0) {
      await doInstall({})
    } else {
      step.value = 'confirm'
    }
  } catch (e) {
    // If volume preview fails (e.g. endpoint not available), still allow install
    volumes.value = []
    step.value = 'confirm'
  }
}

// ─── Install ─────────────────────────────────────────────────

/**
 * Called when user confirms in InstallConfirmModal.
 * @param {Object} volumeOverrides - map of containerPath → hostPath overrides
 */
async function handleConfirm(volumeOverrides) {
  await doInstall(volumeOverrides)
}

async function doInstall(volumeOverrides) {
  step.value = 'progress'
  installError.value = ''

  const payload = {
    ...props.options,
    ...(Object.keys(volumeOverrides).length > 0 ? { volume_overrides: volumeOverrides } : {})
  }

  try {
    const result = await appStoreStore.installApp(props.storeId, props.appName, payload)
    if (result?.job_id) {
      jobId.value = result.job_id
    } else {
      // No job ID means synchronous install or error
      installError.value = 'No job ID returned from install'
      step.value = 'error'
    }
  } catch (e) {
    installError.value = e.message || 'Install failed'
    step.value = 'error'
  }
}

// ─── Callbacks ───────────────────────────────────────────────
function handleProgressDone() {
  emit('done')
}

function handleProgressError() {
  // Keep the progress modal visible so user can see the error state
  // The InstallProgressModal handles error display internally
}

function handleCancel() {
  emit('close')
}
</script>

<template>
  <div>
    <!-- Loading overlay -->
    <div
      v-if="step === 'loading'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div class="rounded-xl bg-panel-primary p-8 shadow-xl text-center">
        <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        <p class="text-sm text-secondary">Preparing install&hellip;</p>
      </div>
    </div>

    <!-- Step 1: Volume confirmation -->
    <InstallConfirmModal
      v-if="step === 'confirm'"
      :app="app"
      :volumes="volumes"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />

    <!-- Step 2: Install progress via SSE -->
    <InstallProgressModal
      v-if="step === 'progress' && jobId"
      :app-name="appTitle"
      :app-icon="appIcon"
      job-type="install"
      :job-id="jobId"
      @done="handleProgressDone"
      @error="handleProgressError"
      @close="handleCancel"
    />

    <!-- Error fallback -->
    <div
      v-if="step === 'error'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div class="mx-4 max-w-md rounded-xl bg-panel-primary p-6 shadow-xl">
        <h3 class="mb-2 text-lg font-semibold text-primary">Install Failed</h3>
        <p class="mb-4 text-sm text-secondary">{{ installError || loadError || 'An unexpected error occurred.' }}</p>
        <div class="flex justify-end gap-3">
          <button
            class="rounded-lg px-4 py-2 text-sm text-secondary hover:text-primary"
            @click="handleCancel"
          >
            Close
          </button>
          <button
            class="rounded-lg bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary/90"
            @click="loadVolumes"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
