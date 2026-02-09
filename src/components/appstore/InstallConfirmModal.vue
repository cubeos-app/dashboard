<script setup>
/**
 * InstallConfirmModal.vue
 *
 * Pre-install confirmation modal shown when an app has external volume mounts.
 * Displays a table of volumes that will be remapped, allowing the user to
 * override default paths via DirectoryBrowser before confirming installation.
 *
 * Props:
 *   app     – store app object (icon, title, name, store_id)
 *   volumes – VolumeMapping[] from the preview endpoint
 *
 * Emits:
 *   confirm(volumeOverrides)  – user confirmed; payload is map[containerPath]hostPath
 *   cancel                    – user closed without installing
 */
import { ref, computed, nextTick, onMounted } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import DirectoryBrowser from '@/components/ui/DirectoryBrowser.vue'

const props = defineProps({
  app: { type: Object, required: true },
  volumes: { type: Array, required: true }
})

const emit = defineEmits(['confirm', 'cancel'])

const modalRef = ref(null)

onMounted(() => nextTick(() => modalRef.value?.focus()))

// ==========================================
// State
// ==========================================

// Track user overrides: containerPath → hostPath
const overrides = ref({})

// DirectoryBrowser state
const showBrowser = ref(false)
const browseTarget = ref(null) // containerPath being edited
const browsePath = ref('/')

// ==========================================
// Computed
// ==========================================

const title = computed(() => {
  return props.app?.title?.en_us || props.app?.title?.en_US || props.app?.name || 'App'
})

// Split volumes into external (user-facing) and config (collapsed)
const externalVolumes = computed(() =>
  props.volumes.filter(v => v.is_external && !v.is_config)
)

const configVolumes = computed(() =>
  props.volumes.filter(v => v.is_config || !v.is_external)
)

const showConfigSection = ref(false)

/**
 * Get the display host path for a volume.
 * If user has overridden it, show the override; otherwise show the default.
 */
function displayHostPath(vol) {
  return overrides.value[vol.container_path] || vol.current_host_path
}

/**
 * Check if a volume has been overridden from its default.
 */
function isOverridden(vol) {
  const override = overrides.value[vol.container_path]
  return override && override !== vol.current_host_path
}

// ==========================================
// DirectoryBrowser integration
// ==========================================

function openBrowser(vol) {
  browseTarget.value = vol.container_path
  browsePath.value = displayHostPath(vol)
  showBrowser.value = true
}

function handleBrowseConfirm(path) {
  if (browseTarget.value) {
    overrides.value[browseTarget.value] = path
  }
  showBrowser.value = false
  browseTarget.value = null
}

function handleBrowseCancel() {
  showBrowser.value = false
  browseTarget.value = null
}

function resetOverride(vol) {
  delete overrides.value[vol.container_path]
}

// ==========================================
// Actions
// ==========================================

function handleConfirm() {
  // Build volume_overrides map: only include actual overrides
  const volumeOverrides = {}
  for (const [containerPath, hostPath] of Object.entries(overrides.value)) {
    const vol = props.volumes.find(v => v.container_path === containerPath)
    if (vol && hostPath !== vol.current_host_path) {
      volumeOverrides[containerPath] = hostPath
    }
  }
  emit('confirm', volumeOverrides)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div
    ref="modalRef"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="`Confirm install ${title}`"
    tabindex="-1"
    @keydown.escape="handleCancel"
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
      @click="handleCancel"
    ></div>

    <!-- Modal -->
    <div class="relative w-full max-w-lg max-h-[90vh] bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col">
      <!-- Header -->
      <div class="flex items-start gap-4 p-5 border-b border-theme-primary flex-shrink-0">
        <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
          <img
            v-if="app.icon"
            :src="app.icon"
            :alt="title"
            class="w-9 h-9 rounded-lg object-contain"
          />
          <Icon v-else name="Package" :size="24" class="text-theme-muted" />
        </div>

        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold text-theme-primary truncate">Configure Volumes</h2>
          <p class="text-sm text-theme-secondary mt-0.5">{{ title }} has external volume mounts</p>
        </div>

        <button
          @click="handleCancel"
          aria-label="Close"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="overflow-y-auto flex-1">
        <!-- Info banner -->
        <div class="px-5 pt-4">
          <div class="p-3 rounded-lg bg-accent-muted/50 border border-accent/20">
            <div class="flex items-start gap-2">
              <Icon name="Info" :size="14" class="text-accent mt-0.5 flex-shrink-0" />
              <p class="text-xs text-theme-secondary">
                External volumes will be remapped to safe CubeOS paths. You can customize mount points below or use the defaults.
              </p>
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
              class="p-3 rounded-xl border border-theme-primary bg-theme-secondary"
            >
              <!-- Volume header: description + container path -->
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
              </div>

              <!-- Original path (strikethrough) -->
              <div class="flex items-center gap-2 text-xs text-theme-muted mb-1.5">
                <span class="flex-shrink-0">Original:</span>
                <span class="font-mono line-through truncate">{{ vol.original_host_path }}</span>
              </div>

              <!-- Current/override path with browse button -->
              <div class="flex items-center gap-2">
                <Icon name="ArrowRight" :size="12" class="text-accent flex-shrink-0" />
                <span
                  class="flex-1 text-sm font-mono truncate"
                  :class="isOverridden(vol) ? 'text-accent' : 'text-theme-primary'"
                >
                  {{ displayHostPath(vol) }}
                </span>

                <button
                  v-if="isOverridden(vol)"
                  @click="resetOverride(vol)"
                  class="p-1 rounded text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors flex-shrink-0"
                  title="Reset to default"
                  aria-label="Reset to default path"
                >
                  <Icon name="RotateCcw" :size="12" />
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
          @click="handleCancel"
          class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          Cancel
        </button>

        <button
          @click="handleConfirm"
          class="flex items-center gap-2 px-5 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          <Icon name="Download" :size="16" />
          Install with {{ Object.keys(overrides).length > 0 ? 'Custom Paths' : 'Defaults' }}
        </button>
      </div>
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
