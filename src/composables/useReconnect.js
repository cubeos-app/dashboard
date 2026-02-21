/**
 * useReconnect.js — Health polling composable
 *
 * Polls the API /health endpoint to detect connection loss and recovery.
 * Used by SystemTransitionScreen for reboot and WiFi reconnect flows.
 *
 * Usage:
 *   const { connected, wasDisconnected, attempts, start, stop } = useReconnect()
 *   start()  // begins polling
 *   watch(connected, (val) => { if (val && wasDisconnected.value) { ... } })
 */
import { ref, onUnmounted } from 'vue'

export function useReconnect(options = {}) {
  const {
    url = '/health',
    intervalMs = 3000,
    timeoutMs = 5000,
    autoStart = false
  } = options

  const connected = ref(false)
  const wasDisconnected = ref(false)
  const attempts = ref(0)
  const reconnected = ref(false)

  let pollTimer = null
  let active = false

  /**
   * Single health check. Returns true if API is reachable.
   */
  async function check() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const resp = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (resp.ok) {
        connected.value = true
        if (wasDisconnected.value && !reconnected.value) {
          reconnected.value = true
        }
        return true
      }
    } catch {
      // Network error or timeout — not connected
    }
    connected.value = false
    wasDisconnected.value = true
    return false
  }

  /**
   * Start polling loop.
   */
  function start() {
    stop()
    active = true
    attempts.value = 0
    connected.value = false
    wasDisconnected.value = false
    reconnected.value = false

    async function poll() {
      if (!active) return
      attempts.value++
      await check()
      if (active) {
        pollTimer = setTimeout(poll, intervalMs)
      }
    }
    poll()
  }

  /**
   * Stop polling.
   */
  function stop() {
    active = false
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  /**
   * Reset all state and stop polling.
   */
  function reset() {
    stop()
    connected.value = false
    wasDisconnected.value = false
    reconnected.value = false
    attempts.value = 0
  }

  if (autoStart) start()

  onUnmounted(stop)

  return {
    connected,
    wasDisconnected,
    reconnected,
    attempts,
    start,
    stop,
    reset,
    check
  }
}
