<script setup>
/**
 * TorToggle.vue
 * 
 * Toggle component for enabling/disabling Tor routing for an app.
 * Uses the unified /api/v1/apps/{name}/tor endpoint.
 * 
 * Sprint 4: S4-12
 */

import { ref, computed, watch } from 'vue'
import { useAppsStore } from '@/stores/apps'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  appName: {
    type: String,
    required: true
  },
  // Initial state (can be overridden by app data)
  modelValue: {
    type: Boolean,
    default: false
  },
  // Size variant
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  // Show label
  showLabel: {
    type: Boolean,
    default: true
  },
  // Disabled state
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'error'])

const appsStore = useAppsStore()

// Local state
const isEnabled = ref(props.modelValue)
const isLoading = ref(false)
const error = ref(null)

// Get app from store
const app = computed(() => appsStore.getAppByName(props.appName))

// Sync with app data if available
watch(() => app.value?.tor_enabled, (newVal) => {
  if (newVal !== undefined) {
    isEnabled.value = newVal
  }
}, { immediate: true })

// Sync with prop
watch(() => props.modelValue, (newVal) => {
  isEnabled.value = newVal
})

// Size classes
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return {
        track: 'w-8 h-4',
        thumb: 'w-3 h-3',
        translate: 'translate-x-4',
        icon: 12,
        text: 'text-xs'
      }
    case 'lg':
      return {
        track: 'w-14 h-7',
        thumb: 'w-5 h-5',
        translate: 'translate-x-7',
        icon: 20,
        text: 'text-base'
      }
    default: // md
      return {
        track: 'w-11 h-6',
        thumb: 'w-4 h-4',
        translate: 'translate-x-5',
        icon: 16,
        text: 'text-sm'
      }
  }
})

// Toggle Tor routing
async function toggle() {
  if (props.disabled || isLoading.value) return
  
  isLoading.value = true
  error.value = null
  
  const newState = !isEnabled.value
  
  try {
    const result = await appsStore.setAppTor(props.appName, newState)
    
    if (result) {
      isEnabled.value = newState
      emit('update:modelValue', newState)
      emit('change', { appName: props.appName, enabled: newState })
    } else {
      error.value = appsStore.error || 'Failed to update Tor routing'
      emit('error', error.value)
    }
  } catch (e) {
    error.value = e.message
    emit('error', error.value)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Toggle Switch -->
    <button
      type="button"
      role="switch"
      :aria-checked="isEnabled"
      :aria-label="`${isEnabled ? 'Disable' : 'Enable'} Tor routing for ${appName}`"
      :disabled="disabled || isLoading"
      @click="toggle"
      class="relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--tor)] focus:ring-offset-2 focus:ring-offset-theme-secondary"
      :class="[
        sizeClasses.track,
        isEnabled ? 'bg-tor' : 'bg-theme-tertiary',
        (disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
      ]"
    >
      <!-- Thumb -->
      <span
        class="inline-flex items-center justify-center rounded-full bg-theme-primary shadow transform transition-transform duration-200"
        :class="[
          sizeClasses.thumb,
          isEnabled ? sizeClasses.translate : 'translate-x-1'
        ]"
      >
        <!-- Loading spinner -->
        <Icon 
          v-if="isLoading" 
          name="Loader2" 
          :size="sizeClasses.icon - 4" 
          class="animate-spin text-theme-muted" 
        />
        <!-- Tor icon when enabled -->
        <Icon 
          v-else-if="isEnabled" 
          name="Eye" 
          :size="sizeClasses.icon - 4" 
          class="text-tor" 
        />
      </span>
    </button>
    
    <!-- Label -->
    <div v-if="showLabel" class="flex flex-col">
      <span :class="[sizeClasses.text, 'font-medium text-theme-primary']">
        Tor Routing
      </span>
      <span class="text-xs text-theme-muted">
        {{ isEnabled ? 'Traffic routed through Tor' : 'Direct connection' }}
      </span>
    </div>
    
    <!-- Error indicator -->
    <div v-if="error" class="flex items-center gap-1 text-error">
      <Icon name="AlertCircle" :size="14" />
      <span class="text-xs">{{ error }}</span>
    </div>
  </div>
</template>
