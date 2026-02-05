<script setup>
/**
 * AppCard.vue - Sprint 4 Component
 * 
 * Displays an app card using the unified apps store.
 * Replaces ServiceCard.vue with new API structure.
 */
import { computed, ref } from 'vue'
import { useAppsStore } from '@/stores/apps'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  app: {
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
const actionLoading = ref(false)

// Computed properties using apps store helpers
const displayName = computed(() => appsStore.getAppDisplayName(props.app))
const iconName = computed(() => appsStore.getAppIcon(props.app))
const running = computed(() => appsStore.isRunning(props.app))
const healthy = computed(() => appsStore.isHealthy(props.app))
const isCore = computed(() => appsStore.isCore(props.app))
const hasUI = computed(() => appsStore.hasWebUI(props.app))

const statusConfig = computed(() => {
  if (!running.value) {
    return { dot: 'bg-theme-muted', text: 'Stopped', class: 'text-theme-muted' }
  }
  if (!healthy.value) {
    return { dot: 'bg-warning', text: 'Unhealthy', class: 'text-warning', pulse: true }
  }
  return { dot: 'bg-success', text: 'Running', class: 'text-success' }
})

const appUrl = computed(() => {
  if (!hasUI.value) return null
  return appsStore.getAppUrl(props.app)
})

const imageName = computed(() => {
  const img = props.app.image || ''
  return img.split(':')[0].split('/').pop() || 'Container'
})

const displayPorts = computed(() => {
  const ports = props.app.ports || []
  return ports.filter(p => p.port).slice(0, 3).map(p => p.port)
})

const extraPortCount = computed(() => {
  const ports = props.app.ports || []
  return Math.max(0, ports.filter(p => p.port).length - 3)
})

function handleClick() {
  if (!running.value) return
  
  if (hasUI.value && appUrl.value) {
    window.open(appUrl.value, '_blank', 'noopener,noreferrer')
  } else {
    emit('showHealth', props.app)
  }
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
    if (action === 'start') await appsStore.startApp(props.app.name)
    else if (action === 'stop') await appsStore.stopApp(props.app.name)
    else if (action === 'restart') await appsStore.restartApp(props.app.name)
    await appsStore.fetchApps()
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div
    @click="handleClick"
    class="group relative bg-theme-card rounded-xl border border-theme-primary overflow-hidden transition-all duration-200 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5"
    :class="[
      { 'opacity-60': !running },
      running ? 'cursor-pointer' : 'cursor-default'
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
          <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <!-- Start -->
            <button
              v-if="!running && !isCore"
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
              v-if="running && !isCore"
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
              v-if="running && !isCore"
              @click="handleAction('restart', $event)"
              :disabled="actionLoading"
              class="p-1.5 text-theme-tertiary hover:text-warning hover:bg-warning-muted rounded-lg transition-colors"
              title="Restart"
            >
              <Icon name="RotateCw" :size="16" />
            </button>
          </div>
          
          <!-- Open link / Info icon -->
          <div
            v-if="running"
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
