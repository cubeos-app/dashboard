/**
 * useDashboardEdit.js — Session 6
 *
 * Manages dashboard edit mode state: editing toggle, drag tracking,
 * drop handling, layout persistence, and undo/redo history.
 *
 * SESSION 1: Restored left/right position handling in handleDrop().
 * SESSION 6: Added undo/redo stack. Before each layout mutation, the
 *            current state is pushed to the undo stack. Max 20 entries.
 *            Stacks are cleared on exit edit mode.
 *
 * Usage:
 *   const { isEditing, toggleEdit, handleDrop, undo, redo, undoCount, redoCount } = useDashboardEdit()
 */
import { ref, readonly, computed } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'

// ─── Shared state (singleton across components) ──────────────
const isEditing = ref(false)
const dragWidgetId = ref(null)
const dragSourceRowIdx = ref(null)

// ─── Undo/Redo stacks (Session 6) ────────────────────────────
const MAX_HISTORY = 20
const undoStack = ref([])   // Array of { gridLayout, advancedSectionOrder }
const redoStack = ref([])

export function useDashboardEdit() {
  const config = useDashboardConfig()
  const { gridLayout, updateGridLayout, advancedSectionOrder, updateAdvancedSectionOrder } = config

  // ─── Snapshot helpers ───────────────────────────────────────

  /** Capture the current layout state as a snapshot */
  function captureSnapshot() {
    return {
      gridLayout: gridLayout.value.map(entry => ({ row: [...entry.row] })),
      advancedSectionOrder: advancedSectionOrder.value ? [...advancedSectionOrder.value] : null,
    }
  }

  /** Push current state to undo stack. Clears redo stack (new branch). */
  function pushUndo() {
    const snapshot = captureSnapshot()
    undoStack.value.push(snapshot)
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift() // Remove oldest entry
    }
    redoStack.value = [] // New mutation clears redo
  }

  /** Restore a snapshot to the layout */
  async function restoreSnapshot(snapshot) {
    if (snapshot.gridLayout) {
      await updateGridLayout(snapshot.gridLayout)
    }
    if (snapshot.advancedSectionOrder) {
      await updateAdvancedSectionOrder(snapshot.advancedSectionOrder)
    }
  }

  // ─── Public undo/redo ───────────────────────────────────────

  /** Undo the last layout change */
  async function undo() {
    if (undoStack.value.length === 0) return

    // Save current state to redo stack before undoing
    const currentSnapshot = captureSnapshot()
    redoStack.value.push(currentSnapshot)

    // Pop the last undo state and restore it
    const previousSnapshot = undoStack.value.pop()
    await restoreSnapshot(previousSnapshot)
  }

  /** Redo the last undone layout change */
  async function redo() {
    if (redoStack.value.length === 0) return

    // Save current state to undo stack before redoing
    const currentSnapshot = captureSnapshot()
    undoStack.value.push(currentSnapshot)

    // Pop the last redo state and restore it
    const redoneSnapshot = redoStack.value.pop()
    await restoreSnapshot(redoneSnapshot)
  }

  const undoCount = computed(() => undoStack.value.length)
  const redoCount = computed(() => redoStack.value.length)
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  // ─── Edit mode toggle ──────────────────────────────────────

  /** Toggle edit mode on/off. Clears drag state and undo/redo stacks on exit. */
  function toggleEdit() {
    isEditing.value = !isEditing.value
    if (!isEditing.value) {
      dragWidgetId.value = null
      dragSourceRowIdx.value = null
      // Clear stacks on exit — changes are already persisted
      undoStack.value = []
      redoStack.value = []
    }
  }

  /** Exit edit mode */
  function exitEdit() {
    isEditing.value = false
    dragWidgetId.value = null
    dragSourceRowIdx.value = null
    undoStack.value = []
    redoStack.value = []
  }

  // ─── Drag helpers ──────────────────────────────────────────

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
   * Handle a drop event. Moves the dragged widget to the target location.
   *
   * SESSION 1: Supports four positions:
   *   - 'before': insert widget as new row before targetRowIdx
   *   - 'after': insert widget as new row after targetRowIdx
   *   - 'left': insert widget to the LEFT of existing widget in targetRowIdx
   *   - 'right': insert widget to the RIGHT of existing widget in targetRowIdx
   *
   * SESSION 6: Pushes current state to undo stack before mutating.
   */
  function handleDrop(targetRowIdx, position) {
    const wid = dragWidgetId.value
    if (!wid) return

    // Deep-clone current layout
    const layout = gridLayout.value.map(entry => ({ row: [...entry.row] }))

    // For left/right: check that the target row can accept another widget
    if (position === 'left' || position === 'right') {
      const targetRow = layout[targetRowIdx]
      if (!targetRow || targetRow.row.length >= 2) {
        endDrag()
        return
      }
      // Don't drop onto self (widget already in this row)
      if (targetRow.row.includes(wid)) {
        endDrag()
        return
      }
    }

    // Push current state to undo stack BEFORE mutating
    pushUndo()

    // 1. Find and remove widget from its source row
    for (let i = layout.length - 1; i >= 0; i--) {
      const idx = layout[i].row.indexOf(wid)
      if (idx !== -1) {
        layout[i].row.splice(idx, 1)
        // Remove row if now empty
        if (layout[i].row.length === 0) {
          layout.splice(i, 1)
          // Adjust targetRowIdx if the removed row was before it
          if (i < targetRowIdx) targetRowIdx--
          else if (i === targetRowIdx) {
            // Target row was removed — fall back to safe insert
            targetRowIdx = Math.min(targetRowIdx, layout.length)
          }
        }
        break
      }
    }

    // 2. Insert widget at the target position
    if (position === 'left') {
      const targetRow = layout[targetRowIdx]
      if (targetRow && targetRow.row.length < 2) {
        targetRow.row.unshift(wid)
      } else {
        layout.splice(targetRowIdx, 0, { row: [wid] })
      }
    } else if (position === 'right') {
      const targetRow = layout[targetRowIdx]
      if (targetRow && targetRow.row.length < 2) {
        targetRow.row.push(wid)
      } else {
        const insertIdx = Math.min(targetRowIdx + 1, layout.length)
        layout.splice(insertIdx, 0, { row: [wid] })
      }
    } else if (position === 'before') {
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
   * SESSION 6: Pushes to undo stack before mutating.
   */
  function reorderRow(srcIdx, destIdx) {
    const layout = gridLayout.value.map(entry => ({ row: [...entry.row] }))
    if (srcIdx < 0 || srcIdx >= layout.length) return
    if (destIdx < 0 || destIdx >= layout.length) return

    pushUndo()

    const [moved] = layout.splice(srcIdx, 1)
    layout.splice(destIdx, 0, moved)
    updateGridLayout(layout)
  }

  /**
   * Push undo state externally — for use by settings modal operations
   * (split, merge, remove, add) that mutate layout outside of handleDrop.
   */
  function pushUndoExternal() {
    if (isEditing.value) {
      pushUndo()
    }
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

    // Undo/redo (Session 6)
    undo,
    redo,
    undoCount,
    redoCount,
    canUndo,
    canRedo,
    pushUndoExternal,
  }
}
