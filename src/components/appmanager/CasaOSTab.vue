<script setup>
import { ref } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

const popularStores = [
  { name: 'CasaOS Official', url: 'https://github.com/IceWhaleTech/CasaOS-AppStore/raw/main/Apps' },
  { name: 'BigBearCasaOS', url: 'https://github.com/bigbeartechworld/big-bear-casaos/raw/master/Apps' }
]

const selectedStore = ref('')
const storeApps = ref([])
const loadingStore = ref(false)
const customStoreUrl = ref('')

const pastedJson = ref('')
const previewCompose = ref('')
const showPreviewModal = ref(false)
const previewApp = ref(null)
const importing = ref(false)

async function fetchStore(url) {
  loadingStore.value = true
  storeApps.value = []
  try {
    const apps = await store.fetchCasaOSStore(url)
    storeApps.value = apps || []
  } catch (e) {
    // Store fetch failed
  }
  finally { loadingStore.value = false }
}

function selectStore(url) {
  selectedStore.value = url
  fetchStore(url)
}

function loadCustomStore() {
  if (!customStoreUrl.value.trim()) return
  selectStore(customStoreUrl.value.trim())
}

async function previewAppJson(json) {
  try {
    const result = await store.previewCasaOSApp(json)
    previewCompose.value = result.compose
    previewApp.value = result.app
    showPreviewModal.value = true
  } catch (e) {
    await confirm({
      title: 'Parse Error',
      message: 'Failed to parse CasaOS JSON: ' + e.message,
      confirmText: 'OK',
      cancelText: '',
      variant: 'danger'
    })
  }
}

async function previewPastedJson() {
  if (!pastedJson.value.trim()) return
  await previewAppJson(pastedJson.value.trim())
}

async function previewStoreApp(app) {
  const json = JSON.stringify(app)
  await previewAppJson(json)
}

async function importApp() {
  if (!previewApp.value) return
  importing.value = true
  try {
    await store.importCasaOSApp(JSON.stringify(previewApp.value))
    showPreviewModal.value = false
    previewApp.value = null
    previewCompose.value = ''
    pastedJson.value = ''
  } catch (e) {
    await confirm({
      title: 'Import Failed',
      message: 'Failed to import app: ' + e.message,
      confirmText: 'OK',
      cancelText: '',
      variant: 'danger'
    })
  }
  finally { importing.value = false }
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Left: Browse Stores -->
    <div>
      <div class="bg-theme-secondary rounded-lg border border-theme-primary p-6">
        <h3 class="text-lg font-medium text-theme-primary mb-4 flex items-center gap-2">
          <Icon name="Store" :size="20" />Browse CasaOS Stores
        </h3>
        
        <!-- Popular Stores -->
        <div class="space-y-2 mb-4">
          <button v-for="s in popularStores" :key="s.url" @click="selectStore(s.url)" :class="['w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors', selectedStore === s.url ? 'border-accent bg-accent-muted' : 'border-theme-primary hover:border-accent/50']">
            <span class="text-sm font-medium text-theme-primary">{{ s.name }}</span>
            <Icon name="ChevronRight" :size="16" class="text-theme-muted" />
          </button>
        </div>

        <!-- Custom URL -->
        <div class="flex gap-2">
          <input v-model="customStoreUrl" type="text" placeholder="Custom store URL..." class="flex-1 rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
          <button @click="loadCustomStore" class="px-3 py-2 text-sm font-medium text-accent hover:bg-accent-muted rounded-md transition-colors">
            <Icon name="ExternalLink" :size="16" />
          </button>
        </div>

        <!-- Store Apps List -->
        <div v-if="loadingStore" class="mt-6 flex items-center justify-center py-8">
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>
        <div v-else-if="storeApps.length > 0" class="mt-6 space-y-2 max-h-96 overflow-y-auto">
          <div v-for="app in storeApps" :key="app.name" class="flex items-center justify-between p-3 bg-theme-tertiary rounded-lg">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-theme-secondary flex items-center justify-center">
                <Icon name="Box" :size="16" class="text-accent" />
              </div>
              <div>
                <span class="text-sm font-medium text-theme-primary">{{ app.title || app.name }}</span>
                <p v-if="app.tagline" class="text-xs text-theme-muted line-clamp-1">{{ app.tagline }}</p>
              </div>
            </div>
            <button @click="previewStoreApp(app)" class="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-muted rounded transition-colors">
              <Icon name="Eye" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Paste JSON -->
    <div>
      <div class="bg-theme-secondary rounded-lg border border-theme-primary p-6">
        <h3 class="text-lg font-medium text-theme-primary mb-4 flex items-center gap-2">
          <Icon name="FileJson" :size="20" />Paste CasaOS JSON
        </h3>
        <textarea v-model="pastedJson" rows="12" placeholder='Paste CasaOS app JSON here...

{
  "name": "my-app",
  "title": "My Application",
  "container": {
    "image": "nginx:latest",
    "ports": [{"container": "80", "host": "8080"}]
  }
}' class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm font-mono"></textarea>
        <div class="mt-4 flex justify-end">
          <button @click="previewPastedJson" :disabled="!pastedJson.trim()" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
            <Icon name="Eye" :size="16" />Preview & Import
          </button>
        </div>
      </div>

      <!-- Help -->
      <div class="mt-4 bg-theme-tertiary rounded-lg p-4">
        <h4 class="text-sm font-medium text-theme-primary mb-2 flex items-center gap-2">
          <Icon name="HelpCircle" :size="16" />How it works
        </h4>
        <ul class="text-xs text-theme-secondary space-y-1">
          <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />CasaOS JSON is converted to docker-compose.yml</li>
          <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />Paths are mapped: /DATA/AppData/ becomes /cubeos/userapps/</li>
          <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />App is registered in AppManager with allocated ports</li>
          <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />Use profiles to control which apps run</li>
        </ul>
      </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreviewModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="showPreviewModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Preview: {{ previewApp?.title || previewApp?.name }}</h3>
            <button @click="showPreviewModal = false" class="text-theme-muted hover:text-theme-primary"><Icon name="X" :size="20" /></button>
          </div>
          <div class="mb-4">
            <h4 class="text-sm font-medium text-theme-secondary mb-2">Generated docker-compose.yml</h4>
            <pre class="bg-theme-primary rounded-lg p-4 text-xs font-mono text-theme-primary overflow-x-auto">{{ previewCompose }}</pre>
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showPreviewModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
            <button @click="importApp" :disabled="importing" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
              <Icon :name="importing ? 'Loader2' : 'Download'" :size="16" :class="importing ? 'animate-spin' : ''" />
              {{ importing ? 'Importing...' : 'Import App' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
