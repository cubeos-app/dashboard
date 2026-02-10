<script setup>
/**
 * AppHealthModal.vue - Sprint 4 Component
 * 
 * Shows app health and logs using the unified apps store.
 * Replaces ServiceHealthModal.vue.
 */
import { ref, watch, computed, nextTick } from 'vue'
import { useAppsStore } from '@/stores/apps'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  app: {
    type: Object,
    default: null
  },
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const appsStore = useAppsStore()
const loading = ref(false)
const logs = ref([])
const error = ref(null)
const modalRef = ref(null)

const displayName = computed(() => 
  props.app ? appsStore.getAppDisplayName(props.app) : ''
)

const iconName = computed(() => 
  props.app ? appsStore.getAppIcon(props.app) : 'Box'
)

const isRunning = computed(() => 
  props.app ? appsStore.isRunning(props.app) : false
)

const isHealthy = computed(() => 
  props.app ? appsStore.isHealthy(props.app) : false
)

const statusText = computed(() => {
  if (!props.app) return 'Loading...'
  if (!isRunning.value) return 'Stopped'
  if (!isHealthy.value) return 'Unhealthy'
  return 'Healthy'
})

const statusColor = computed(() => {
  if (!props.app) return 'text-theme-muted'
  if (!isRunning.value) return 'text-theme-muted'
  if (!isHealthy.value) return 'text-warning'
  return 'text-success'
})

const replicas = computed(() => {
  return props.app?.status?.replicas || 'N/A'
})

const health = computed(() => {
  return props.app?.status?.health || 'N/A'
})

// Auto-focus modal when shown
watch(() => props.show, (visible) => {
  if (visible) nextTick(() => modalRef.value?.focus())
})

watch(() => [props.show, props.app], async ([show, app]) => {
  if (show && app) {
    loading.value = true
    error.value = null
    try {
      const result = await appsStore.getAppLogs(app.name, 50)
      logs.value = result || []
    } catch (e) {
      error.value = e.message
      logs.value = []
    } finally {
      loading.value = false
    }
  }
}, { immediate: true })

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show" 
        ref="modalRef"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="displayName ? `${displayName} health` : 'App health'"
        tabindex="-1"
        @keydown.escape="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="close"></div>
        
        <!-- Modal -->
        <div class="relative w-full max-w-lg bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-theme-primary">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center">
                <Icon :name="iconName" :size="20" class="text-theme-secondary" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-theme-primary">{{ displayName }}</h2>
                <p class="text-sm" :class="statusColor">{{ statusText }}</p>
              </div>
            </div>
            <button
              @click="close"
              class="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              aria-label="Close health details"
            >
              <Icon name="X" :size="20" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-8">
              <Icon name="Loader2" :size="32" class="animate-spin text-accent" />
            </div>
            
            <!-- Health Info -->
            <div v-else class="space-y-4">
              <!-- Status Cards -->
              <div class="grid grid-cols-3 gap-3">
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Status</p>
                  <p class="font-medium" :class="statusColor">
                    {{ isRunning ? 'Running' : 'Stopped' }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Health</p>
                  <p class="font-medium" :class="statusColor">
                    {{ health }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Replicas</p>
                  <p class="font-medium text-theme-primary">
                    {{ replicas }}
                  </p>
                </div>
              </div>
              
              <!-- Logs -->
              <div>
                <h3 class="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-2">
                  <Icon name="ScrollText" :size="14" />
                  Recent Logs
                </h3>
                <div class="bg-code rounded-xl p-3 max-h-64 overflow-auto">
                  <pre 
                    v-if="logs && logs.length > 0"
                    class="text-xs font-mono text-code whitespace-pre-wrap"
                  >{{ logs.join('\n') }}</pre>
                  <p v-else-if="error" class="text-xs text-error italic">{{ error }}</p>
                  <p v-else class="text-xs text-code-muted italic">No recent logs available</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="flex justify-end gap-2 p-4 border-t border-theme-primary bg-theme-secondary">
            <button
              @click="close"
              class="px-4 py-2 rounded-lg text-sm font-medium bg-theme-tertiary text-theme-secondary hover:bg-theme-card transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
