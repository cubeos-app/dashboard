<script setup>
import { ref, computed } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import Icon from '@/components/ui/Icon.vue'
import ConfigEditorModal from './ConfigEditorModal.vue'

const store = useAppManagerStore()

const showRegisterModal = ref(false)
const showConfigModal = ref(false)
const configLoading = ref(false)
const selectedApp = ref(null)
const appConfig = ref({ compose: '', env: '' })

const newApp = ref({
  name: '',
  display_name: '',
  description: '',
  type: 'user',
  source: 'custom',
  github_repo: '',
  compose_path: ''
})

const typeFilter = ref('')
const controllingApp = ref(null)

const filteredApps = computed(() => {
  if (!typeFilter.value) return store.apps
  return store.apps.filter(a => a.type === typeFilter.value)
})

async function registerApp() {
  try {
    await store.registerApp(newApp.value)
    showRegisterModal.value = false
    resetForm()
  } catch (e) {}
}

function resetForm() {
  newApp.value = { name: '', display_name: '', description: '', type: 'user', source: 'custom', github_repo: '', compose_path: '' }
}

async function toggleApp(app) {
  try {
    if (app.enabled) await store.disableApp(app.name)
    else await store.enableApp(app.name)
  } catch (e) {}
}

async function deleteApp(app) {
  if (!confirm(`Unregister "${app.display_name || app.name}"?`)) return
  try { await store.unregisterApp(app.name) } catch (e) {}
}

async function startAppContainer(app) {
  controllingApp.value = app.name
  try { await store.startApp(app.name) } catch (e) {}
  finally { controllingApp.value = null }
}

async function stopAppContainer(app) {
  controllingApp.value = app.name
  try { await store.stopApp(app.name) } catch (e) {}
  finally { controllingApp.value = null }
}

async function restartAppContainer(app) {
  controllingApp.value = app.name
  try { await store.restartApp(app.name) } catch (e) {}
  finally { controllingApp.value = null }
}

async function openConfigEditor(app) {
  selectedApp.value = app
  configLoading.value = true
  showConfigModal.value = true
  
  try {
    const config = await store.getAppConfig(app.name)
    appConfig.value = {
      compose: config.compose || '',
      env: config.env || ''
    }
  } catch (e) {
    appConfig.value = { compose: '', env: '' }
  } finally {
    configLoading.value = false
  }
}

