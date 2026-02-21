<script setup>
/**
 * RegistryTab.vue — S05 Refactor (Batch 4: Management only)
 *
 * Advanced-only tab for local Docker registry management.
 * Batch 4: Removed all deploy/install functionality — installs now
 * go exclusively through AppStoreTab → InstallFlow.vue.
 *
 * Features:
 *   - Registry status card with disk usage stats + progress bar
 *   - Cleanup button with confirm dialog → freed space feedback
 *   - Cache image form (pull from remote registry)
 *   - Image list with expandable tag detail + copy tag + delete
 *   - Per-image delete with confirm dialog
 *   - Responsive: desktop table → mobile card layout
 *
 * Stores:
 *   - useRegistryStore → status, images, disk-usage, cleanup, tags, delete
 *   - useAppManagerStore → initRegistry, cacheImage (legacy — not yet in registry store)
 */
import { ref, computed, onMounted } from 'vue'
import { useRegistryStore } from '@/stores/registry'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const registryStore = useRegistryStore()
const appManagerStore = useAppManagerStore()

// ==========================================
// State
// ==========================================

const initLoading = ref(false)
const caching = ref(false)
const cleanupLoading = ref(false)
const cleanupResult = ref(null)
const newImageRef = ref('')
const expandedImage = ref(null)
const tagsLoading = ref(false)
const deleteLoading = ref({})
const actionError = ref(null)

// ==========================================
// Computed
// ==========================================

const registryHost = computed(() => registryStore.status?.url || 'Not configured')

const images = computed(() => {
  const raw = registryStore.images || []
  return raw.map(img => typeof img === 'string' ? { name: img, tags: [] } : img)
})

const diskUsage = computed(() => registryStore.diskUsage)

const usagePercent = computed(() => {
  if (!diskUsage.value?.total_space || !diskUsage.value?.used_space) return null
  return Math.min(100, Math.round((diskUsage.value.used_space / diskUsage.value.total_space) * 100))
})

// ==========================================
// Data Fetching
// ==========================================

onMounted(() => {
  registryStore.fetchAll()
})

async function refresh() {
  actionError.value = null
  cleanupResult.value = null
  await registryStore.fetchAll()
}

// ==========================================
// Actions
// ==========================================

async function initRegistry() {
  initLoading.value = true
  actionError.value = null
  try {
    await appManagerStore.initRegistry()
    await registryStore.fetchAll()
  } catch (e) {
    actionError.value = 'Failed to initialize registry: ' + e.message
  } finally {
    initLoading.value = false
  }
}

async function cacheImage() {
  if (!newImageRef.value.trim()) return
  caching.value = true
  actionError.value = null
  try {
    await appManagerStore.cacheImage(newImageRef.value.trim())
    newImageRef.value = ''
    await registryStore.fetchImages()
    await registryStore.fetchDiskUsage()
  } catch (e) {
    actionError.value = 'Failed to cache image: ' + e.message
  } finally {
    caching.value = false
  }
}

async function runCleanup() {
  if (!await confirm({
    title: 'Registry Cleanup',
    message: 'This will remove unused layers and untagged images from the local registry. Continue?',
    confirmText: 'Clean Up',
    variant: 'warning'
  })) return

  cleanupLoading.value = true
  cleanupResult.value = null
  actionError.value = null
  try {
    const result = await registryStore.cleanup()
    cleanupResult.value = result
  } catch (e) {
    actionError.value = 'Cleanup failed: ' + e.message
  } finally {
    cleanupLoading.value = false
  }
}

async function toggleImageExpand(imageName) {
  if (expandedImage.value === imageName) {
    expandedImage.value = null
    registryStore.clearSelectedImage()
    return
  }
  expandedImage.value = imageName
  tagsLoading.value = true
  try {
    await registryStore.fetchImageTags(imageName)
  } catch (e) {
    // Tags fetch failed — still show expanded with inline tags
  } finally {
    tagsLoading.value = false
  }
}

