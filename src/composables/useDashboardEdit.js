/**
 * useDashboardEdit.js — Session C: Drag-and-Drop Edit Mode
 *
 * Manages dashboard edit mode state: editing toggle, drag tracking,
 * drop handling, and layout persistence. Uses HTML5 Drag and Drop API.
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
   * @param {number} rowIdx — source row index
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
   * Handle a drop event. Moves the dragged widget to the target location.
   *
   * @param {number} targetRowIdx — row index to drop into
   * @param {'left'|'right'|'before'|'after'} position
   *   - 'left'/'right': merge into existing row at that position
   *   - 'before': insert as new row before targetRowIdx
   *   - 'after': insert as new row after targetRowIdx
   */
  function handleDrop(targetRowIdx, position) {
    const wid = dragWidgetId.value
    if (!wid) return

    // Deep-clone current layout
    const layout = gridLayout.value.map(entry => ({ row: [...entry.row] }))

    // 1. Remove widget from its source row
    for (let i = layout.length - 1; i >= 0; i--) {
      const idx = layout[i].row.indexOf(wid)
      if (idx !== -1) {
        layout[i].row.splice(idx, 1)
        // Remove empty rows
        if (layout[i].row.length === 0) {
          layout.splice(i, 1)
          // Adjust target if it was after the removed row
          if (i < targetRowIdx) targetRowIdx--
          else if (i === targetRowIdx) {
            // Dropped on own now-empty row — recalculate
            targetRowIdx = Math.min(targetRowIdx, layout.length - 1)
          }
        }
        break
      }
    }

    // 2. Insert widget at target
    if (position === 'before') {
      const insertIdx = Math.max(0, Math.min(targetRowIdx, layout.length))
      layout.splice(insertIdx, 0, { row: [wid] })
    } else if (position === 'after') {
      const insertIdx = Math.min(targetRowIdx + 1, layout.length)
      layout.splice(insertIdx, 0, { row: [wid] })
    } else if (position === 'left' || position === 'right') {
      // Merge into existing row (max 2 widgets per row)
      const safeIdx = Math.max(0, Math.min(targetRowIdx, layout.length - 1))
      if (safeIdx < layout.length) {
        const targetRow = layout[safeIdx].row
        if (targetRow.length < 2) {
          if (position === 'left') {
            targetRow.unshift(wid)
          } else {
            targetRow.push(wid)
          }
        } else {
          // Row is full — insert as new row after
          layout.splice(safeIdx + 1, 0, { row: [wid] })
        }
      } else {
        layout.push({ row: [wid] })
      }
    }

    // 3. Persist
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
