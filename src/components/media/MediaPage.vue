<script setup>
/**
 * MediaPage.vue — S09 Component
 *
 * Shell that renders Audio + Camera tabs with mode-aware content.
 * Hidden from nav when HAL reports no media hardware.
 *
 * Pattern: Shell → tab components (following S08 SystemPage pattern)
 *
 * Standard tabs: Audio, Camera
 * Advanced tabs: Audio, Camera (with extended sections)
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/media'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'

import AudioTab from './AudioTab.vue'
import CameraTab from './CameraTab.vue'

const route = useRoute()
const router = useRouter()
const mediaStore = useMediaStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

// ─── Tab Management ──────────────────────────────────────────
const TAB_DEFS = [
  { key: 'audio', label: 'Audio', icon: 'Volume2' },
  { key: 'camera', label: 'Camera', icon: 'Camera' }
]

const activeTab = ref('audio')

// Read ?tab= from route
watch(() => route.query.tab, (tab) => {
  if (tab && TAB_DEFS.some(t => t.key === tab)) {
    activeTab.value = tab
  }
}, { immediate: true })

function setTab(key) {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

// ─── Data ────────────────────────────────────────────────────
const loading = ref(false)
const error = ref(null)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const s = signal()
    if (activeTab.value === 'audio') {
      await Promise.all([
        mediaStore.fetchAudioDevices({ signal: s }),
        mediaStore.fetchPlaybackDevices({ signal: s }),
        mediaStore.fetchCaptureDevices({ signal: s }),
        mediaStore.fetchVolume({ signal: s })
      ])
    } else if (activeTab.value === 'camera') {
      await Promise.all([
        mediaStore.fetchCameras({ signal: s }),
        mediaStore.fetchCameraInfo({ signal: s }),
        mediaStore.fetchStreamInfo({ signal: s })
      ])
    }
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
}

// Refresh when switching tabs
watch(activeTab, () => {
  refresh()
})

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader
      icon="Volume2"
      title="Media"
      subtitle="Audio devices, volume control, and camera management"
    >
      <template #actions>
        <button
          @click="refresh"
          :disabled="loading"
          class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          aria-label="Refresh media data"
        >
          <Icon name="RefreshCw" :size="20" :class="{ 'animate-spin': loading }" />
        </button>
      </template>
    </PageHeader>

    <!-- Error Alert -->
    <div v-if="error || mediaStore.error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-center gap-3">
      <Icon name="AlertCircle" :size="18" class="text-error shrink-0" />
      <p class="text-error text-sm flex-1">{{ error || mediaStore.error }}</p>
      <button @click="error = null" class="p-1 text-error hover:opacity-70" aria-label="Dismiss error">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-theme-primary overflow-x-auto scrollbar-hide">
      <nav class="flex gap-1 sm:gap-4 min-w-max" role="tablist" aria-label="Media tabs">
        <button
          v-for="tab in TAB_DEFS"
          :key="tab.key"
          @click="setTab(tab.key)"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2"
          :class="activeTab === tab.key
            ? 'border-[color:var(--accent-primary)] text-accent'
            : 'border-transparent text-theme-muted hover:text-theme-primary'"
        >
          <Icon :name="tab.icon" :size="16" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <AudioTab
      v-if="activeTab === 'audio'"
    />

    <CameraTab
      v-if="activeTab === 'camera'"
    />
  </div>
</template>
