<script setup>
/**
 * ServiceCard.vue
 * 
 * Reusable service/app card component.
 * Sprint 4: Uses unified apps.js store.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { confirm } from '@/utils/confirmDialog'
import { safeGetItem, safeSetItem } from '@/utils/storage'
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

const emit = defineEmits(['showHealth'])

const appsStore = useAppsStore()
const router = useRouter()
const actionLoading = ref(false)
const favoritesStore = useFavoritesStore()

// Computed properties
const displayName = computed(() => appsStore.getDisplayName(props.service))
const iconName = computed(() => appsStore.getAppIcon(props.service))

const isRunning = computed(() => {
  return props.service.status?.running || props.service.state === 'running'
})

const isHealthy = computed(() => {
  const health = props.service.status?.health || props.service.health
  if (!health) return null  // Unknown — don't mask as healthy
  return health === 'healthy' || health === 'running'
})

const isCore = computed(() => {
  return props.service.type === 'system' || 
         props.service.type === 'platform' || 
         props.service.name.startsWith('cubeos-')
})

const isFavorite = computed(() => favoritesStore.isFavorite(props.service.name))

const hasUI = computed(() => appsStore.hasWebUI(props.service))

const statusConfig = computed(() => {
  if (!isRunning.value) {
    return { dot: 'bg-theme-muted', text: 'Stopped', class: 'text-theme-muted' }
  }
  if (isHealthy.value === false) {
    return { dot: 'bg-warning', text: 'Unhealthy', class: 'text-warning', pulse: true }
  }
  return { dot: 'bg-success', text: 'Running', class: 'text-success' }
})

const serviceUrl = computed(() => {
  if (!hasUI.value) return null
  return appsStore.getAppUrl(props.service)
})

const imageName = computed(() => {
  const img = props.service.image || ''
  return img.split(':')[0].split('/').pop() || 'Container'
})

const displayPorts = computed(() => {
  const ports = props.service.ports || []
  return ports.filter(p => p.port || p.public_port).slice(0, 3).map(p => p.port || p.public_port)
})

const extraPortCount = computed(() => {
  const ports = props.service.ports || []
  return Math.max(0, ports.filter(p => p.port || p.public_port).length - 3)
})

// Track usage in localStorage
function trackUsage(name) {
  let recent = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(recent)) recent = []
  recent = recent.filter(n => n !== name)
  recent.unshift(name)
  recent = recent.slice(0, 10)
  safeSetItem('cubeos-recent', recent)
}

function handleClick() {
  // Running service with Web UI → open in new tab
  if (isRunning.value && hasUI.value && serviceUrl.value) {
    trackUsage(props.service.name)
    window.open(serviceUrl.value, '_blank', 'noopener,noreferrer')
    return
  }

  // Running service without Web UI → show health modal
  if (isRunning.value) {
    emit('showHealth', props.service)
    return
  }

  // Stopped service → navigate to detail view
  router.push(`/services/${props.service.name}`)
}

async function handleAction(action, e) {
  e.preventDefault()
  e.stopPropagation()
  
  if (action !== 'start' && !await confirm({
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName.value}?`,
    message: `This will ${action} the ${displayName.value} service.`,
    confirmText: action.charAt(0).toUpperCase() + action.slice(1),
    variant: action === 'stop' ? 'danger' : 'warning'
  })) return
  
  actionLoading.value = true
  try {
    if (action === 'start') await appsStore.startApp(props.service.name)
    else if (action === 'stop') await appsStore.stopApp(props.service.name)
    else if (action === 'restart') await appsStore.restartApp(props.service.name)
  } finally {
    actionLoading.value = false
  }
}

function handleToggleFavorite(e) {
  e.preventDefault()
  e.stopPropagation()
  favoritesStore.toggleFavorite(props.service.name)
}
</script>

<template>
  <div
    @click="handleClick"
    class="group relative bg-theme-card rounded-xl border border-theme-primary overflow-hidden transition-all duration-200 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5"
    :class="[
      { 'opacity-60': !isRunning },
      'cursor-pointer'
    ]"
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
              :aria-label="'Start ' + displayName"
            >
              <Icon name="Play" :size="16" />
            </button>
            
            <!-- Stop -->
            <button
              v-if="isRunning && !isCore"
              @click="handleAction('stop', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-error hover:bg-error-muted rounded-lg transition-colors"
              title="Stop"
              :aria-label="'Stop ' + displayName"
            >
              <Icon name="Square" :size="16" />
            </button>
            
            <!-- Restart -->
            <button
              v-if="isRunning && !isCore"
              @click="handleAction('restart', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-warning hover:bg-warning-muted rounded-lg transition-colors"
              title="Restart"
              :aria-label="'Restart ' + displayName"
            >
              <Icon name="RotateCw" :size="16" />
            </button>
            
            <!-- Favorite -->
            <button
              @click="handleToggleFavorite($event)"
              class="p-1.5 rounded-lg transition-colors"
              :class="isFavorite 
                ? 'text-warning' 
                : 'text-theme-tertiary hover:text-warning hover:bg-warning-muted'"
              :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :aria-label="(isFavorite ? 'Remove ' : 'Add ') + displayName + (isFavorite ? ' from favorites' : ' to favorites')"
            >
              <Icon name="Star" :size="16" :class="{ 'fill-current': isFavorite }" />
            </button>
          </div>
          
          <!-- Open link / Info icon -->
          <div
            v-if="isRunning"
            class="p-1.5 text-theme-tertiary hover:text-accent hover:bg-accent-muted rounded-lg transition-colors"
            :title="hasUI ? 'Open' : 'View Status'"
          >
            <Icon :name="hasUI ? 'ExternalLink' : 'Info'" :size="16" />
          </div>
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
