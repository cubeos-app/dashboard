<script setup>
import { computed, ref } from 'vue'
import { useServicesStore } from '@/stores/services'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  service: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const servicesStore = useServicesStore()
const actionLoading = ref(false)
const favoriteLoading = ref(false)

const displayName = computed(() => servicesStore.getServiceName(props.service.name))
const iconName = computed(() => servicesStore.getServiceIcon(props.service.name))
const isRunning = computed(() => props.service.state === 'running')
const isHealthy = computed(() => props.service.health === 'healthy' || !props.service.health)
const isCore = computed(() => props.service.is_core)
const isFavorite = computed(() => servicesStore.isFavorite(props.service.name))

const statusConfig = computed(() => {
  if (!isRunning.value) {
    return { dot: 'bg-theme-muted', text: 'Stopped', class: 'text-theme-muted' }
  }
  if (!isHealthy.value) {
    return { dot: 'bg-warning', text: 'Unhealthy', class: 'text-warning', pulse: true }
  }
  return { dot: 'bg-success', text: 'Running', class: 'text-success' }
})

const serviceUrl = computed(() => {
  const ports = props.service.ports || []
  const webPort = ports.find(p => p.public_port)
  if (webPort) {
    return `http://192.168.42.1:${webPort.public_port}`
  }
  return null
})

const imageName = computed(() => {
  const img = props.service.image || ''
  return img.split(':')[0].split('/').pop() || 'Container'
})

const displayPorts = computed(() => {
  const ports = props.service.ports || []
  return ports.filter(p => p.public_port).slice(0, 3).map(p => p.public_port)
})

const extraPortCount = computed(() => {
  const ports = props.service.ports || []
  return Math.max(0, ports.filter(p => p.public_port).length - 3)
})

async function handleAction(action, e) {
  e.preventDefault()
  e.stopPropagation()
  
  if (action !== 'start' && !confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName.value}?`)) return
  
  actionLoading.value = true
  try {
    if (action === 'start') await servicesStore.startService(props.service.name)
    else if (action === 'stop') await servicesStore.stopService(props.service.name)
    else if (action === 'restart') await servicesStore.restartService(props.service.name)
    await servicesStore.fetchServices()
  } finally {
    actionLoading.value = false
  }
}

async function handleToggleFavorite(e) {
  e.preventDefault()
  e.stopPropagation()
  
  favoriteLoading.value = true
  try {
    await servicesStore.toggleFavorite(props.service.name)
  } finally {
    favoriteLoading.value = false
  }
}
</script>

<template>
  <div
    class="group relative bg-theme-card rounded-xl border border-theme-primary overflow-hidden transition-all duration-200 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5"
    :class="{ 'opacity-60': !isRunning }"
  >
    <div class="p-4" :class="{ 'p-3': compact }">
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div 
          class="flex-shrink-0 w-11 h-11 rounded-xl bg-theme-tertiary flex items-center justify-center group-hover:bg-accent-muted transition-colors duration-200"
          :class="{ 'w-9 h-9': compact }"
        >
          <Icon 
            :name="iconName" 
            :size="compact ? 18 : 22" 
            class="text-theme-secondary group-hover:text-accent transition-colors duration-200"
            :stroke-width="1.5"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 
              class="font-medium text-theme-primary truncate"
              :class="compact ? 'text-sm' : 'text-base'"
            >
              {{ displayName }}
            </h3>
            <span 
              class="flex-shrink-0 w-2 h-2 rounded-full"
              :class="[statusConfig.dot, { 'animate-pulse-status': statusConfig.pulse }]"
              :title="statusConfig.text"
            ></span>
          </div>
          
          <p 
            v-if="!compact"
            class="text-sm text-theme-tertiary truncate mt-0.5"
          >
            {{ imageName }}
          </p>
          <p 
            v-else
            class="text-xs mt-0.5"
            :class="statusConfig.class"
          >
            {{ statusConfig.text }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex-shrink-0 flex items-center gap-1">
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- Start -->
            <button
              v-if="!isRunning && !isCore"
              @click="handleAction('start', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-success hover:bg-success-muted rounded-lg transition-colors"
              title="Start"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            
            <!-- Stop -->
            <button
              v-if="isRunning && !isCore"
              @click="handleAction('stop', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-error hover:bg-error-muted rounded-lg transition-colors"
              title="Stop"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
            
            <!-- Restart -->
            <button
              v-if="isRunning && !isCore"
              @click="handleAction('restart', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-warning hover:bg-warning-muted rounded-lg transition-colors"
              title="Restart"
            >
              <Icon name="RotateCw" :size="16" />
            </button>
            
            <!-- Favorite -->
            <button
              @click="handleToggleFavorite($event)"
              :disabled="favoriteLoading"
              class="p-1.5 rounded-lg transition-colors"
              :class="isFavorite 
                ? 'text-warning' 
                : 'text-theme-tertiary hover:text-warning hover:bg-warning-muted'"
              :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
            >
              <Icon name="Star" :size="16" :class="{ 'fill-current': isFavorite }" />
            </button>
          </div>
          
          <!-- Open link -->
          <a
            v-if="isRunning && serviceUrl"
            :href="serviceUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            class="p-1.5 text-theme-tertiary hover:text-accent hover:bg-accent-muted rounded-lg transition-colors"
            title="Open"
          >
            <Icon name="ExternalLink" :size="16" />
          </a>
        </div>
      </div>
    </div>

    <!-- Ports footer -->
    <div 
      v-if="!compact && displayPorts.length > 0"
      class="px-4 py-2 bg-theme-secondary border-t border-theme-primary"
    >
      <div class="flex items-center gap-2 text-xs">
        <span class="text-theme-muted">Port{{ displayPorts.length > 1 ? 's' : '' }}</span>
        <div class="flex items-center gap-1">
          <span 
            v-for="port in displayPorts" 
            :key="port"
            class="px-1.5 py-0.5 rounded bg-theme-tertiary text-theme-secondary font-mono text-[11px]"
          >
            {{ port }}
          </span>
          <span v-if="extraPortCount > 0" class="text-theme-muted">
            +{{ extraPortCount }}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Loading overlay -->
    <div v-if="actionLoading" class="absolute inset-0 bg-theme-card/80 backdrop-blur-sm flex items-center justify-center">
      <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
    </div>
  </div>
</template>
