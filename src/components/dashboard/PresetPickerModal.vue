<script setup>
/**
 * PresetPickerModal.vue — Session 10
 *
 * Modal showing built-in + user-created preset cards with SVG layout previews.
 * Supports: apply preset, save current layout, rename/delete user presets,
 * export current layout as JSON, import layout from JSON.
 *
 * Layout:
 *   Header → Built-in Presets (2×2 grid) → My Presets (list, if any)
 *   → Save Current button → Footer (Export / Import)
 */
import { ref, computed, nextTick } from 'vue'
import {
  useDashboardPresets,
  BUILT_IN_PRESETS,
  generatePreview,
} from '@/composables/useDashboardPresets'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  show: { type: Boolean, required: true },
})

const emit = defineEmits(['close'])

const {
  applyPreset,
  applyUserPreset,
  saveCurrentAsPreset,
  renameUserPreset,
  deleteUserPreset,
  userPresetsForMode,
  downloadExport,
  importFromFile,
} = useDashboardPresets()

const config = useDashboardConfig()
const { trapFocus } = useFocusTrap()

const importError = ref(null)
const importSuccess = ref(false)
const fileInputRef = ref(null)

// ─── Save preset state ────────────────────────────────────
const showSaveForm = ref(false)
const saveName = ref('')
const saveDescription = ref('')
const saving = ref(false)
const saveInputRef = ref(null)

// ─── Rename state ─────────────────────────────────────────
const renamingId = ref(null)
const renameValue = ref('')
const renameInputRef = ref(null)

// ─── Built-in preset actions ──────────────────────────────

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

// ─── User preset actions ──────────────────────────────────

async function handleApplyUser(presetId) {
  const preset = userPresetsForMode.value.find(p => p.id === presetId)
  if (!preset) return

  const confirmed = await confirm({
    title: 'Apply Preset',
    message: `Apply "${preset.name}"? This will replace your current layout and widget settings.`,
    confirmText: 'Apply',
    variant: 'warning',
  })

  if (!confirmed) return

  await applyUserPreset(presetId)
  emit('close')
}

async function handleDeleteUser(presetId, e) {
  e.stopPropagation()
  const preset = userPresetsForMode.value.find(p => p.id === presetId)
  if (!preset) return

  const confirmed = await confirm({
    title: 'Delete Preset',
    message: `Delete "${preset.name}"? This cannot be undone.`,
    confirmText: 'Delete',
    variant: 'danger',
  })

  if (!confirmed) return
  await deleteUserPreset(presetId)
}

function startRename(presetId, currentName, e) {
  e.stopPropagation()
  renamingId.value = presetId
  renameValue.value = currentName
  nextTick(() => renameInputRef.value?.focus())
}

async function finishRename() {
  if (!renamingId.value || !renameValue.value.trim()) {
    renamingId.value = null
    return
  }
  await renameUserPreset(renamingId.value, renameValue.value)
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ─── Save current layout ─────────────────────────────────

function openSaveForm() {
  showSaveForm.value = true
  saveName.value = ''
  saveDescription.value = ''
  nextTick(() => saveInputRef.value?.focus())
}

function closeSaveForm() {
  showSaveForm.value = false
  saveName.value = ''
  saveDescription.value = ''
}

async function handleSave() {
  if (!saveName.value.trim()) return
  saving.value = true
  try {
    await saveCurrentAsPreset(saveName.value, saveDescription.value)
    closeSaveForm()
  } finally {
    saving.value = false
  }
}

// ─── Export / Import ──────────────────────────────────────

function handleExport() {
  downloadExport()
}

function triggerImport() {
  importError.value = null
  importSuccess.value = false
  fileInputRef.value?.click()
}

async function handleFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
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
  showSaveForm.value = false
  renamingId.value = null
  emit('close')
}

// ─── SVG preview helpers ──────────────────────────────────

/**
 * Build SVG preview rows from a preset's grid_layout for the current mode.
 */
function buildPreviewRows(preset) {
  const modeKey = config.modeKey.value
  const modeData = preset[modeKey] || preset.standard
  if (!modeData?.grid_layout) return []

  const preview = generatePreview(modeData.grid_layout)
  const ROW_HEIGHT = 14
  const GAP = 3
  const TOTAL_WIDTH = 160

  return preview.map((row, rowIdx) => {
    let x = 0
    const blocks = row.map((block, blockIdx) => {
      const blockWidth = block.w * TOTAL_WIDTH - (row.length > 1 ? GAP / 2 : 0)
      const b = { x, w: blockWidth, label: block.label }
      x += blockWidth + (blockIdx < row.length - 1 ? GAP : 0)
      return b
    })
    return { y: rowIdx * (ROW_HEIGHT + GAP), blocks }
  })
}

function previewHeight(preset) {
  const modeKey = config.modeKey.value
  const modeData = preset[modeKey] || preset.standard
  if (!modeData?.grid_layout) return 40

  const ROW_HEIGHT = 14
  const GAP = 3
  const rowCount = modeData.grid_layout.length
  return Math.min(rowCount * (ROW_HEIGHT + GAP) - GAP, 140)
}

/**
 * Build SVG preview rows from a user preset's config.
 */
