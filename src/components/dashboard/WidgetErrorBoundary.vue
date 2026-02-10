<script setup>
/**
 * WidgetErrorBoundary.vue — Session 2
 *
 * Vue error boundary component that catches rendering and lifecycle errors
 * from child (widget) components. When an error occurs, it shows a fallback
 * UI with the widget name, a brief error summary, and a Retry button.
 *
 * Uses Vue's onErrorCaptured lifecycle hook. When an error is caught:
 *   1. Sets hasError=true to show fallback UI
 *   2. Stores the error message for display
 *   3. Logs the full error with widget context to console
 *   4. Returns false to prevent the error from propagating
 *
 * Retry: Bumps a local key to force Vue to re-create the child component
 * tree, clearing any stale state from the crashed widget.
 *
 * Note: This does NOT catch async errors in Pinia stores or fetch calls.
 * Those need per-widget error handling (try/catch in the widget itself).
 *
 * Props:
 *   widget-id  — widget identifier for error logging context
 *   label      — human-readable widget name for fallback UI
 *   icon       — Lucide icon name for fallback UI (default: 'AlertTriangle')
 */
import { ref, onErrorCaptured } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  widgetId: { type: String, default: 'unknown' },
  label: { type: String, default: 'Widget' },
  icon: { type: String, default: 'AlertTriangle' },
})

const hasError = ref(false)
const errorMessage = ref('')
const retryKey = ref(0)

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorMessage.value = err?.message || 'An unexpected error occurred'

  // Log with context for debugging
  console.error(
    `[WidgetErrorBoundary] Error in "${props.widgetId}" (${props.label}):`,
    err,
    '\nComponent:', instance,
    '\nInfo:', info,
  )

  // Prevent propagation — this widget is isolated
  return false
})

function retry() {
  hasError.value = false
  errorMessage.value = ''
  retryKey.value++
}
</script>

<template>
  <!-- Error fallback UI -->
  <div
    v-if="hasError"
    class="flex flex-col items-center justify-center py-8 px-4 text-center
           rounded-2xl border border-error/20 bg-error/5 min-h-[120px]"
  >
    <div class="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center mb-3">
      <Icon name="AlertTriangle" :size="20" class="text-error" />
    </div>

    <p class="text-sm font-medium text-theme-secondary mb-1">
      {{ label }} failed to load
    </p>

    <p class="text-xs text-theme-muted max-w-xs mb-4 line-clamp-2">
      {{ errorMessage }}
    </p>

    <button
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
             bg-theme-tertiary text-theme-secondary border border-theme-primary
             hover:text-theme-primary hover:border-accent/40 transition-colors"
      @click="retry"
    >
      <Icon name="RotateCcw" :size="12" />
      Retry
    </button>
  </div>

  <!-- Normal render with keyed wrapper for retry -->
  <div v-else :key="retryKey">
    <slot />
  </div>
</template>
