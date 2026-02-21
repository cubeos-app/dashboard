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
 * Batch 2: Now handles registry installs (source='registry') through
 * the same flow. Registry installs skip volume preview and call the
 * unified POST /apps endpoint with SSE progress at /apps/jobs/{jobID}.
 *
 * Props:
 *   storeId  – catalog store identifier (or '_registry' for registry apps)
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
import api from '@/api/client'

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
const isRegistry = computed(() => props.app?._source === 'registry')

const appTitle = computed(() => {
  const t = props.app?.title
  return t?.en_us || t?.en_US || props.app?.name || props.appName
})

const appIcon = computed(() => {
  return props.app?.icon || ''
})

/**
 * SSE base path differs by source:
 *   Registry installs → /api/v1/apps/jobs/
 *   Store installs    → /api/v1/appstore/jobs/
 */
const sseBasePath = computed(() => {
  return isRegistry.value ? '/api/v1/apps/jobs/' : '/api/v1/appstore/jobs/'
})

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  await loadVolumes()
})

async function loadVolumes() {
  step.value = 'loading'
  loadError.value = ''

  // Registry apps: generate synthetic volume mapping (same UI as store apps)
  if (isRegistry.value) {
    const appNameClean = (props.appName || '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    volumes.value = [{
      service_name: appNameClean,
      container_path: '/data',
      original_host_path: '/data',
      current_host_path: `/cubeos/apps/${appNameClean}/appdata`,
      description: 'App data',
      is_remapped: true,
      is_external: true,
      is_config: false,
      read_only: false
    }]
    step.value = 'confirm'
    return
  }

  // Store apps: fetch volume preview from manifest
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
 * @param {Object} confirmData - { volumeOverrides, port, subdomain } or plain volumeOverrides
 */
async function handleConfirm(confirmData) {
  // Support both new structured format and legacy plain volumeOverrides
  const volumeOverrides = confirmData?.volumeOverrides || (confirmData && !confirmData.port ? confirmData : {})
  const port = confirmData?.port || 0
  const subdomain = confirmData?.subdomain || ''
  await doInstall(volumeOverrides, port, subdomain)
}

async function doInstall(volumeOverrides, port = 0, subdomain = '') {
  step.value = 'progress'
  installError.value = ''

  try {
    let result

    if (isRegistry.value) {
      // Registry install → unified POST /apps endpoint with same overrides as store
      const payload = {
        name: props.appName,
        source: 'registry',
        image: props.app._imageName,
        tag: props.app._tag || 'latest',
        display_name: appTitle.value,
        category: 'utility'
      }
      // Pass volume overrides if user customized paths
      if (volumeOverrides && Object.keys(volumeOverrides).length > 0) {
        payload.volume_overrides = volumeOverrides
      }
      // Pass port override if specified (Advanced mode)
      if (port > 0) payload.port = port
      // Pass subdomain override if specified (Advanced mode)
      if (subdomain) payload.subdomain = subdomain
      result = await api.post('/apps', payload)
    } else {
      // Store install → existing POST /appstore/installed endpoint
      const payload = {
        ...props.options,
        ...(Object.keys(volumeOverrides).length > 0 ? { volume_overrides: volumeOverrides } : {})
      }
      result = await appStoreStore.installApp(props.storeId, props.appName, payload)
    }

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

/**
 * Called when SSE reports install done.
 * Do NOT close — let InstallProgressModal show success state
 * with "Open App" and "Done" buttons. User decides when to dismiss.
 */
function handleProgressDone() {
  // Don't emit('done') here — user will click "Done" in the success modal
}

function handleProgressError() {
  // Keep the progress modal visible so user can see the error state
  // The InstallProgressModal handles error display internally
}

function handleCancel() {
  emit('done')
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
      :app-subdomain="appName"
      job-type="install"
      :job-id="jobId"
      :sse-base-path="sseBasePath"
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
