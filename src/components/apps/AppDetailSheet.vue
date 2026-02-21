<script setup>
/**
 * AppDetailSheet.vue — S04 Component
 *
 * Slide-over detail panel (not a separate route).
 * Adapts based on whether the app is:
 *   - A store catalog app (shows description, screenshots, install button)
 *   - An installed/running app (shows status, logs, restart, Docker info)
 *
 * Standard: status, logs snippet, restart, open UI.
 * Advanced: + full Docker inspect, Compose YAML, resource limits.
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppsStore } from '@/stores/apps'
import { useAppStoreStore } from '@/stores/appstore'
import { useMode } from '@/composables/useMode'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm, confirmState } from '@/utils/confirmDialog'
import { makePlaceholder } from '@/utils/domain'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  app: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'install'])

const appsStore = useAppsStore()
const appStoreStore = useAppStoreStore()
const { isAdvanced } = useMode()
const { signal } = useAbortOnUnmount()

const sheetRef = ref(null)

// ─── Detect app type ─────────────────────────────────────────
// Store catalog apps have store_id or title.en_us
// Installed/running apps have status.running or deploy_mode
// Registry apps have _source === 'registry'
const isRegistryApp = computed(() => props.app?._source === 'registry')

const isCatalogApp = computed(() => {
  if (!props.app) return false
  return !!(props.app.store_id || props.app.title?.en_us || props.app.title?.en_US)
    && !props.app.deploy_mode
    && !props.app.status
})

const isInstalledApp = computed(() => !isCatalogApp.value)

// ─── Catalog app computed ────────────────────────────────────
const catalogTitle = computed(() =>
  props.app.title?.en_us || props.app.title?.en_US || props.app.name || ''
)
const catalogDescription = computed(() =>
  props.app.description?.en_us || props.app.description?.en_US || ''
)
const catalogTagline = computed(() =>
  props.app.tagline?.en_us || props.app.tagline?.en_US || ''
)
const catalogStoreId = computed(() =>
  props.app.store_id || props.app.id?.split('/')[0] || ''
)
const catalogAppName = computed(() =>
  props.app.name || props.app.id?.split('/')[1] || ''
)

// ─── Registry app computed ────────────────────────────────────
const registryImageName = computed(() => props.app?._imageName || '')
const registryTag = computed(() => props.app?._tag || 'latest')
const registryFqdn = computed(() => {
  const name = catalogAppName.value || registryImageName.value.split('/').pop() || ''
  const clean = name.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
  return clean ? `${clean}.cubeos.cube` : ''
})

// Screenshots
const screenshots = computed(() => {
  const count = props.app.screenshot_count || props.app.screenshots?.length || 0
  if (catalogStoreId.value && catalogAppName.value && count > 0) {
    return Array.from(
      { length: count },
      (_, i) => appStoreStore.getAppScreenshotUrl(catalogStoreId.value, catalogAppName.value, i)
    )
  }
  return props.app.screenshots || []
})
const failedScreenshots = ref(new Set())
const visibleScreenshots = computed(() =>
  screenshots.value
    .map((url, index) => ({ url, index }))
    .filter(s => !failedScreenshots.value.has(s.index))
)

// ARM64 badge
function isArmArch(arch) {
  const lower = (arch || '').toLowerCase()
  return lower === 'arm64' || lower === 'aarch64'
}

// Install options (Advanced)
const showInstallOptions = ref(false)
const installPort = ref('')
const installFqdn = ref('')

function handleInstallClick() {
  if (isAdvanced.value && !showInstallOptions.value) {
    showInstallOptions.value = true
    return
  }
  const options = {}
  if (installPort.value) options.port = parseInt(installPort.value, 10)
  if (installFqdn.value) options.fqdn = installFqdn.value
  emit('install', catalogStoreId.value, catalogAppName.value, options)
}

function handleQuickInstall() {
  emit('install', catalogStoreId.value, catalogAppName.value, {})
}

// ─── Installed app state ─────────────────────────────────────
const displayName = computed(() =>
  isInstalledApp.value ? appsStore.getAppDisplayName(props.app) : catalogTitle.value
)
const iconName = computed(() => {
  if (isRegistryApp.value) return 'HardDrive'
  return isInstalledApp.value ? appsStore.getAppIcon(props.app) : 'Package'
})
const isRunning = computed(() => appsStore.isRunning(props.app))
const isHealthy = computed(() => appsStore.isHealthy(props.app))
const isCore = computed(() => appsStore.isCore(props.app))
const hasWebUI = computed(() => appsStore.hasWebUI(props.app))
const appUrl = computed(() => appsStore.getAppUrl(props.app))

// Logs
const logs = ref([])
const logsLoading = ref(false)

async function fetchLogs() {
  if (!isInstalledApp.value || !isRunning.value) return
  logsLoading.value = true
  try {
    const result = await appsStore.getAppLogs(props.app.name, 50, { signal: signal() })
    logs.value = result || []
  } catch (e) {
    if (e.name !== 'AbortError') logs.value = []
  } finally {
    logsLoading.value = false
  }
}

// Docker detail (Advanced only)
const dockerDetail = ref(null)
const dockerLoading = ref(false)

async function fetchDockerDetail() {
  if (!isInstalledApp.value) return
  dockerLoading.value = true
  try {
    dockerDetail.value = await api.get(`/services/${encodeURIComponent(props.app.name)}`)
  } catch {
    dockerDetail.value = null
  } finally {
    dockerLoading.value = false
  }
}

// Actions
const actionLoading = ref(false)

async function handleAction(action) {
  if (action !== 'start' && !await confirm({
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName.value}?`,
    message: `Are you sure you want to ${action} ${displayName.value}?`,
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

async function handleUninstall() {
  if (!await confirm({
    title: 'Uninstall App',
    message: `This will stop and remove ${displayName.value} from your system.`,
    confirmText: 'Uninstall',
    variant: 'danger',
    checkboxLabel: 'Also delete app data',
    checkboxDefault: true
  })) return

  actionLoading.value = true
  try {
    await appsStore.uninstallApp(props.app.name, !confirmState.checkboxChecked)
    emit('close')
  } finally {
    actionLoading.value = false
  }
}

function openWebUI() {
  if (appUrl.value) window.open(appUrl.value, '_blank', 'noopener,noreferrer')
}

// ─── Active tab (installed apps) ─────────────────────────────
const activeDetailTab = ref('overview')

watch(activeDetailTab, (tab) => {
  if (tab === 'logs' && logs.value.length === 0) fetchLogs()
  if (tab === 'docker' && !dockerDetail.value && isAdvanced.value) fetchDockerDetail()
})

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  sheetRef.value?.focus()
  if (isInstalledApp.value && isRunning.value) {
    fetchLogs()
  }
})

function handleClose() {
  emit('close')
}
</script>

<template>
  <!-- Slide-over sheet -->
  <div
    ref="sheetRef"
    class="fixed inset-0 z-50 flex justify-end"
    role="dialog"
    aria-modal="true"
    :aria-label="displayName + ' details'"
    tabindex="-1"
    @keydown.escape="handleClose"
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"
      @click="handleClose"
    ></div>

    <!-- Sheet Panel -->
    <div class="relative w-full max-w-lg h-full bg-theme-card border-l border-theme-primary shadow-theme-xl overflow-hidden flex flex-col animate-slide-in-right">
      <!-- Header -->
      <div class="flex items-start gap-4 p-5 border-b border-theme-primary flex-shrink-0">
        <!-- App Icon -->
        <div class="w-14 h-14 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
          <img
            v-if="isCatalogApp && app?.icon"
            :src="app.icon"
            :alt="displayName"
            class="w-10 h-10 rounded-lg object-contain"
          />
          <Icon v-else :name="iconName" :size="28" class="text-theme-secondary" :stroke-width="1.5" />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-theme-primary truncate">{{ displayName }}</h2>
            <span
              v-if="isInstalledApp && isRunning"
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :class="isHealthy ? 'bg-success' : 'bg-warning animate-pulse-status'"
            ></span>
          </div>
          <p v-if="isCatalogApp && catalogTagline" class="text-sm text-theme-secondary mt-0.5">
            {{ catalogTagline }}
          </p>
          <p v-else-if="isInstalledApp" class="text-sm mt-0.5" :class="isRunning ? 'text-success' : 'text-theme-muted'">
            {{ isRunning ? 'Running' : 'Stopped' }}
            <template v-if="isAdvanced && app.deploy_mode">
              <span class="text-theme-muted"> · </span>
              <span class="text-theme-secondary capitalize">{{ app.deploy_mode }}</span>
            </template>
          </p>
          <!-- Meta row -->
          <div v-if="isCatalogApp" class="flex items-center gap-3 mt-2 text-xs text-theme-muted">
            <span v-if="isRegistryApp" class="flex items-center gap-1 text-success">
              <Icon name="HardDrive" :size="12" />
              Local Registry
            </span>
            <span v-if="isRegistryApp && registryImageName" class="flex items-center gap-1 font-mono">
              {{ registryImageName }}:{{ registryTag }}
            </span>
            <span v-if="!isRegistryApp && app.category" class="flex items-center gap-1">
              <Icon name="Folder" :size="12" />
              {{ app.category }}
            </span>
            <span v-if="!isRegistryApp && app.version" class="flex items-center gap-1">
              <Icon name="Tag" :size="12" />
              v{{ app.version }}
            </span>
            <span v-if="!isRegistryApp && app.author" class="flex items-center gap-1">
              <Icon name="User" :size="12" />
              {{ app.author }}
            </span>
          </div>
        </div>

        <!-- Close -->
        <button
          @click="handleClose"
          aria-label="Close"
          class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon name="X" :size="18" />
        </button>
      </div>

      <!-- ═══ Catalog App Content ═══ -->
      <div v-if="isCatalogApp" class="overflow-y-auto flex-1">

        <!-- Registry App Info (no screenshots/manifest for registry apps) -->
        <template v-if="isRegistryApp">
          <div class="p-5 space-y-4">
            <!-- Offline badge -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-muted text-success text-sm font-medium">
              <Icon name="HardDrive" :size="14" />
              Cached locally — available offline
            </div>

            <!-- Image info card -->
            <div class="p-4 rounded-xl bg-theme-tertiary space-y-3">
              <div>
                <p class="text-xs text-theme-muted mb-1">Docker Image</p>
                <p class="font-mono text-sm text-theme-primary">{{ registryImageName }}</p>
              </div>
              <div>
                <p class="text-xs text-theme-muted mb-1">Tag</p>
                <p class="font-mono text-sm text-theme-primary">{{ registryTag }}</p>
              </div>
              <div v-if="registryFqdn">
                <p class="text-xs text-theme-muted mb-1">FQDN (after install)</p>
                <p class="font-mono text-sm text-accent">{{ registryFqdn }}</p>
              </div>
            </div>

            <!-- Description -->
            <div>
              <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">About</h3>
              <p class="text-sm text-theme-secondary leading-relaxed">
                This Docker image is cached in the local registry and can be deployed as a Swarm service without an internet connection.
                A port will be allocated automatically and DNS/proxy will be configured.
              </p>
            </div>

            <!-- Data directory note -->
            <div class="p-3 rounded-lg bg-theme-secondary/50 text-xs text-theme-muted">
              <Icon name="Info" :size="12" class="inline mr-1" />
              App data will be stored in <code class="bg-theme-tertiary px-1 py-0.5 rounded">/cubeos/data/apps/{name}/data</code>
            </div>
          </div>
        </template>

        <!-- Store App Info (screenshots, description, architectures) -->
        <template v-else> Screenshots -->
        <div v-if="visibleScreenshots.length > 0" class="px-5 pt-4">
          <div class="flex gap-3 overflow-x-auto scroll-smooth pb-3" style="-webkit-overflow-scrolling: touch;">
            <img
              v-for="ss in visibleScreenshots"
              :key="ss.index"
              :src="ss.url"
              :alt="`Screenshot ${ss.index + 1}`"
              loading="lazy"
              class="h-40 sm:h-48 rounded-lg object-cover bg-theme-tertiary shrink-0"
              @error="failedScreenshots = new Set([...failedScreenshots, ss.index])"
            />
          </div>
        </div>

        <!-- Description -->
        <div class="p-5">
          <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Description</h3>
          <p class="text-sm text-theme-secondary leading-relaxed">
            {{ catalogDescription || 'No description available.' }}
          </p>
        </div>

        <!-- Architectures -->
        <div v-if="app.architectures?.length > 0" class="px-5 pb-4">
          <h3 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Architectures</h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="arch in app.architectures"
              :key="arch"
              class="px-2 py-0.5 text-[10px] font-medium rounded"
              :class="isArmArch(arch)
                ? 'bg-success-muted text-success'
                : 'bg-theme-tertiary text-theme-secondary'"
            >
              {{ arch }}
            </span>
          </div>
        </div>

        <!-- Install Options (Advanced, expandable) -->
        <div v-if="isAdvanced && showInstallOptions && !app.installed" class="px-5 pb-4">
          <div class="p-4 rounded-lg border border-theme-primary bg-theme-secondary">
            <h4 class="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Install Options</h4>
            <div class="flex flex-col gap-3">
              <div>
                <label for="detail-port" class="block text-[10px] text-theme-muted uppercase tracking-wider mb-1">Port (optional)</label>
                <input
                  id="detail-port"
                  v-model="installPort"
                  type="text"
                  placeholder="e.g. 6100"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label for="detail-fqdn" class="block text-[10px] text-theme-muted uppercase tracking-wider mb-1">FQDN (optional)</label>
                <input
                  id="detail-fqdn"
                  v-model="installFqdn"
                  type="text"
                  :placeholder="'e.g. ' + makePlaceholder('myapp')"
                  class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>
            <p class="mt-2 text-[10px] text-theme-muted">Leave blank to use defaults.</p>
          </div>
        </div>
        </template>
      </div>

      <!-- ═══ Installed App Content ═══ -->
      <template v-if="isInstalledApp">
        <!-- Detail tabs -->
        <div class="flex items-center gap-1 px-5 pt-3 border-b border-theme-primary">
          <button
            v-for="tab in [
              { key: 'overview', label: 'Overview' },
              { key: 'logs', label: 'Logs' },
              ...(isAdvanced ? [{ key: 'docker', label: 'Docker' }] : [])
            ]"
            :key="tab.key"
            @click="activeDetailTab = tab.key"
            class="pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 -mb-px"
            :class="activeDetailTab === tab.key
              ? 'border-accent text-accent'
              : 'border-transparent text-theme-secondary hover:text-theme-primary'"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="overflow-y-auto flex-1 p-5 space-y-4">
          <!-- Overview Tab -->
          <template v-if="activeDetailTab === 'overview'">
            <!-- Status cards -->
            <div class="grid grid-cols-3 gap-3">
              <div class="p-3 rounded-xl bg-theme-tertiary">
                <p class="text-xs text-theme-muted mb-1">Status</p>
                <p class="font-medium" :class="isRunning ? 'text-success' : 'text-theme-muted'">
                  {{ isRunning ? 'Running' : 'Stopped' }}
                </p>
              </div>
              <div class="p-3 rounded-xl bg-theme-tertiary">
                <p class="text-xs text-theme-muted mb-1">Health</p>
                <p class="font-medium" :class="isHealthy ? 'text-success' : isRunning ? 'text-warning' : 'text-theme-muted'">
                  {{ isHealthy ? 'Healthy' : isRunning ? 'Unhealthy' : 'N/A' }}
                </p>
              </div>
              <div class="p-3 rounded-xl bg-theme-tertiary">
                <p class="text-xs text-theme-muted mb-1">Type</p>
                <p class="font-medium text-theme-primary capitalize">
                  {{ app.type || 'Unknown' }}
                </p>
              </div>
            </div>

            <!-- Advanced: Deploy mode + ports -->
            <div v-if="isAdvanced" class="grid grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-theme-tertiary">
                <p class="text-xs text-theme-muted mb-1">Deploy Mode</p>
                <p class="font-medium text-theme-primary capitalize">
                  {{ app.deploy_mode || 'Unknown' }}
                </p>
              </div>
              <div v-if="app.ports?.length" class="p-3 rounded-xl bg-theme-tertiary">
                <p class="text-xs text-theme-muted mb-1">Ports</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="p in app.ports.filter(p => p.port).slice(0, 5)"
                    :key="p.port"
                    class="px-1.5 py-0.5 rounded bg-theme-secondary text-theme-primary font-mono text-[11px]"
                  >
                    {{ p.port }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div v-if="app.description" class="p-4 rounded-xl bg-theme-tertiary">
              <h3 class="text-xs text-theme-muted mb-2">Description</h3>
              <p class="text-sm text-theme-primary">{{ app.description }}</p>
            </div>

            <!-- Quick actions -->
            <div class="flex items-center gap-2">
              <button
                v-if="isRunning && hasWebUI"
                @click="openWebUI"
                class="flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
              >
                <Icon name="ExternalLink" :size="16" />
                Open
              </button>
              <button
                v-if="isRunning && !isCore"
                @click="handleAction('restart')"
                :disabled="actionLoading"
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              >
                <Icon name="RotateCw" :size="16" />
                Restart
              </button>
              <button
                v-if="!isRunning && !isCore"
                @click="handleAction('start')"
                :disabled="actionLoading"
                class="flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
              >
                <Icon name="Play" :size="16" />
                Start
              </button>
              <button
                v-if="isRunning && !isCore"
                @click="handleAction('stop')"
                :disabled="actionLoading"
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-error/30 text-sm text-error hover:bg-error-muted transition-colors"
              >
                <Icon name="Square" :size="16" />
                Stop
              </button>
            </div>

            <!-- Danger zone (non-core only) -->
            <div v-if="!isCore && isAdvanced" class="p-4 rounded-xl bg-error-muted border border-error-subtle">
              <h3 class="text-sm font-medium text-error mb-2">Danger Zone</h3>
              <p class="text-xs text-theme-muted mb-3">Uninstalling will remove this app and its containers.</p>
              <button
                @click="handleUninstall"
                :disabled="actionLoading"
                class="px-4 py-2 rounded-lg btn-error text-sm font-medium"
              >
                Uninstall App
              </button>
            </div>
          </template>

          <!-- Logs Tab -->
          <template v-if="activeDetailTab === 'logs'">
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
          </template>

          <!-- Docker Tab (Advanced) -->
          <template v-if="activeDetailTab === 'docker' && isAdvanced">
            <div v-if="dockerLoading" class="flex items-center justify-center py-12">
              <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
            </div>

            <template v-else-if="dockerDetail">
              <!-- Container Info -->
              <div class="p-4 rounded-xl bg-theme-tertiary">
                <h3 class="text-xs text-theme-muted mb-3">Container Info</h3>
                <div class="grid grid-cols-1 gap-3 text-sm">
                  <div v-if="dockerDetail.container_id">
                    <p class="text-xs text-theme-muted">Container ID</p>
                    <p class="font-mono text-theme-primary break-all text-xs">{{ dockerDetail.container_id }}</p>
                  </div>
                  <div v-if="dockerDetail.image">
                    <p class="text-xs text-theme-muted">Image</p>
                    <p class="font-mono text-theme-primary break-all text-xs">{{ dockerDetail.image }}</p>
                  </div>
                  <div v-if="dockerDetail.created">
                    <p class="text-xs text-theme-muted">Created</p>
                    <p class="text-theme-primary text-xs">{{ new Date(dockerDetail.created).toLocaleString() }}</p>
                  </div>
                </div>
              </div>

              <!-- Resource Limits -->
              <div
                v-if="dockerDetail.resources || dockerDetail.limits"
                class="p-4 rounded-xl bg-theme-tertiary"
              >
                <h3 class="text-xs text-theme-muted mb-3">Resource Limits</h3>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div v-if="dockerDetail.resources?.limits?.memory || dockerDetail.limits?.memory">
                    <p class="text-xs text-theme-muted">Memory</p>
                    <p class="text-theme-primary">{{ dockerDetail.resources?.limits?.memory || dockerDetail.limits?.memory }}</p>
                  </div>
                  <div v-if="dockerDetail.resources?.limits?.cpus || dockerDetail.limits?.cpus">
                    <p class="text-xs text-theme-muted">CPU</p>
                    <p class="text-theme-primary">{{ dockerDetail.resources?.limits?.cpus || dockerDetail.limits?.cpus }}</p>
                  </div>
                </div>
              </div>

              <!-- Networks -->
              <div v-if="dockerDetail.networks?.length" class="p-4 rounded-xl bg-theme-tertiary">
                <h3 class="text-xs text-theme-muted mb-3">Networks</h3>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="net in dockerDetail.networks"
                    :key="typeof net === 'string' ? net : net.name"
                    class="px-2 py-1 rounded-lg bg-theme-secondary text-theme-primary font-mono text-xs"
                  >
                    {{ typeof net === 'string' ? net : net.name }}
                  </span>
                </div>
              </div>

              <!-- Mounts -->
              <div
                v-if="dockerDetail.mounts?.length || dockerDetail.volumes?.length"
                class="p-4 rounded-xl bg-theme-tertiary"
              >
                <h3 class="text-xs text-theme-muted mb-3">Mounts</h3>
                <div class="space-y-2">
                  <div
                    v-for="(mount, idx) in (dockerDetail.mounts || dockerDetail.volumes)"
                    :key="idx"
                    class="flex items-center gap-2 text-xs"
                  >
                    <span class="font-mono text-theme-primary break-all">{{ mount.source || mount.name }}</span>
                    <Icon name="ArrowRight" :size="12" class="text-theme-muted flex-shrink-0" />
                    <span class="font-mono text-theme-muted break-all">{{ mount.target || mount.destination }}</span>
                    <span
                      v-if="mount.read_only || mount.readonly"
                      class="px-1 py-0.5 text-[10px] rounded bg-warning/10 text-warning flex-shrink-0"
                    >RO</span>
                  </div>
                </div>
              </div>
            </template>

            <div v-else class="text-center py-12">
              <Icon name="Box" :size="32" class="mx-auto text-theme-muted mb-3" />
              <p class="text-theme-muted text-sm">Docker details not available.</p>
              <button
                @click="fetchDockerDetail"
                class="mt-3 px-4 py-2 rounded-lg bg-theme-tertiary text-theme-secondary hover:text-theme-primary transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          </template>
        </div>
      </template>

      <!-- ═══ Footer ═══ -->
      <div class="flex items-center justify-between gap-3 p-5 border-t border-theme-primary bg-theme-secondary flex-shrink-0">
        <button
          @click="handleClose"
          class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          Close
        </button>

        <!-- Catalog: Install button -->
        <div v-if="isCatalogApp && !app.installed" class="flex items-center gap-2">
          <button
            v-if="isAdvanced && showInstallOptions"
            @click="handleQuickInstall"
            class="px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            Use Defaults
          </button>
          <button
            @click="handleInstallClick"
            class="flex items-center gap-2 px-5 py-2 rounded-lg btn-accent text-sm font-medium"
            :aria-label="showInstallOptions ? 'Confirm install' : 'Install ' + catalogTitle"
          >
            <Icon name="Download" :size="16" />
            <span v-if="showInstallOptions">Confirm Install</span>
            <span v-else>Install</span>
          </button>
        </div>

        <!-- Catalog: Already installed -->
        <span v-if="isCatalogApp && app.installed" class="flex items-center gap-2 text-sm text-success">
          <Icon name="CheckCircle" :size="16" />
          Installed
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slide-in-right 0.25s ease-out;
}
</style>
