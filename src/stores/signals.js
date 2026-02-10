/**
 * CubeOS Signals Store
 *
 * Lightweight store for the SignalsWidget dashboard card.
 * Polls HAL communication endpoints for quick status summaries.
 * Each signal type has a status: 'unavailable' | 'detecting' | 'connected' | 'active'
 *
 * Uses the same API endpoints as the full communication store but only
 * fetches the minimum data needed for the dashboard widget.
 *
 * API Endpoints:
 *   GET /communication/cellular/status   → carrier, signal, connection type
 *   GET /communication/meshtastic/status  → connected, node count
 *   GET /communication/gps               → device list (presence check)
 *   GET /communication/gps/{port}/position → fix, coords, satellites
 *   GET /communication/iridium/status     → connected, registration
 *   GET /communication/iridium/signal     → signal bars (0-5)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useSignalsStore = defineStore('signals', () => {
  // ─── State ──────────────────────────────────────────────────
  const cellular = ref({ status: 'unavailable', carrier: null, signalBars: 0, type: null })
  const meshtastic = ref({ status: 'unavailable', nodeCount: 0, lastHeard: null })
  const gps = ref({ status: 'unavailable', fix: null, lat: null, lon: null, satellites: 0 })
  const iridium = ref({ status: 'unavailable', signalBars: 0, registration: null })
  const loading = ref(false)

  // ─── Computed ───────────────────────────────────────────────
  const hasAnySignal = computed(() => {
    return cellular.value.status !== 'unavailable'
      || meshtastic.value.status !== 'unavailable'
      || gps.value.status !== 'unavailable'
      || iridium.value.status !== 'unavailable'
  })

  // ─── Actions ────────────────────────────────────────────────

  async function fetchCellular(options = {}) {
    try {
      const data = await api.get('/communication/cellular/status', {}, options)
      if (data === null) return
      cellular.value = {
        status: data.connected ? 'active' : 'connected',
        carrier: data.carrier || data.operator || null,
        signalBars: data.signal_bars ?? data.signal_strength ?? 0,
        type: data.access_technology || data.connection_type || null,
      }
    } catch {
      cellular.value = { status: 'unavailable', carrier: null, signalBars: 0, type: null }
    }
  }

  async function fetchMeshtastic(options = {}) {
    try {
      const data = await api.get('/communication/meshtastic/status', {}, options)
      if (data === null) return
      meshtastic.value = {
        status: data.connected ? 'active' : 'connected',
        nodeCount: data.node_count ?? data.nodes?.length ?? 0,
        lastHeard: data.last_heard || null,
      }
    } catch {
      meshtastic.value = { status: 'unavailable', nodeCount: 0, lastHeard: null }
    }
  }

  async function fetchGps(options = {}) {
    try {
      const devices = await api.get('/communication/gps', {}, options)
      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        gps.value = { status: 'unavailable', fix: null, lat: null, lon: null, satellites: 0 }
        return
      }
      // Use the first GPS device
      const port = devices[0]?.port || devices[0]?.device
      if (!port) {
        gps.value = { status: 'connected', fix: null, lat: null, lon: null, satellites: 0 }
        return
      }
      const pos = await api.get(`/communication/gps/${encodeURIComponent(port)}/position`, {}, options)
      gps.value = {
        status: pos?.fix && pos.fix !== 'none' ? 'active' : 'connected',
        fix: pos?.fix || null,
        lat: pos?.latitude ?? null,
        lon: pos?.longitude ?? null,
        satellites: pos?.satellites ?? 0,
      }
    } catch {
      gps.value = { status: 'unavailable', fix: null, lat: null, lon: null, satellites: 0 }
    }
  }

  async function fetchIridium(options = {}) {
    try {
      const data = await api.get('/communication/iridium/status', {}, options)
      if (data === null) return
      const sig = await api.get('/communication/iridium/signal', {}, {}).catch(() => null)
      iridium.value = {
        status: data.connected ? 'active' : 'connected',
        signalBars: sig?.bars ?? sig?.signal ?? 0,
        registration: data.registration || data.status || null,
      }
    } catch {
      iridium.value = { status: 'unavailable', signalBars: 0, registration: null }
    }
  }

  /** Fetch all signal sources. Failures are per-source, not global. */
  async function fetchAll(options = {}) {
    loading.value = true
    await Promise.allSettled([
      fetchCellular(options),
      fetchMeshtastic(options),
      fetchGps(options),
      fetchIridium(options),
    ])
    loading.value = false
  }

  return {
    cellular,
    meshtastic,
    gps,
    iridium,
    loading,
    hasAnySignal,
    fetchAll,
    fetchCellular,
    fetchMeshtastic,
    fetchGps,
    fetchIridium,
  }
})
