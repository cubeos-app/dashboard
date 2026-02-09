<script setup>
/**
 * VolumeSettingsModal.vue
 *
 * Post-install volume management modal. Lets users view and change
 * volume mount paths for an installed app, then redeploys the stack.
 *
 * Props:
 *   appId   – installed app identifier
 *   appName – display name for header
 *
 * Emits:
 *   close  – user dismissed the modal
 *   saved  – volumes were updated and stack redeployed
 */
import { ref, computed, onMounted, nextTick, reactive } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import DirectoryBrowser from '@/components/ui/DirectoryBrowser.vue'
import { useAppStoreStore } from '@/stores/appstore'

const props = defineProps({
  appId: { type: [String, Number], required: true },
  appName: { type: String, default: 'App' }
})

const emit = defineEmits(['close', 'saved'])

const appStore = useAppStoreStore()
const modalRef = ref(null)

onMounted(async () => {
  await loadVolumes()
  await nextTick()
  modalRef.value?.focus()
})

// ==========================================
// State
// ==========================================

const loading = ref(true)
const loadError = ref('')
const volumes = ref([])         // VolumeMapping[] from API
const editedPaths = reactive({}) // containerPath → edited host path

const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

// DirectoryBrowser state
const showBrowser = ref(false)
const browseTarget = ref(null) // containerPath being edited
const browsePath = ref('/')

// Config volumes toggle
const showConfigSection = ref(false)

// ==========================================
// Data loading
// ==========================================

async function loadVolumes() {
  loading.value = true
  loadError.value = ''

  const result = await appStore.getVolumeMappings(props.appId)

  if (!result || !result.volumes) {
    loadError.value = appStore.error || 'Failed to load volume mappings'
    loading.value = false
    return
  }

  volumes.value = result.volumes

  // Initialize editedPaths with current values
  for (const vol of result.volumes) {
    editedPaths[vol.container_path] = vol.current_host_path
  }

  loading.value = false
}

// ==========================================
// Computed — split volumes + dirty tracking
// ==========================================

const externalVolumes = computed(() =>
  volumes.value.filter(v => v.is_external && !v.is_config)
)

const configVolumes = computed(() =>
  volumes.value.filter(v => v.is_config || !v.is_external)
)

const isDirty = computed(() => {
  for (const vol of volumes.value) {
    if (editedPaths[vol.container_path] !== vol.current_host_path) {
      return true
    }
  }
  return false
})

const changedCount = computed(() => {
  let count = 0
  for (const vol of volumes.value) {
    if (editedPaths[vol.container_path] !== vol.current_host_path) {
      count++
    }
  }
  return count
})

// ==========================================
// Path editing
// ==========================================

function isChanged(vol) {
  return editedPaths[vol.container_path] !== vol.current_host_path
}

function resetPath(vol) {
  editedPaths[vol.container_path] = vol.current_host_path
}

function resetToOriginal(vol) {
  editedPaths[vol.container_path] = vol.original_host_path
}

// ==========================================
// DirectoryBrowser integration
// ==========================================

function openBrowser(vol) {
  browseTarget.value = vol.container_path
  browsePath.value = editedPaths[vol.container_path] || vol.current_host_path
  showBrowser.value = true
}

function handleBrowseConfirm(path) {
  if (browseTarget.value) {
    editedPaths[browseTarget.value] = path
  }
  showBrowser.value = false
  browseTarget.value = null
}

function handleBrowseCancel() {
  showBrowser.value = false
  browseTarget.value = null
}

// ==========================================
// Save + redeploy
// ==========================================

async function handleSave() {
  saveError.value = ''
  saveSuccess.value = false
  saving.value = true

  // Build updates array: only include changed volumes
  const updates = []
  for (const vol of volumes.value) {
    const edited = editedPaths[vol.container_path]
    if (edited && edited !== vol.current_host_path) {
      updates.push({
        container_path: vol.container_path,
        new_host_path: edited
      })
    }
  }

  if (updates.length === 0) {
    saving.value = false
    return
  }

  try {
    await appStore.updateVolumeMappings(props.appId, updates)
    saveSuccess.value = true
    // Reload to reflect new state
    await loadVolumes()
    // Auto-dismiss success after a moment
    setTimeout(() => {
      saveSuccess.value = false
      emit('saved')
    }, 1500)
  } catch (e) {
    saveError.value = e.message || 'Failed to update volumes'
  } finally {
    saving.value = false
  }
}

