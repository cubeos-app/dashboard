<script setup>
/**
 * CameraTab.vue
 *
 * Sprint 8 Group 4: Camera device management panel.
 * Displays camera list, detailed info, image capture with inline display,
 * and stream start/stop with copyable URL.
 *
 * Lazy-loaded by MediaView.
 * Store: useMediaStore — fetchCameras, fetchCameraInfo, captureImage,
 *        fetchCapturedImage, fetchStreamInfo, startStream, stopStream
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMediaStore } from '@/stores/media'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { useMode } from '@/composables/useMode'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const mediaStore = useMediaStore()
const { signal } = useAbortOnUnmount()
const { isAdvanced } = useMode()

const loading = ref(true)
const actionLoading = ref({})
const captureSuccess = ref(false)
const streamUrlCopied = ref(false)
let captureSuccessTimeout = null
let streamUrlCopiedTimeout = null

// ==========================================
// Computed — camera list
// ==========================================

const cameraList = computed(() => {
  const raw = mediaStore.cameras
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : (raw.cameras || raw.devices || raw.items || [])
  return list.map((c, i) => ({
    name: c.name ?? c.device ?? c.label ?? `Camera ${i + 1}`,
    id: c.id ?? c.device ?? c.path ?? `cam-${i}`,
    resolution: c.resolution ?? c.format ?? null,
    driver: c.driver ?? c.type ?? null,
    status: c.status ?? c.state ?? 'available',
    _raw: c
  }))
})

// ==========================================
// Computed — camera info
// ==========================================

const cameraInfo = computed(() => {
  const info = mediaStore.cameraInfo
  if (!info) return null

  // Parse capabilities/resolutions
  let resolutions = info.resolutions ?? info.formats ?? info.capabilities ?? null
  if (resolutions && !Array.isArray(resolutions)) {
    resolutions = [resolutions]
  }

  return {
    name: info.name ?? info.device ?? info.label ?? 'Camera',
    driver: info.driver ?? info.type ?? info.backend ?? null,
    resolution: info.resolution ?? info.current_resolution ?? info.format ?? null,
    resolutions: resolutions,
    capabilities: info.capabilities ?? info.features ?? null,
    _raw: info
  }
})

// ==========================================
// Computed — captured image
// ==========================================

const capturedImageSrc = computed(() => {
  const img = mediaStore.capturedImage
  if (!img) return null

  // Handle base64 data
  const data = img.image ?? img.data ?? img.base64 ?? null
  if (data) {
    // Already a data URL
    if (String(data).startsWith('data:')) return data
    // Raw base64 — assume JPEG
    return `data:image/jpeg;base64,${data}`
  }

  // Handle URL
  const url = img.url ?? img.src ?? img.path ?? null
  if (url) return url

  return null
})

// ==========================================
// Computed — stream info
// ==========================================

const streamStatus = computed(() => {
  const info = mediaStore.streamInfo
  if (!info) return null

  const active = info.active ?? info.streaming ?? info.running ?? info.status === 'active'
  const url = info.url ?? info.stream_url ?? info.rtsp_url ?? info.endpoint ?? null

  return {
    active: active === true || active === 'true',
    url: url,
    format: info.format ?? info.type ?? null,
    resolution: info.resolution ?? null,
    _raw: info
  }
})

const streamBadge = computed(() => {
  if (!streamStatus.value) return { text: 'Unknown', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
  if (streamStatus.value.active) return { text: 'Active', bg: 'bg-success-muted', fg: 'text-success' }
  return { text: 'Inactive', bg: 'bg-neutral-muted', fg: 'text-theme-muted' }
})

// ==========================================
// Actions
// ==========================================

async function handleCapture() {
  actionLoading.value['capture'] = true
  captureSuccess.value = false
  try {
    await mediaStore.captureImage()
    captureSuccess.value = true
    if (captureSuccessTimeout) clearTimeout(captureSuccessTimeout)
    captureSuccessTimeout = setTimeout(() => { captureSuccess.value = false }, 3000)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value['capture'] = false
  }
}

async function handleStartStream() {
  const confirmed = await confirm({
    title: 'Start Camera Stream',
    message: 'This will start a live video stream from the camera. The stream will consume additional system resources.',
    confirmText: 'Start Stream',
    cancelText: 'Cancel',
    variant: 'info'
  })
  if (!confirmed) return

  actionLoading.value['stream-start'] = true
  try {
    await mediaStore.startStream()
  } catch {
    // Store sets error
  } finally {
    actionLoading.value['stream-start'] = false
  }
}

async function handleStopStream() {
  actionLoading.value['stream-stop'] = true
  try {
    await mediaStore.stopStream()
  } catch {
    // Store sets error
  } finally {
    actionLoading.value['stream-stop'] = false
  }
}

async function copyStreamUrl() {
  if (!streamStatus.value?.url) return
  try {
    await navigator.clipboard.writeText(streamStatus.value.url)
  } catch {
    // Fallback for non-HTTPS / older browsers
    const ta = document.createElement('textarea')
    ta.value = streamStatus.value.url
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  streamUrlCopied.value = true
  if (streamUrlCopiedTimeout) clearTimeout(streamUrlCopiedTimeout)
  streamUrlCopiedTimeout = setTimeout(() => { streamUrlCopied.value = false }, 2000)
}

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      mediaStore.fetchCameras({ signal: signal() }),
      mediaStore.fetchCameraInfo({ signal: signal() }),
      mediaStore.fetchStreamInfo({ signal: signal() })
    ])
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (captureSuccessTimeout) clearTimeout(captureSuccessTimeout)
  if (streamUrlCopiedTimeout) clearTimeout(streamUrlCopiedTimeout)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading && !mediaStore.cameras">
      <SkeletonLoader variant="card" :count="3" />
    </template>

    <template v-else>
      <!-- ======================================== -->
      <!-- Empty state — no camera detected -->
      <!-- ======================================== -->
      <div
        v-if="!cameraList.length"
        class="bg-theme-card border border-theme-primary rounded-xl p-8 text-center"
      >
        <Icon name="Camera" :size="40" class="text-theme-muted mx-auto mb-3" />
        <p class="text-theme-secondary font-medium mb-1">No Camera Detected</p>
        <p class="text-sm text-theme-muted">
          Connect a USB camera or Raspberry Pi Camera Module to enable image capture and streaming.
        </p>
      </div>

      <template v-else>
        <!-- ======================================== -->
        <!-- Camera Info Card -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-muted">
                <Icon name="Camera" :size="20" class="text-accent" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-theme-primary">
                    {{ cameraInfo?.name ?? cameraList[0]?.name ?? 'Camera' }}
                  </h2>
                  <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-success-muted text-success">
                    Available
                  </span>
                </div>
                <div class="flex items-center gap-4 mt-0.5 flex-wrap">
                  <span v-if="cameraInfo?.driver" class="text-sm text-theme-muted">
                    {{ cameraInfo.driver }}
                  </span>
                  <span v-if="cameraInfo?.resolution" class="text-sm text-theme-muted">
                    {{ cameraInfo.resolution }}
                  </span>
                  <span v-if="cameraList.length > 1" class="text-sm text-theme-muted">
                    {{ cameraList.length }} cameras
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Camera list (Advanced, multiple) -->
          <div v-if="isAdvanced && cameraList.length > 1" class="mt-4 pt-4 border-t border-theme-primary">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="camera in cameraList"
                :key="camera.id"
                class="bg-theme-secondary rounded-lg p-3 flex items-center gap-3"
              >
                <Icon name="Camera" :size="16" class="text-theme-muted shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-theme-primary truncate">{{ camera.name }}</p>
                  <p v-if="camera.resolution" class="text-xs text-theme-muted">{{ camera.resolution }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Supported resolutions (Advanced) -->
          <div
            v-if="isAdvanced && cameraInfo?.resolutions?.length"
            class="mt-4 pt-4 border-t border-theme-primary"
          >
            <p class="text-xs text-theme-muted uppercase tracking-wider mb-2">Supported Resolutions</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(res, idx) in cameraInfo.resolutions"
                :key="idx"
                class="text-xs font-mono px-2 py-1 rounded bg-theme-secondary text-theme-secondary"
              >
                {{ typeof res === 'string' ? res : JSON.stringify(res) }}
              </span>
            </div>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Capture Section -->
        <!-- ======================================== -->
        <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon name="Aperture" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Capture</h2>
              </div>

              <div class="flex items-center gap-2">
                <!-- Success flash -->
                <span
                  v-if="captureSuccess"
                  class="text-xs font-medium text-success"
                >
                  Image captured
                </span>

                <!-- Capture button -->
                <button
                  @click="handleCapture"
                  :disabled="actionLoading['capture']"
                  aria-label="Capture image from camera"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  <Icon
                    :name="actionLoading['capture'] ? 'Loader2' : 'Camera'"
                    :size="14"
                    :class="['inline-block mr-1.5', { 'animate-spin': actionLoading['capture'] }]"
                  />
                  {{ actionLoading['capture'] ? 'Capturing...' : 'Capture Image' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Captured image display -->
          <div v-if="capturedImageSrc" class="p-5">
            <div class="rounded-lg overflow-hidden bg-theme-secondary border border-theme-primary">
              <img
                :src="capturedImageSrc"
                alt="Captured image"
                class="w-full h-auto max-h-96 object-contain"
              />
            </div>
          </div>

          <!-- No captured image -->
          <div v-else class="p-8 text-center">
            <Icon name="ImageOff" :size="32" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-secondary">No Captured Image</p>
            <p class="text-xs text-theme-muted mt-1">
              Click "Capture Image" to take a snapshot from the camera
            </p>
          </div>
        </div>

        <!-- ======================================== -->
        <!-- Stream Section (Advanced) -->
        <!-- ======================================== -->
        <div v-if="isAdvanced" class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
          <div class="px-5 py-4 border-b border-theme-primary">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <Icon name="Video" :size="18" class="text-accent" />
                <h2 class="text-lg font-semibold text-theme-primary">Stream</h2>
                <span
                  :class="[
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    streamBadge.bg,
                    streamBadge.fg
                  ]"
                >
                  {{ streamBadge.text }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <!-- Start / Stop buttons -->
                <button
                  v-if="!streamStatus?.active"
                  @click="handleStartStream"
                  :disabled="actionLoading['stream-start']"
                  aria-label="Start camera stream"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  <Icon
                    :name="actionLoading['stream-start'] ? 'Loader2' : 'Play'"
                    :size="14"
                    :class="['inline-block mr-1.5', { 'animate-spin': actionLoading['stream-start'] }]"
                  />
                  {{ actionLoading['stream-start'] ? 'Starting...' : 'Start Stream' }}
                </button>

                <button
                  v-else
                  @click="handleStopStream"
                  :disabled="actionLoading['stream-stop']"
                  aria-label="Stop camera stream"
                  class="px-4 py-2 text-sm font-medium rounded-lg bg-error text-on-accent hover:opacity-80 transition-colors disabled:opacity-50"
                >
                  <Icon
                    :name="actionLoading['stream-stop'] ? 'Loader2' : 'Square'"
                    :size="14"
                    :class="['inline-block mr-1.5', { 'animate-spin': actionLoading['stream-stop'] }]"
                  />
                  {{ actionLoading['stream-stop'] ? 'Stopping...' : 'Stop Stream' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Stream details when active -->
          <div v-if="streamStatus?.active" class="p-5 space-y-4">
            <!-- Stream URL (copyable) -->
            <div v-if="streamStatus.url" class="space-y-2">
              <p class="text-xs text-theme-muted uppercase tracking-wider">Stream URL</p>
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-theme-secondary rounded-lg px-3 py-2 font-mono text-sm text-theme-primary overflow-x-auto">
                  {{ streamStatus.url }}
                </div>
                <button
                  @click="copyStreamUrl"
                  class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors shrink-0"
                  :title="streamUrlCopied ? 'Copied!' : 'Copy URL'"
                  :aria-label="streamUrlCopied ? 'Stream URL copied' : 'Copy stream URL'"
                >
                  <Icon :name="streamUrlCopied ? 'Check' : 'Copy'" :size="16" />
                </button>
              </div>
            </div>

            <!-- Stream metadata -->
            <div class="flex items-center gap-6 flex-wrap">
              <div v-if="streamStatus.format" class="flex items-center gap-2">
                <span class="text-sm text-theme-secondary">Format:</span>
                <span class="text-sm font-mono text-theme-primary">{{ streamStatus.format }}</span>
              </div>
              <div v-if="streamStatus.resolution" class="flex items-center gap-2">
                <span class="text-sm text-theme-secondary">Resolution:</span>
                <span class="text-sm font-mono text-theme-primary">{{ streamStatus.resolution }}</span>
              </div>
            </div>
          </div>

          <!-- Stream inactive hint -->
          <div v-else class="p-8 text-center">
            <Icon name="VideoOff" :size="32" class="text-theme-muted mx-auto mb-2" />
            <p class="text-sm text-theme-secondary">Stream Inactive</p>
            <p class="text-xs text-theme-muted mt-1">
              Start a live stream to get an RTSP/HTTP URL for use in other applications
            </p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
