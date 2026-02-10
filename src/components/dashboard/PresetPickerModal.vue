<script setup>
/**
 * PresetPickerModal.vue — Session 6
 *
 * Modal showing built-in preset thumbnails with simple SVG layout previews.
 * Supports: apply preset, export current layout as JSON, import layout from JSON.
 *
 * Renders each preset as a card with a miniature SVG diagram of the layout,
 * name, and description. "Apply" button applies the preset instantly.
 * Footer has Export + Import buttons.
 */
import { ref, computed } from 'vue'
import { useDashboardPresets, BUILT_IN_PRESETS } from '@/composables/useDashboardPresets'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true },
})

const emit = defineEmits(['close'])

const { applyPreset, downloadExport, importFromFile } = useDashboardPresets()
const { trapFocus } = useFocusTrap()

const importError = ref(null)
const importSuccess = ref(false)
const fileInputRef = ref(null)

/** Handle applying a preset with confirmation */
async function handleApply(presetId) {
  const preset = BUILT_IN_PRESETS.find(p => p.id === presetId)
  if (!preset) return

  const confirmed = await confirm({
    title: 'Apply Preset',
    message: `Apply "${preset.name}" preset? This will replace your current layout and widget settings.`,
    confirmText: 'Apply',
    variant: 'warning',
  })

  if (!confirmed) return

  await applyPreset(presetId)
  emit('close')
}

/** Handle export */
function handleExport() {
  downloadExport()
}

/** Trigger file picker for import */
function triggerImport() {
  importError.value = null
  importSuccess.value = false
  fileInputRef.value?.click()
}

/** Handle file selection for import */
async function handleFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return

  // Reset input so re-selecting same file triggers change
  e.target.value = ''

  const confirmed = await confirm({
    title: 'Import Layout',
    message: `Import layout from "${file.name}"? This will replace your current layout and widget settings.`,
    confirmText: 'Import',
    variant: 'warning',
  })

  if (!confirmed) return

  const result = await importFromFile(file)
  if (result.success) {
    importSuccess.value = true
    importError.value = null
    setTimeout(() => {
      importSuccess.value = false
      emit('close')
    }, 1000)
  } else {
    importError.value = result.error
    importSuccess.value = false
  }
}

function handleClose() {
  importError.value = null
  importSuccess.value = false
  emit('close')
}

/**
 * Build an SVG preview of a preset layout.
 * Returns an array of row descriptors: { y, blocks: [{ x, w, label }] }
 */
function buildPreviewRows(preset) {
  if (!preset.preview) return []

  const ROW_HEIGHT = 14
  const GAP = 3
  const TOTAL_WIDTH = 160

  return preset.preview.map((row, rowIdx) => {
    let x = 0
    const blocks = row.map((block, blockIdx) => {
      const blockWidth = block.w * TOTAL_WIDTH - (row.length > 1 ? GAP / 2 : 0)
      const b = { x, w: blockWidth, label: block.label }
      x += blockWidth + (blockIdx < row.length - 1 ? GAP : 0)
      return b
    })
    return {
      y: rowIdx * (ROW_HEIGHT + GAP),
      blocks,
    }
  })
}

function previewHeight(preset) {
  if (!preset.preview) return 40
  const ROW_HEIGHT = 14
  const GAP = 3
  return preset.preview.length * (ROW_HEIGHT + GAP) - GAP
}
</script>

<template>
  <Teleport to="body">
    <Transition name="preset-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard Presets"
        tabindex="-1"
        @keydown.escape="handleClose"
        @keydown="trapFocus"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
          @click="handleClose"
        ></div>

        <!-- Modal -->
        <div class="relative w-full max-w-lg bg-theme-card border border-theme-primary rounded-2xl shadow-theme-xl flex flex-col max-h-[90vh] animate-preset-pop-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-theme-primary flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-theme-tertiary flex items-center justify-center">
                <Icon name="LayoutTemplate" :size="18" class="text-theme-secondary" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-theme-primary">Layout Presets</h2>
                <p class="text-xs text-theme-muted">Choose a preset or import your own</p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Preset grid -->
          <div class="flex-1 overflow-y-auto p-5">
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="preset in BUILT_IN_PRESETS"
                :key="preset.id"
                class="group relative rounded-xl border border-theme-primary bg-theme-secondary/30 p-3 cursor-pointer
                       hover:border-accent/40 hover:bg-accent/5 transition-all"
                @click="handleApply(preset.id)"
              >
                <!-- SVG preview -->
                <svg
                  :viewBox="`0 0 160 ${previewHeight(preset)}`"
                  class="w-full mb-2"
                  :style="{ height: previewHeight(preset) * 0.55 + 'px' }"
                >
                  <template v-for="(row, rIdx) in buildPreviewRows(preset)" :key="rIdx">
                    <rect
                      v-for="(block, bIdx) in row.blocks"
                      :key="`${rIdx}-${bIdx}`"
                      :x="block.x"
                      :y="row.y"
                      :width="block.w"
                      height="14"
                      rx="3"
                      class="fill-theme-tertiary group-hover:fill-accent/20 transition-colors"
                    />
                    <text
                      v-for="(block, bIdx) in row.blocks"
                      :key="`t-${rIdx}-${bIdx}`"
                      :x="block.x + block.w / 2"
                      :y="row.y + 10"
                      text-anchor="middle"
                      class="fill-theme-muted text-[6px] select-none pointer-events-none"
                    >{{ block.label }}</text>
                  </template>
                </svg>

                <!-- Info -->
                <div class="flex items-center gap-1.5 mb-1">
                  <Icon :name="preset.icon" :size="13" class="text-theme-secondary group-hover:text-accent transition-colors" />
                  <span class="text-sm font-medium text-theme-primary">{{ preset.name }}</span>
                </div>
                <p class="text-[10px] text-theme-muted leading-tight">{{ preset.description }}</p>
              </div>
            </div>

            <!-- Import error / success message -->
            <div v-if="importError" class="mt-3 p-2 rounded-lg bg-error-muted text-error text-xs">
              {{ importError }}
            </div>
            <div v-if="importSuccess" class="mt-3 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
              Layout imported successfully.
            </div>
          </div>

          <!-- Footer: Export / Import -->
          <div class="flex items-center justify-between p-4 border-t border-theme-primary flex-shrink-0">
            <button
              @click="handleExport"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-theme-secondary
                     hover:bg-theme-tertiary hover:text-theme-primary transition-colors"
            >
              <Icon name="Download" :size="14" />
              Export Current
            </button>
            <button
              @click="triggerImport"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-theme-secondary
                     hover:bg-theme-tertiary hover:text-theme-primary transition-colors"
            >
              <Icon name="Upload" :size="14" />
              Import Layout
            </button>

            <!-- Hidden file input for import -->
            <input
              ref="fileInputRef"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleFileSelected"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@keyframes preset-pop-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-preset-pop-in {
  animation: preset-pop-in 0.2s ease-out;
}

.preset-fade-enter-active,
.preset-fade-leave-active {
  transition: opacity 0.15s ease;
}
.preset-fade-enter-from,
.preset-fade-leave-to {
  opacity: 0;
}
</style>
