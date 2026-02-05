<script setup>
/**
 * NotFoundView.vue
 *
 * 404 error page shown for unrecognized routes.
 */
import { useRouter } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
    <div class="w-20 h-20 rounded-2xl bg-theme-tertiary flex items-center justify-center mb-6">
      <Icon name="AlertCircle" :size="40" class="text-theme-muted" />
    </div>
    <h1 class="text-3xl font-semibold text-theme-primary mb-2">Page Not Found</h1>
    <p class="text-theme-muted mb-8 max-w-md">
      The page you are looking for does not exist or has been moved.
    </p>
    <button
      @click="router.push('/')"
      class="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors"
      aria-label="Go back to dashboard"
    >
      Back to Dashboard
    </button>
  </div>
</template>