async function deleteImage(name) {
  const tags = registryStore.selectedImageTags || []
  const tagCount = tags.length
  if (!await confirm({
    title: 'Delete Image',
    message: `Delete "${name}" from the local registry?${tagCount > 0 ? ` This will remove ${tagCount} tag${tagCount !== 1 ? 's' : ''}.` : ''}`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  deleteLoading.value = { ...deleteLoading.value, [name]: true }
  actionError.value = null
  try {
    // Delete all tags individually to ensure complete removal
    if (tags.length > 0) {
      for (const tag of tags) {
        await appManagerStore.deleteRegistryImage(name, tag)
      }
    } else {
      await registryStore.deleteImage(name)
    }
    if (expandedImage.value === name) {
      expandedImage.value = null
    }
    await registryStore.fetchImages()
    await registryStore.fetchDiskUsage()
  } catch (e) {
    actionError.value = `Failed to delete "${name}": ` + e.message
  } finally {
    deleteLoading.value = { ...deleteLoading.value, [name]: false }
  }
}

async function deleteImageTag(imageName, tag) {
  if (!await confirm({
    title: 'Delete Image Tag',
    message: `Delete ${imageName}:${tag} from the local registry?`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  actionError.value = null
  try {
    await appManagerStore.deleteRegistryImage(imageName, tag)
    await registryStore.fetchImageTags(imageName)
    await registryStore.fetchImages()
    await registryStore.fetchDiskUsage()
  } catch (e) {
    actionError.value = 'Failed to delete tag: ' + e.message
  }
}

function copyTagRef(imageName, tag) {
  const ref = `${registryHost.value}/${imageName}:${tag}`
  navigator.clipboard?.writeText(ref)
}

// ==========================================
// Helpers
// ==========================================

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = Number(bytes)
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(1)} ${units[i]}`
}

function usageColor(percent) {
  if (percent >= 90) return 'bg-error'
  if (percent >= 75) return 'bg-warning'
  return 'bg-success'
}

function usageTextColor(percent) {
  if (percent >= 90) return 'text-error'
  if (percent >= 75) return 'text-warning'
  return 'text-success'
}

function getImageTags(image) {
  if (expandedImage.value === image.name && registryStore.selectedImageName === image.name) {
    return registryStore.selectedImageTags || []
  }
  return image.tags || []
}
</script>

<template>
  <div class="space-y-6">

    <!-- Info Banner -->
    <div class="bg-accent-muted border border-[color:var(--accent-primary)]/30 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <Icon name="Info" :size="20" class="text-accent mt-0.5 flex-shrink-0" />
        <div class="text-sm">
          <p class="text-theme-primary font-medium">Offline Docker Registry</p>
          <p class="mt-1 text-theme-secondary">
            Cache Docker images locally for offline deployment. Images are stored at
            <code class="bg-theme-tertiary px-1.5 py-0.5 rounded text-xs font-mono">{{ registryHost }}</code>.
            To install cached images, use the
            <strong class="text-theme-primary">App Store</strong> tab and filter by "Offline Apps".
          </p>
        </div>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss error">Dismiss</button>
      </div>
    </div>

    <!-- Cleanup Success -->
    <div v-if="cleanupResult" class="bg-success-muted border border-success rounded-lg p-4 flex items-start gap-2">
      <Icon name="CheckCircle" :size="16" class="text-success flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-success">
          Cleanup complete.
          <span v-if="cleanupResult.freed_space"> Freed {{ formatBytes(cleanupResult.freed_space) }}.</span>
          <span v-if="cleanupResult.removed_layers"> Removed {{ cleanupResult.removed_layers }} layer{{ cleanupResult.removed_layers !== 1 ? 's' : '' }}.</span>
        </p>
        <button @click="cleanupResult = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1" aria-label="Dismiss cleanup result">Dismiss</button>
      </div>
    </div>

    <!-- ==================== Status + Disk Usage Card ==================== -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="registryStore.isOnline ? 'bg-success-muted' : 'bg-theme-tertiary'"
          >
            <Icon
              name="Container"
              :size="20"
              :class="registryStore.isOnline ? 'text-success' : 'text-theme-muted'"
            />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Registry Status</h3>
            <div v-if="registryStore.loading" class="flex items-center gap-2 text-sm text-theme-muted mt-0.5">
              <Icon name="Loader2" :size="14" class="animate-spin" />
              Loading...
            </div>
            <div v-else class="flex flex-wrap items-center gap-3 text-sm mt-0.5">
              <span
                class="flex items-center gap-1"
                :class="registryStore.isOnline ? 'text-success' : 'text-error'"
              >
                <Icon :name="registryStore.isOnline ? 'CheckCircle' : 'XCircle'" :size="14" />
                {{ registryStore.isOnline ? 'Running' : 'Stopped' }}
              </span>
              <span class="text-theme-muted">{{ registryStore.imageCount }} image{{ registryStore.imageCount !== 1 ? 's' : '' }}</span>
              <span v-if="diskUsage" class="text-theme-muted">{{ formatBytes(registryStore.totalDiskUsage) }} used</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            v-if="registryStore.isOnline"
            @click="runCleanup"
            :disabled="cleanupLoading"
            class="px-3 py-1.5 text-sm bg-warning-muted text-warning rounded-lg hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
            title="Remove unused layers"
            aria-label="Clean up unused registry layers"
          >
            <Icon v-if="cleanupLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Trash2" :size="14" />
            {{ cleanupLoading ? 'Cleaning...' : 'Cleanup' }}
          </button>
          <button
            v-if="!registryStore.isOnline && !registryStore.loading"
            @click="initRegistry"
            :disabled="initLoading"
            class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
          >
            <Icon v-if="initLoading" name="Loader2" :size="14" class="animate-spin" />
            <Icon v-else name="Play" :size="14" />
            Initialize
          </button>
          <button
            @click="refresh"
            :disabled="registryStore.loading"
            class="p-2 bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh registry status"
          >
            <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': registryStore.loading }" class="text-theme-secondary" />
          </button>
        </div>
      </div>

      <!-- Disk Usage Bar -->
      <div v-if="diskUsage && usagePercent != null" class="mt-4">
        <div class="flex items-center justify-between text-xs text-theme-muted mb-1.5">
          <span>Registry Disk Usage</span>
          <span :class="usageTextColor(usagePercent)" class="font-semibold">{{ usagePercent }}%</span>
        </div>
        <div class="h-2 bg-theme-tertiary rounded-full overflow-hidden">
          <div
            :class="usageColor(usagePercent)"
            class="h-full transition-all"
            :style="{ width: usagePercent + '%' }"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-theme-muted mt-1">
          <span>Used: {{ formatBytes(diskUsage.used_space || diskUsage.size) }}</span>
          <span v-if="diskUsage.total_space">Total: {{ formatBytes(diskUsage.total_space) }}</span>
        </div>
      </div>

      <!-- Disk stats grid -->
      <div v-if="diskUsage && (diskUsage.image_count != null || diskUsage.layer_count != null)" class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-if="diskUsage.image_count != null" class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Images</p>
          <p class="font-semibold text-theme-primary">{{ diskUsage.image_count }}</p>
        </div>
        <div v-if="diskUsage.layer_count != null" class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Layers</p>
          <p class="font-semibold text-theme-primary">{{ diskUsage.layer_count }}</p>
        </div>
        <div v-if="diskUsage.tag_count != null" class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Tags</p>
          <p class="font-semibold text-theme-primary">{{ diskUsage.tag_count }}</p>
        </div>
        <div v-if="diskUsage.blob_size != null" class="p-3 bg-theme-secondary/50 rounded-lg">
          <p class="text-xs text-theme-muted mb-1">Blob Size</p>
          <p class="font-semibold text-theme-primary">{{ formatBytes(diskUsage.blob_size) }}</p>
        </div>
      </div>
    </div>

    <!-- ==================== Cache Image Form ==================== -->
    <div v-if="registryStore.isOnline" class="bg-theme-card rounded-xl border border-theme-primary p-6">
      <h3 class="font-semibold text-theme-primary mb-3">Cache Image</h3>
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="newImageRef"
          type="text"
          placeholder="docker.io/library/nginx:latest"
          aria-label="Docker image reference to cache"
          class="flex-1 px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
          :disabled="caching"
          @keyup.enter="cacheImage"
        >
        <button
          @click="cacheImage"
          :disabled="caching || !newImageRef.trim()"
          class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Icon :name="caching ? 'Loader2' : 'Download'" :size="14" :class="{ 'animate-spin': caching }" />
          {{ caching ? 'Caching...' : 'Cache Image' }}
        </button>
      </div>
      <p class="mt-2 text-xs text-theme-muted">Pull and store in the local registry for offline use</p>
    </div>

    <!-- ==================== Image List ==================== -->
    <div class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden">
      <div class="px-6 py-4 border-b border-theme-primary flex items-center justify-between">
        <h3 class="font-semibold text-theme-primary">Cached Images</h3>
        <span v-if="images.length > 0" class="text-xs text-theme-muted">{{ images.length }} image{{ images.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Loading -->
      <div v-if="registryStore.loading && images.length === 0" class="p-8 flex items-center justify-center">
        <Icon name="Loader2" :size="20" class="animate-spin text-theme-muted" />
        <span class="ml-2 text-sm text-theme-muted">Loading images...</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="images.length === 0" class="p-8 text-center">
        <Icon name="Container" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h4 class="text-lg font-medium text-theme-primary mb-2">No Images Cached</h4>
        <p class="text-theme-muted text-sm">Cache Docker images from the form above for offline use.</p>
      </div>

      <!-- Image rows -->
      <div v-else class="divide-y divide-theme-primary/50">
        <div
          v-for="image in images"
          :key="image.name"
          class="overflow-hidden"
        >
          <!-- Image header row -->
          <div
            class="px-6 py-4 flex items-center gap-3 cursor-pointer hover:bg-theme-tertiary/30 transition-colors"
            @click="toggleImageExpand(image.name)"
            @keydown.enter="toggleImageExpand(image.name)"
            role="button"
            tabindex="0"
            :aria-expanded="expandedImage === image.name"
            :aria-label="'Toggle details for image ' + image.name"
          >
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon name="Container" :size="18" class="text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-medium text-theme-primary font-mono truncate">{{ image.name }}</h4>
              <div class="flex items-center gap-2 mt-0.5">
                <span v-if="image.tags?.length" class="text-xs text-theme-muted">
                  {{ image.tags.length }} tag{{ image.tags.length !== 1 ? 's' : '' }}
                </span>
                <span v-if="image.size" class="text-xs text-theme-muted">{{ formatBytes(image.size) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Inline tags (desktop, collapsed) -->
              <div v-if="expandedImage !== image.name && image.tags?.length" class="hidden sm:flex flex-wrap gap-1 max-w-xs">
                <span
                  v-for="tag in image.tags.slice(0, 3)"
                  :key="tag"
                  class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-secondary"
                >{{ tag }}</span>
                <span v-if="image.tags.length > 3" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-theme-tertiary text-theme-muted">
                  +{{ image.tags.length - 3 }}
                </span>
              </div>
              <button
                @click.stop="deleteImage(image.name)"
                :disabled="deleteLoading[image.name]"
                class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted disabled:opacity-50"
                title="Delete image"
                :aria-label="'Delete image ' + image.name"
              >
                <Icon v-if="deleteLoading[image.name]" name="Loader2" :size="14" class="animate-spin" />
                <Icon v-else name="Trash2" :size="14" />
              </button>
              <Icon
                name="ChevronDown"
                :size="14"
                class="text-theme-muted transition-transform"
                :class="{ 'rotate-180': expandedImage === image.name }"
              />
            </div>
          </div>

          <!-- Expanded detail panel -->
          <div v-if="expandedImage === image.name" class="px-6 pb-4 border-t border-theme-primary/50">
            <!-- Tags loading -->
            <div v-if="tagsLoading" class="py-4 flex items-center justify-center">
              <Icon name="Loader2" :size="16" class="animate-spin text-theme-muted" />
              <span class="ml-2 text-sm text-theme-muted">Loading tags...</span>
            </div>

            <!-- Tags list -->
            <div v-else class="pt-4 space-y-3">
              <!-- Image info -->
              <div v-if="image.size || image.created" class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                <div v-if="image.size">
                  <span class="text-xs text-theme-muted block">Size</span>
                  <span class="text-theme-primary">{{ formatBytes(image.size) }}</span>
                </div>
                <div v-if="image.created">
                  <span class="text-xs text-theme-muted block">Created</span>
                  <span class="text-theme-primary text-xs">{{ image.created }}</span>
                </div>
                <div v-if="image.architecture">
                  <span class="text-xs text-theme-muted block">Architecture</span>
                  <span class="text-theme-primary">{{ image.architecture }}</span>
                </div>
              </div>

              <!-- Tags -->
              <div>
                <h5 class="text-xs font-medium text-theme-muted mb-2 uppercase tracking-wide">Tags</h5>
                <div v-if="getImageTags(image).length > 0" class="flex flex-wrap gap-2">
                  <div
                    v-for="tag in getImageTags(image)"
                    :key="tag"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-tertiary text-sm group"
                  >
                    <Icon name="Tag" :size="12" class="text-theme-muted" />
                    <span class="text-theme-primary font-mono text-xs">{{ tag }}</span>
                    <button
                      @click.stop="copyTagRef(image.name, tag)"
                      class="p-0.5 text-theme-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy full reference"
                      :aria-label="'Copy reference for ' + image.name + ':' + tag"
                    >
                      <Icon name="Copy" :size="12" />
                    </button>
                    <button
                      @click.stop="deleteImageTag(image.name, tag)"
                      class="p-0.5 text-theme-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete tag"
                      :aria-label="'Delete tag ' + tag + ' from ' + image.name"
                    >
                      <Icon name="X" :size="12" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-sm text-theme-muted">No tags found</p>
              </div>

              <!-- Full reference -->
              <div class="mt-2 p-3 bg-theme-secondary/50 rounded-lg">
                <p class="text-xs text-theme-muted mb-1">Pull Reference</p>
                <code class="text-xs font-mono text-theme-primary">{{ registryHost }}/{{ image.name }}:{{ getImageTags(image)[0] || 'latest' }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
