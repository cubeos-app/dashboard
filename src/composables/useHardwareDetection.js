/**
 * CubeOS Hardware Detection Composable
 *
 * S09 — Lightweight probe for communication and media hardware.
 * Used by AppSidebar and MobileNav to conditionally show/hide
 * Communication and Media nav items.
 *
 * Probes the API once on first call, caches result reactively.
 * Re-probes every 60 seconds to detect hot-plugged devices.
 *
 * Usage:
 *   const { hasCommHardware, hasMediaHardware, probeHardware } = useHardwareDetection()
 */
import { ref, onUnmounted } from 'vue'
import api from '@/api/client'

// Shared reactive state (singleton across all composable users)
const hasCommHardware = ref(true)  // Default true to avoid flash-of-missing nav
const hasMediaHardware = ref(true)
const lastProbe = ref(0)
const probing = ref(false)
let probeTimer = null
let instanceCount = 0

const PROBE_INTERVAL = 60000 // Re-probe every 60s

/**
 * Probe communication hardware by checking if any comm devices exist.
 * Uses lightweight endpoints that return quickly.
 */
async function probeHardware() {
  if (probing.value) return
  probing.value = true

  try {
    // Probe communication: check bluetooth, cellular, GPS
    // Any non-empty result means comm hardware exists
    const commChecks = await Promise.allSettled([
      api.get('/communication/bluetooth', {}, { timeout: 3000 }),
      api.get('/communication/cellular/status', {}, { timeout: 3000 }),
      api.get('/communication/gps', {}, { timeout: 3000 })
    ])

    const commDetected = commChecks.some(r => {
      if (r.status !== 'fulfilled' || !r.value) return false
      const v = r.value
      // Any truthy response means hardware exists
      if (Array.isArray(v) && v.length > 0) return true
      if (v.devices && v.devices.length > 0) return true
      if (v.items && v.items.length > 0) return true
      if (v.powered !== undefined) return true // Bluetooth adapter present
      if (v.connected !== undefined) return true // Cellular modem present
      return false
    })

    hasCommHardware.value = commDetected

    // Probe media: check audio devices and cameras
    const mediaChecks = await Promise.allSettled([
      api.get('/media/audio', {}, { timeout: 3000 }),
      api.get('/media/cameras', {}, { timeout: 3000 })
    ])

    const mediaDetected = mediaChecks.some(r => {
      if (r.status !== 'fulfilled' || !r.value) return false
      const v = r.value
      if (Array.isArray(v) && v.length > 0) return true
      if (v.devices && v.devices.length > 0) return true
      if (v.items && v.items.length > 0) return true
      return false
    })

    hasMediaHardware.value = mediaDetected
    lastProbe.value = Date.now()
  } catch {
    // On error, keep items visible (safe default)
    hasCommHardware.value = true
    hasMediaHardware.value = true
  } finally {
    probing.value = false
  }
}

function startProbing() {
  if (!probeTimer) {
    // Initial probe
    if (Date.now() - lastProbe.value > PROBE_INTERVAL) {
      probeHardware()
    }
    probeTimer = setInterval(probeHardware, PROBE_INTERVAL)
  }
}

function stopProbing() {
  if (probeTimer) {
    clearInterval(probeTimer)
    probeTimer = null
  }
}

export function useHardwareDetection() {
  instanceCount++
  startProbing()

  onUnmounted(() => {
    instanceCount--
    if (instanceCount <= 0) {
      stopProbing()
      instanceCount = 0
    }
  })

  return {
    hasCommHardware,
    hasMediaHardware,
    probeHardware
  }
}
