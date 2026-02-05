<script setup>
import { ref, onMounted } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

const registryStatus = ref(null)
const registryImages = ref([])
const loading = ref(false)
const caching = ref(false)
const newImageRef = ref('')

onMounted(() => {
  fetchRegistryStatus()
  fetchRegistryImages()
})

async function fetchRegistryStatus() {
  loading.value = true
  try { registryStatus.value = await store.getRegistryStatus() } catch (e) {}
  finally { loading.value = false }
}

async function fetchRegistryImages() {
  try { registryImages.value = await store.getRegistryImages() } catch (e) {}
}

async function initRegistry() {
  loading.value = true
  try {
    await store.initRegistry()
    await fetchRegistryStatus()
    await fetchRegistryImages()
  } catch (e) {}
  finally { loading.value = false }
}

async function cacheImage() {
  if (!newImageRef.value.trim()) return
  caching.value = true
  try {
    await store.cacheImage(newImageRef.value.trim())
    newImageRef.value = ''
    await fetchRegistryImages()
  } catch (e) {}
  finally { caching.value = false }
}

async function deleteImage(name, tag) {
  if (!await confirm({
    title: 'Delete Image Tag',
    message: `Delete ${name}:${tag} from local registry?`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return
  try {
    await store.deleteRegistryImage(name, tag)
    await fetchRegistryImages()
  } catch (e) {}
}
</script>

<template>
  <div>
    <!-- Info Banner -->
    <div class="bg-accent-muted border border-accent/30 rounded-lg p-4 mb-6">
      <div class="flex items-start">
        <Icon name="Info" :size="20" class="text-accent mt-0.5" />
        <div class="ml-3 text-sm">
          <p class="text-theme-primary font-medium">Offline Docker Registry</p>
          <p class="mt-1 text-theme-secondary">
            Cache Docker images locally for offline deployment. Images are stored at <code class="bg-theme-tertiary px-1 rounded">localhost:5000</code>
          </p>
        </div>
      </div>
    </div>

    <!-- Registry Status -->
    <div class="bg-theme-secondary rounded-lg border border-theme-primary p-6 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-medium text-theme-primary">Registry Status</h3>
          <div v-if="loading" class="mt-2 flex items-center gap-2 text-sm text-theme-secondary">
            <Icon name="Loader2" :size="16" class="animate-spin" />Loading...
          </div>
          <div v-else-if="registryStatus" class="mt-2 flex items-center gap-4 text-sm">
            <span :class="['flex items-center gap-1', registryStatus.running ? 'text-success' : 'text-error']">
              <Icon :name="registryStatus.running ? 'CheckCircle' : 'XCircle'" :size="14" />
              {{ registryStatus.running ? 'Running' : 'Stopped' }}
            </span>
            <span class="text-theme-secondary">{{ registryStatus.image_count || 0 }} images</span>
            <span class="text-theme-secondary">{{ registryStatus.tag_count || 0 }} tags</span>
          </div>
          <div v-else class="mt-2 text-sm text-theme-muted">Registry not initialized</div>
        </div>
        <button v-if="!registryStatus?.running" @click="initRegistry" :disabled="loading" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
          <Icon name="Play" :size="16" />Initialize Registry
        </button>
      </div>
    </div>

    <!-- Cache Image Form -->
    <div class="bg-theme-secondary rounded-lg border border-theme-primary p-6 mb-6">
      <h3 class="text-lg font-medium text-theme-primary mb-4">Cache Image</h3>
      <form @submit.prevent="cacheImage" class="flex gap-4">
        <input v-model="newImageRef" type="text" placeholder="docker.io/library/nginx:latest" class="flex-1 rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm" :disabled="caching || !registryStatus?.running">
        <button type="submit" :disabled="caching || !registryStatus?.running || !newImageRef.trim()" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
          <Icon :name="caching ? 'Loader2' : 'Download'" :size="16" :class="caching ? 'animate-spin' : ''" />
          {{ caching ? 'Caching...' : 'Cache' }}
        </button>
      </form>
      <p class="mt-2 text-xs text-theme-muted">Image will be pulled and stored in the local registry for offline use</p>
    </div>

    <!-- Cached Images -->
    <div class="bg-theme-secondary rounded-lg border border-theme-primary overflow-hidden">
      <div class="px-6 py-4 border-b border-theme-primary">
        <h3 class="text-lg font-medium text-theme-primary">Cached Images</h3>
      </div>
      <div v-if="registryImages.length === 0" class="p-6 text-center">
        <Icon name="Container" :size="48" class="mx-auto text-theme-muted" />
        <p class="mt-4 text-sm text-theme-secondary">No images cached yet</p>
      </div>
      <div v-else class="divide-y divide-theme-primary">
        <div v-for="image in registryImages" :key="image.name" class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm font-medium text-theme-primary font-mono">{{ image.name }}</h4>
              <div class="mt-1 flex flex-wrap gap-2">
                <span v-for="tag in image.tags" :key="tag" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-theme-tertiary text-theme-secondary">
                  <Icon name="Tag" :size="10" />{{ tag }}
                  <button @click="deleteImage(image.name, tag)" class="ml-1 text-error hover:text-error/80" title="Delete tag">
                    <Icon name="X" :size="10" />
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
