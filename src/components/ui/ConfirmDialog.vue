<script setup>
/**
 * ConfirmDialog.vue
 *
 * Modal confirmation dialog for destructive actions.
 * Replaces native confirm() with a themed, accessible modal.
 */
import { ref, watch, nextTick } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const dialogRef = ref(null)

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: 'Are you sure?'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  variant: {
    type: String,
    default: 'danger',
    validator: (v) => ['danger', 'warning', 'info'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const variantClasses = {
  danger: 'btn-error',
  warning: 'btn-warning',
  info: 'bg-accent hover:bg-accent-secondary'
}

const iconMap = {
  danger: 'AlertTriangle',
  warning: 'AlertCircle',
  info: 'Info'
}

const iconColorMap = {
  danger: 'text-error',
  warning: 'text-warning',
  info: 'text-accent'
}

// Auto-focus dialog when shown so it receives keyboard events
watch(() => props.show, (visible) => {
  if (visible) {
    nextTick(() => dialogRef.value?.focus())
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        ref="dialogRef"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        @keydown.escape="emit('cancel')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('cancel')"></div>
        
        <!-- Dialog -->
        <div class="relative bg-theme-card border border-theme-primary rounded-2xl shadow-xl max-w-sm w-full p-6">
          <div class="flex flex-col items-center text-center">
            <div class="w-12 h-12 rounded-full flex items-center justify-center mb-4" :class="iconColorMap[variant]">
              <Icon :name="iconMap[variant]" :size="28" />
            </div>
            
            <h3 class="text-lg font-semibold text-theme-primary mb-2">{{ title }}</h3>
            <p v-if="message" class="text-sm text-theme-muted mb-6">{{ message }}</p>
            
            <div class="flex gap-3 w-full">
              <button
                @click="emit('cancel')"
                :disabled="loading"
                class="flex-1 px-4 py-2.5 rounded-xl border border-theme-primary text-theme-secondary text-sm font-medium hover:bg-theme-tertiary transition-colors disabled:opacity-50"
                aria-label="Cancel action"
              >
                {{ cancelText }}
              </button>
              <button
                @click="emit('confirm')"
                :disabled="loading"
                class="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                :class="variantClasses[variant]"
                :aria-label="confirmText"
              >
                <Icon v-if="loading" name="Loader2" :size="16" class="animate-spin" />
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
