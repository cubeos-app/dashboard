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
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import TorToggle from '@/components/swarm/TorToggle.vue'
import Icon from '@/components/ui/Icon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()
const { signal } = useAbortOnUnmount()

const app = ref(null)
const logs = ref([])
const loading = ref(true)
const logsLoading = ref(false)
const actionLoading = ref(false)
const activeTab = ref('overview')
const dockerLoading = ref(false)
const dockerDetail = ref(null)

// Uninstall confirmation
const showUninstallConfirm = ref(false)

async function handleUninstall() {
  showUninstallConfirm.value = false
  actionLoading.value = true
  try {
    await appsStore.uninstallApp(appName.value)
    router.push('/apps')
  } finally {
    actionLoading.value = false
  }
}

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
  if (!health) return null  // Unknown state — don't mask as healthy
  return health === 'healthy' || health === 'running'
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
  if (!isRunning.value) return { text: 'Stopped', color: 'text-neutral' }
  if (isHealthy.value === false) return { text: 'Unhealthy', color: 'text-warning' }
  if (isHealthy.value === null) return { text: 'Running', color: 'text-success' }
  return { text: 'Running', color: 'text-success' }
})

async function fetchApp() {
  loading.value = true
  try {
    const result = await appsStore.getApp(appName.value, { signal: signal() })
    if (result) {
      app.value = result
    } else {
      // Try to find in store
      app.value = appsStore.getAppByName(appName.value)
    }
  } catch (e) {
    app.value = appsStore.getAppByName(appName.value)
  } finally {
    loading.value = false
  }
}

