<script setup>
/**
 * WidgetWrapper.vue — Session 5
 *
 * Thin wrapper that controls per-widget:
 *   - Card background opacity (Session B)
 *   - Drag-and-drop in edit mode (Session C / Session 1)
 *   - Resize handles for width and height (Session 2)
 *   - Error boundary isolation (Session 2)
 *   - Touch-based DnD for mobile (Session 4)
 *   - Per-widget auto-refresh with WS bypass (Session 5)
 *
 * Auto-Refresh (Session 5):
 *   - Each widget has a configurable refresh interval (from useDashboardConfig).
 *   - When the interval fires, emits 'refresh' so the child widget can re-fetch data.
 *   - If the widget is covered by WebSocket (e.g., vitals, disk, network),
 *     polling is automatically suppressed while WS is connected.
 *   - Static widgets (clock, search, actions, launcher) never poll.
 *   - Interval restarts immediately when the configured value changes.
 *   - Polling pauses when the tab is hidden (visibilitychange).
 *
 * Props:
 *   widget-id    — widget ID for opacity, dimensions, drag, and error context
 *   editing      — whether edit mode is active
 *   row-idx      — the row index this widget lives in (for drag source tracking)
 *   in-pair      — whether this widget shares a row with another (disables width resize)
 */
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useDashboardConfig, WIDGET_REGISTRY } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import { useDashboardResize } from '@/composables/useDashboardResize'
import { useTouchDrag } from '@/composables/useTouchDrag'
import { useWidgetWebSocket } from '@/composables/useWidgetWebSocket'
import WidgetErrorBoundary from './WidgetErrorBoundary.vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  widgetId: { type: String, required: true },
  editing: { type: Boolean, default: false },
  rowIdx: { type: Number, default: 0 },
  inPair: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh'])

const { getOpacity, getRefreshInterval } = useDashboardConfig()
const { startDrag, endDrag, handleDrop, dragWidgetId } = useDashboardEdit()
const {
  getWidgetHeight,
  isCollapsed,
  toggleWidth,
  toggleCollapse,
  updateWidgetHeight,
} = useDashboardResize()
const {
  isDraggingTouch,
  touchDragWidgetId,
  onTouchStart: touchStart,
  onTouchMove: touchMove,
  onTouchEnd: touchEnd,
  onTouchCancel: touchCancel,
} = useTouchDrag()
const {
  isLiveViaWS,
  needsPolling,
  isStaticWidget,
} = useWidgetWebSocket()

const isDragging = ref(false)
const isResizingHeight = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)
const wrapperRef = ref(null)

// Track if we're using touch to prevent HTML5 DnD from firing
const isTouchDevice = ref(false)

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

/** Whether this specific widget is being dragged (HTML5 or touch) */
const isBeingDragged = computed(() =>
  dragWidgetId.value === props.widgetId ||
  touchDragWidgetId.value === props.widgetId
)

/** Whether the widget is currently collapsed */
const widgetCollapsed = computed(() => isCollapsed(props.widgetId))

/** Whether width resize is available (not in a pair) */
const canResizeWidth = computed(() => !props.inPair)

// ─── Per-widget auto-refresh (Session 5) ─────────────────

/** Whether this widget is receiving live data via WebSocket */
const widgetIsLive = computed(() => isLiveViaWS(props.widgetId))

/** Resolved refresh interval in seconds */
const refreshIntervalSecs = computed(() => getRefreshInterval(props.widgetId))

let refreshTimer = null
let isPageVisible = true

/**
 * Start or restart the per-widget refresh timer.
 * Skips if: widget is static, WS is covering it, interval is 0 (manual),
 * or the page is hidden.
 */
function startRefreshTimer() {
  stopRefreshTimer()

  // Static widgets (clock, search, etc.) never need polling
  if (isStaticWidget(props.widgetId)) return

  // WS-covered widgets skip polling when WS is connected
  if (widgetIsLive.value) return

  // Manual mode (0s) or invalid interval
  const seconds = refreshIntervalSecs.value
  if (!seconds || seconds <= 0) return

  // Don't poll while page is hidden
  if (!isPageVisible) return

  refreshTimer = setInterval(() => {
    emit('refresh')
  }, seconds * 1000)
}