async function saveConfig({ compose, env, recreate }) {
  if (!selectedApp.value) return
  configLoading.value = true
  
  try {
    await store.saveAppConfig(selectedApp.value.name, compose, env, recreate)
    showConfigModal.value = false
  } catch (e) {
    alert('Failed to save config: ' + e.message)
  } finally {
    configLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div class="flex items-center gap-4">
        <select v-model="typeFilter" class="rounded-md border-theme-primary bg-theme-secondary text-theme-primary text-sm focus:ring-accent focus:border-accent">
          <option value="">All Apps</option>
          <option value="system">System</option>
          <option value="user">User</option>
        </select>
        <span class="text-sm text-theme-secondary">{{ filteredApps.length }} apps</span>
      </div>
      <button @click="showRegisterModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors">
        <Icon name="Plus" :size="16" />
        Register App
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="filteredApps.length === 0" class="text-center py-12">
      <Icon name="Inbox" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No apps found</h3>
      <p class="mt-1 text-sm text-theme-secondary">Register a new application to get started</p>
    </div>

    <!-- Apps Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="app in filteredApps" :key="app.id" class="bg-theme-secondary rounded-lg border border-theme-primary p-4 hover:border-accent/50 transition-colors">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center">
            <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center">
              <Icon name="Box" :size="20" class="text-accent" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-theme-primary">{{ app.display_name || app.name }}</h3>
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', app.type === 'system' ? 'bg-accent-muted text-accent' : 'bg-theme-tertiary text-theme-secondary']">
                {{ app.type }}
              </span>
            </div>
          </div>
          <!-- Edit Config Button -->
          <button @click="openConfigEditor(app)" class="p-1.5 text-theme-secondary hover:text-accent hover:bg-accent-muted rounded transition-colors" title="Edit Config">
            <Icon name="FileCode" :size="16" />
          </button>
        </div>

        <p v-if="app.description" class="mt-2 text-sm text-theme-secondary line-clamp-2">{{ app.description }}</p>

        <!-- Ports -->
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="port in (app.ports || []).slice(0, 3)" :key="port.port" class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-theme-tertiary text-theme-secondary">
            <Icon name="Plug" :size="10" class="mr-1" />{{ port.port }}
          </span>
          <span v-if="(app.ports || []).length > 3" class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-theme-tertiary text-theme-secondary">+{{ app.ports.length - 3 }} more</span>
        </div>

        <!-- FQDNs -->
        <div v-if="app.fqdns && app.fqdns.length" class="mt-2 flex flex-wrap gap-2">
          <a v-for="fqdn in app.fqdns" :key="fqdn.fqdn" :href="`http://${fqdn.fqdn}`" target="_blank" class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-success-muted text-success hover:bg-success/20">
            <Icon name="Globe" :size="10" class="mr-1" />{{ fqdn.fqdn }}
          </a>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex items-center justify-between border-t border-theme-primary pt-3">
          <div class="flex items-center gap-1">
            <button @click="startAppContainer(app)" :disabled="controllingApp === app.name" class="p-1.5 text-success hover:bg-success-muted rounded transition-colors disabled:opacity-50" title="Start">
              <Icon name="Play" :size="14" />
            </button>
            <button @click="stopAppContainer(app)" :disabled="controllingApp === app.name" class="p-1.5 text-error hover:bg-error-muted rounded transition-colors disabled:opacity-50" title="Stop">
              <Icon name="Square" :size="14" />
            </button>
            <button @click="restartAppContainer(app)" :disabled="controllingApp === app.name" class="p-1.5 text-accent hover:bg-accent-muted rounded transition-colors disabled:opacity-50" title="Restart">
              <Icon name="RotateCcw" :size="14" />
            </button>
            <label class="relative inline-flex items-center cursor-pointer ml-2">
              <input type="checkbox" :checked="app.enabled" @change="toggleApp(app)" class="sr-only peer">
              <div class="w-9 h-5 bg-theme-tertiary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-theme-primary after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
          <button v-if="app.type !== 'system'" @click="deleteApp(app)" class="p-1.5 text-error hover:bg-error-muted rounded transition-colors" title="Unregister">
            <Icon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Register Modal -->
    <div v-if="showRegisterModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="showRegisterModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Register Application</h3>
            <button @click="showRegisterModal = false" class="text-theme-muted hover:text-theme-primary"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="registerApp" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Name (identifier)</label>
              <input v-model="newApp.name" type="text" required placeholder="my-app" pattern="[a-z0-9-]+" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Display Name</label>
              <input v-model="newApp.display_name" type="text" required placeholder="My Application" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Description</label>
              <textarea v-model="newApp.description" rows="2" placeholder="Brief description..." class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Type</label>
                <select v-model="newApp.type" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <option value="user">User</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Source</label>
                <select v-model="newApp.source" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <option value="custom">Custom</option>
                  <option value="cubeos">CubeOS</option>
                  <option value="casaos">CasaOS</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Compose Path (optional)</label>
              <input v-model="newApp.compose_path" type="text" placeholder="/path/to/docker-compose.yml" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showRegisterModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors">Register</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Config Editor Modal -->
    <ConfigEditorModal
      :show="showConfigModal"
      :app-name="selectedApp?.display_name || selectedApp?.name"
      :compose="appConfig.compose"
      :env="appConfig.env"
      :loading="configLoading"
      @close="showConfigModal = false"
      @save="saveConfig"
    />
  </div>
</template>
