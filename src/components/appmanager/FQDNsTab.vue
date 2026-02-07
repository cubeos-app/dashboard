<script setup>
import { ref, computed } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

// Register modal state
const showRegisterModal = ref(false)
const registering = ref(false)
const newFQDN = ref({ app_name: '', subdomain: '', backend_port: 80, ssl_enabled: false })

// Detail panel state
const expandedFQDN = ref(null)
const fqdnDetail = ref(null)
const fqdnDetailLoading = ref(false)
const fqdnDetailError = ref(null)

// Edit modal state
const showEditModal = ref(false)
const editing = ref(false)
const editData = ref({ subdomain: '', backend_port: 80, ssl_enabled: false })
const editingFQDN = ref('')
const editError = ref('')

// Live preview for edit modal
const editPreviewFQDN = computed(() => {
  const sub = editData.value.subdomain || 'app'
  return `${sub}.cubeos.cube`
})

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

// Toggle detail panel (accordion — max 1 open)
async function toggleFQDNDetail(fqdn) {
  if (expandedFQDN.value === fqdn) {
    expandedFQDN.value = null
    fqdnDetail.value = null
    fqdnDetailError.value = null
  } else {
    expandedFQDN.value = fqdn
    fqdnDetail.value = null
    fqdnDetailError.value = null
    await loadFQDNDetail(fqdn)
  }
}

async function loadFQDNDetail(fqdn) {
  fqdnDetailLoading.value = true
  fqdnDetailError.value = null
  try {
    const data = await store.getFQDNDetail(fqdn)
    if (data) {
      fqdnDetail.value = data
    } else {
      fqdnDetailError.value = store.error || 'Failed to load FQDN details'
    }
  } catch (e) {
    fqdnDetailError.value = e.message
  } finally {
    fqdnDetailLoading.value = false
  }
}

// Edit modal
function openEditModal(detail) {
  editingFQDN.value = detail.fqdn
  editData.value = {
    subdomain: detail.subdomain,
    backend_port: detail.backend_port,
    ssl_enabled: detail.ssl_enabled || false
  }
  editError.value = ''
  showEditModal.value = true
}

async function saveEdit() {
  const subdomainChanged = editData.value.subdomain !== fqdnDetail.value?.subdomain
  if (subdomainChanged) {
    if (!await confirm({
      title: 'Change Domain',
      message: `This will change the FQDN from ${editingFQDN.value} to ${editPreviewFQDN.value}. Existing links will break.`,
      confirmText: 'Change',
      variant: 'warning'
    })) return
  }
  editing.value = true
  editError.value = ''
  try {
    await store.updateFQDN(editingFQDN.value, editData.value)
    showEditModal.value = false
    // Refresh detail if still expanded
    if (expandedFQDN.value === editingFQDN.value) {
      const newFqdn = editData.value.subdomain + '.cubeos.cube'
      expandedFQDN.value = newFqdn
      await loadFQDNDetail(newFqdn)
    }
  } catch (e) {
    editError.value = e.message
  } finally {
    editing.value = false
  }
}

// Register
async function registerFQDN() {
  registering.value = true
  try {
    await store.registerFQDN(newFQDN.value)
    showRegisterModal.value = false
    newFQDN.value = { app_name: '', subdomain: '', backend_port: 80, ssl_enabled: false }
  } catch (e) {}
  finally { registering.value = false }
}

