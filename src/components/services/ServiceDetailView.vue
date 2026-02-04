<script setup>
/**
 * ServiceDetailView.vue
 * 
 * Detailed view for a single app/service.
 * Sprint 4: Uses unified apps.js store.
 */
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import TorToggle from '@/components/swarm/TorToggle.vue'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()

const app = ref(null)
const logs = ref([])
const loading = ref(true)
const logsLoading = ref(false)
const actionLoading = ref(false)
const activeTab = ref('overview')

const appName = computed(() => route.params.name)

const displayName = computed(() => 
  app.value ? appsStore.getDisplayName(app.value) : appName.value
)

const iconName = computed(() => 
  app.value ? appsStore.getAppIcon(app.value) : 'Box'
)

const isRunning = computed(() => 
  app.value?.status?.running || app.value?.state === 'running'
)

const isHealthy = computed(() => {
  const health = app.value?.status?.health
  return health === 'healthy' || health === 'running' || !health
})

const isCore = computed(() => 
  app.value?.type === 'system' || app.value?.type === 'platform'
)

const serviceUrl = computed(() => 
  app.value ? appsStore.getAppUrl(app.value) : null
)

const hasWebUI = computed(() => 
  app.value ? appsStore.hasWebUI(app.value) : false
)

const status = computed(() => {
  if (!isRunning.value) return { text: 'Stopped', color: 'text-gray-500' }
  if (!isHealthy.value) return { text: 'Unhealthy', color: 'text-yellow-500' }
  return { text: 'Running', color: 'text-green-500' }
})

async function fetchApp() {
  loading.value = true
  try {
    const result = await appsStore.getApp(appName.value)
    if (result) {
      app.value = result
    } else {
      // Try to find in store
      app.value = appsStore.getAppByName(appName.value)
    }
  } catch (e) {
    console.error('Failed to fetch app:', e)
    app.value = appsStore.getAppByName(appName.value)
  } finally {
    loading.value = false
  }
}

