<script setup>
/**
 * AudioTab.vue
 *
 * Sprint 8 Group 4: Audio device management panel.
 * Displays playback/capture device lists, volume slider with
 * debounced control, and mute toggle.
 *
 * Lazy-loaded by MediaView.
 * Store: useMediaStore — fetchAudioDevices, fetchPlaybackDevices,
 *        fetchCaptureDevices, fetchVolume, setVolume, setMute
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMediaStore } from '@/stores/media'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const mediaStore = useMediaStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const actionLoading = ref({})
let volumeDebounceTimer = null

// ==========================================
// Computed — volume state
// ==========================================

const volumeData = computed(() => {
  const v = mediaStore.volume
  if (!v) return null

  const level = v.volume ?? v.level ?? v.percentage ?? v.value ?? null
  const muted = v.muted ?? v.mute ?? v.is_muted ?? false

  return {
    level: level !== null ? Math.min(100, Math.max(0, Math.round(Number(level)))) : 50,
    muted: muted === true || muted === 'true',
    _raw: v
  }
})

const volumeIcon = computed(() => {
  if (!volumeData.value || volumeData.value.muted) return 'VolumeX'
  if (volumeData.value.level === 0) return 'VolumeX'
  if (volumeData.value.level <= 33) return 'Volume'
  if (volumeData.value.level <= 66) return 'Volume1'
  return 'Volume2'
})

// Track slider value locally for smooth UX
const sliderValue = ref(50)

// Sync slider with store when volume data changes
function syncSlider() {
  if (volumeData.value) {
    sliderValue.value = volumeData.value.level
  }
}

// ==========================================
// Computed — device lists
// ==========================================

const playbackList = computed(() => {
  const raw = mediaStore.playbackDevices
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
  return list.map(d => ({
    name: d.name ?? d.description ?? d.label ?? 'Unknown Device',
    type: d.type ?? d.class ?? d.category ?? 'playback',
    isDefault: d.default ?? d.is_default ?? d.primary ?? false,
    id: d.id ?? d.index ?? d.name ?? 'unknown',
    _raw: d
  }))
})

const captureList = computed(() => {
  const raw = mediaStore.captureDevices
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
  return list.map(d => ({
    name: d.name ?? d.description ?? d.label ?? 'Unknown Device',
    type: d.type ?? d.class ?? d.category ?? 'capture',
    isDefault: d.default ?? d.is_default ?? d.primary ?? false,
    id: d.id ?? d.index ?? d.name ?? 'unknown',
    _raw: d
  }))
})

const hasAnyDevices = computed(() => {
  // Check if we have any audio devices from the main audio endpoint
  const raw = mediaStore.audioDevices
  if (!raw) return false
  const list = Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
  if (list.length > 0) return true
  // Fallback: check playback + capture
  return playbackList.value.length > 0 || captureList.value.length > 0
})

const totalDeviceCount = computed(() => {
  const raw = mediaStore.audioDevices
  if (raw) {
    const list = Array.isArray(raw) ? raw : (raw.devices || raw.items || [])
    if (list.length > 0) return list.length
  }
  return playbackList.value.length + captureList.value.length
})

// ==========================================
// Actions
// ==========================================

function handleVolumeChange(event) {
  const level = Number(event.target.value)
  sliderValue.value = level

  // Debounce the API call
  if (volumeDebounceTimer) clearTimeout(volumeDebounceTimer)
  volumeDebounceTimer = setTimeout(async () => {
    actionLoading.value['volume'] = true
    try {
      await mediaStore.setVolume(level)
    } catch {
      // Store sets error
    } finally {
      actionLoading.value['volume'] = false
    }
  }, 300)
}

async function handleToggleMute() {
  if (!volumeData.value) return
  const newMuted = !volumeData.value.muted
  actionLoading.value['mute'] = true
  try {
    await mediaStore.setMute(newMuted)
    syncSlider()
  } catch {
    // Store sets error
  } finally {
    actionLoading.value['mute'] = false
  }
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      mediaStore.fetchAudioDevices({ signal: signal() }),
      mediaStore.fetchPlaybackDevices({ signal: signal() }),
      mediaStore.fetchCaptureDevices({ signal: signal() }),
      mediaStore.fetchVolume({ signal: signal() })
    ])
    syncSlider()
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (volumeDebounceTimer) clearTimeout(volumeDebounceTimer)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !mediaStore.audioDevices">
      <SkeletonLoader variant="card" :count="3" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Empty state — no audio devices -->
      <!-- ======================================== -->
      <div
        v-if="!hasAnyDevices"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="VolumeX" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Audio Devices Detected</p>
        <p class="text-sm text-theme-muted">
          Connect a USB audio device, speaker, or microphone to manage audio settings.
        </p>
      </div>

      <template v-else>
        <!-- ======================================== -->
        <!-- Volume Control Card -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  volumeData?.muted ? 'bg-neutral-muted' : 'bg-accent-muted'
                ]"
              >
                <Icon
                  :name="volumeIcon"
                  :size="20"
                  :class="volumeData?.muted ? 'text-theme-muted' : 'text-accent'"
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-theme-primary">Volume</h2>
                  <span
                    v-if="volumeData?.muted"
                    class="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-muted text-warning"
                  >
                    Muted
                  </span>
                </div>
                <p class="text-sm text-theme-secondary mt-0.5">
                  {{ totalDeviceCount }} audio device{{ totalDeviceCount !== 1 ? 's' : '' }} detected
                </p>
              </div>
            </div>

            <!-- Mute toggle -->
            <button
              @click="handleToggleMute"
              :disabled="actionLoading['mute']"
              role="switch"
              :aria-checked="volumeData?.muted ? 'true' : 'false'"
              :aria-label="volumeData?.muted ? 'Unmute audio' : 'Mute audio'"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                volumeData?.muted
                  ? 'bg-accent text-white hover:bg-accent-hover'
                  : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
              ]"
            >
              <Icon
                :name="actionLoading['mute'] ? 'Loader2' : (volumeData?.muted ? 'Volume2' : 'VolumeX')"
                :size="14"
                :class="['inline-block mr-1.5', { 'animate-spin': actionLoading['mute'] }]"
              />
              {{ volumeData?.muted ? 'Unmute' : 'Mute' }}
            </button>
          </div>

          <!-- Volume slider -->
          <div class="mt-5 pt-4 border-t border-theme-primary">
            <div class="flex items-center gap-4">
              <Icon name="Volume" :size="16" class="text-theme-muted shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="sliderValue"
                @input="handleVolumeChange"
                aria-label="Volume level"
                :class="[
                  'flex-1 h-2 rounded-full appearance-none cursor-pointer',
                  'bg-theme-tertiary',
                  '[&::-webkit-slider-thumb]:appearance-none',
                  '[&::-webkit-slider-thumb]:w-4',
                  '[&::-webkit-slider-thumb]:h-4',
                  '[&::-webkit-slider-thumb]:rounded-full',
                  '[&::-webkit-slider-thumb]:bg-accent',
                  '[&::-webkit-slider-thumb]:cursor-pointer',
                  '[&::-moz-range-thumb]:w-4',
                  '[&::-moz-range-thumb]:h-4',
                  '[&::-moz-range-thumb]:rounded-full',
                  '[&::-moz-range-thumb]:bg-accent',
                  '[&::-moz-range-thumb]:border-0',
                  '[&::-moz-range-thumb]:cursor-pointer',
                  volumeData?.muted ? 'opacity-40' : ''
                ]"
                :disabled="volumeData?.muted"
              />
              <Icon name="Volume2" :size="16" class="text-theme-muted shrink-0" />
              <span
                :class="[
                  'text-sm font-mono font-semibold min-w-[3ch] text-right',
                  volumeData?.muted ? 'text-theme-muted' : 'text-theme-primary'
                ]"
              >
                {{ sliderValue }}
              </span>
            </div>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Playback Devices -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex items-center gap-2">
              <Icon name="Speaker" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Playback Devices</h2>
              <span
                v-if="playbackList.length"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
              >
                {{ playbackList.length }}
              </span>
            </div>
          </div>

          <!-- Empty playback -->
          <div v-if="!playbackList.length" class="p-6 text-center">
            <Icon name="Speaker" :size="28" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-muted">No playback devices found</p>
          </div>

          <!-- Playback device list -->
          <div v-else class="divide-y divide-theme-primary">
            <div
              v-for="device in playbackList"
              :key="device.id"
              class="px-5 py-3 flex items-center justify-between gap-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    device.isDefault ? 'bg-success-muted' : 'bg-theme-secondary'
                  ]"
                >
                  <Icon
                    name="Speaker"
                    :size="16"
                    :class="device.isDefault ? 'text-success' : 'text-theme-muted'"
                  />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-theme-primary truncate">{{ device.name }}</p>
                  <p v-if="device.type" class="text-xs text-theme-muted capitalize">{{ device.type }}</p>
                </div>
              </div>
              <span
                v-if="device.isDefault"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-muted text-success shrink-0"
              >
                Default
              </span>
            </div>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Capture Devices -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex items-center gap-2">
              <Icon name="Mic" :size="18" class="text-accent" />
              <h2 class="text-lg font-semibold text-theme-primary">Capture Devices</h2>
              <span
                v-if="captureList.length"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
              >
                {{ captureList.length }}
              </span>
            </div>
          </div>

          <!-- Empty capture -->
          <div v-if="!captureList.length" class="p-6 text-center">
            <Icon name="Mic" :size="28" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-muted">No capture devices found</p>
          </div>

          <!-- Capture device list -->
          <div v-else class="divide-y divide-theme-primary">
            <div
              v-for="device in captureList"
              :key="device.id"
              class="px-5 py-3 flex items-center justify-between gap-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    device.isDefault ? 'bg-success-muted' : 'bg-theme-secondary'
                  ]"
                >
                  <Icon
                    name="Mic"
                    :size="16"
                    :class="device.isDefault ? 'text-success' : 'text-theme-muted'"
                  />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-theme-primary truncate">{{ device.name }}</p>
                  <p v-if="device.type" class="text-xs text-theme-muted capitalize">{{ device.type }}</p>
                </div>
              </div>
              <span
                v-if="device.isDefault"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-muted text-success shrink-0"
              >
                Default
              </span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
