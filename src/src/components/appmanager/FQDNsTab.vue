<script setup>
import { ref } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

const showRegisterModal = ref(false)
const registering = ref(false)
const newFQDN = ref({ app_name: '', subdomain: '', backend_port: 80, ssl_enabled: false })

async function registerFQDN() {
  registering.value = true
  try {
    await store.registerFQDN(newFQDN.value)
    showRegisterModal.value = false
    newFQDN.value = { app_name: '', subdomain: '', backend_port: 80, ssl_enabled: false }
  } catch (e) {}
  finally { registering.value = false }
}

async function deregisterFQDN(fqdn) {
  if (!await confirm({
    title: 'Remove Domain',
    message: `Remove ${fqdn} from DNS?`,
    confirmText: 'Remove',
    variant: 'danger'
  })) return
  try { await store.deregisterFQDN(fqdn) } catch (e) {}
}

function onAppSelect(appName) {
  if (appName && !newFQDN.value.subdomain) newFQDN.value.subdomain = appName
}
</script>

<template>
  <div>
    <!-- Info Banner -->
    <div class="bg-success-muted border border-success/30 rounded-lg p-4 mb-6">
      <div class="flex items-start">
        <Icon name="Info" :size="20" class="text-success mt-0.5" />
        <div class="ml-3 text-sm">
          <p class="text-theme-primary font-medium">Pi-hole DNS Integration</p>
          <p class="mt-1 text-theme-secondary">
            Registered domains are automatically added to Pi-hole's custom DNS. 
            Access apps at <code class="bg-theme-tertiary px-1 rounded">subdomain.cubeos.cube</code>
          </p>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <span class="text-sm text-theme-secondary">{{ store.fqdns.length }} registered domains</span>
      <button @click="showRegisterModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors">
        <Icon name="Plus" :size="16" />Register Domain
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="store.fqdns.length === 0" class="text-center py-12">
      <Icon name="Globe" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No domains registered</h3>
      <p class="mt-1 text-sm text-theme-secondary">Register domains to access apps via friendly URLs</p>
    </div>

    <!-- FQDNs Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="fqdn in store.fqdns" :key="fqdn.id" class="bg-theme-secondary rounded-lg border border-theme-primary p-4 hover:border-accent/50 transition-colors">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <a :href="`http://${fqdn.fqdn}`" target="_blank" class="text-sm font-medium text-accent hover:underline flex items-center gap-1">
              <Icon name="Globe" :size="14" />{{ fqdn.fqdn }}<Icon name="ExternalLink" :size="12" class="text-theme-muted" />
            </a>
            <p class="mt-1 text-xs text-theme-secondary">App: {{ fqdn.app_name || 'Unknown' }}</p>
          </div>
          <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', fqdn.ssl_enabled ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-secondary']">
            <Icon :name="fqdn.ssl_enabled ? 'Lock' : 'Unlock'" :size="10" class="mr-1" />{{ fqdn.ssl_enabled ? 'HTTPS' : 'HTTP' }}
          </span>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs text-theme-secondary">
          <span class="flex items-center gap-1"><Icon name="Server" :size="12" />Backend port: {{ fqdn.backend_port }}</span>
          <button @click="deregisterFQDN(fqdn.fqdn)" class="p-1 text-error hover:bg-error-muted rounded transition-colors" title="Remove domain">
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
            <h3 class="text-lg font-medium text-theme-primary">Register Domain</h3>
            <button @click="showRegisterModal = false" class="text-theme-muted hover:text-theme-primary"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="registerFQDN" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <select v-model="newFQDN.app_name" required @change="onAppSelect(newFQDN.app_name)" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <option value="">Select an app...</option>
                <option v-for="app in store.apps" :key="app.id" :value="app.name">{{ app.display_name || app.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Subdomain</label>
              <div class="flex items-center">
                <input v-model="newFQDN.subdomain" type="text" required placeholder="my-app" pattern="[a-z0-9-]+" class="flex-1 rounded-l-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <span class="px-3 py-2 bg-theme-tertiary border border-l-0 border-theme-primary rounded-r-md text-sm text-theme-secondary">.cubeos.cube</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Backend Port</label>
              <input v-model.number="newFQDN.backend_port" type="number" required min="1" max="65535" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
              <p class="mt-1 text-xs text-theme-muted">The port your app listens on inside the container</p>
            </div>
            <div class="flex items-center">
              <input v-model="newFQDN.ssl_enabled" type="checkbox" id="ssl_enabled" class="rounded border-theme-primary text-accent focus:ring-accent">
              <label for="ssl_enabled" class="ml-2 text-sm text-theme-secondary">Enable SSL (requires NPM proxy)</label>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showRegisterModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="registering" class="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">{{ registering ? 'Registering...' : 'Register' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