async function fetchLogs() {
  logsLoading.value = true
  try {
    const result = await appsStore.getAppLogs(appName.value, 200)
    logs.value = result || []
  } catch (e) {
    console.error('Failed to fetch logs:', e)
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

async function handleAction(action) {
  if (action !== 'start' && !confirm(`Are you sure you want to ${action} ${displayName.value}?`)) return
  
  actionLoading.value = true
  try {
    if (action === 'start') await appsStore.startApp(appName.value)
    else if (action === 'stop') await appsStore.stopApp(appName.value)
    else if (action === 'restart') await appsStore.restartApp(appName.value)
    
    await fetchApp()
  } finally {
    actionLoading.value = false
  }
}

function openWebUI() {
  if (serviceUrl.value) {
    window.open(serviceUrl.value, '_blank')
  }
}

let refreshInterval = null

onMounted(async () => {
  // First try to get from store cache
  app.value = appsStore.getAppByName(appName.value)
  if (!app.value) {
    await appsStore.fetchApps()
    app.value = appsStore.getAppByName(appName.value)
  }
  loading.value = false
  
  if (isRunning.value) {
    await fetchLogs()
  }
  
  refreshInterval = setInterval(async () => {
    if (isRunning.value) {
      await appsStore.fetchApps()
      app.value = appsStore.getAppByName(appName.value)
    }
  }, 15000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Fetch logs when switching to logs tab
watch(activeTab, async (tab) => {
  if (tab === 'logs' && logs.value.length === 0 && isRunning.value) {
    await fetchLogs()
  }
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(1)} ${units[i]}`
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    <!-- Back button & header -->
    <div class="flex items-center gap-4">
      <button 
        @click="router.push('/services')"
        class="p-2 rounded-lg hover:bg-theme-tertiary transition-colors"
      >
        <Icon name="ChevronLeft" :size="20" class="text-theme-secondary" />
      </button>
      
      <div class="flex items-center gap-3 flex-1">
        <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center">
          <Icon :name="iconName" :size="24" class="text-theme-secondary" />
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-theme-primary">{{ displayName }}</h1>
          <p class="text-sm" :class="status.color">{{ status.text }}</p>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex items-center gap-2">
        <button
          v-if="hasWebUI && isRunning"
          @click="openWebUI"
          class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors flex items-center gap-2"
        >
          <Icon name="ExternalLink" :size="16" />
          Open
        </button>
        
        <button
          v-if="!isRunning && !isCore"
          @click="handleAction('start')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="Play" :size="16" />
          Start
        </button>
        
        <button
          v-if="isRunning && !isCore"
          @click="handleAction('restart')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="RotateCw" :size="16" />
          Restart
        </button>
        
        <button
          v-if="isRunning && !isCore"
          @click="handleAction('stop')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="Square" :size="16" />
          Stop
        </button>
      </div>
    </div>
    
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <Icon name="Loader2" :size="32" class="animate-spin text-accent" />
    </div>
    
    <!-- Content -->
    <div v-else-if="app" class="space-y-6">
      <!-- Tabs -->
      <div class="flex items-center gap-1 border-b border-theme-primary">
        <button
          v-for="tab in ['overview', 'logs', 'settings']"
          :key="tab"
          @click="activeTab = tab"
          class="px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px"
          :class="activeTab === tab 
            ? 'text-accent border-accent' 
            : 'text-theme-secondary border-transparent hover:text-theme-primary'"
        >
          {{ tab }}
        </button>
      </div>
      
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <!-- Info Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <p class="text-xs text-theme-muted mb-1">Type</p>
            <p class="font-medium text-theme-primary capitalize">{{ app.type || 'Unknown' }}</p>
          </div>
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <p class="text-xs text-theme-muted mb-1">Deploy Mode</p>
            <p class="font-medium text-theme-primary capitalize">{{ app.deploy_mode || 'Unknown' }}</p>
          </div>
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <p class="text-xs text-theme-muted mb-1">Health</p>
            <p class="font-medium" :class="isHealthy ? 'text-green-500' : 'text-yellow-500'">
              {{ app.status?.health || 'Unknown' }}
            </p>
          </div>
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <p class="text-xs text-theme-muted mb-1">Enabled</p>
            <p class="font-medium" :class="app.enabled ? 'text-green-500' : 'text-gray-500'">
              {{ app.enabled ? 'Yes' : 'No' }}
            </p>
          </div>
        </div>
        
        <!-- Ports -->
        <div v-if="app.ports?.length" class="p-4 rounded-xl bg-theme-card border border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-3">Ports</h3>
          <div class="flex flex-wrap gap-2">
            <span 
              v-for="port in app.ports" 
              :key="port.port"
              class="px-3 py-1.5 rounded-lg bg-theme-tertiary text-theme-primary font-mono text-sm"
            >
              {{ port.port }}{{ port.protocol ? `/${port.protocol}` : '' }}
              <span v-if="port.is_primary" class="ml-1 text-xs text-accent">(primary)</span>
            </span>
          </div>
        </div>
        
        <!-- FQDNs -->
        <div v-if="app.fqdns?.length" class="p-4 rounded-xl bg-theme-card border border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-3">Domain Names</h3>
          <div class="flex flex-wrap gap-2">
            <a 
              v-for="fqdn in app.fqdns" 
              :key="fqdn.fqdn"
              :href="`http://${fqdn.fqdn}`"
              target="_blank"
              class="px-3 py-1.5 rounded-lg bg-theme-tertiary text-accent hover:bg-accent/10 transition-colors text-sm flex items-center gap-2"
            >
              {{ fqdn.fqdn }}
              <Icon name="ExternalLink" :size="12" />
            </a>
          </div>
        </div>
        
        <!-- Description -->
        <div v-if="app.description" class="p-4 rounded-xl bg-theme-card border border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-2">Description</h3>
          <p class="text-theme-primary">{{ app.description }}</p>
        </div>
      </div>
      
      <!-- Logs Tab -->
      <div v-if="activeTab === 'logs'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-theme-secondary">Container Logs</h3>
          <button
            @click="fetchLogs"
            :disabled="logsLoading"
            class="px-3 py-1.5 rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors text-sm flex items-center gap-2"
          >
            <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': logsLoading }" />
            Refresh
          </button>
        </div>
        
        <div class="bg-gray-900 rounded-xl p-4 max-h-[500px] overflow-auto">
          <pre 
            v-if="logs.length > 0"
            class="text-xs font-mono text-gray-300 whitespace-pre-wrap"
          >{{ logs.join('\n') }}</pre>
          <p v-else-if="logsLoading" class="text-gray-500 italic">Loading logs...</p>
          <p v-else class="text-gray-500 italic">No logs available</p>
        </div>
      </div>
      
      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="space-y-6">
        <!-- Tor Routing -->
        <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-3">Privacy</h3>
          <TorToggle :app-name="app.name" :model-value="app.tor_enabled" />
        </div>
        
        <!-- Danger Zone -->
        <div v-if="!isCore" class="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <h3 class="text-sm font-medium text-red-500 mb-3">Danger Zone</h3>
          <p class="text-sm text-theme-muted mb-4">
            Uninstalling this app will remove it from your system. Data may be preserved depending on your settings.
          </p>
          <button
            class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
          >
            Uninstall App
          </button>
        </div>
      </div>
    </div>
    
    <!-- Not Found -->
    <div v-else class="text-center py-16">
      <Icon name="AlertCircle" :size="48" class="mx-auto text-theme-muted mb-4" />
      <h2 class="text-xl font-semibold text-theme-primary mb-2">App Not Found</h2>
      <p class="text-theme-muted mb-4">The app "{{ appName }}" could not be found.</p>
      <button
        @click="router.push('/services')"
        class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors"
      >
        Back to Services
      </button>
    </div>
  </div>
</template>
