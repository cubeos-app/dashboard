<script setup>
import { ref, watch, computed } from 'vue'
import { useServicesStore } from '@/stores/services'
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

const servicesStore = useServicesStore()
const loading = ref(false)
const healthData = ref(null)

const displayName = computed(() => 
  props.service ? servicesStore.getServiceName(props.service.name) : ''
)

const iconName = computed(() => 
  props.service ? servicesStore.getServiceIcon(props.service.name) : 'Box'
)

const isHealthy = computed(() => {
  if (!healthData.value) return false
  return healthData.value.health === 'healthy' || !healthData.value.health
})

const statusText = computed(() => {
  if (!healthData.value) return 'Loading...'
  if (healthData.value.status !== 'running') return 'Stopped'
  if (!isHealthy.value) return 'Unhealthy'
  return 'Healthy'
})

const statusColor = computed(() => {
  if (!healthData.value) return 'text-theme-muted'
  if (healthData.value.status !== 'running') return 'text-theme-muted'
  if (!isHealthy.value) return 'text-warning'
  return 'text-success'
})

watch(() => [props.show, props.service], async ([show, service]) => {
  if (show && service) {
    loading.value = true
    healthData.value = await servicesStore.getServiceHealth(service.name)
    loading.value = false
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
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
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
            <div v-else-if="healthData" class="space-y-4">
              <!-- Status Cards -->
              <div class="grid grid-cols-3 gap-3">
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Status</p>
                  <p class="font-medium" :class="statusColor">
                    {{ healthData.status || 'Unknown' }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Health</p>
                  <p class="font-medium" :class="statusColor">
                    {{ healthData.health || 'N/A' }}
                  </p>
                </div>
                <div class="p-3 rounded-xl bg-theme-tertiary">
                  <p class="text-xs text-theme-muted mb-1">Uptime</p>
                  <p class="font-medium text-theme-primary">
                    {{ healthData.uptime || 'N/A' }}
                  </p>
                </div>
              </div>
              
              <!-- Logs -->
              <div>
                <h3 class="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-2">
                  <Icon name="ScrollText" :size="14" />
                  Recent Logs
                </h3>
                <div class="bg-gray-900 rounded-xl p-3 max-h-64 overflow-auto">
                  <pre 
                    v-if="healthData.logs && healthData.logs.length > 0"
                    class="text-xs font-mono text-gray-300 whitespace-pre-wrap"
                  >{{ healthData.logs.join('\n') }}</pre>
                  <p v-else class="text-xs text-gray-500 italic">No recent logs available</p>
                </div>
              </div>
            </div>
            
            <!-- Error -->
            <div v-else class="text-center py-8">
              <Icon name="AlertCircle" :size="32" class="text-error mx-auto mb-2" />
              <p class="text-theme-tertiary">Failed to load service health</p>
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
