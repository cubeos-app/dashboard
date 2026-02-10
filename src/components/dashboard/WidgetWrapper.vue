<script setup>
/**
 * WidgetWrapper.vue — DnD Bugfix
 *
 * Thin wrapper that controls per-widget card background opacity (Session B)
 * AND provides drag-and-drop support in edit mode (Session C).
 *
 * Session B: Sets --widget-bg-opacity CSS custom property.
 * Session C: When editing=true, shows a drag handle badge, dashed border,
 *   and handles dragstart/dragend for HTML5 Drag and Drop.
 *
 * BUGFIX: Removed the z-20 transparent overlay that was blocking drag
 * initiation in some browsers. Instead, the slot content gets
 * pointer-events:none during edit mode, so interactive children (buttons,
 * links, inputs) can't capture mousedown — while the parent draggable div
 * still receives pointer events and can initiate HTML5 drag.
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
      'ring-2 ring-dashed ring-accent/30 rounded-2xl cursor-grab active:cursor-grabbing': editing && !isDragging,
      'opacity-30 scale-95': isDragging,
    }"
    :style="wrapperStyle"
    :draggable="editing"
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

    <!--
      Slot content: during edit mode, pointer-events:none prevents interactive
      children from capturing mousedown, so the parent draggable div receives
      the events and HTML5 drag initiates correctly.
    -->
    <div :class="editing ? 'pointer-events-none' : ''">
      <slot />
    </div>
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
