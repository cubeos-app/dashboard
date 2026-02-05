<script setup>
/**
 * ErrorBoundary.vue
 *
 * Catches render errors in child components and displays a recovery UI
 * instead of a white screen. Wraps the main <router-view> in App.vue.
 *
 * Uses Vue's onErrorCaptured lifecycle hook to intercept errors from
 * any descendant component. Provides retry and navigation options.
 *
 * Sprint 1 — S1-01
 */
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const hasError = ref(false)
const errorMessage = ref('')
const errorComponent = ref('')

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorMessage.value = err?.message || 'An unexpected error occurred'
  errorComponent.value = info || ''

  // Log for debugging but don't re-throw — prevent propagation
  console.error(`[ErrorBoundary] Caught in ${info}:`, err)
  return false
})

function retry() {
  hasError.value = false
  errorMessage.value = ''
  errorComponent.value = ''
}

function goHome() {
  hasError.value = false
  errorMessage.value = ''
  errorComponent.value = ''
  router.push('/')
}
</script>

<template>
  <slot v-if="!hasError" />

  <div v-else class="flex items-center justify-center min-h-[60vh] p-6">
    <div class="max-w-md w-full text-center">
      <!-- Error icon -->
      <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-error-muted flex items-center justify-center">
        <svg
          class="w-8 h-8 text-error"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 class="text-xl font-semibold text-theme-primary mb-2">Something went wrong</h2>
      <p class="text-sm text-theme-secondary mb-1">
        This view encountered an error and couldn't render.
      </p>
      <p v-if="errorMessage" class="text-xs text-theme-muted font-mono mb-6 break-all">
        {{ errorMessage }}
      </p>

      <div class="flex gap-3 justify-center">
        <button
          @click="retry"
          class="px-5 py-2.5 rounded-xl border border-theme-primary text-theme-secondary text-sm font-medium hover:bg-theme-tertiary transition-colors"
          aria-label="Try again"
        >
          Try Again
        </button>
        <button
          @click="goHome"
          class="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors btn-accent"
          aria-label="Go to dashboard"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  </div>
</template>