function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Handle page visibility changes — pause polling when tab is hidden,
 * resume (with immediate refresh) when tab becomes visible again.
 */
function onVisibilityChange() {
  isPageVisible = document.visibilityState === 'visible'
  if (isPageVisible) {
    // Immediate refresh when coming back to the tab
    if (needsPolling(props.widgetId)) {
      emit('refresh')
    }
    startRefreshTimer()
  } else {
    stopRefreshTimer()
  }
}

// Watch for changes that should restart the timer:
// - WS connection state (widget becomes live or loses WS)
// - Configured refresh interval changes
// - Widget collapse state (don't poll collapsed widgets)
watch(
  [widgetIsLive, refreshIntervalSecs, widgetCollapsed],
  () => {
    if (widgetCollapsed.value) {
      stopRefreshTimer()
    } else {
      startRefreshTimer()
    }
  }
)

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Start timer after a brief delay to let the widget mount and do its initial fetch
  setTimeout(() => startRefreshTimer(), 500)
})

// ─── HTML5 Drag handlers (desktop) ────────────────────────

function onDragStart(e) {
  if (isTouchDevice.value) {
    e.preventDefault()
    return
  }
  isDragging.value = true
  startDrag(props.widgetId, props.rowIdx)
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', props.widgetId)
}

function onDragEnd() {
  isDragging.value = false
  endDrag()
}

// ─── Touch drag handlers (mobile) ─────────────────────────

function onWrapperTouchStart(e) {
  if (!props.editing || isResizingHeight.value) return

  // Mark that we're on a touch device to suppress HTML5 DnD
  isTouchDevice.value = true

  touchStart(e, props.widgetId, props.rowIdx, wrapperRef.value)
}

function onWrapperTouchMove(e) {
  if (!isDraggingTouch.value) return
  touchMove(e)
}

function onWrapperTouchEnd(e) {
  if (!isDraggingTouch.value) {
    // Reset touch device flag after a brief delay
    // (allows detecting switch back to mouse)
    return
  }
  touchEnd(e, handleDrop)
}

function onWrapperTouchCancel() {
  touchCancel()
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

// ─── Cleanup ────────────────────────────────────────────────

onBeforeUnmount(() => {
  stopRefreshTimer()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('mousemove', onResizeMouseMove)
  window.removeEventListener('mouseup', onResizeMouseUp)
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="widget-wrap h-full relative"
    :class="{
      'ring-2 ring-dashed ring-accent/30 rounded-2xl cursor-grab active:cursor-grabbing': editing && !isDragging && !isResizingHeight && !isDraggingTouch,
      'opacity-30 scale-95': isDragging,
      'touch-drag-source': isDraggingTouch && touchDragWidgetId === widgetId,
    }"
    :style="wrapperStyle"
    :draggable="editing && !isResizingHeight && !isTouchDevice"
    @dragstart="editing ? onDragStart($event) : null"
    @dragend="editing ? onDragEnd() : null"
    @touchstart.passive="editing ? onWrapperTouchStart($event) : null"
    @touchmove="onWrapperTouchMove($event)"
    @touchend="onWrapperTouchEnd($event)"
    @touchcancel="onWrapperTouchCancel()"
  >
    <!-- Drag handle badge (visible only in edit mode) -->
    <div
      v-if="editing"
      class="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1
             rounded-full bg-theme-secondary border border-theme-primary shadow-lg cursor-grab
             active:cursor-grabbing select-none transition-opacity"
      :class="isBeingDragged ? 'opacity-0' : 'opacity-100'"
    >
      <Icon name="GripHorizontal" :size="12" class="text-theme-muted" />
      <span class="text-[10px] font-medium text-theme-secondary whitespace-nowrap">{{ widgetLabel }}</span>
      <!-- Live WS indicator (Session 5) -->
      <span
        v-if="widgetIsLive"
        class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"
        title="Live via WebSocket"
      ></span>
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

/* Touch drag source — applied by useTouchDrag via inline styles,
   but we keep this class for any additional styling needs */
.touch-drag-source {
  opacity: 0.3;
  transform: scale(0.95);
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
