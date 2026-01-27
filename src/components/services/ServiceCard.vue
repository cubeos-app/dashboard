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
const iconPath = computed(() => servicesStore.getServiceIcon(props.service.name))
const isRunning = computed(() => props.service.state === 'running')
const isHealthy = computed(() => props.service.health_status === 'healthy' || !props.service.health_status)

const statusColor = computed(() => {
  if (!isRunning.value) return 'bg-gray-500'
  if (!isHealthy.value) return 'bg-amber-400'
  return 'bg-emerald-400'
})

const statusText = computed(() => {
  if (!isRunning.value) return 'Stopped'
  if (!isHealthy.value) return 'Unhealthy'
  return 'Running'
})

const serviceUrl = computed(() => {
  const name = props.service.name
    .replace('mulecube-', '')
    .replace(/-/g, '')
  return `http://${name}.mulecube.net`
})
</script>

<template>
  <a
    :href="serviceUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="service-card block bg-[#161b22] rounded-xl border border-gray-800 overflow-hidden hover:border-[#2dd4bf]/50 transition-all"
    :class="{ 'opacity-50': !isRunning }"
  >
    <div class="p-4" :class="{ 'p-3': compact }">
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div 
          class="flex-shrink-0 w-10 h-10 rounded-lg bg-[#0d1117] border border-gray-800 flex items-center justify-center"
          :class="{ 'w-8 h-8': compact }"
        >
          <svg 
            class="w-5 h-5 text-gray-400" 
            :class="{ 'w-4 h-4': compact }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            v-html="iconPath"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 
              class="font-medium text-white truncate"
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
          
          <p 
            class="text-gray-500 truncate"
            :class="compact ? 'text-xs' : 'text-sm mt-0.5'"
          >
            {{ compact ? statusText : (service.image?.split(':')[0] || 'Container') }}
          </p>
        </div>

        <!-- Arrow -->
        <svg 
          v-if="isRunning"
          class="w-4 h-4 text-gray-600 flex-shrink-0" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </div>

    <!-- Port info (non-compact) -->
    <div 
      v-if="!compact && service.ports?.length > 0"
      class="px-4 py-2 bg-[#0d1117] border-t border-gray-800"
    >
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <span>Port{{ service.ports.length > 1 ? 's' : '' }}:</span>
        <span class="font-mono">
          {{ service.ports.slice(0, 3).map(p => p.public_port || p.private_port).join(', ') }}
          {{ service.ports.length > 3 ? `+${service.ports.length - 3}` : '' }}
        </span>
      </div>
    </div>
  </a>
</template>