async function fetchLogs() {
  logsLoading.value = true
  try {
    const result = await appsStore.getAppLogs(appName.value, 200, { signal: signal() })
    logs.value = result || []
  } catch (e) {
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

async function handleAction(action) {
  if (action !== 'start' && !await confirm({
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName.value}?`,
    message: `Are you sure you want to ${action} ${displayName.value}?`,
    confirmText: action.charAt(0).toUpperCase() + action.slice(1),
    variant: action === 'stop' ? 'danger' : 'warning'
  })) return
  
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

onMounted(async () => {
  // First try to get from store cache
  app.value = appsStore.getAppByName(appName.value)
  if (!app.value) {
    await appsStore.fetchApps({ signal: signal() })
    app.value = appsStore.getAppByName(appName.value)
  }
  loading.value = false
  
  if (isRunning.value) {
    await fetchLogs()
  }
  
  // Use centralized polling
  appsStore.startPolling()
})

onUnmounted(() => {
  appsStore.stopPolling()
})

// Sync local app ref when store data updates from polling
// Shallow watch is sufficient — polling replaces the apps array reference
watch(() => appsStore.apps, () => {
  const updated = appsStore.getAppByName(appName.value)
  if (updated) {
    app.value = updated
  }
})

// Fetch logs when switching to logs tab
watch(activeTab, async (tab) => {
  if (tab === 'logs' && logs.value.length === 0 && isRunning.value) {
    await fetchLogs()
  }
  if (tab === 'docker' && !dockerDetail.value) {
    await fetchDockerDetail()
  }
})

async function fetchDockerDetail() {
  dockerLoading.value = true
  try {
    const result = await api.get(`/services/${encodeURIComponent(appName.value)}`)
    dockerDetail.value = result
  } catch (e) {
    dockerDetail.value = null
  } finally {
    dockerLoading.value = false
  }
}

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
        @click="router.push('/apps')"
        aria-label="Back to apps"
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
          class="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-secondary transition-colors flex items-center gap-2"
        >
          <Icon name="ExternalLink" :size="16" />
          Open
        </button>
        
        <button
          v-if="!isRunning && !isCore"
          @click="handleAction('start')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg btn-success text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="Play" :size="16" />
          Start
        </button>
        
        <button
          v-if="isRunning && !isCore"
          @click="handleAction('restart')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg btn-warning text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="RotateCw" :size="16" />
          Restart
        </button>
        
        <button
          v-if="isRunning && !isCore"
          @click="handleAction('stop')"
          :disabled="actionLoading"
          class="px-4 py-2 rounded-lg btn-error text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
      <div class="flex items-center gap-1 border-b border-theme-primary" role="tablist" aria-label="Service details">
        <button
          v-for="tab in ['overview', 'logs', 'docker', 'settings']"
          :key="tab"
          @click="activeTab = tab"
          role="tab"
          :aria-selected="activeTab === tab"
          :aria-controls="'panel-' + tab"
          class="px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px"
          :class="activeTab === tab 
            ? 'text-accent border-accent' 
            : 'text-theme-secondary border-transparent hover:text-theme-primary'"
        >
          {{ tab }}
        </button>
      </div>
      
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" id="panel-overview" role="tabpanel" class="space-y-6">
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
            <p class="font-medium" :class="isHealthy ? 'text-success' : 'text-warning'">
              {{ app.status?.health || 'Unknown' }}
            </p>
          </div>
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <p class="text-xs text-theme-muted mb-1">Enabled</p>
            <p class="font-medium" :class="app.enabled ? 'text-success' : 'text-neutral'">
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
      <div v-if="activeTab === 'logs'" id="panel-logs" role="tabpanel" class="space-y-4">
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
        
        <div class="bg-code rounded-xl p-4 max-h-[500px] overflow-auto">
          <pre 
            v-if="logs.length > 0"
            class="text-xs font-mono text-code whitespace-pre-wrap"
          >{{ logs.join('\n') }}</pre>
          <p v-else-if="logsLoading" class="text-code-muted italic">Loading logs...</p>
          <p v-else class="text-code-muted italic">No logs available</p>
        </div>
      </div>
      
      <!-- Docker Tab -->
      <div v-if="activeTab === 'docker'" id="panel-docker" role="tabpanel" class="space-y-6">
        <!-- Loading -->
        <div v-if="dockerLoading" class="flex items-center justify-center py-12">
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>

        <!-- Docker Detail -->
        <template v-else-if="dockerDetail">
          <!-- Container Info -->
          <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
            <h3 class="text-sm font-medium text-theme-secondary mb-3">Container Info</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="dockerDetail.container_id">
                <p class="text-xs text-theme-muted mb-1">Container ID</p>
                <p class="font-mono text-sm text-theme-primary break-all">{{ dockerDetail.container_id }}</p>
              </div>
              <div v-if="dockerDetail.image">
                <p class="text-xs text-theme-muted mb-1">Image</p>
                <p class="font-mono text-sm text-theme-primary break-all">{{ dockerDetail.image }}</p>
              </div>
              <div v-if="dockerDetail.created">
                <p class="text-xs text-theme-muted mb-1">Created</p>
                <p class="text-sm text-theme-primary">{{ new Date(dockerDetail.created).toLocaleString() }}</p>
              </div>
              <div v-if="dockerDetail.updated_at || dockerDetail.updated">
                <p class="text-xs text-theme-muted mb-1">Updated</p>
                <p class="text-sm text-theme-primary">{{ new Date(dockerDetail.updated_at || dockerDetail.updated).toLocaleString() }}</p>
              </div>
              <div v-if="dockerDetail.mode || dockerDetail.deploy_mode">
                <p class="text-xs text-theme-muted mb-1">Deploy Mode</p>
                <p class="text-sm text-theme-primary capitalize">{{ dockerDetail.mode || dockerDetail.deploy_mode }}</p>
              </div>
              <div v-if="dockerDetail.replicas !== undefined">
                <p class="text-xs text-theme-muted mb-1">Replicas</p>
                <p class="text-sm text-theme-primary">{{ dockerDetail.replicas_running ?? dockerDetail.replicas }} / {{ dockerDetail.replicas }}</p>
              </div>
            </div>
          </div>

          <!-- Resource Limits -->
          <div 
            v-if="dockerDetail.resources || dockerDetail.limits" 
            class="p-4 rounded-xl bg-theme-card border border-theme-primary"
          >
            <h3 class="text-sm font-medium text-theme-secondary mb-3">Resource Limits</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="(dockerDetail.resources?.limits?.memory || dockerDetail.limits?.memory)">
                <p class="text-xs text-theme-muted mb-1">Memory Limit</p>
                <p class="text-sm text-theme-primary">{{ dockerDetail.resources?.limits?.memory || dockerDetail.limits?.memory }}</p>
              </div>
              <div v-if="(dockerDetail.resources?.limits?.cpus || dockerDetail.limits?.cpus)">
                <p class="text-xs text-theme-muted mb-1">CPU Limit</p>
                <p class="text-sm text-theme-primary">{{ dockerDetail.resources?.limits?.cpus || dockerDetail.limits?.cpus }}</p>
              </div>
              <div v-if="(dockerDetail.resources?.reservations?.memory || dockerDetail.reservations?.memory)">
                <p class="text-xs text-theme-muted mb-1">Memory Reservation</p>
                <p class="text-sm text-theme-primary">{{ dockerDetail.resources?.reservations?.memory || dockerDetail.reservations?.memory }}</p>
              </div>
              <div v-if="(dockerDetail.resources?.reservations?.cpus || dockerDetail.reservations?.cpus)">
                <p class="text-xs text-theme-muted mb-1">CPU Reservation</p>
                <p class="text-sm text-theme-primary">{{ dockerDetail.resources?.reservations?.cpus || dockerDetail.reservations?.cpus }}</p>
              </div>
            </div>
          </div>

          <!-- Docker Labels -->
          <div 
            v-if="dockerDetail.labels && Object.keys(dockerDetail.labels).length > 0" 
            class="p-4 rounded-xl bg-theme-card border border-theme-primary"
          >
            <h3 class="text-sm font-medium text-theme-secondary mb-3">Docker Labels</h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <div 
                v-for="(value, key) in dockerDetail.labels" 
                :key="key"
                class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-1.5 border-b border-theme-secondary last:border-0"
              >
                <span class="font-mono text-xs text-accent shrink-0 break-all">{{ key }}</span>
                <span class="font-mono text-xs text-theme-primary break-all">{{ value }}</span>
              </div>
            </div>
          </div>

          <!-- Networks -->
          <div 
            v-if="dockerDetail.networks?.length" 
            class="p-4 rounded-xl bg-theme-card border border-theme-primary"
          >
            <h3 class="text-sm font-medium text-theme-secondary mb-3">Networks</h3>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="net in dockerDetail.networks" 
                :key="typeof net === 'string' ? net : net.name"
                class="px-3 py-1.5 rounded-lg bg-theme-tertiary text-theme-primary font-mono text-sm"
              >
                {{ typeof net === 'string' ? net : net.name }}
              </span>
            </div>
          </div>

          <!-- Volumes / Mounts -->
          <div 
            v-if="dockerDetail.mounts?.length || dockerDetail.volumes?.length" 
            class="p-4 rounded-xl bg-theme-card border border-theme-primary"
          >
            <h3 class="text-sm font-medium text-theme-secondary mb-3">Mounts</h3>
            <div class="space-y-2">
              <div 
                v-for="(mount, idx) in (dockerDetail.mounts || dockerDetail.volumes)" 
                :key="idx"
                class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5 border-b border-theme-secondary last:border-0"
              >
                <span class="font-mono text-xs text-theme-primary break-all">{{ mount.source || mount.name }}</span>
                <Icon name="ArrowRight" :size="12" class="text-theme-muted hidden sm:block shrink-0" />
                <span class="font-mono text-xs text-theme-muted break-all">{{ mount.target || mount.destination }}</span>
                <span 
                  v-if="mount.read_only || mount.readonly" 
                  class="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning"
                >RO</span>
              </div>
            </div>
          </div>
        </template>

        <!-- No Docker Data -->
        <div v-else class="text-center py-12">
          <Icon name="Container" :size="32" class="mx-auto text-theme-muted mb-3" />
          <p class="text-theme-muted text-sm">Docker service details are not available for this app.</p>
          <button
            @click="fetchDockerDetail"
            class="mt-3 px-4 py-2 rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
      
      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" id="panel-settings" role="tabpanel" class="space-y-6">
        <!-- Tor Routing -->
        <div class="p-4 rounded-xl bg-theme-card border border-theme-primary">
          <h3 class="text-sm font-medium text-theme-secondary mb-3">Privacy</h3>
          <TorToggle :app-name="app.name" :model-value="app.tor_enabled" />
        </div>
        
        <!-- Danger Zone -->
        <div v-if="!isCore" class="p-4 rounded-xl bg-error-muted border border-error-subtle">
          <h3 class="text-sm font-medium text-error mb-3">Danger Zone</h3>
          <p class="text-sm text-theme-muted mb-4">
            Uninstalling this app will remove it from your system. Data may be preserved depending on your settings.
          </p>
          <button
            @click="showUninstallConfirm = true"
            class="px-4 py-2 rounded-lg btn-error text-sm font-medium transition-colors"
          >
            Uninstall App
          </button>
        </div>
      </div>
      
      <!-- Uninstall Confirmation -->
      <ConfirmDialog
        :show="showUninstallConfirm"
        title="Uninstall App"
        :message="`This will remove ${displayName} from your system. Data may be preserved depending on your settings.`"
        confirm-text="Uninstall"
        variant="danger"
        @confirm="handleUninstall"
        @cancel="showUninstallConfirm = false"
      />
    </div>
    
    <!-- Not Found -->
    <div v-else class="text-center py-16">
      <Icon name="AlertCircle" :size="48" class="mx-auto text-theme-muted mb-4" />
      <h2 class="text-xl font-semibold text-theme-primary mb-2">App Not Found</h2>
      <p class="text-theme-muted mb-4">The app "{{ appName }}" could not be found.</p>
      <button
        @click="router.push('/apps')"
        class="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-secondary transition-colors"
      >
        Back to Apps
      </button>
    </div>
  </div>
</template>