function buildUserPreviewRows(preset) {
  if (!preset.config?.grid_layout) return []

  const preview = generatePreview(preset.config.grid_layout)
  const ROW_HEIGHT = 10
  const GAP = 2
  const TOTAL_WIDTH = 120

  return preview.slice(0, 6).map((row, rowIdx) => {
    let x = 0
    const blocks = row.map((block, blockIdx) => {
      const blockWidth = block.w * TOTAL_WIDTH - (row.length > 1 ? GAP / 2 : 0)
      const b = { x, w: blockWidth, label: block.label }
      x += blockWidth + (blockIdx < row.length - 1 ? GAP : 0)
      return b
    })
    return { y: rowIdx * (ROW_HEIGHT + GAP), blocks }
  })
}

function userPreviewHeight(preset) {
  if (!preset.config?.grid_layout) return 30
  const ROW_HEIGHT = 10
  const GAP = 2
  const rowCount = Math.min(preset.config.grid_layout.length, 6)
  return rowCount * (ROW_HEIGHT + GAP) - GAP
}

/** Format date string for display */
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
                <p class="text-xs text-theme-muted">Choose a preset or save your own</p>
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

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto p-5 space-y-5">

            <!-- Built-in presets -->
            <div>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Built-in Presets</h3>
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
                    :style="{ height: Math.min(previewHeight(preset) * 0.55, 77) + 'px' }"
                    preserveAspectRatio="xMidYMin meet"
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
            </div>

            <!-- User presets (if any exist for current mode) -->
            <div v-if="userPresetsForMode.length > 0">
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">My Presets</h3>
              <div class="space-y-2">
                <div
                  v-for="preset in userPresetsForMode"
                  :key="preset.id"
                  class="group relative rounded-xl border border-theme-primary bg-theme-secondary/30 p-3 cursor-pointer
                         hover:border-accent/40 hover:bg-accent/5 transition-all flex gap-3 items-start"
                  @click="handleApplyUser(preset.id)"
                >
                  <!-- Mini SVG preview -->
                  <svg
                    :viewBox="`0 0 120 ${userPreviewHeight(preset)}`"
                    class="w-20 flex-shrink-0"
                    :style="{ height: Math.min(userPreviewHeight(preset) * 0.6, 48) + 'px' }"
                    preserveAspectRatio="xMidYMin meet"
                  >
                    <template v-for="(row, rIdx) in buildUserPreviewRows(preset)" :key="rIdx">
                      <rect
                        v-for="(block, bIdx) in row.blocks"
                        :key="`u-${rIdx}-${bIdx}`"
                        :x="block.x"
                        :y="row.y"
                        :width="block.w"
                        height="10"
                        rx="2"
                        class="fill-theme-tertiary group-hover:fill-accent/20 transition-colors"
                      />
                    </template>
                  </svg>

                  <!-- Info + actions -->
                  <div class="flex-1 min-w-0">
                    <template v-if="renamingId === preset.id">
                      <input
                        ref="renameInputRef"
                        v-model="renameValue"
                        class="w-full text-sm font-medium text-theme-primary bg-theme-tertiary rounded-lg px-2 py-1 border border-theme-primary focus:border-accent outline-none"
                        maxlength="40"
                        @keydown.enter="finishRename"
                        @keydown.escape="cancelRename"
                        @blur="finishRename"
                        @click.stop
                      />
                    </template>
                    <template v-else>
                      <div class="text-sm font-medium text-theme-primary truncate">{{ preset.name }}</div>
                      <div v-if="preset.description" class="text-[10px] text-theme-muted truncate">{{ preset.description }}</div>
                      <div class="text-[10px] text-theme-muted/60 mt-0.5">{{ formatDate(preset.created_at) }}</div>
                    </template>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      @click="startRename(preset.id, preset.name, $event)"
                      class="w-7 h-7 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                      aria-label="Rename preset"
                      title="Rename"
                    >
                      <Icon name="Pencil" :size="13" />
                    </button>
                    <button
                      @click="handleDeleteUser(preset.id, $event)"
                      class="w-7 h-7 rounded-lg flex items-center justify-center text-theme-muted hover:text-error hover:bg-error-muted transition-colors"
                      aria-label="Delete preset"
                      title="Delete"
                    >
                      <Icon name="Trash2" :size="13" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Save current layout -->
            <div>
              <template v-if="!showSaveForm">
                <button
                  @click="openSaveForm"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-theme-primary
                         text-sm text-theme-secondary hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all"
                >
                  <Icon name="Plus" :size="15" />
                  Save Current Layout
                </button>
              </template>
              <template v-else>
                <div class="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
                  <input
                    ref="saveInputRef"
                    v-model="saveName"
                    placeholder="Preset name"
                    maxlength="40"
                    class="w-full text-sm text-theme-primary bg-theme-card rounded-lg px-3 py-2 border border-theme-primary focus:border-accent outline-none placeholder:text-theme-muted/50"
                    @keydown.enter="handleSave"
                    @keydown.escape="closeSaveForm"
                  />
                  <input
                    v-model="saveDescription"
                    placeholder="Description (optional)"
                    maxlength="80"
                    class="w-full text-xs text-theme-secondary bg-theme-card rounded-lg px-3 py-1.5 border border-theme-primary focus:border-accent outline-none placeholder:text-theme-muted/50"
                    @keydown.enter="handleSave"
                    @keydown.escape="closeSaveForm"
                  />
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="closeSaveForm"
                      class="px-3 py-1.5 rounded-lg text-xs text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      @click="handleSave"
                      :disabled="!saveName.trim() || saving"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {{ saving ? 'Saving...' : 'Save Preset' }}
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <!-- Import error / success message -->
            <div v-if="importError" class="p-2 rounded-lg bg-error-muted text-error text-xs">
              {{ importError }}
            </div>
            <div v-if="importSuccess" class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
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
