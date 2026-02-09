<script setup>
/**
 * DirectoryBrowser.vue
 *
 * Reusable modal directory picker. Lets the user navigate the host
 * filesystem and select a directory path. Backed by GET /system/browse.
 *
 * Props:
 *   modelValue  – currently selected path (v-model)
 *   show        – controls visibility
 *   initialPath – starting directory when opened
 *   title       – modal header text
 *
 * Emits:
 *   update:modelValue – selected path
 *   confirm           – user confirmed selection (payload: path string)
 *   cancel            – user closed without selecting
 */
import { ref, watch, nextTick } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useAppStoreStore } from '@/stores/appstore'

const { trapFocus } = useFocusTrap()

const props = defineProps({
  modelValue: { type: String, default: '' },
  show: { type: Boolean, required: true },
  initialPath: { type: String, default: '/' },
  title: { type: String, default: 'Select Directory' }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const appStore = useAppStoreStore()

// State
const currentPath = ref('/')
const entries = ref([])
const loading = ref(false)
const errorMsg = ref('')
const selectedPath = ref('')
const confirmBtnRef = ref(null)

// ==========================================
// Navigation
// ==========================================

async function browse(path) {
  loading.value = true
  errorMsg.value = ''

  const result = await appStore.browseDirectory(path)

  if (!result) {
    errorMsg.value = 'Failed to read directory'
    loading.value = false
    return
  }

  currentPath.value = result.path || path
  entries.value = result.entries || []
  selectedPath.value = currentPath.value
  loading.value = false
}

function navigateTo(path) {
  browse(path)
}

function navigateUp() {
  if (currentPath.value === '/') return
  const parent = currentPath.value.replace(/\/[^/]+\/?$/, '') || '/'
  browse(parent)
}

// ==========================================
// Breadcrumbs
// ==========================================

function getBreadcrumbs() {
  if (currentPath.value === '/') {
    return [{ name: '/', path: '/' }]
  }
  const segments = currentPath.value.split('/').filter(Boolean)
  const crumbs = [{ name: '/', path: '/' }]
  let accumulated = ''
  for (const seg of segments) {
    accumulated += '/' + seg
    crumbs.push({ name: seg, path: accumulated })
  }
  return crumbs
}

// ==========================================
// Selection
// ==========================================

function selectEntry(entry) {
  if (entry.is_restricted) return
  navigateTo(entry.path)
}

function handleConfirm() {
  emit('update:modelValue', selectedPath.value)
  emit('confirm', selectedPath.value)
}

function handleCancel() {
  emit('cancel')
}

// ==========================================
// Keyboard
// ==========================================

function handleKeydown(e) {
  if (e.key === 'Escape') {
    handleCancel()
  }
}

// ==========================================
// Lifecycle — load when shown
// ==========================================

watch(() => props.show, async (visible) => {
  if (visible) {
    const startPath = props.modelValue || props.initialPath || '/'
    await browse(startPath)
    await nextTick()
    confirmBtnRef.value?.focus()
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown="handleKeydown"
      @keydown.tab="trapFocus"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="handleCancel"></div>

      <!-- Modal -->
      <div class="relative w-full max-w-lg bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col max-h-[80vh]">
        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-theme-primary flex-shrink-0">
          <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
            <Icon name="FolderOpen" :size="18" class="text-theme-muted" />
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-semibold text-theme-primary truncate">{{ title }}</h2>
          </div>
          <button
            @click="handleCancel"
            aria-label="Close"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            <Icon name="X" :size="18" />
          </button>
        </div>

        <!-- Breadcrumbs -->
        <div class="flex items-center gap-1 px-4 py-2.5 border-b border-theme-primary bg-theme-secondary text-xs overflow-x-auto flex-shrink-0">
          <button
            v-if="currentPath !== '/'"
            @click="navigateUp"
            class="p-1 rounded hover:bg-theme-tertiary text-theme-muted hover:text-theme-primary transition-colors flex-shrink-0"
            aria-label="Go up"
          >
            <Icon name="ArrowUp" :size="14" />
          </button>
          <template v-for="(crumb, idx) in getBreadcrumbs()" :key="crumb.path">
            <span v-if="idx > 0" class="text-theme-muted flex-shrink-0">/</span>
            <button
              @click="navigateTo(crumb.path)"
              class="px-1.5 py-0.5 rounded hover:bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors truncate max-w-[120px] flex-shrink-0"
              :class="{ 'text-theme-primary font-medium': idx === getBreadcrumbs().length - 1 }"
            >
              {{ crumb.name }}
            </button>
          </template>
        </div>

        <!-- Current selection -->
        <div class="flex items-center gap-2 px-4 py-2 bg-theme-tertiary/50 border-b border-theme-primary flex-shrink-0">
          <Icon name="FolderCheck" :size="14" class="text-accent flex-shrink-0" />
          <span class="text-xs text-theme-secondary font-mono truncate">{{ selectedPath }}</span>
        </div>

        <!-- Directory listing -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-12">
            <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
            <span class="ml-2 text-sm text-theme-muted">Loading...</span>
          </div>

          <!-- Error -->
          <div v-else-if="errorMsg" class="p-4">
            <div class="p-3 rounded-lg bg-error/10 border border-error/20">
              <p class="text-sm text-error">{{ errorMsg }}</p>
              <button
                @click="browse(currentPath)"
                class="mt-2 text-xs text-error hover:text-error/80 underline"
              >
                Retry
              </button>
            </div>
          </div>

          <!-- Empty -->
          <div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center py-12 text-theme-muted">
            <Icon name="FolderOpen" :size="32" class="mb-2 opacity-40" />
            <p class="text-sm">No subdirectories</p>
            <p class="text-xs mt-1">Select this directory or navigate up</p>
          </div>

          <!-- Entries -->
          <div v-else class="py-1">
            <button
              v-for="entry in entries"
              :key="entry.path"
              @click="selectEntry(entry)"
              :disabled="entry.is_restricted"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
              :class="entry.is_restricted
                ? 'text-theme-muted cursor-not-allowed opacity-50'
                : 'text-theme-primary hover:bg-theme-tertiary cursor-pointer'"
            >
              <Icon
                :name="entry.is_restricted ? 'FolderLock' : 'Folder'"
                :size="16"
                :class="entry.is_restricted ? 'text-theme-muted' : 'text-accent'"
                class="flex-shrink-0"
              />
              <span class="truncate">{{ entry.name }}</span>
              <Icon
                v-if="!entry.is_restricted"
                name="ChevronRight"
                :size="14"
                class="ml-auto text-theme-muted flex-shrink-0"
              />
              <span v-if="entry.is_restricted" class="ml-auto text-xs text-theme-muted flex-shrink-0">
                Restricted
              </span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme-primary bg-theme-secondary flex-shrink-0">
          <button
            @click="handleCancel"
            class="px-4 py-2 rounded-lg text-sm font-medium border border-theme-primary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            ref="confirmBtnRef"
            @click="handleConfirm"
            class="px-4 py-2 rounded-lg text-sm font-medium btn-accent transition-colors"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
