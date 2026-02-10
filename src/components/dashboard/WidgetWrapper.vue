<script setup>
/**
 * WidgetWrapper.vue — Session 2
 *
 * Thin wrapper that controls per-widget:
 *   - Card background opacity (Session B)
 *   - Drag-and-drop in edit mode (Session C / Session 1)
 *   - Resize handles for width and height (Session 2)
 *   - Error boundary isolation (Session 2)
 *
 * Resize behavior (edit mode only):
 *   - Right edge: col-resize cursor. Double-click to toggle half↔full width.
 *   - Bottom edge: row-resize cursor. Drag to set explicit pixel height.
 *     Double-click to toggle auto↔collapsed.
 *   - Collapsed state: shows only header (icon + label + expand button).
 *
 * Props:
 *   widget-id    — widget ID for opacity, dimensions, drag, and error context
 *   editing      — whether edit mode is active
 *   row-idx      — the row index this widget lives in (for drag source tracking)
 *   in-pair      — whether this widget shares a row with another (disables width resize)
 */
import { computed, ref } from 'vue'
import { useDashboardConfig, WIDGET_REGISTRY } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import { useDashboardResize } from '@/composables/useDashboardResize'
import WidgetErrorBoundary from './WidgetErrorBoundary.vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  widgetId: { type: String, required: true },
  editing: { type: Boolean, default: false },
  rowIdx: { type: Number, default: 0 },
  inPair: { type: Boolean, default: false },
})

const { getOpacity } = useDashboardConfig()
const { startDrag, endDrag, dragWidgetId } = useDashboardEdit()
const {
  getWidgetHeight,
  isCollapsed,
  toggleWidth,
  toggleCollapse,
  updateWidgetHeight,
} = useDashboardResize()

const isDragging = ref(false)
const isResizingHeight = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

/** Normalized opacity: 0–100 config → 0–1 CSS */
const normalizedOpacity = computed(() => getOpacity(props.widgetId) / 100)

const wrapperStyle = computed(() => {
  const style = {
    '--widget-bg-opacity': normalizedOpacity.value,
  }

  // Apply explicit height if set to a pixel value
  const h = getWidgetHeight(props.widgetId)
  if (typeof h === 'number' && h > 0) {
    style.height = `${h}px`
    style.overflow = 'hidden'
  }

  return style
})

/** Widget metadata */
const widgetMeta = computed(() => WIDGET_REGISTRY[props.widgetId] || { label: props.widgetId, icon: 'Box' })
const widgetLabel = computed(() => widgetMeta.value.label)
const widgetIcon = computed(() => widgetMeta.value.icon)

/** Whether this specific widget is being dragged */
const isBeingDragged = computed(() => dragWidgetId.value === props.widgetId)

/** Whether the widget is currently collapsed */
const widgetCollapsed = computed(() => isCollapsed(props.widgetId))

/** Whether width resize is available (not in a pair) */
const canResizeWidth = computed(() => !props.inPair)

// ─── Drag handlers ──────────────────────────────────────────

function onDragStart(e) {
  isDragging.value = true
  startDrag(props.widgetId, props.rowIdx)
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', props.widgetId)
}

function onDragEnd() {
  isDragging.value = false
  endDrag()
}

// ─── Width resize (right edge) ──────────────────────────────

function onRightEdgeDblClick() {
  if (!props.editing) return
  toggleWidth(props.widgetId)
}

// ─── Height resize (bottom edge) ────────────────────────────

function onBottomEdgeMouseDown(e) {
  if (!props.editing) return
  e.preventDefault()
  e.stopPropagation()

  isResizingHeight.value = true
  resizeStartY.value = e.clientY

  // Get current rendered height
  const el = e.target.closest('.widget-wrap')
  resizeStartHeight.value = el ? el.offsetHeight : 200

  window.addEventListener('mousemove', onResizeMouseMove)
  window.addEventListener('mouseup', onResizeMouseUp)
}

function onResizeMouseMove(e) {
  if (!isResizingHeight.value) return
  const delta = e.clientY - resizeStartY.value
  const newHeight = Math.max(60, resizeStartHeight.value + delta)

  // Snap to nearest 20px grid
  const snapped = Math.round(newHeight / 20) * 20
  updateWidgetHeight(props.widgetId, snapped)
}

function onResizeMouseUp() {
  isResizingHeight.value = false
  window.removeEventListener('mousemove', onResizeMouseMove)
  window.removeEventListener('mouseup', onResizeMouseUp)
}

function onBottomEdgeDblClick() {
  if (!props.editing) return
  toggleCollapse(props.widgetId)
}

// ─── Collapsed expand button ────────────────────────────────

function expandWidget() {
  toggleCollapse(props.widgetId)
}
</script>

