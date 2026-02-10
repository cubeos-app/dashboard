/**
 * useTouchDrag.js — Session 4
 *
 * Touch-based drag and drop system for mobile devices.
 * Works alongside HTML5 DnD (which handles desktop) without conflict.
 *
 * Behavior:
 *   - Long-press (300ms) on a draggable element in edit mode initiates drag.
 *   - Short taps still work normally (no drag interference).
 *   - Ghost element (50% opacity clone) follows finger.
 *   - Source element dims to 30% opacity during drag.
 *   - Drop zones calculated dynamically via getBoundingClientRect().
 *   - Auto-scroll when finger is within 60px of viewport edges.
 *   - Haptic feedback via navigator.vibrate() on drag start + successful drop.
 *   - On touchend over a valid drop zone, fires the provided drop callback.
 *   - Cancel: lift finger outside any drop zone → widget returns to original position.
 *
 * Performance:
 *   - Ghost positioning throttled to requestAnimationFrame (60fps cap).
 *   - Drop zone hit-testing uses cached bounding rects, recalculated on scroll.
 *
 * Usage (in WidgetWrapper.vue):
 *   const { onTouchStart, onTouchMove, onTouchEnd, isDraggingTouch } = useTouchDrag()
 *
 * Usage (in DashboardStandard.vue / DashboardAdvanced.vue):
 *   const { registerDropZone, unregisterDropZone, clearDropZones } = useTouchDrag()
 */
import { ref, readonly } from 'vue'

// ─── Shared state (singleton across components) ──────────────
const isDraggingTouch = ref(false)
const touchDragWidgetId = ref(null)
const touchDragSourceRowIdx = ref(null)
const activeDropTarget = ref(null)

// Registered drop zones: { id, element, position, layoutIdx, type }
// type: 'row' (before/after) | 'side' (left/right) | 'section' (advanced)
let registeredDropZones = []

// Internal state (not reactive — performance sensitive)
let longPressTimer = null
let ghostEl = null
let sourceEl = null
let dragStartX = 0
let dragStartY = 0
let hasMoved = false
let rafId = null
let scrollRafId = null
let cachedZoneRects = []
let lastScrollY = window.scrollY

// ─── Constants ───────────────────────────────────────────────
const LONG_PRESS_MS = 300
const MOVE_THRESHOLD = 8 // px — must move at least this far to confirm drag intent
const SCROLL_EDGE_PX = 60
const SCROLL_SPEED = 8 // px per frame
const GHOST_OPACITY = 0.5

