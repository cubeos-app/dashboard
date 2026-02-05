import { onUnmounted } from 'vue'

/**
 * Composable that provides an AbortController signal for fetch cancellation.
 * Automatically aborts all in-flight requests when the component unmounts.
 *
 * Usage:
 *   const { signal, abort, newSignal } = useAbortOnUnmount()
 *   await api.get('/endpoint', {}, { signal: signal() })
 *
 *   // Or for multiple sequential fetches:
 *   const s = newSignal()
 *   await Promise.all([
 *     api.get('/a', {}, { signal: s }),
 *     api.get('/b', {}, { signal: s })
 *   ])
 */
export function useAbortOnUnmount() {
  let controller = new AbortController()
  const controllers = new Set()

  controllers.add(controller)

  /**
   * Get the current AbortSignal. Use this for individual requests.
   */
  function signal() {
    // If current controller is already aborted, create a fresh one
    if (controller.signal.aborted) {
      controller = new AbortController()
      controllers.add(controller)
    }
    return controller.signal
  }

  /**
   * Create a new AbortSignal (useful for grouping requests).
   * The previous controller remains tracked for cleanup.
   */
  function newSignal() {
    controller = new AbortController()
    controllers.add(controller)
    return controller.signal
  }

  /**
   * Manually abort all in-flight requests.
   * Useful when navigating or refreshing data.
   */
  function abort() {
    for (const c of controllers) {
      c.abort()
    }
    controllers.clear()
    controller = new AbortController()
    controllers.add(controller)
  }

  onUnmounted(() => {
    for (const c of controllers) {
      c.abort()
    }
    controllers.clear()
  })

  return { signal, newSignal, abort }
}