// ==========================================
// Modal actions
// ==========================================

function handleClose() {
  emit('close')
}
</script>

<template>
  <div
    ref="modalRef"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="`Volume settings for ${appName}`"
    tabindex="-1"
    @keydown.escape="handleClose"
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
      @click="handleClose"
    ></div>

    <!-- Modal -->
    <div class="relative w-full max-w-lg max-h-[90vh] bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-3 p-5 border-b border-theme-primary flex-shrink-0">
        <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
          <Icon name="HardDrive" :size="20" class="text-theme-muted" />
        </div>

        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-theme-primary truncate">Volume Settings</h2>
          <p class="text-sm text-theme-secondary truncate">{{ appName }}</p>
        </div>

        <button
          @click="handleClose"
          aria-label="Close"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center py-16">
        <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
        <span class="ml-3 text-sm text-theme-muted">Loading volumes...</span>
      </div>

      <!-- Load Error -->
      <div v-else-if="loadError" class="flex-1 p-5">
        <div class="p-4 rounded-xl bg-error/10 border border-error/20">
          <div class="flex items-start gap-3">
            <Icon name="AlertCircle" :size="16" class="text-error mt-0.5 flex-shrink-0" />
            <div class="flex-1">
              <p class="text-sm text-error">{{ loadError }}</p>
              <button
                @click="loadVolumes"
                class="mt-2 text-xs text-error hover:text-error/80 underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No volumes -->
      <div v-else-if="volumes.length === 0" class="flex-1 flex flex-col items-center justify-center py-16 text-theme-muted">
        <Icon name="HardDrive" :size="36" class="mb-3 opacity-40" />
        <p class="text-sm">No volume mappings found</p>
        <p class="text-xs mt-1">This app does not have any managed volumes</p>
      </div>

      <!-- Volume list -->
      <template v-else>
        <div class="overflow-y-auto flex-1">
          <!-- Success banner -->
          <div v-if="saveSuccess" class="px-5 pt-4">
            <div class="p-3 rounded-lg bg-success-muted border border-success/20">
              <div class="flex items-center gap-2">
                <Icon name="CheckCircle2" :size="14" class="text-success flex-shrink-0" />
                <p class="text-xs text-success font-medium">Volumes updated — stack redeploying</p>
              </div>
            </div>
          </div>

          <!-- Save error banner -->
          <div v-if="saveError" class="px-5 pt-4">
            <div class="p-3 rounded-lg bg-error/10 border border-error/20">
              <div class="flex items-center gap-2">
                <Icon name="AlertCircle" :size="14" class="text-error flex-shrink-0" />
                <p class="text-xs text-error">{{ saveError }}</p>
              </div>
            </div>
          </div>

          <!-- External volumes -->
          <div v-if="externalVolumes.length > 0" class="px-5 pt-4">
            <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
              Data Volumes
            </h3>

            <div class="space-y-3">
              <div
                v-for="vol in externalVolumes"
                :key="vol.container_path"
                class="p-3 rounded-xl border transition-colors"
                :class="isChanged(vol) ? 'border-accent/40 bg-accent-muted/20' : 'border-theme-primary bg-theme-secondary'"
              >
                <!-- Volume header -->
                <div class="flex items-center gap-2 mb-2">
                  <Icon name="HardDrive" :size="14" class="text-theme-muted flex-shrink-0" />
                  <span class="text-sm font-medium text-theme-primary truncate">
                    {{ vol.description || vol.container_path }}
                  </span>
                  <span
                    v-if="vol.read_only"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-theme-tertiary text-theme-muted flex-shrink-0"
                  >
                    Read-only
                  </span>
                  <span
                    v-if="vol.is_remapped"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-muted text-accent flex-shrink-0"
                  >
                    Remapped
                  </span>
                </div>

                <!-- Container path (target inside container) -->
                <div class="flex items-center gap-2 text-xs text-theme-muted mb-1.5">
                  <span class="flex-shrink-0">Container:</span>
                  <span class="font-mono truncate">{{ vol.container_path }}</span>
                </div>

                <!-- Original path hint -->
                <div v-if="vol.original_host_path !== editedPaths[vol.container_path]" class="flex items-center gap-2 text-xs text-theme-muted mb-1.5">
                  <span class="flex-shrink-0">Original:</span>
                  <span class="font-mono line-through truncate">{{ vol.original_host_path }}</span>
                  <button
                    v-if="editedPaths[vol.container_path] !== vol.original_host_path"
                    @click="resetToOriginal(vol)"
                    class="ml-auto text-[10px] text-theme-muted hover:text-theme-primary underline flex-shrink-0"
                  >
                    Reset to original
                  </button>
                </div>

                <!-- Editable host path + browse button -->
                <div class="flex items-center gap-2">
                  <Icon name="ArrowRight" :size="12" class="text-accent flex-shrink-0" />
                  <input
                    v-model="editedPaths[vol.container_path]"
                    type="text"
                    class="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-sm font-mono bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    :class="isChanged(vol) ? 'border-accent/40' : 'border-theme-primary'"
                    :aria-label="`Host path for ${vol.description || vol.container_path}`"
                  />

                  <button
                    v-if="isChanged(vol)"
                    @click="resetPath(vol)"
                    class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors flex-shrink-0"
                    title="Undo changes"
                    aria-label="Undo path change"
                  >
                    <Icon name="Undo2" :size="14" />
                  </button>

                  <button
                    @click="openBrowser(vol)"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-theme-primary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors flex-shrink-0"
                    :aria-label="`Browse for ${vol.description || vol.container_path}`"
                  >
                    <Icon name="FolderOpen" :size="12" />
                    Browse
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Config volumes (collapsed) -->
          <div v-if="configVolumes.length > 0" class="px-5 pt-4 pb-2">
            <button
              @click="showConfigSection = !showConfigSection"
              class="flex items-center gap-2 w-full text-left group"
            >
              <Icon
                name="ChevronDown"
                :size="14"
                class="text-theme-muted transition-transform duration-200"
                :class="{ 'rotate-180': showConfigSection }"
              />
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                Config Volumes
              </h3>
              <span class="text-[10px] text-theme-muted">
                ({{ configVolumes.length }})
              </span>
            </button>

            <div v-if="showConfigSection" class="mt-3 space-y-2">
              <div
                v-for="vol in configVolumes"
                :key="vol.container_path"
                class="flex items-center gap-3 px-3 py-2 rounded-lg bg-theme-tertiary/50"
              >
                <Icon name="Lock" :size="12" class="text-theme-muted flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-theme-secondary truncate">
                    {{ vol.description || vol.container_path }}
                  </p>
                  <p class="text-[10px] font-mono text-theme-muted truncate">
                    {{ vol.current_host_path }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-3 p-5 border-t border-theme-primary bg-theme-secondary flex-shrink-0">
          <button
            @click="handleClose"
            class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            {{ isDirty ? 'Discard' : 'Close' }}
          </button>

          <div class="flex items-center gap-3">
            <span v-if="isDirty" class="text-xs text-accent">
              {{ changedCount }} change{{ changedCount !== 1 ? 's' : '' }}
            </span>

            <button
              @click="handleSave"
              :disabled="!isDirty || saving"
              class="flex items-center gap-2 px-5 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon v-if="saving" name="Loader2" :size="16" class="animate-spin" />
              <Icon v-else name="RotateCw" :size="16" />
              Save &amp; Restart
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- DirectoryBrowser (nested modal) -->
    <DirectoryBrowser
      v-model="browsePath"
      :show="showBrowser"
      :initial-path="browsePath"
      title="Select Mount Path"
      @confirm="handleBrowseConfirm"
      @cancel="handleBrowseCancel"
    />
  </div>
</template>
