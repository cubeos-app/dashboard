<script setup>
/**
 * ServiceHealthModal.vue
 * 
 * Modal showing service/app health details and logs.
 * Sprint 4: Uses unified apps.js store.
 */
import { ref, watch, computed, onUnmounted, nextTick } from 'vue'
import { useAppsStore } from '@/stores/apps'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  service: {
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
let logFetchController = null
const modalRef = ref(null)

const displayName = computed(() => 
  props.service ? appsStore.getDisplayName(props.service) : ''
)

const iconName = computed(() => 
  props.service ? appsStore.getAppIcon(props.service) : 'Box'
)

const status = computed(() => {
  if (!props.service) return 'unknown'
  return props.service.status?.health || 
         props.service.health || 
         (props.service.status?.running ? 'running' : 'stopped')
})

const isRunning = computed(() => {
  return props.service?.status?.running || props.service?.state === 'running'
})

const isHealthy = computed(() => {
  return status.value === 'healthy' || status.value === 'running'
})

const statusText = computed(() => {
  if (!isRunning.value) return 'Stopped'
  if (status.value === 'unhealthy') return 'Unhealthy'
  if (status.value === 'starting') return 'Starting'
  return 'Healthy'
})

const statusColor = computed(() => {
  if (!isRunning.value) return 'text-theme-muted'
  if (status.value === 'unhealthy') return 'text-warning'
  if (status.value === 'starting') return 'text-warning'
  return 'text-success'
})

const uptime = computed(() => {
  if (!props.service?.status?.started_at) return 'N/A'
  const started = new Date(props.service.status.started_at)
  const now = new Date()
  const diff = now - started
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
})

// Auto-focus modal when shown
watch(() => props.show, (visible) => {
  if (visible) nextTick(() => modalRef.value?.focus())
})

// Fetch logs when modal opens
watch(() => [props.show, props.service], async ([show, service]) => {
  // Abort any in-flight log fetch
  if (logFetchController) {
    logFetchController.abort()
    logFetchController = null
  }
  
  if (show && service) {
    loading.value = true
    error.value = null
    logFetchController = new AbortController()
    
    try {
      const result = await appsStore.getAppLogs(service.name, 50, { signal: logFetchController.signal })
      logs.value = result || []
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      logs.value = []
    } finally {
      loading.value = false
    }
  }
}, { immediate: true })

function close() {
  if (logFetchController) {
    logFetchController.abort()
    logFetchController = null
  }
  emit('close')
}

onUnmounted(() => {
  if (logFetchController) {
    logFetchController.abort()
    logFetchController = null
  }
})
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
        :aria-label="displayName ? `${displayName} health` : 'Service health'"
        tabindex="-1"
        @keydown.escape="close"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"></div>
        
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
              aria-label="Close"
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
                    {{ status }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Uptime</p>
                  <p class="font-medium text-theme-primary">
                    {{ uptime }}
                  </p>
                </div>
              </div>
              
              <!-- App Type & Deploy Mode -->
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Type</p>
                  <p class="font-medium text-theme-primary capitalize">
                    {{ service?.type || 'Unknown' }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Deploy Mode</p>
                  <p class="font-medium text-theme-primary capitalize">
                    {{ service?.deploy_mode || 'Unknown' }}
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
                    v-if="logs.length > 0"
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
