<script setup>
/**
 * StackList.vue
 * 
 * Lists Docker Swarm stacks with expandable service details.
 * Shows stack name, service count, health status, and allows
 * expanding to see individual services.
 * 
 * Sprint 4: S4-04
 */

import { ref, computed } from 'vue'
import { useAppsStore, APP_TYPES, DEPLOY_MODES, HEALTH_STATUS } from '@/stores/apps'
import { useRouter } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const appsStore = useAppsStore()

// Expanded stacks state
const expandedStacks = ref(new Set())

// Group apps by stack
const stacks = computed(() => {
  const stackMap = new Map()
  
  for (const app of appsStore.apps) {
    // Use stack_name if available, otherwise use app name as stack name
    const stackName = app.stack_name || app.name
    
    if (!stackMap.has(stackName)) {
      stackMap.set(stackName, {
        name: stackName,
        deployMode: app.deploy_mode,
        services: [],
        healthyCount: 0,
        runningCount: 0
      })
    }
    
    const stack = stackMap.get(stackName)
    stack.services.push(app)
    
    if (app.status?.running) {
      stack.runningCount++
    }
    
    if (appsStore.isHealthy(app)) {
      stack.healthyCount++
    }
  }
  
  // Convert to array and sort
  return Array.from(stackMap.values())
    .sort((a, b) => {
      // System and platform first
      const aIsCore = a.services.some(s => 
        s.type === APP_TYPES.SYSTEM || s.type === APP_TYPES.PLATFORM
      )
      const bIsCore = b.services.some(s => 
        s.type === APP_TYPES.SYSTEM || s.type === APP_TYPES.PLATFORM
      )
      if (aIsCore && !bIsCore) return -1
      if (!aIsCore && bIsCore) return 1
      return a.name.localeCompare(b.name)
    })
})

// Toggle stack expansion
function toggleStack(stackName) {
  if (expandedStacks.value.has(stackName)) {
    expandedStacks.value.delete(stackName)
  } else {
    expandedStacks.value.add(stackName)
  }
}

// Check if stack is expanded
function isExpanded(stackName) {
  return expandedStacks.value.has(stackName)
}

// Get stack health status
function getStackHealth(stack) {
  if (stack.services.length === 0) return 'unknown'
  if (stack.healthyCount === stack.services.length) return 'healthy'
  if (stack.healthyCount === 0) return 'unhealthy'
  return 'partial'
}

// Get health indicator classes
function getHealthClasses(stack) {
  const health = getStackHealth(stack)
  switch (health) {
    case 'healthy': return 'bg-green-500'
    case 'unhealthy': return 'bg-red-500'
    case 'partial': return 'bg-yellow-500'
    default: return 'bg-gray-500'
  }
}

// Navigate to service detail
function viewService(app) {
  router.push(`/services/${app.name}`)
}

// Get icon for service
function getServiceIcon(app) {
  return appsStore.getAppIcon(app)
}

// Get display name for service
function getDisplayName(app) {
  return appsStore.getDisplayName(app)
}

// Get URL for service (if has web UI)
function getServiceUrl(app) {
  return appsStore.getAppUrl(app)
}

// Format deploy mode label
function formatDeployMode(mode) {
  if (mode === DEPLOY_MODES.STACK) return 'Swarm Stack'
  if (mode === DEPLOY_MODES.COMPOSE) return 'Compose'
  return mode || 'Unknown'
}

// No lifecycle polling — parent view (ServicesView) handles centralized polling
</script>

<template>
  <div class="space-y-3">
    <!-- Stack Cards -->
    <div
      v-for="stack in stacks"
      :key="stack.name"
      class="bg-theme-secondary rounded-xl border border-theme-primary overflow-hidden"
    >
      <!-- Stack Header (clickable) -->
      <button
        @click="toggleStack(stack.name)"
        class="w-full flex items-center justify-between p-4 hover:bg-theme-tertiary/50 transition-colors"
      >
        <div class="flex items-center gap-3">
          <!-- Health indicator -->
          <span class="w-2.5 h-2.5 rounded-full" :class="getHealthClasses(stack)"></span>
          
          <!-- Stack name and mode -->
          <div class="text-left">
            <h3 class="text-sm font-medium text-theme-primary">{{ stack.name }}</h3>
            <span class="text-xs text-theme-muted">{{ formatDeployMode(stack.deployMode) }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <!-- Service count -->
          <div class="text-right">
            <span class="text-sm font-medium text-theme-primary">
              {{ stack.runningCount }}/{{ stack.services.length }}
            </span>
            <span class="text-xs text-theme-muted ml-1">running</span>
          </div>
          
          <!-- Expand icon -->
          <Icon 
            :name="isExpanded(stack.name) ? 'ChevronUp' : 'ChevronDown'" 
            :size="18" 
            class="text-theme-muted"
          />
        </div>
      </button>
      
      <!-- Expanded Services List -->
      <div
        v-if="isExpanded(stack.name)"
        class="border-t border-theme-primary bg-theme-tertiary/30"
      >
        <div
          v-for="service in stack.services"
          :key="service.name"
          class="flex items-center justify-between px-4 py-3 border-b border-theme-primary last:border-b-0 hover:bg-theme-tertiary/50 transition-colors"
        >
          <div class="flex items-center gap-3">
            <!-- Service icon -->
            <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
              <Icon :name="getServiceIcon(service)" :size="16" class="text-theme-secondary" />
            </div>
            
            <!-- Service info -->
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-theme-primary">{{ getDisplayName(service) }}</span>
                <span 
                  v-if="service.status?.health"
                  class="px-1.5 py-0.5 text-[10px] font-medium rounded"
                  :class="{
                    'bg-green-500/20 text-green-400': service.status.health === 'healthy' || service.status.health === 'running',
                    'bg-red-500/20 text-red-400': service.status.health === 'unhealthy',
                    'bg-yellow-500/20 text-yellow-400': service.status.health === 'starting',
                    'bg-gray-500/20 text-gray-400': service.status.health === 'stopped' || service.status.health === 'unknown'
                  }"
                >
                  {{ service.status.health }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs text-theme-muted">
                <span>{{ service.name }}</span>
                <span v-if="service.ports?.length">
                  · Port {{ service.ports[0]?.port }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-2">
            <!-- Open Web UI -->
            <a
              v-if="getServiceUrl(service)"
              :href="getServiceUrl(service)"
              target="_blank"
              rel="noopener"
              class="p-2 rounded-lg hover:bg-theme-tertiary text-theme-muted hover:text-theme-primary transition-colors"
              title="Open Web UI"
              @click.stop
            >
              <Icon name="ExternalLink" :size="16" />
            </a>
            
            <!-- View Details -->
            <button
              @click.stop="viewService(service)"
              class="p-2 rounded-lg hover:bg-theme-tertiary text-theme-muted hover:text-theme-primary transition-colors"
              title="View Details"
            >
              <Icon name="Info" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div
      v-if="stacks.length === 0 && !appsStore.loading"
      class="text-center py-12"
    >
      <Icon name="Container" :size="48" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Stacks Found</h3>
      <p class="text-sm text-theme-muted">No Docker Swarm stacks are currently deployed.</p>
    </div>
    
    <!-- Loading State -->
    <div
      v-if="appsStore.loading && stacks.length === 0"
      class="text-center py-12"
    >
      <Icon name="Loader2" :size="32" class="mx-auto text-accent animate-spin mb-4" />
      <p class="text-sm text-theme-muted">Loading stacks...</p>
    </div>
  </div>
</template>
