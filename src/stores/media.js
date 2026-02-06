/**
 * CubeOS Media Store
 *
 * Sprint 8: Audio and camera device management for MuleCube.
 * Provides access to audio playback/capture devices, volume control,
 * and camera capture/streaming endpoints.
 * All endpoints proxy through CubeOS API → HAL service.
 *
 * API Endpoints:
 *   GET    /media/audio              - List all audio devices
 *   GET    /media/audio/playback     - List playback devices
 *   GET    /media/audio/capture      - List capture devices
 *   GET    /media/audio/volume       - Get current volume
 *   POST   /media/audio/volume       - Set volume level
 *   POST   /media/audio/mute         - Set mute state
 *   GET    /media/cameras            - List cameras
 *   GET    /media/cameras/info       - Camera details
 *   POST   /media/cameras/capture    - Capture image
 *   GET    /media/cameras/capture    - Get captured image
 *   GET    /media/cameras/stream     - Stream status
 *   POST   /media/cameras/stream/start  - Start stream
 *   POST   /media/cameras/stream/stop   - Stop stream
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useMediaStore = defineStore('media', () => {
  // ==========================================
  // State
  // ==========================================

  // Audio
  const audioDevices = ref(null)
  const playbackDevices = ref(null)
  const captureDevices = ref(null)
  const volume = ref(null)

  // Camera
  const cameras = ref(null)
  const cameraInfo = ref(null)
  const capturedImage = ref(null)
  const streamInfo = ref(null)

  // Per-section loading & error (fixes shared loading/error clobber)
  const audioLoading = ref(false)
  const audioError = ref(null)
  const cameraLoading = ref(false)
  const cameraError = ref(null)

  // Backwards-compatible unified refs
  const loading = computed(() => audioLoading.value || cameraLoading.value)
  const error = computed(() => audioError.value || cameraError.value)

  // ==========================================
  // Audio
  // ==========================================

  /**
   * Fetch all audio devices
   * GET /media/audio
   */
  async function fetchAudioDevices(options = {}) {
    audioLoading.value = true
    audioError.value = null
    try {
      const data = await api.get('/media/audio', {}, options)
      if (data === null) return
      audioDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      audioError.value = e.message
      audioDevices.value = null
    } finally {
      audioLoading.value = false
    }
  }

  /**
   * Fetch playback devices
   * GET /media/audio/playback
   */
  async function fetchPlaybackDevices(options = {}) {
    try {
      const data = await api.get('/media/audio/playback', {}, options)
      if (data === null) return
      playbackDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      playbackDevices.value = null
    }
  }

  /**
   * Fetch capture devices
   * GET /media/audio/capture
   */
  async function fetchCaptureDevices(options = {}) {
    try {
      const data = await api.get('/media/audio/capture', {}, options)
      if (data === null) return
      captureDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      captureDevices.value = null
    }
  }

  /**
   * Fetch current volume level
   * GET /media/audio/volume
   */
  async function fetchVolume(options = {}) {
    try {
      const data = await api.get('/media/audio/volume', {}, options)
      if (data === null) return
      volume.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      volume.value = null
    }
  }

  /**
   * Set volume level
   * POST /media/audio/volume
   * @param {number} level - Volume 0–100
   */
  async function setVolume(level) {
    audioError.value = null
    try {
      const data = await api.post('/media/audio/volume', { volume: level })
      await fetchVolume()
      return data
    } catch (e) {
      audioError.value = e.message
      throw e
    }
  }

  /**
   * Set mute state
   * POST /media/audio/mute
   * @param {boolean} muted - true to mute, false to unmute
   */
  async function setMute(muted) {
    audioError.value = null
    try {
      const data = await api.post('/media/audio/mute', { muted })
      await fetchVolume()
      return data
    } catch (e) {
      audioError.value = e.message
      throw e
    }
  }

  // ==========================================
  // Camera
  // ==========================================

  /**
   * Fetch list of cameras
   * GET /media/cameras
   */
  async function fetchCameras(options = {}) {
    cameraLoading.value = true
    cameraError.value = null
    try {
      const data = await api.get('/media/cameras', {}, options)
      if (data === null) return
      cameras.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      cameraError.value = e.message
      cameras.value = null
    } finally {
      cameraLoading.value = false
    }
  }

  /**
   * Fetch camera details
   * GET /media/cameras/info
   */
  async function fetchCameraInfo(options = {}) {
    try {
      const data = await api.get('/media/cameras/info', {}, options)
      if (data === null) return
      cameraInfo.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      cameraInfo.value = null
    }
  }

  /**
   * Capture an image from camera
   * POST /media/cameras/capture
   */
  async function captureImage() {
    cameraError.value = null
    try {
      const data = await api.post('/media/cameras/capture')
      // Auto-fetch the captured image after capture
      await fetchCapturedImage()
      return data
    } catch (e) {
      cameraError.value = e.message
      throw e
    }
  }

  /**
   * Fetch the last captured image
   * GET /media/cameras/capture
   */
  async function fetchCapturedImage(options = {}) {
    try {
      const data = await api.get('/media/cameras/capture', {}, options)
      if (data === null) return
      capturedImage.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      capturedImage.value = null
    }
  }

  /**
   * Fetch stream status
   * GET /media/cameras/stream
   */
  async function fetchStreamInfo(options = {}) {
    try {
      const data = await api.get('/media/cameras/stream', {}, options)
      if (data === null) return
      streamInfo.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      streamInfo.value = null
    }
  }

  /**
   * Start camera stream
   * POST /media/cameras/stream/start
   */
  async function startStream() {
    cameraError.value = null
    try {
      const data = await api.post('/media/cameras/stream/start')
      await fetchStreamInfo()
      return data
    } catch (e) {
      cameraError.value = e.message
      throw e
    }
  }

  /**
   * Stop camera stream
   * POST /media/cameras/stream/stop
   */
  async function stopStream() {
    cameraError.value = null
    try {
      const data = await api.post('/media/cameras/stream/stop')
      await fetchStreamInfo()
      return data
    } catch (e) {
      cameraError.value = e.message
      throw e
    }
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State — Audio
    audioDevices,
    playbackDevices,
    captureDevices,
    volume,

    // State — Camera
    cameras,
    cameraInfo,
    capturedImage,
    streamInfo,

    // State — Common
    loading,
    error,
    audioLoading,
    audioError,
    cameraLoading,
    cameraError,

    // Audio
    fetchAudioDevices,
    fetchPlaybackDevices,
    fetchCaptureDevices,
    fetchVolume,
    setVolume,
    setMute,

    // Camera
    fetchCameras,
    fetchCameraInfo,
    captureImage,
    fetchCapturedImage,
    fetchStreamInfo,
    startStream,
    stopStream
  }
})