export function useTouchDrag() {

  // ─── Drop zone registration ──────────────────────────────

  /**
   * Register a DOM element as a drop zone.
   * @param {string} id — unique ID for this zone
   * @param {HTMLElement} element — the DOM element
   * @param {string} position — 'before' | 'after' | 'left' | 'right' | 'section'
   * @param {number|string} layoutIdx — row index or section ID
   * @param {string} type — 'row' | 'side' | 'section'
   */
  function registerDropZone(id, element, position, layoutIdx, type = 'row') {
    // Avoid duplicates
    const existing = registeredDropZones.findIndex(z => z.id === id)
    if (existing !== -1) {
      registeredDropZones[existing] = { id, element, position, layoutIdx, type }
    } else {
      registeredDropZones.push({ id, element, position, layoutIdx, type })
    }
  }

  /**
   * Unregister a drop zone by ID.
   */
  function unregisterDropZone(id) {
    registeredDropZones = registeredDropZones.filter(z => z.id !== id)
  }

  /**
   * Clear all registered drop zones (call on unmount).
   */
  function clearDropZones() {
    registeredDropZones = []
    cachedZoneRects = []
  }

  // ─── Rect caching for hit-testing ────────────────────────

  function refreshZoneRects() {
    cachedZoneRects = registeredDropZones
      .filter(z => z.element && z.element.isConnected)
      .map(z => {
        const rect = z.element.getBoundingClientRect()
        return {
          ...z,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        }
      })
    lastScrollY = window.scrollY
  }

  /**
   * Find the nearest drop zone to a point.
   * Returns the zone object or null if none within reasonable range.
   */
  function hitTestDropZones(clientX, clientY) {
    // Refresh rects if scroll has changed (avoids stale positions)
    if (Math.abs(window.scrollY - lastScrollY) > 5) {
      refreshZoneRects()
    }

    let closest = null
    let closestDist = Infinity

    for (const zone of cachedZoneRects) {
      // Check if point is within the zone's bounding box (with some padding)
      const padX = zone.type === 'side' ? 20 : 0
      const padY = zone.type === 'row' ? 20 : 10

      const inX = clientX >= zone.left - padX && clientX <= zone.right + padX
      const inY = clientY >= zone.top - padY && clientY <= zone.bottom + padY

      if (inX && inY) {
        // Distance from center of zone
        const dx = clientX - zone.centerX
        const dy = clientY - zone.centerY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < closestDist) {
          closestDist = dist
          closest = zone
        }
      }
    }

    return closest
  }

  // ─── Ghost element management ────────────────────────────

  function createGhost(sourceElement) {
    const rect = sourceElement.getBoundingClientRect()

    ghostEl = sourceElement.cloneNode(true)

    // Style the ghost
    Object.assign(ghostEl.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      opacity: String(GHOST_OPACITY),
      pointerEvents: 'none',
      zIndex: '9999',
      transform: 'scale(0.95)',
      transition: 'transform 0.15s ease, opacity 0.15s ease',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    })

    // Remove any editing affordances from the ghost
    ghostEl.querySelectorAll('.resize-handle-right, .resize-handle-bottom, [class*="drop-zone"]').forEach(el => el.remove())

    document.body.appendChild(ghostEl)

    // Animate in
    requestAnimationFrame(() => {
      if (ghostEl) {
        ghostEl.style.transform = 'scale(0.92)'
      }
    })
  }

  function moveGhost(clientX, clientY) {
    if (!ghostEl) return

    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      if (!ghostEl) return

      const ghostWidth = ghostEl.offsetWidth
      const ghostHeight = ghostEl.offsetHeight

      // Center ghost on finger position
      const x = clientX - ghostWidth / 2
      const y = clientY - ghostHeight / 2

      ghostEl.style.left = `${x}px`
      ghostEl.style.top = `${y}px`
    })
  }

  function destroyGhost() {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (ghostEl && ghostEl.parentNode) {
      ghostEl.parentNode.removeChild(ghostEl)
    }
    ghostEl = null
  }

  // ─── Auto-scroll near viewport edges ─────────────────────

  function startAutoScroll(clientY) {
    stopAutoScroll()

    function scrollStep() {
      const vh = window.innerHeight

      if (clientY < SCROLL_EDGE_PX) {
        // Near top edge — scroll up
        const intensity = 1 - (clientY / SCROLL_EDGE_PX)
        window.scrollBy(0, -SCROLL_SPEED * intensity)
      } else if (clientY > vh - SCROLL_EDGE_PX) {
        // Near bottom edge — scroll down
        const intensity = 1 - ((vh - clientY) / SCROLL_EDGE_PX)
        window.scrollBy(0, SCROLL_SPEED * intensity)
      }

      scrollRafId = requestAnimationFrame(scrollStep)
    }

    scrollRafId = requestAnimationFrame(scrollStep)
  }

  function stopAutoScroll() {
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
  }

  // ─── Drop zone visual highlights ─────────────────────────

  function highlightDropZone(zone) {
    if (!zone) return
    activeDropTarget.value = zone.id

    if (zone.element) {
      zone.element.classList.add('touch-drop-active')
    }
  }

  function clearHighlights() {
    activeDropTarget.value = null
    // Remove highlight class from all registered zones
    for (const zone of registeredDropZones) {
      if (zone.element) {
        zone.element.classList.remove('touch-drop-active')
      }
    }
  }

  // ─── Haptic feedback ─────────────────────────────────────

  function vibrate(ms = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(ms)
    }
  }

  // ─── Core touch handlers ─────────────────────────────────

  /**
   * Handle touchstart on a draggable element.
   * Starts a long-press timer. If the user lifts before 300ms,
   * nothing happens (allows normal tap interactions).
   *
   * @param {TouchEvent} e
   * @param {string} widgetId — ID of the widget being touched
   * @param {number} rowIdx — source row index
   * @param {HTMLElement} wrapperEl — the draggable wrapper element
   */
  function onTouchStart(e, widgetId, rowIdx, wrapperEl) {
    // Only handle single-finger touches
    if (e.touches.length !== 1) return

    const touch = e.touches[0]
    dragStartX = touch.clientX
    dragStartY = touch.clientY
    hasMoved = false

    // Start long-press timer
    longPressTimer = setTimeout(() => {
      longPressTimer = null

      // Initiate drag
      isDraggingTouch.value = true
      touchDragWidgetId.value = widgetId
      touchDragSourceRowIdx.value = rowIdx
      sourceEl = wrapperEl

      // Dim the source element
      if (sourceEl) {
        sourceEl.style.opacity = '0.3'
        sourceEl.style.transform = 'scale(0.95)'
        sourceEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
      }

      // Create ghost
      createGhost(wrapperEl)

      // Haptic feedback
      vibrate(50)

      // Cache drop zone positions
      refreshZoneRects()

      // Prevent page scroll during drag
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'

    }, LONG_PRESS_MS)
  }

  /**
   * Handle touchmove.
   * If drag is active, moves ghost and tests drop zones.
   * If drag hasn't started yet (within long-press window),
   * cancel if finger moves too far (user is scrolling, not long-pressing).
   */
  function onTouchMove(e) {
    const touch = e.touches[0]

    if (!isDraggingTouch.value) {
      // Long-press hasn't fired yet — check if user is scrolling
      const dx = touch.clientX - dragStartX
      const dy = touch.clientY - dragStartY
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        // User is scrolling — cancel long-press
        cancelLongPress()
      }
      return
    }

    // Drag is active — prevent scrolling
    e.preventDefault()
    hasMoved = true

    // Move ghost to finger position
    moveGhost(touch.clientX, touch.clientY)

    // Auto-scroll near edges
    startAutoScroll(touch.clientY)

    // Hit-test drop zones
    clearHighlights()
    const zone = hitTestDropZones(touch.clientX, touch.clientY)
    if (zone) {
      highlightDropZone(zone)
    }
  }

  /**
   * Handle touchend.
   * If drag is active and finger is over a valid drop zone, execute the drop.
   * Otherwise, cancel and restore.
   *
   * @param {TouchEvent} e
   * @param {Function} dropCallback — function(targetIdx, position) to execute the drop
   * @param {Function} [sectionDropCallback] — function(srcId, targetId) for advanced section drops
   */
  function onTouchEnd(e, dropCallback, sectionDropCallback) {
    cancelLongPress()
    stopAutoScroll()

    if (!isDraggingTouch.value) return

    // Get last touch position (from changedTouches since finger is lifted)
    const touch = e.changedTouches[0]

    // Find which drop zone the finger ended on
    const zone = hitTestDropZones(touch.clientX, touch.clientY)

    if (zone && hasMoved) {
      // Valid drop — execute callback
      vibrate(30) // Short haptic for success

      if (zone.type === 'section' && sectionDropCallback) {
        // Advanced mode section reorder
        sectionDropCallback(touchDragWidgetId.value, zone.layoutIdx)
      } else if (dropCallback) {
        // Standard mode row-based drop
        dropCallback(zone.layoutIdx, zone.position)
      }
    }
    // else: no valid drop zone — widget returns to original position

    // Clean up
    cleanup()
  }

  /**
   * Handle touchcancel (e.g., incoming call, multi-finger gesture).
   */
  function onTouchCancel() {
    cancelLongPress()
    stopAutoScroll()
    cleanup()
  }

  // ─── Cleanup helpers ─────────────────────────────────────

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function cleanup() {
    // Restore source element
    if (sourceEl) {
      sourceEl.style.opacity = ''
      sourceEl.style.transform = ''
      sourceEl.style.transition = ''
      sourceEl = null
    }

    // Remove ghost
    destroyGhost()

    // Clear highlights
    clearHighlights()

    // Restore page scroll
    document.body.style.overflow = ''
    document.body.style.touchAction = ''

    // Reset state
    isDraggingTouch.value = false
    touchDragWidgetId.value = null
    touchDragSourceRowIdx.value = null
    activeDropTarget.value = null
    hasMoved = false
  }

  return {
    // Reactive state
    isDraggingTouch: readonly(isDraggingTouch),
    touchDragWidgetId: readonly(touchDragWidgetId),
    activeDropTarget: readonly(activeDropTarget),

    // Touch event handlers (for WidgetWrapper / section wrappers)
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,

    // Drop zone management (for DashboardStandard / DashboardAdvanced)
    registerDropZone,
    unregisterDropZone,
    clearDropZones,
    refreshZoneRects,

    // Utility
    cleanup,
  }
}
