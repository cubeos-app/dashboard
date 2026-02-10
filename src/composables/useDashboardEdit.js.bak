/**
 * useDashboardEdit.js — DnD Bugfix
 *
 * Manages dashboard edit mode state: editing toggle, drag tracking,
 * drop handling, and layout persistence. Uses HTML5 Drag and Drop API.
 *
 * BUGFIX: Simplified handleDrop to row-reorder only (before/after).
 * Removed left/right position handling that grouped widgets side-by-side.
 * DnD now only moves entire rows up/down, per user requirement.
 *
 * Usage:
 *   const { isEditing, toggleEdit, startDrag, endDrag, handleDrop } = useDashboardEdit()
 */
import { ref, readonly } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'

// ─── Shared state (singleton across components) ──────────────
const isEditing = ref(false)
const dragWidgetId = ref(null)
const dragSourceRowIdx = ref(null)

export function useDashboardEdit() {
  const { gridLayout, updateGridLayout } = useDashboardConfig()

  /** Toggle edit mode on/off. Clears drag state on exit. */
  function toggleEdit() {
    isEditing.value = !isEditing.value
    if (!isEditing.value) {
      dragWidgetId.value = null
      dragSourceRowIdx.value = null
    }
  }

  /** Exit edit mode */
  function exitEdit() {
    isEditing.value = false
    dragWidgetId.value = null
    dragSourceRowIdx.value = null
  }

  /**
   * Called on dragstart. Records which widget is being dragged.
   * @param {string} widgetId — widget being dragged
   * @param {number} rowIdx — source row index in the UNFILTERED gridLayout
   */
  function startDrag(widgetId, rowIdx) {
    dragWidgetId.value = widgetId
    dragSourceRowIdx.value = rowIdx
  }

  /** Called on dragend. Clears drag state. */
  function endDrag() {
    dragWidgetId.value = null
    dragSourceRowIdx.value = null
  }

  /**
   * Handle a drop event. Moves the dragged widget's row to the target location.
   * Row-reorder only: moves entire rows up/down. No side-by-side pairing.
   *
   * @param {number} targetRowIdx — row index (in unfiltered gridLayout) to drop relative to
   * @param {'before'|'after'} position
   *   - 'before': insert widget as new row before targetRowIdx
   *   - 'after': insert widget as new row after targetRowIdx
   */
  function handleDrop(targetRowIdx, position) {
    const wid = dragWidgetId.value
    if (!wid) return

    // Deep-clone current layout
    const layout = gridLayout.value.map(entry => ({ row: [...entry.row] }))

    // 1. Find and remove widget from its source row
    let removedFromIdx = -1
    for (let i = layout.length - 1; i >= 0; i--) {
      const idx = layout[i].row.indexOf(wid)
      if (idx !== -1) {
        layout[i].row.splice(idx, 1)
        removedFromIdx = i
        // Remove row if now empty
        if (layout[i].row.length === 0) {
          layout.splice(i, 1)
          // Adjust targetRowIdx if the removed row was before/at it
          if (i < targetRowIdx) targetRowIdx--
          else if (i === targetRowIdx) {
            targetRowIdx = Math.min(targetRowIdx, layout.length)
          }
        }
        break
      }
    }

    // 2. Insert widget as a new single-widget row at the target position
    if (position === 'before') {
      const insertIdx = Math.max(0, Math.min(targetRowIdx, layout.length))
      layout.splice(insertIdx, 0, { row: [wid] })
    } else {
      // 'after'
      const insertIdx = Math.min(targetRowIdx + 1, layout.length)
      layout.splice(insertIdx, 0, { row: [wid] })
    }

    // 3. Persist the new layout
    updateGridLayout(layout)
    endDrag()
  }

  /**
   * Reorder entire rows (for Advanced mode).
   * Moves a row from srcIdx to destIdx.
   */
  function reorderRow(srcIdx, destIdx) {
    const layout = gridLayout.value.map(entry => ({ row: [...entry.row] }))
    if (srcIdx < 0 || srcIdx >= layout.length) return
    if (destIdx < 0 || destIdx >= layout.length) return
    const [moved] = layout.splice(srcIdx, 1)
    layout.splice(destIdx, 0, moved)
    updateGridLayout(layout)
  }

  return {
    isEditing: readonly(isEditing),
    dragWidgetId: readonly(dragWidgetId),
    dragSourceRowIdx: readonly(dragSourceRowIdx),
    toggleEdit,
    exitEdit,
    startDrag,
    endDrag,
    handleDrop,
    reorderRow,
  }
}
