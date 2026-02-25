import { ref, onMounted, onUnmounted } from 'vue'

/**
 * usePolling — Reusable polling composable with visibility awareness.
 *
 * @param {Function} fetchFn - Function to call on each poll tick
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {Object} [options]
 * @param {boolean} [options.immediate=true] - Call fetchFn immediately on mount
 * @param {boolean} [options.pauseWhenHidden=true] - Pause polling when browser tab is hidden
 * @param {boolean} [options.autoStart=true] - Start polling automatically on mount
 * @returns {{ start: Function, stop: Function, isPolling: import('vue').Ref<boolean> }}
 */
export function usePolling(fetchFn, intervalMs, options = {}) {
  const {
    immediate = true,
    pauseWhenHidden = true,
    autoStart = true
  } = options

  const isPolling = ref(false)
  let timer = null

  function start() {
    if (timer) return
    isPolling.value = true
    timer = setInterval(fetchFn, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    isPolling.value = false
  }

  function handleVisibility() {
    if (document.hidden) {
      stop()
    } else {
      fetchFn()
      start()
    }
  }

  onMounted(() => {
    if (autoStart) {
      if (immediate) fetchFn()
      start()
    }
    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibility)
    }
  })

  onUnmounted(() => {
    stop()
    if (pauseWhenHidden) {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  })

  return { start, stop, isPolling }
}