// Deregister
async function deregisterFQDN(fqdn) {
  if (!await confirm({
    title: 'Remove Domain',
    message: `Remove ${fqdn} from DNS?`,
    confirmText: 'Remove',
    variant: 'danger'
  })) return
  try {
    await store.deregisterFQDN(fqdn)
    // Collapse detail if this FQDN was expanded
    if (expandedFQDN.value === fqdn) {
      expandedFQDN.value = null
      fqdnDetail.value = null
    }
  } catch (e) {}
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
      <button @click="showRegisterModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors">
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
      <div v-for="fqdn in store.fqdns" :key="fqdn.id"
        class="bg-theme-secondary rounded-lg border border-theme-primary p-4 cursor-pointer hover:border-accent/50 transition-colors"
        :class="{ 'border-accent/50': expandedFQDN === fqdn.fqdn }"
        @click="toggleFQDNDetail(fqdn.fqdn)"
        @keydown.enter="toggleFQDNDetail(fqdn.fqdn)"
        role="button"
        tabindex="0"
        :aria-expanded="expandedFQDN === fqdn.fqdn"
        :aria-label="'Toggle details for ' + fqdn.fqdn"
      >
        <!-- Card Header -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <a :href="`http${fqdn.ssl_enabled ? 's' : ''}://${fqdn.fqdn}`" target="_blank"
              @click.stop
              :aria-label="'Open ' + fqdn.fqdn + ' in new tab'"
              class="text-sm font-medium text-accent hover:underline flex items-center gap-1">
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
          <button @click.stop="deregisterFQDN(fqdn.fqdn)" class="p-1 text-error hover:bg-error-muted rounded transition-colors" title="Remove domain" :aria-label="'Remove domain ' + fqdn.fqdn">
            <Icon name="Trash2" :size="14" />
          </button>
        </div>

        <!-- Expandable Detail Panel -->
        <div v-if="expandedFQDN === fqdn.fqdn" class="mt-4 pt-4 border-t border-theme-primary" @click.stop>
          <!-- Loading skeleton -->
          <div v-if="fqdnDetailLoading" class="space-y-3">
            <div class="h-4 bg-theme-tertiary animate-pulse rounded-lg w-3/4"></div>
            <div class="h-4 bg-theme-tertiary animate-pulse rounded-lg w-1/2"></div>
            <div class="h-4 bg-theme-tertiary animate-pulse rounded-lg w-2/3"></div>
          </div>

          <!-- Error state -->
          <div v-else-if="fqdnDetailError" class="text-center py-3">
            <p class="text-xs text-error mb-2">{{ fqdnDetailError }}</p>
            <button @click.stop="loadFQDNDetail(fqdn.fqdn)" class="text-xs text-accent hover:underline" aria-label="Retry loading FQDN details">
              Retry
            </button>
          </div>

          <!-- Detail content -->
          <div v-else-if="fqdnDetail" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Full FQDN</p>
                <p class="text-theme-primary font-mono">{{ fqdnDetail.fqdn }}</p>
              </div>
              <div>
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Subdomain</p>
                <p class="text-theme-primary font-mono">{{ fqdnDetail.subdomain }}</p>
              </div>
              <div>
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Backend Port</p>
                <p class="text-theme-primary font-mono">{{ fqdnDetail.backend_port }}</p>
              </div>
              <div>
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">SSL Status</p>
                <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', fqdnDetail.ssl_enabled ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-secondary']">
                  <Icon :name="fqdnDetail.ssl_enabled ? 'Lock' : 'Unlock'" :size="10" class="mr-1" />
                  {{ fqdnDetail.ssl_enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
              <div v-if="fqdnDetail.npm_proxy_id">
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">NPM Proxy ID</p>
                <p class="text-theme-primary font-mono">{{ fqdnDetail.npm_proxy_id }}</p>
              </div>
              <div>
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Application</p>
                <p class="text-theme-primary">{{ fqdnDetail.app_name || '-' }}</p>
              </div>
              <div v-if="fqdnDetail.created_at">
                <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Created</p>
                <p class="text-theme-secondary flex items-center gap-1">
                  <Icon name="Clock" :size="12" />{{ formatDate(fqdnDetail.created_at) }}
                </p>
              </div>
            </div>

            <!-- Edit button -->
            <div class="pt-2">
              <button @click.stop="openEditModal(fqdnDetail)"
                :aria-label="'Edit domain ' + fqdnDetail.fqdn"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary rounded-md transition-colors">
                <Icon name="Edit3" :size="12" />Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Register Modal -->
    <div v-if="showRegisterModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-theme-overlay backdrop-blur-sm" @click="showRegisterModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-label="Register Domain">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Register Domain</h3>
            <button @click="showRegisterModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="registerFQDN" class="space-y-4">
            <div>
              <label for="reg-app" class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <select id="reg-app" v-model="newFQDN.app_name" required @change="onAppSelect(newFQDN.app_name)" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <option value="">Select an app...</option>
                <option v-for="app in store.apps" :key="app.id" :value="app.name">{{ app.display_name || app.name }}</option>
              </select>
            </div>
            <div>
              <label for="reg-subdomain" class="block text-sm font-medium text-theme-secondary mb-1">Subdomain</label>
              <div class="flex items-center">
                <input id="reg-subdomain" v-model="newFQDN.subdomain" type="text" required placeholder="my-app" pattern="[a-z0-9-]+" class="flex-1 rounded-l-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <span class="px-3 py-2 bg-theme-tertiary border border-l-0 border-theme-primary rounded-r-md text-sm text-theme-secondary">.cubeos.cube</span>
              </div>
            </div>
            <div>
              <label for="reg-backend-port" class="block text-sm font-medium text-theme-secondary mb-1">Backend Port</label>
              <input id="reg-backend-port" v-model.number="newFQDN.backend_port" type="number" required min="1" max="65535" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
              <p class="mt-1 text-xs text-theme-muted">The port your app listens on inside the container</p>
            </div>
            <div class="flex items-center">
              <input v-model="newFQDN.ssl_enabled" type="checkbox" id="ssl_enabled" class="rounded border-theme-primary text-accent focus:ring-accent">
              <label for="ssl_enabled" class="ml-2 text-sm text-theme-secondary">Enable SSL (requires NPM proxy)</label>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showRegisterModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="registering" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">{{ registering ? 'Registering...' : 'Register' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-theme-overlay backdrop-blur-sm" @click="showEditModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-label="Edit Domain">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Edit Domain</h3>
            <button @click="showEditModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="saveEdit" class="space-y-4">
            <!-- App name (read-only) -->
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <p class="text-sm text-theme-primary py-2">{{ fqdnDetail?.app_name || '-' }}</p>
            </div>

            <!-- Subdomain -->
            <div>
              <label for="edit-subdomain" class="block text-sm font-medium text-theme-secondary mb-1">Subdomain</label>
              <div class="flex items-center">
                <input id="edit-subdomain" v-model="editData.subdomain" type="text" required placeholder="my-app" pattern="[a-z0-9-]+"
                  class="flex-1 rounded-l-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <span class="px-3 py-2 bg-theme-tertiary border border-l-0 border-theme-primary rounded-r-md text-sm text-theme-secondary">.cubeos.cube</span>
              </div>
              <p class="mt-1 text-xs text-theme-muted">
                Preview: <span class="font-mono text-theme-primary">{{ editPreviewFQDN }}</span>
              </p>
            </div>

            <!-- Backend Port -->
            <div>
              <label for="edit-backend-port" class="block text-sm font-medium text-theme-secondary mb-1">Backend Port</label>
              <input id="edit-backend-port" v-model.number="editData.backend_port" type="number" required min="1" max="65535"
                class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
              <p class="mt-1 text-xs text-theme-muted">The port your app listens on inside the container</p>
            </div>

            <!-- SSL Toggle -->
            <div class="flex items-center">
              <input v-model="editData.ssl_enabled" type="checkbox" id="edit_ssl_enabled" class="rounded border-theme-primary text-accent focus:ring-accent">
              <label for="edit_ssl_enabled" class="ml-2 text-sm text-theme-secondary">Enable SSL (requires NPM proxy)</label>
            </div>

            <!-- Error message -->
            <p v-if="editError" class="text-xs text-error">{{ editError }}</p>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="editing" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">
                {{ editing ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