<template>
  <div
    class="widget-wrap h-full relative"
    :class="{
      'ring-2 ring-dashed ring-accent/30 rounded-2xl cursor-grab active:cursor-grabbing': editing && !isDragging && !isResizingHeight,
      'opacity-30 scale-95': isDragging,
    }"
    :style="wrapperStyle"
    :draggable="editing && !isResizingHeight"
    @dragstart="editing ? onDragStart($event) : null"
    @dragend="editing ? onDragEnd() : null"
  >
    <!-- Drag handle badge (visible only in edit mode) -->
    <div
      v-if="editing"
      class="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1
             rounded-full bg-theme-secondary border border-theme-primary shadow-lg cursor-grab
             active:cursor-grabbing select-none transition-opacity"
      :class="isDragging ? 'opacity-0' : 'opacity-100'"
    >
      <Icon name="GripHorizontal" :size="12" class="text-theme-muted" />
      <span class="text-[10px] font-medium text-theme-secondary whitespace-nowrap">{{ widgetLabel }}</span>
    </div>

    <!-- Right edge resize handle (width toggle, edit mode only, not in pairs) -->
    <div
      v-if="editing && canResizeWidth && !widgetCollapsed"
      class="resize-handle-right"
      @dblclick.stop="onRightEdgeDblClick"
      @mousedown.stop
    >
      <div class="resize-handle-indicator-v">
        <Icon name="GripVertical" :size="10" />
      </div>
    </div>

    <!-- Bottom edge resize handle (height, edit mode only) -->
    <div
      v-if="editing && !widgetCollapsed"
      class="resize-handle-bottom"
      @mousedown.stop="onBottomEdgeMouseDown"
      @dblclick.stop="onBottomEdgeDblClick"
    >
      <div class="resize-handle-indicator-h">
        <Icon name="GripHorizontal" :size="10" />
      </div>
    </div>

    <!-- Collapsed state: header-only bar -->
    <div
      v-if="widgetCollapsed"
      class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-theme-card border border-theme-primary"
    >
      <Icon :name="widgetIcon" :size="14" class="text-theme-muted flex-shrink-0" />
      <span class="text-xs font-medium text-theme-secondary flex-1 truncate">{{ widgetLabel }}</span>
      <button
        v-if="!editing"
        class="w-6 h-6 rounded-lg flex items-center justify-center text-theme-muted
               hover:text-theme-primary hover:bg-theme-tertiary transition-colors flex-shrink-0"
        title="Expand widget"
        @click="expandWidget"
      >
        <Icon name="ChevronDown" :size="14" />
      </button>
      <button
        v-else
        class="w-6 h-6 rounded-lg flex items-center justify-center text-theme-muted
               hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
        title="Expand widget"
        @click.stop="expandWidget"
      >
        <Icon name="Maximize2" :size="12" />
      </button>
    </div>

    <!-- Normal content (wrapped in error boundary) -->
    <WidgetErrorBoundary
      v-if="!widgetCollapsed"
      :widget-id="widgetId"
      :label="widgetLabel"
      :icon="widgetIcon"
    >
      <div :class="editing ? 'pointer-events-none' : ''">
        <slot />
      </div>
    </WidgetErrorBoundary>
  </div>
</template>

<style scoped>
/*
 * Solid card mode: override bg-theme-card and border-theme-primary
 * within the wrapped widget to respect --widget-bg-opacity.
 */
.widget-wrap :deep(.bg-theme-card) {
  background-color: color-mix(
    in srgb,
    var(--bg-card) calc(var(--widget-bg-opacity, 1) * 100%),
    transparent
  );
}
.widget-wrap :deep(.border-theme-primary) {
  border-color: color-mix(
    in srgb,
    var(--border-primary) calc(var(--widget-bg-opacity, 1) * 100%),
    transparent
  );
}

/* Smooth transitions for drag/resize state */
.widget-wrap {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* ─── Right edge resize handle (width) ───────────────────────── */

.resize-handle-right {
  position: absolute;
  top: 0;
  right: -4px;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.widget-wrap:hover .resize-handle-right,
.resize-handle-right:hover {
  opacity: 1;
}

.resize-handle-indicator-v {
  width: 12px;
  height: 28px;
  border-radius: 4px;
  background: var(--bg-secondary, rgba(255,255,255,0.1));
  border: 1px solid var(--border-primary, rgba(255,255,255,0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, rgba(255,255,255,0.4));
  pointer-events: none;
}

.resize-handle-right:hover .resize-handle-indicator-v {
  background: var(--accent, #6366f1);
  border-color: var(--accent, #6366f1);
  color: white;
}

/* ─── Bottom edge resize handle (height) ─────────────────────── */

.resize-handle-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -4px;
  height: 8px;
  cursor: row-resize;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.widget-wrap:hover .resize-handle-bottom,
.resize-handle-bottom:hover {
  opacity: 1;
}

.resize-handle-indicator-h {
  width: 28px;
  height: 12px;
  border-radius: 4px;
  background: var(--bg-secondary, rgba(255,255,255,0.1));
  border: 1px solid var(--border-primary, rgba(255,255,255,0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, rgba(255,255,255,0.4));
  pointer-events: none;
}

.resize-handle-bottom:hover .resize-handle-indicator-h {
  background: var(--accent, #6366f1);
  border-color: var(--accent, #6366f1);
  color: white;
}
</style>
