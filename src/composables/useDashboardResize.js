/**
 * useDashboardResize.js — Session 2
 *
 * Manages widget resize state: dimensions per widget, resize tracking,
 * snap-to-grid logic, and persistence via dashboard config.
 *
 * Widget dimensions model:
 *   {
 *     width: 'half' | 'full',          // column span (50% or 100%)
 *     height: 'auto' | 'collapsed' | number  // content-fit, header-only, or px
 *   }
 *
 * Width resize:
 *   - Only meaningful for widgets in a 1-widget row (they're full-width by default).
 *   - Dragging right edge or double-clicking toggles half↔full.
 *   - In a 2-widget row, both are always half — width resize is disabled.
 *
 * Height resize:
 *   - 'auto': content determines height (default)
 *   - 'collapsed': shows only header bar (icon + label + expand button)
 *   - number: explicit pixel height, set by dragging bottom edge
 *
 * Collapsed state:
 *   - Double-click bottom edge toggles auto↔collapsed.
 *   - Useful for widgets you want on screen but not prominently displayed.
 *
 * Usage:
 *   const { getWidgetDimensions, updateWidgetWidth, toggleCollapse, ... } = useDashboardResize()
 */
import { computed } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'

/** Default dimensions for all widgets */
const DEFAULT_DIMENSIONS = { width: 'full', height: 'auto' }

export function useDashboardResize() {
  const { raw, defaults, updateConfig } = useDashboardConfig()

  // ─── Dimensions map from config ────────────────────────────

  /**
   * Raw widget_dimensions map from stored config.
   * Keys are widget IDs, values are { width, height } objects.
   */
  const widgetDimensions = computed(() => {
    return raw.value?.widget_dimensions ?? {}
  })

  /**
   * Get dimensions for a specific widget.
   * Returns { width: 'half'|'full', height: 'auto'|'collapsed'|number }
   */
  function getWidgetDimensions(widgetId) {
    const stored = widgetDimensions.value[widgetId]
    if (!stored) return { ...DEFAULT_DIMENSIONS }
    return {
      width: stored.width || DEFAULT_DIMENSIONS.width,
      height: stored.height ?? DEFAULT_DIMENSIONS.height,
    }
  }

  /**
   * Get just the width dimension for a widget.
   * @returns {'half'|'full'}
   */
  function getWidgetWidth(widgetId) {
    return getWidgetDimensions(widgetId).width
  }

  /**
   * Get just the height dimension for a widget.
   * @returns {'auto'|'collapsed'|number}
   */
  function getWidgetHeight(widgetId) {
    return getWidgetDimensions(widgetId).height
  }

  /**
   * Check if a widget is in collapsed state.
   */
  function isCollapsed(widgetId) {
    return getWidgetHeight(widgetId) === 'collapsed'
  }

  // ─── Persistence ───────────────────────────────────────────

  /**
   * Persist dimensions for a single widget.
   * Merges into the existing widget_dimensions map.
   */
  async function updateWidgetDimensions(widgetId, dims) {
    const current = { ...widgetDimensions.value }
    current[widgetId] = {
      ...(current[widgetId] || {}),
      ...dims,
    }
    return updateConfig('widget_dimensions', current)
  }

  /**
   * Set width for a widget ('half' or 'full').
   */
  async function updateWidgetWidth(widgetId, width) {
    return updateWidgetDimensions(widgetId, { width })
  }

  /**
   * Set height for a widget ('auto', 'collapsed', or a pixel number).
   */
  async function updateWidgetHeight(widgetId, height) {
    return updateWidgetDimensions(widgetId, { height })
  }

  /**
   * Toggle width between 'half' and 'full'.
   */
  async function toggleWidth(widgetId) {
    const current = getWidgetWidth(widgetId)
    return updateWidgetWidth(widgetId, current === 'full' ? 'half' : 'full')
  }

  /**
   * Toggle between 'auto' and 'collapsed'.
   * If height is a pixel value, it goes to 'collapsed'.
   */
  async function toggleCollapse(widgetId) {
    const current = getWidgetHeight(widgetId)
    const newHeight = current === 'collapsed' ? 'auto' : 'collapsed'
    return updateWidgetHeight(widgetId, newHeight)
  }

  /**
   * Reset dimensions for a widget back to defaults.
   */
  async function resetWidgetDimensions(widgetId) {
    const current = { ...widgetDimensions.value }
    delete current[widgetId]
    return updateConfig('widget_dimensions', current)
  }

  /**
   * Reset all widget dimensions.
   */
  async function resetAllDimensions() {
    return updateConfig('widget_dimensions', {})
  }

  return {
    widgetDimensions,
    getWidgetDimensions,
    getWidgetWidth,
    getWidgetHeight,
    isCollapsed,
    updateWidgetDimensions,
    updateWidgetWidth,
    updateWidgetHeight,
    toggleWidth,
    toggleCollapse,
    resetWidgetDimensions,
    resetAllDimensions,
  }
}
