<script setup>
/**
 * WidgetWrapper.vue — Session C Fix
 *
 * Thin wrapper that controls per-widget card background opacity (Session B)
 * AND provides drag-and-drop support in edit mode (Session C).
 *
 * Session B: Sets --widget-bg-opacity CSS custom property.
 * Session C: When editing=true, shows a drag handle overlay, dashed border,
 *   and handles dragstart/dragend for HTML5 Drag and Drop.
 *
 * FIX: Added a transparent interaction overlay in edit mode. This overlay
 * sits above the widget content (but below the drag handle badge) and
 * captures mouse/touch events that would otherwise be swallowed by
 * interactive children (buttons, links, inputs). Without this overlay,
 * dragging from any interactive element inside the widget would fail
 * because the element's own mousedown behavior takes priority over the
 * parent's draggable attribute.
 *
 * Props:
 *   widget-id — widget ID for opacity lookup and drag identification
 *   editing   — whether edit mode is active
 *   row-idx   — the row index this widget lives in (for drag source tracking)
 */
import { computed, ref } from 'vue'
import { useDashboardConfig, WIDGET_REGISTRY } from '@/composables/useDashboardConfig'
import { useDashboardEdit } from '@/composables/useDashboardEdit'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  widgetId: { type: String, required: true },
  editing: { type: Boolean, default: false },
  rowIdx: { type: Number, default: 0 },
})

const { getOpacity } = useDashboardConfig()
const { startDrag, endDrag, dragWidgetId } = useDashboardEdit()

const isDragging = ref(false)

/** Normalized opacity: 0–100 config → 0–1 CSS */
const normalizedOpacity = computed(() => getOpacity(props.widgetId) / 100)

const wrapperStyle = computed(() => ({
  '--widget-bg-opacity': normalizedOpacity.value,
}))

/** Widget label for the drag handle badge */
const widgetLabel = computed(() => WIDGET_REGISTRY[props.widgetId]?.label || props.widgetId)

/** Whether this specific widget is being dragged */
const isBeingDragged = computed(() => dragWidgetId.value === props.widgetId)

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
</script>

<template>
  <div
    class="widget-wrap h-full relative"
    :class="{
      'ring-2 ring-dashed ring-accent/30 rounded-2xl': editing && !isDragging,
      'opacity-30 scale-95': isDragging,
    }"
    :style="wrapperStyle"
    :draggable="editing"
    @dragstart="editing ? onDragStart($event) : null"
    @dragend="editing ? onDragEnd() : null"
  >
    <!-- Drag handle overlay (visible only in edit mode) -->
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

    <!--
      Transparent interaction overlay — edit mode only.
      Sits above widget content (z-20) but below the drag handle (z-30).
      Prevents buttons/links/inputs inside the widget from capturing
      mousedown events that would block the parent's HTML5 drag.
    -->
    <div
      v-if="editing"
      class="absolute inset-0 z-20 cursor-grab active:cursor-grabbing rounded-2xl"
    ></div>

    <slot />
  </div>
</template>

<style scoped>
/*
 * Solid card mode: override bg-theme-card and border-theme-primary
 * within the wrapped widget to respect --widget-bg-opacity.
 * Uses color-mix() for clean alpha blending with transparent.
 *
 * Glass mode is handled by main.css (.glass reads --widget-bg-opacity directly).
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

/* Smooth transitions for drag state */
.widget-wrap {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
</style>
