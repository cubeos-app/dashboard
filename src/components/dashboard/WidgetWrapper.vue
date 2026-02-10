<script setup>
/**
 * WidgetWrapper.vue — Session B: Per-Widget Transparency
 *
 * Thin wrapper that controls the card background opacity of any widget.
 * Sets --widget-bg-opacity CSS custom property (0–1) which cascades into:
 *   - .glass class (via main.css rgba + calc)
 *   - .bg-theme-card class (via scoped :deep override using color-mix)
 *
 * Props:
 *   widget-id  — widget ID string used to look up opacity from config
 *
 * Opacity scale: 0 = fully transparent card, 100 = fully opaque card.
 * Content inside the widget always renders at full opacity.
 */
import { computed } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'

const props = defineProps({
  widgetId: { type: String, required: true },
})

const { getOpacity } = useDashboardConfig()

/** Normalized opacity: 0–100 config → 0–1 CSS */
const normalizedOpacity = computed(() => getOpacity(props.widgetId) / 100)

const wrapperStyle = computed(() => ({
  '--widget-bg-opacity': normalizedOpacity.value,
}))
</script>

<template>
  <div class="widget-wrap h-full" :style="wrapperStyle">
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
</style>
