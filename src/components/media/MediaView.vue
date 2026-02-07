<script setup>
/**
 * MediaView.vue
 *
 * Sprint 8 Group 4: Main media management page.
 * Tabbed layout with Audio and Camera panels.
 *
 * AudioTab + CameraTab lazy-loaded as async components.
 * Uses mediaStore (G1) for all media data.
 * Mirrors CommunicationView tab architecture.
 */
import { ref, defineAsyncComponent } from 'vue'
import { useMediaStore } from '@/stores/media'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

// Lazy tab panels
const AudioTab = defineAsyncComponent(() => import('./AudioTab.vue'))
const CameraTab = defineAsyncComponent(() => import('./CameraTab.vue'))

const mediaStore = useMediaStore()
const { signal } = useAbortOnUnmount()

// ==========================================
// Tabs
// ==========================================

const tabs = [
  { id: 'audio', name: 'Audio', icon: 'Volume2' },
  { id: 'camera', name: 'Camera', icon: 'Camera' }
]

const activeTab = ref('audio')
const refreshing = ref(false)

// ==========================================
// Data loading
// ==========================================

async function refresh() {
  refreshing.value = true
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
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-theme-primary">
    <!-- Header -->
    <div class="bg-theme-secondary border-b border-theme-primary">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-theme-primary">Media</h1>
            </div>
            <p class="mt-1 text-sm text-theme-secondary">
              Audio devices, volume control, and camera management
            </p>
          </div>

          <!-- Header actions -->
          <div class="flex items-center gap-3">
            <!-- Error indicator -->
            <div
              v-if="mediaStore.error"
              class="hidden sm:flex items-center gap-2 text-sm text-error"
              :title="mediaStore.error"
            >
              <Icon name="AlertCircle" :size="14" />
              <span>Error</span>
            </div>

            <!-- Refresh -->
            <button
              @click="refresh"
              :disabled="refreshing"
              class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              title="Refresh"
              aria-label="Refresh media data"
            >
              <Icon name="RefreshCw" :size="18" :class="{ 'animate-spin': refreshing }" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="border-b border-theme-primary overflow-x-auto">
        <nav class="-mb-px flex space-x-8" role="tablist" aria-label="Media tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-secondary hover:text-theme-primary hover:border-theme-tertiary',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
            ]"
          >
            <Icon :name="tab.icon" :size="16" />
            <span>{{ tab.name }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab content -->
      <div class="py-6">
        <!-- Store error banner -->
        <div
          v-if="mediaStore.error"
          class="mb-4 bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2"
        >
          <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5 shrink-0" />
          <span class="text-sm text-error">{{ mediaStore.error }}</span>
        </div>

        <!-- ======================================== -->
        <!-- AUDIO TAB (G4) -->
        <!-- ======================================== -->
        <Suspense v-if="activeTab === 'audio'">
          <AudioTab />
          <template #fallback>
            <SkeletonLoader variant="card" :count="3" />
          </template>
        </Suspense>

        <!-- ======================================== -->
        <!-- CAMERA TAB (G4) -->
        <!-- ======================================== -->
        <Suspense v-else-if="activeTab === 'camera'">
          <CameraTab />
          <template #fallback>
            <SkeletonLoader variant="card" :count="2" />
          </template>
        </Suspense>
      </div>
    </div>
  </div>
</template>
