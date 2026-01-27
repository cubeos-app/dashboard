<script setup>
import { computed } from 'vue'
import { useServicesStore } from '@/stores/services'

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

const displayName = computed(() => servicesStore.getServiceName(props.service.name))
const isRunning = computed(() => props.service.state === 'running')
const isHealthy = computed(() => props.service.health_status === 'healthy' || !props.service.health_status)

const statusColor = computed(() => {
  if (!isRunning.value) return 'bg-gray-400'
  if (!isHealthy.value) return 'bg-yellow-400'
  return 'bg-green-400'
})

const statusText = computed(() => {
  if (!isRunning.value) return 'Stopped'
  if (!isHealthy.value) return 'Unhealthy'
  return 'Running'
})

// Generate service URL
const serviceUrl = computed(() => {
  const name = props.service.name
    .replace('mulecube-', '')
    .replace('-', '')
  return `http://${name}.mulecube.net`
})

// Get emoji icon based on service name
const icon = computed(() => {
  const icons = {
    'kiwix': '📚',
    'open-webui': '🤖',
    'filebrowser': '📁',
    'vaultwarden': '🔐',
    'calibre-web': '📖',
    'syncthing': '🔄',
    'pihole': '🛡️',
    'uptime-kuma': '📊',
    'ollama': '🧠',
    'cryptpad': '📝',
    'excalidraw': '✏️',
    'element': '💬',
    'tileserver': '🗺️',
    'libretranslate': '🌐',
    'linkwarden': '🔗',
    'nginx-proxy': '🌐',
    'postgres': '🗄️',
    'valkey': '🔑',
    'default': '📦'
  }
  return icons[props.service.name] || icons.default
})
</script>

<template>
  <a
    :href="serviceUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="service-card block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-cube-400 dark:hover:border-cube-500"
    :class="{ 'opacity-60': !isRunning }"
  >
    <div class="p-4" :class="{ 'p-3': compact }">
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div 
          class="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl"
          :class="{ 'w-8 h-8 text-lg': compact }"
        >
          {{ icon }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 
              class="font-medium text-gray-900 dark:text-white truncate"
              :class="compact ? 'text-sm' : 'text-base'"
            >
              {{ displayName }}
            </h3>
            <!-- Status dot -->
            <span 
              class="flex-shrink-0 w-2 h-2 rounded-full"
              :class="[statusColor, { 'status-dot-online': isRunning && isHealthy }]"
              :title="statusText"
            ></span>
          </div>
          
          <!-- Description or status -->
          <p 
            v-if="!compact"
            class="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5"
          >
            {{ service.image?.split(':')[0] || 'Container' }}
          </p>
          <p 
            v-else
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ statusText }}
          </p>
        </div>

        <!-- Arrow -->
        <svg 
          v-if="isRunning"
          class="w-4 h-4 text-gray-400 flex-shrink-0" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </div>

    <!-- Port info (non-compact) -->
    <div 
      v-if="!compact && service.ports?.length > 0"
      class="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700"
    >
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Port{{ service.ports.length > 1 ? 's' : '' }}:</span>
        <span class="font-mono">
          {{ service.ports.slice(0, 3).map(p => p.public_port || p.private_port).join(', ') }}
          {{ service.ports.length > 3 ? `+${service.ports.length - 3}` : '' }}
        </span>
      </div>
    </div>
  </a>
</template>
