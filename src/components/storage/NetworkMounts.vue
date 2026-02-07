<script setup>
/**
 * NetworkMounts.vue — Sprint 3 G3
 *
 * Full network mount management component. Replaces G2 placeholder in StorageView
 * Network Mounts tab.
 *
 * Features:
 *   - List all configured network mounts (HAL + API mounts stores)
 *   - Status badges with mount/unmount actions
 *   - Add new mount modal (SMB / NFS) with test connection
 *   - Expandable detail panels per mount
 *   - Edit and delete existing mounts
 *   - Responsive: desktop table → mobile card layout
 *
 * Stores:
 *   - useStorageHalStore → HAL-level network mounts, mount/unmount SMB/NFS, test, check
 *   - useMountsStore → API-level mount CRUD, detail, status, test connection
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useStorageHalStore } from '@/stores/storage-hal'
import { useMountsStore } from '@/stores/mounts'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const storageHalStore = useStorageHalStore()
const mountsStore = useMountsStore()

// ==========================================
// State
// ==========================================

const loading = ref(false)
const actionError = ref(null)

// Mount modal
const showMountModal = ref(false)
const mountModalMode = ref('create') // 'create' | 'edit'
const mountModalRef = ref(null)
const mountForm = ref(defaultForm())
const formLoading = ref(false)
const testLoading = ref(false)
const testResult = ref(null)

// Detail expansion
const expandedMount = ref(null)
const detailLoading = ref(false)

// ==========================================
// Default Form
// ==========================================

function defaultForm() {
  return {
    name: '',
    type: 'smb',
    host: '',
    share: '',
    path: '',
    mountpoint: '',
    username: '',
    password: '',
    domain: '',
    options: '',
    auto_mount: false
  }
}

// ==========================================
// Computed — merged mount list
// ==========================================

const allMounts = computed(() => {
  // Merge HAL mounts and API mounts, dedup by name/source
  const halMounts = (storageHalStore.networkMounts || []).map(m => ({
    ...m,
    _source: 'hal',
    _key: m.name || m.source || m.mountpoint,
    _mounted: m.mounted || m.status === 'mounted',
    _type: m.type || m.protocol || 'unknown',
    _display: m.name || m.mountpoint || m.source
  }))

  const apiMounts = (mountsStore.mounts || []).map(m => ({
    ...m,
    _source: 'api',
    _key: m.name || m.source || m.mountpoint,
    _mounted: mountsStore.isMounted(m.name),
    _type: m.type || m.protocol || 'unknown',
    _display: m.name || m.mountpoint || m.source
  }))

  // Merge: API mounts take precedence (they have CRUD), HAL fills in extras
  const seen = new Set()
  const merged = []

  for (const m of apiMounts) {
    seen.add(m._key)
    merged.push(m)
  }
  for (const m of halMounts) {
    if (!seen.has(m._key)) {
      merged.push(m)
    }
  }

  return merged
})

const mountedCount = computed(() => allMounts.value.filter(m => m._mounted).length)

// ==========================================
// Data Fetching
// ==========================================

async function fetchAll() {
  loading.value = true
  actionError.value = null
  try {
    await Promise.all([
      storageHalStore.fetchNetworkMounts(),
      mountsStore.fetchMounts()
    ])
    // Fetch statuses for API mounts
    if (mountsStore.mounts.length > 0) {
      await mountsStore.fetchAllMountStatuses()
    }
  } catch (e) {
    actionError.value = 'Failed to load mounts: ' + e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

// Polling for mount status (every 30s)
let pollInterval = null
onMounted(() => {
  pollInterval = setInterval(async () => {
    if (mountsStore.mounts.length > 0) {
      await mountsStore.fetchAllMountStatuses()
    }
  }, 30000)
})
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

// Focus mount modal when shown
watch(showMountModal, (visible) => {
  if (visible) nextTick(() => mountModalRef.value?.focus())
})

// ==========================================
// Mount/Unmount Actions
// ==========================================

async function mountShare(mount) {
  actionError.value = null
  try {
    if (mount._source === 'api') {
      await mountsStore.mountShare(mount.name)
    } else {
      // HAL-level mount
      const config = { source: mount.source, mountpoint: mount.mountpoint, type: mount.type }
      if (mount.type === 'nfs' || mount._type === 'nfs') {
        await storageHalStore.mountNFSViaHAL(config)
      } else {
        await storageHalStore.mountSMBViaHAL(config)
      }
    }
    await fetchAll()
  } catch (e) {
    actionError.value = `Mount failed: ${e.message}`
  }
}

async function unmountShare(mount) {
  const name = mount._display
  if (!await confirm({
    title: 'Unmount Network Share',
    message: `Unmount "${name}"? Any active file operations will be interrupted.`,
    confirmText: 'Unmount',
    variant: 'warning'
  })) return

  actionError.value = null
  try {
    if (mount._source === 'api') {
      await mountsStore.unmountShare(mount.name)
    } else {
      await storageHalStore.unmountNetworkShare({
        source: mount.source,
        mountpoint: mount.mountpoint
      })
    }
    await fetchAll()
  } catch (e) {
    actionError.value = `Unmount failed: ${e.message}`
  }
}

// ==========================================
// CRUD Actions
// ==========================================

function openCreateMount() {
  mountModalMode.value = 'create'
  mountForm.value = defaultForm()
  testResult.value = null
  showMountModal.value = true
}

function openEditMount(mount) {
  mountModalMode.value = 'edit'
  mountForm.value = {
    name: mount.name || '',
    type: mount._type || mount.type || 'smb',
    host: mount.host || mount.server || '',
    share: mount.share || mount.export_path || mount.remote || '',
    path: mount.path || '',
    mountpoint: mount.mountpoint || '',
    username: mount.username || mount.user || '',
    password: '', // Never pre-fill
    domain: mount.domain || '',
    options: mount.options || '',
    auto_mount: mount.auto_mount || mount.automount || false
  }
  testResult.value = null
  showMountModal.value = true
}

async function saveMount() {
  if (!mountForm.value.name || !mountForm.value.host) return
  formLoading.value = true
  actionError.value = null
  try {
    const config = {
      name: mountForm.value.name,
      type: mountForm.value.type,
      host: mountForm.value.host,
      share: mountForm.value.share,
      mountpoint: mountForm.value.mountpoint || `/mnt/${mountForm.value.name}`,
      username: mountForm.value.username || undefined,
      password: mountForm.value.password || undefined,
      domain: mountForm.value.domain || undefined,
      options: mountForm.value.options || undefined,
      auto_mount: mountForm.value.auto_mount
    }

    if (mountModalMode.value === 'create') {
      await mountsStore.addMount(config)
    } else {
      // For edit: delete + re-add (API mounts are name-keyed)
      // Capture original config for rollback if add fails
      const originalMount = allMounts.value.find(m => m.name === mountForm.value.name)
      await mountsStore.deleteMount(mountForm.value.name)
      try {
        await mountsStore.addMount(config)
      } catch (addError) {
        // Rollback: re-add original mount if we still have it
        if (originalMount) {
          try {
            await mountsStore.addMount({
              name: originalMount.name,
              type: originalMount._type || originalMount.type,
              host: originalMount.host || originalMount.server,
              share: originalMount.share || originalMount.export_path || originalMount.remote,
              mountpoint: originalMount.mountpoint,
              username: originalMount.username || originalMount.user,
              domain: originalMount.domain,
              options: originalMount.options,
              auto_mount: originalMount.auto_mount || originalMount.automount
            })
          } catch {
            // Rollback also failed — surface the original add error
          }
        }
        throw addError
      }
    }

    showMountModal.value = false
    await fetchAll()
  } catch (e) {
    actionError.value = 'Failed to save mount: ' + e.message
  } finally {
    formLoading.value = false
  }
}

async function deleteMount(mount) {
  const name = mount._display
  if (!await confirm({
    title: 'Delete Network Mount',
    message: `Remove mount configuration for "${name}"? If currently mounted, it will be unmounted first.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  actionError.value = null
  try {
    if (mount._source === 'api') {
      await mountsStore.deleteMount(mount.name)
    } else if (mount._source === 'hal') {
      // HAL-only mounts: unmount (HAL has no persistent config to delete)
      if (mount._mounted) {
        await storageHalStore.unmountNetworkShare({
          source: mount.source,
          mountpoint: mount.mountpoint
        })
      }
    }
    await fetchAll()
  } catch (e) {
    actionError.value = 'Failed to delete mount: ' + e.message
  }
}

// ==========================================
// Test Connection
// ==========================================

async function testConnection() {
  testLoading.value = true
  testResult.value = null
  try {
    const config = {
      type: mountForm.value.type,
      host: mountForm.value.host,
      share: mountForm.value.share,
      username: mountForm.value.username || undefined,
      password: mountForm.value.password || undefined,
      domain: mountForm.value.domain || undefined
    }

    // Try API-level test first, fallback to HAL on failure
    let result = null
    try {
      result = await mountsStore.testMountConnection(config)
    } catch {
      // API test failed or unavailable — try HAL
    }
    if (!result || result.error) {
      try {
        result = await storageHalStore.testNetworkMount(config)
      } catch {
        // HAL test also failed
      }
    }

    testResult.value = result || { success: false, error: 'Connection test unavailable' }
  } catch (e) {
    testResult.value = { success: false, error: e.message }
  } finally {
    testLoading.value = false
  }
}

// ==========================================
// Detail Expansion
// ==========================================

async function toggleDetail(key) {
  if (expandedMount.value === key) {
    expandedMount.value = null
    return
  }

  expandedMount.value = key
  detailLoading.value = true
  try {
    const mount = allMounts.value.find(m => m._key === key)
    if (mount?._source === 'api' && mount?.name) {
      await mountsStore.fetchMountDetail(mount.name)
    }
    if (mount?._source === 'hal' && mount?.mountpoint) {
      await storageHalStore.checkNetworkMount({ mountpoint: mount.mountpoint })
    }
  } catch (e) {
    // Detail fetch failed — still show what we have
  } finally {
    detailLoading.value = false
  }
}

// ==========================================
// Helpers
// ==========================================

function mountTypeIcon(type) {
  if (!type) return 'Network'
  const t = String(type).toLowerCase()
  if (t.includes('smb') || t.includes('cifs')) return 'FolderOpen'
  if (t.includes('nfs')) return 'Server'
  return 'Network'
}

function mountTypeBadge(type) {
  if (!type) return 'bg-theme-tertiary text-theme-secondary'
  const t = String(type).toLowerCase()
  if (t.includes('smb') || t.includes('cifs')) return 'bg-accent-muted text-accent'
  if (t.includes('nfs')) return 'bg-success-muted text-success'
  return 'bg-theme-tertiary text-theme-secondary'
}

function mountTypeLabel(type) {
  if (!type) return 'Unknown'
  const t = String(type).toLowerCase()
  if (t.includes('smb') || t.includes('cifs')) return 'SMB'
  if (t.includes('nfs')) return 'NFS'
  return type.toUpperCase()
}

function mountSource(mount) {
  if (mount.source) return mount.source
  if (mount.host && mount.share) return `//${mount.host}/${mount.share}`
  if (mount.host && mount.export_path) return `${mount.host}:${mount.export_path}`
  if (mount.remote) return mount.remote
  return '-'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-theme-primary">
        Network Mounts
        <span class="text-sm font-normal text-theme-muted ml-2">
          {{ allMounts.length }} configured
          <template v-if="mountedCount > 0"> · {{ mountedCount }} active</template>
        </span>
      </h2>
      <div class="flex items-center gap-2">
        <button
          @click="fetchAll"
          :disabled="loading"
          class="px-3 py-1.5 text-sm bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 flex items-center gap-1.5 disabled:opacity-50"
          aria-label="Refresh network mounts"
        >
          <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': loading }" />
          Refresh
        </button>
        <button
          @click="openCreateMount"
          class="px-3 py-1.5 text-sm btn-accent rounded-lg flex items-center gap-1.5"
          aria-label="Add network mount"
        >
          <Icon name="Plus" :size="14" />
          Add Mount
        </button>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && allMounts.length === 0" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading network mounts...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="allMounts.length === 0" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Network" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Network Mounts</h3>
      <p class="text-theme-muted mb-4">Connect to remote SMB or NFS shares to access network storage.</p>
      <button @click="openCreateMount" class="px-4 py-2 btn-accent rounded-lg text-sm flex items-center gap-2 mx-auto">
        <Icon name="Plus" :size="14" />
        Add First Mount
      </button>
    </div>

    <!-- Mounts list -->
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="mount in allMounts"
          :key="mount._key"
          class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
        >
          <!-- Mount header row -->
          <div class="p-4 flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
              :class="mount._mounted ? 'bg-success-muted' : 'bg-theme-tertiary'"
              @click="toggleDetail(mount._key)"
            >
              <Icon :name="mountTypeIcon(mount._type)" :size="20"
                :class="mount._mounted ? 'text-success' : 'text-theme-muted'"
              />
            </div>
            <div
              class="flex-1 min-w-0 cursor-pointer"
              @click="toggleDetail(mount._key)"
            >
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-theme-primary truncate">{{ mount._display }}</h4>
                <span
                  class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold rounded-full"
                  :class="mountTypeBadge(mount._type)"
                >{{ mountTypeLabel(mount._type) }}</span>
              </div>
              <p class="text-xs text-theme-muted truncate">{{ mountSource(mount) }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Status badge -->
              <span
                class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                :class="mount._mounted ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'"
              >{{ mount._mounted ? 'Active' : 'Inactive' }}</span>

              <!-- Mount/Unmount toggle -->
              <button
                v-if="!mount._mounted"
                @click.stop="mountShare(mount)"
                class="p-2 text-theme-muted hover:text-success rounded-lg hover:bg-success-muted"
                title="Mount"
                :aria-label="'Mount ' + mount._display"
              >
                <Icon name="Play" :size="14" />
              </button>
              <button
                v-else
                @click.stop="unmountShare(mount)"
                class="p-2 text-theme-muted hover:text-warning rounded-lg hover:bg-warning-muted"
                title="Unmount"
                :aria-label="'Unmount ' + mount._display"
              >
                <Icon name="Square" :size="14" />
              </button>

              <!-- Edit (API mounts only) -->
              <button
                v-if="mount._source === 'api'"
                @click.stop="openEditMount(mount)"
                class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary"
                title="Edit mount"
                :aria-label="'Edit mount ' + mount._display"
              >
                <Icon name="Pencil" :size="14" />
              </button>

              <!-- Delete -->
              <button
                @click.stop="deleteMount(mount)"
                class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted"
                title="Delete mount"
                :aria-label="'Delete mount ' + mount._display"
              >
                <Icon name="Trash2" :size="14" />
              </button>

              <!-- Expand -->
              <button
                @click="toggleDetail(mount._key)"
                class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg"
                :aria-label="'Toggle details for ' + mount._display"
                :aria-expanded="expandedMount === mount._key"
              >
                <Icon
                  name="ChevronDown"
                  :size="14"
                  class="transition-transform"
                  :class="{ 'rotate-180': expandedMount === mount._key }"
                />
              </button>
            </div>
          </div>

          <!-- Expanded detail panel -->
          <div v-if="expandedMount === mount._key" class="px-4 pb-4 border-t border-theme-primary/50">
            <div v-if="detailLoading" class="py-4 flex items-center justify-center">
              <Icon name="Loader2" :size="16" class="animate-spin text-theme-muted" />
              <span class="ml-2 text-sm text-theme-muted">Loading details...</span>
            </div>
            <div v-else class="pt-4">
              <!-- Mobile type badge (hidden on desktop) -->
              <div class="flex gap-2 mb-3 sm:hidden">
                <span
                  class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                  :class="mountTypeBadge(mount._type)"
                >{{ mountTypeLabel(mount._type) }}</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span class="text-xs text-theme-muted block">Source</span>
                  <span class="text-theme-primary font-mono text-xs break-all">{{ mountSource(mount) }}</span>
                </div>
                <div v-if="mount.mountpoint">
                  <span class="text-xs text-theme-muted block">Mount Point</span>
                  <span class="text-theme-primary font-mono text-xs">{{ mount.mountpoint }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Protocol</span>
                  <span class="text-theme-primary text-xs">{{ mountTypeLabel(mount._type) }}</span>
                </div>
                <div v-if="mount.host || mount.server">
                  <span class="text-xs text-theme-muted block">Host</span>
                  <span class="text-theme-primary text-xs">{{ mount.host || mount.server }}</span>
                </div>
                <div v-if="mount.username || mount.user">
                  <span class="text-xs text-theme-muted block">Username</span>
                  <span class="text-theme-primary text-xs">{{ mount.username || mount.user }}</span>
                </div>
                <div v-if="mount.domain">
                  <span class="text-xs text-theme-muted block">Domain</span>
                  <span class="text-theme-primary text-xs">{{ mount.domain }}</span>
                </div>
                <div>
                  <span class="text-xs text-theme-muted block">Auto Mount</span>
                  <span class="text-theme-primary text-xs">{{ (mount.auto_mount || mount.automount) ? 'Yes' : 'No' }}</span>
                </div>
                <div v-if="mount.options">
                  <span class="text-xs text-theme-muted block">Options</span>
                  <span class="text-theme-primary font-mono text-xs break-all">{{ mount.options }}</span>
                </div>
              </div>

              <!-- HAL check result — guard by mountpoint to avoid showing wrong mount's result -->
              <div
                v-if="storageHalStore.mountCheckResult && mount._source === 'hal' && storageHalStore.mountCheckResult.mountpoint === mount.mountpoint"
                class="mt-3 p-3 rounded-lg text-xs"
                :class="storageHalStore.mountCheckResult.available
                  ? 'bg-success-muted text-success'
                  : 'bg-warning-muted text-warning'"
              >
                <div class="flex items-center gap-2">
                  <Icon :name="storageHalStore.mountCheckResult.available ? 'CheckCircle' : 'AlertCircle'" :size="14" />
                  <span>{{ storageHalStore.mountCheckResult.available ? 'Remote share is reachable' : 'Remote share is not reachable' }}</span>
                </div>
              </div>

              <!-- API mount detail -->
              <div
                v-if="mountsStore.selectedMount && mount._source === 'api' && mountsStore.selectedMount.name === mount.name"
                class="mt-3"
              >
                <div v-if="mountsStore.selectedMount.space" class="grid grid-cols-3 gap-2 text-xs">
                  <div class="p-2 bg-theme-secondary/50 rounded-lg">
                    <span class="text-theme-muted block">Total</span>
                    <span class="text-theme-primary font-semibold">{{ storageHalStore.formatBytes(mountsStore.selectedMount.space.total) }}</span>
                  </div>
                  <div class="p-2 bg-theme-secondary/50 rounded-lg">
                    <span class="text-theme-muted block">Used</span>
                    <span class="text-theme-primary font-semibold">{{ storageHalStore.formatBytes(mountsStore.selectedMount.space.used) }}</span>
                  </div>
                  <div class="p-2 bg-theme-secondary/50 rounded-lg">
                    <span class="text-theme-muted block">Free</span>
                    <span class="text-theme-primary font-semibold">{{ storageHalStore.formatBytes(mountsStore.selectedMount.space.free) }}</span>
                  </div>
                </div>
              </div>

              <!-- Mobile action buttons -->
              <div class="mt-3 flex flex-wrap gap-2 sm:hidden">
                <button
                  v-if="!mount._mounted"
                  @click.stop="mountShare(mount)"
                  class="px-3 py-1.5 text-xs bg-success-muted text-success rounded-lg hover:bg-success/20 flex items-center gap-1.5"
                  :aria-label="'Mount ' + mount._display"
                >
                  <Icon name="Play" :size="12" />
                  Mount
                </button>
                <button
                  v-else
                  @click.stop="unmountShare(mount)"
                  class="px-3 py-1.5 text-xs bg-warning-muted text-warning rounded-lg hover:bg-warning/20 flex items-center gap-1.5"
                  :aria-label="'Unmount ' + mount._display"
                >
                  <Icon name="Square" :size="12" />
                  Unmount
                </button>
                <button
                  v-if="mount._source === 'api'"
                  @click.stop="openEditMount(mount)"
                  class="px-3 py-1.5 text-xs bg-theme-tertiary text-theme-secondary rounded-lg hover:bg-theme-secondary/50 flex items-center gap-1.5"
                  :aria-label="'Edit mount ' + mount._display"
                >
                  <Icon name="Pencil" :size="12" />
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== Add/Edit Mount Modal ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showMountModal"
          ref="mountModalRef"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          :aria-label="mountModalMode === 'create' ? 'Add Network Mount' : 'Edit Network Mount'"
          tabindex="-1"
          @keydown.escape="showMountModal = false"
        >
          <div class="absolute inset-0 bg-black/50" @click="showMountModal = false"></div>
          <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-lg border border-theme-primary max-h-[90vh] overflow-y-auto">
            <!-- Modal header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary sticky top-0 bg-theme-card z-10 rounded-t-2xl">
              <h3 class="text-lg font-semibold text-theme-primary">
                {{ mountModalMode === 'create' ? 'Add Network Mount' : 'Edit Network Mount' }}
              </h3>
              <button @click="showMountModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
                <Icon name="X" :size="18" />
              </button>
            </div>

            <!-- Modal body -->
            <div class="p-6 space-y-4">
              <!-- Protocol toggle -->
              <div>
                <label id="mount-protocol-label" class="block text-sm font-medium text-theme-secondary mb-2">Protocol</label>
                <div class="flex rounded-lg overflow-hidden border border-theme-primary" role="radiogroup" aria-labelledby="mount-protocol-label">
                  <button
                    @click="mountForm.type = 'smb'"
                    class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    :class="mountForm.type === 'smb'
                      ? 'bg-accent text-white'
                      : 'text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary'"
                  >SMB / CIFS</button>
                  <button
                    @click="mountForm.type = 'nfs'"
                    class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    :class="mountForm.type === 'nfs'
                      ? 'bg-accent text-white'
                      : 'text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary'"
                  >NFS</button>
                </div>
              </div>

              <!-- Mount name -->
              <div>
                <label for="mount-name" class="block text-sm font-medium text-theme-secondary mb-1">Mount Name</label>
                <input
                  id="mount-name"
                  v-model="mountForm.name"
                  type="text"
                  :disabled="mountModalMode === 'edit'"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent disabled:opacity-50"
                  placeholder="nas-backup"
                >
              </div>

              <!-- Host -->
              <div>
                <label for="mount-host" class="block text-sm font-medium text-theme-secondary mb-1">Host / IP</label>
                <input
                  id="mount-host"
                  v-model="mountForm.host"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  :placeholder="mountForm.type === 'smb' ? '192.168.1.100 or nas.local' : '192.168.1.100'"
                >
              </div>

              <!-- Share / Export path -->
              <div>
                <label for="mount-share" class="block text-sm font-medium text-theme-secondary mb-1">
                  {{ mountForm.type === 'smb' ? 'Share Name' : 'Export Path' }}
                </label>
                <input
                  id="mount-share"
                  v-model="mountForm.share"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  :placeholder="mountForm.type === 'smb' ? 'backups' : '/exports/data'"
                >
              </div>

              <!-- Mount point -->
              <div>
                <label for="mount-mountpoint" class="block text-sm font-medium text-theme-secondary mb-1">Local Mount Point</label>
                <input
                  id="mount-mountpoint"
                  v-model="mountForm.mountpoint"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono text-sm"
                  :placeholder="`/mnt/${mountForm.name || 'share'}`"
                >
                <p class="text-xs text-theme-muted mt-1">Leave blank to auto-generate from mount name</p>
              </div>

              <!-- SMB-specific fields -->
              <template v-if="mountForm.type === 'smb'">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="mount-username" class="block text-sm font-medium text-theme-secondary mb-1">Username</label>
                    <input
                      id="mount-username"
                      v-model="mountForm.username"
                      type="text"
                      class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                      placeholder="guest"
                    >
                  </div>
                  <div>
                    <label for="mount-password" class="block text-sm font-medium text-theme-secondary mb-1">Password</label>
                    <input
                      id="mount-password"
                      v-model="mountForm.password"
                      type="password"
                      class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                      :placeholder="mountModalMode === 'edit' ? 'Re-enter password' : 'Optional'"
                    >
                    <p v-if="mountModalMode === 'edit'" class="text-xs text-theme-muted mt-1">
                      Password is not pre-filled for security. Re-enter to keep credentials.
                    </p>
                  </div>
                </div>
                <div>
                  <label for="mount-domain" class="block text-sm font-medium text-theme-secondary mb-1">Domain (optional)</label>
                  <input
                    id="mount-domain"
                    v-model="mountForm.domain"
                    type="text"
                    class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                    placeholder="WORKGROUP"
                  >
                </div>
              </template>

              <!-- Mount options -->
              <div>
                <label for="mount-options" class="block text-sm font-medium text-theme-secondary mb-1">Mount Options (optional)</label>
                <input
                  id="mount-options"
                  v-model="mountForm.options"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono text-sm"
                  :placeholder="mountForm.type === 'smb' ? 'vers=3.0,iocharset=utf8' : 'rw,soft,timeo=30'"
                >
              </div>

              <!-- Auto mount toggle -->
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="mountForm.auto_mount"
                  type="checkbox"
                  class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]"
                >
                <span class="text-sm text-theme-secondary">Auto-mount on boot</span>
              </label>

              <!-- Test connection -->
              <div class="border-t border-theme-primary pt-4">
                <button
                  @click="testConnection"
                  :disabled="testLoading || !mountForm.host"
                  class="w-full px-4 py-2 text-sm rounded-lg border border-theme-secondary text-theme-secondary hover:bg-theme-tertiary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon v-if="testLoading" name="Loader2" :size="14" class="animate-spin" />
                  <Icon v-else name="Zap" :size="14" />
                  Test Connection
                </button>

                <!-- Test result -->
                <div
                  v-if="testResult"
                  class="mt-3 p-3 rounded-lg text-sm flex items-center gap-2"
                  :class="testResult.success
                    ? 'bg-success-muted text-success'
                    : 'bg-error-muted text-error'"
                >
                  <Icon :name="testResult.success ? 'CheckCircle' : 'XCircle'" :size="16" />
                  <span>{{ testResult.success ? 'Connection successful' : (testResult.error || 'Connection failed') }}</span>
                </div>
              </div>
            </div>

            <!-- Modal footer -->
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary sticky bottom-0 bg-theme-card rounded-b-2xl">
              <button
                @click="showMountModal = false"
                class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm"
              >Cancel</button>
              <button
                @click="saveMount"
                :disabled="formLoading || !mountForm.name || !mountForm.host"
                class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon v-if="formLoading" name="Loader2" :size="14" class="animate-spin" />
                {{ mountModalMode === 'create' ? 'Add Mount' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
