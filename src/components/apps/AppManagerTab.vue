<script setup>
/**
 * AppManagerTab.vue — S05 Component
 *
 * Advanced-only Manager tab that consolidates FQDNs, NPM proxy hosts,
 * and CasaOS import into sub-tabs within the Apps page.
 *
 * Pattern: Sub-tabs within a tab (following AppStoreTab's Browse/Installed pattern).
 *
 * Stores:
 *   - useAppManagerStore → FQDNs, NPM status, CasaOS import
 *   - useNPMStore → NPM proxy hosts CRUD
 */
import { ref, onMounted } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { useNPMStore } from '@/stores/npm'
import { confirm } from '@/utils/confirmDialog'
import { makeFqdn, getDomainSuffix, makePlaceholder } from '@/utils/domain'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()
const npmStore = useNPMStore()

// ─── Sub-tab Management ───────────────────────────────────────
const SUB_TABS = [
  { key: 'fqdns', label: 'Domains', icon: 'Globe' },
  { key: 'npm', label: 'Proxy', icon: 'Shield' },
  { key: 'casaos', label: 'Import', icon: 'Download' }
]
const activeSubTab = ref('fqdns')

// ─── Data Fetching ────────────────────────────────────────────
onMounted(() => {
  store.fetchFQDNs()
  npmStore.fetchAll()
})

// ═══════════════════════════════════════════════════════════════
// FQDN Management
// ═══════════════════════════════════════════════════════════════

const showRegisterModal = ref(false)
const registering = ref(false)
const newFQDN = ref({ app_name: '', subdomain: '', backend_port: 80, ssl_enabled: false })

const expandedFQDN = ref(null)
const fqdnDetail = ref(null)
const fqdnDetailLoading = ref(false)
const fqdnDetailError = ref(null)

const showEditModal = ref(false)
const editing = ref(false)
const editData = ref({ subdomain: '', backend_port: 80, ssl_enabled: false })
const editingFQDN = ref('')
const editError = ref('')

import { computed } from 'vue'
const editPreviewFQDN = computed(() => makeFqdn(editData.value.subdomain || 'app'))

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

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
    fqdnDetail.value = data || null
    if (!data) fqdnDetailError.value = store.error || 'Failed to load FQDN details'
  } catch (e) {
    fqdnDetailError.value = e.message
  } finally {
    fqdnDetailLoading.value = false
  }
}

function openEditModal(detail) {
  editingFQDN.value = detail.fqdn
  editData.value = { subdomain: detail.subdomain, backend_port: detail.backend_port, ssl_enabled: detail.ssl_enabled || false }
  editError.value = ''
  showEditModal.value = true
}

async function saveEdit() {
  const subdomainChanged = editData.value.subdomain !== fqdnDetail.value?.subdomain
  if (subdomainChanged && !await confirm({
    title: 'Change Domain',
    message: `This will change the FQDN from ${editingFQDN.value} to ${editPreviewFQDN.value}. Existing links will break.`,
    confirmText: 'Change',
    variant: 'warning'
  })) return
  editing.value = true
  editError.value = ''
  try {
    await store.updateFQDN(editingFQDN.value, editData.value)
    showEditModal.value = false
    if (expandedFQDN.value === editingFQDN.value) {
      const newFqdn = makeFqdn(editData.value.subdomain)
      expandedFQDN.value = newFqdn
      await loadFQDNDetail(newFqdn)
    }
  } catch (e) { editError.value = e.message }
  finally { editing.value = false }
}

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
  if (!await confirm({ title: 'Remove Domain', message: `Remove ${fqdn} from DNS?`, confirmText: 'Remove', variant: 'danger' })) return
  try {
    await store.deregisterFQDN(fqdn)
    if (expandedFQDN.value === fqdn) { expandedFQDN.value = null; fqdnDetail.value = null }
  } catch (e) {}
}

function onAppSelect(appName) {
  if (appName && !newFQDN.value.subdomain) newFQDN.value.subdomain = appName
}

// ═══════════════════════════════════════════════════════════════
// NPM Proxy Management
// ═══════════════════════════════════════════════════════════════

const showCreateHostModal = ref(false)
const createHostLoading = ref(false)
const deleteHostLoading = ref({})
const npmError = ref(null)

const hostForm = ref({
  domain_names: '', forward_host: '', forward_port: 80, forward_scheme: 'http',
  ssl_forced: false, certificate_id: 0, block_exploits: true, allow_websocket_upgrade: true
})

function openCreateHost() {
  hostForm.value = {
    domain_names: '', forward_host: '', forward_port: 80, forward_scheme: 'http',
    ssl_forced: false, certificate_id: 0, block_exploits: true, allow_websocket_upgrade: true
  }
  npmError.value = null
  showCreateHostModal.value = true
}

async function saveHost() {
  if (!hostForm.value.domain_names.trim() || !hostForm.value.forward_host.trim()) return
  createHostLoading.value = true
  npmError.value = null
  try {
    const domains = hostForm.value.domain_names.split(',').map(d => d.trim()).filter(Boolean)
    const domainPattern = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
    const invalid = domains.find(d => !domainPattern.test(d))
    if (invalid) { npmError.value = `Invalid domain format: ${invalid}`; createHostLoading.value = false; return }
    await npmStore.createHost({
      domain_names: domains, forward_host: hostForm.value.forward_host.trim(),
      forward_port: Number(hostForm.value.forward_port) || 80, forward_scheme: hostForm.value.forward_scheme,
      ssl_forced: hostForm.value.ssl_forced, certificate_id: hostForm.value.certificate_id || 0,
      block_exploits: hostForm.value.block_exploits, allow_websocket_upgrade: hostForm.value.allow_websocket_upgrade
    })
    showCreateHostModal.value = false
  } catch (e) { npmError.value = 'Failed to create host: ' + e.message }
  finally { createHostLoading.value = false }
}

async function deleteHost(host) {
  const displayName = host.domain_names?.join(', ') || host.domain || `Host #${host.id}`
  if (!await confirm({ title: 'Delete Proxy Host', message: `Delete proxy host for "${displayName}"?`, confirmText: 'Delete', variant: 'danger' })) return
  deleteHostLoading.value = { ...deleteHostLoading.value, [host.id]: true }
  npmError.value = null
  try { await npmStore.deleteHost(host.id) }
  catch (e) { npmError.value = 'Failed to delete host: ' + e.message }
  finally { deleteHostLoading.value = { ...deleteHostLoading.value, [host.id]: false } }
}

function getDomainDisplay(host) { return Array.isArray(host.domain_names) ? host.domain_names.join(', ') : host.domain || host.domain_names || '-' }
function getForwardDisplay(host) { return `${host.forward_scheme || 'http'}://${host.forward_host || '-'}:${host.forward_port || 80}` }
function hostStatusClass(host) { return host.enabled === false ? 'bg-theme-tertiary text-theme-muted' : 'bg-success-muted text-success' }
function hostStatusText(host) { return host.enabled === false ? 'Disabled' : 'Active' }

// ═══════════════════════════════════════════════════════════════
// CasaOS Import
// ═══════════════════════════════════════════════════════════════

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

async function fetchCasaStore(url) {
  loadingStore.value = true; storeApps.value = []
  try { storeApps.value = await store.fetchCasaOSStore(url) || [] }
  catch (e) {}
  finally { loadingStore.value = false }
}

function selectStore(url) { selectedStore.value = url; fetchCasaStore(url) }
function loadCustomStore() { if (customStoreUrl.value.trim()) selectStore(customStoreUrl.value.trim()) }

async function previewAppJson(json) {
  try {
    const result = await store.previewCasaOSApp(json)
    previewCompose.value = result.compose; previewApp.value = result.app; showPreviewModal.value = true
  } catch (e) {
    await confirm({ title: 'Parse Error', message: 'Failed to parse CasaOS JSON: ' + e.message, confirmText: 'OK', cancelText: '', variant: 'danger' })
  }
}

async function previewPastedJson() { if (pastedJson.value.trim()) await previewAppJson(pastedJson.value.trim()) }
async function previewStoreApp(app) { await previewAppJson(JSON.stringify(app)) }

async function importApp() {
  if (!previewApp.value) return
  importing.value = true
  try {
    await store.importCasaOSApp(JSON.stringify(previewApp.value))
    showPreviewModal.value = false; previewApp.value = null; previewCompose.value = ''; pastedJson.value = ''
  } catch (e) {
    await confirm({ title: 'Import Failed', message: 'Failed to import app: ' + e.message, confirmText: 'OK', cancelText: '', variant: 'danger' })
  }
  finally { importing.value = false }
}
</script>

<template>
  <div class="space-y-6">

    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg w-fit">
      <button
        v-for="tab in SUB_TABS"
        :key="tab.key"
        @click="activeSubTab = tab.key"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        :class="activeSubTab === tab.key
          ? 'bg-theme-card text-theme-primary shadow-sm'
          : 'text-theme-secondary hover:text-theme-primary'"
      >
        <Icon :name="tab.icon" :size="14" />
        {{ tab.label }}
      </button>
    </div>

    <!-- ═══════════ FQDNs Sub-tab ═══════════ -->
    <template v-if="activeSubTab === 'fqdns'">
      <!-- Info -->
      <div class="bg-success-muted border border-success/30 rounded-lg p-4">
        <div class="flex items-start">
          <Icon name="Info" :size="20" class="text-success mt-0.5" />
          <div class="ml-3 text-sm">
            <p class="text-theme-primary font-medium">Pi-hole DNS Integration</p>
            <p class="mt-1 text-theme-secondary">
              Registered domains are automatically added to Pi-hole's custom DNS.
              Access apps at <code class="bg-theme-tertiary px-1 rounded">subdomain{{ getDomainSuffix() }}</code>
            </p>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-theme-secondary">{{ store.fqdns.length }} registered domains</span>
        <button @click="showRegisterModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors">
          <Icon name="Plus" :size="16" />Register Domain
        </button>
      </div>

      <!-- Empty -->
      <div v-if="store.fqdns.length === 0" class="text-center py-12">
        <Icon name="Globe" :size="48" class="mx-auto text-theme-muted" />
        <h3 class="mt-4 text-lg font-medium text-theme-primary">No domains registered</h3>
        <p class="mt-1 text-sm text-theme-secondary">Register domains to access apps via friendly URLs</p>
      </div>

      <!-- FQDN Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="fqdn in store.fqdns" :key="fqdn.id"
          class="bg-theme-card rounded-lg border border-theme-primary p-4 cursor-pointer hover:border-accent/50 transition-colors"
          :class="{ 'border-accent/50': expandedFQDN === fqdn.fqdn }"
          @click="toggleFQDNDetail(fqdn.fqdn)"
          @keydown.enter="toggleFQDNDetail(fqdn.fqdn)"
          role="button" tabindex="0"
          :aria-expanded="expandedFQDN === fqdn.fqdn"
          :aria-label="'Toggle details for ' + fqdn.fqdn"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <a :href="`http${fqdn.ssl_enabled ? 's' : ''}://${fqdn.fqdn}`" target="_blank" @click.stop
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

          <!-- Expanded detail -->
          <div v-if="expandedFQDN === fqdn.fqdn" class="mt-4 pt-4 border-t border-theme-primary" @click.stop>
            <div v-if="fqdnDetailLoading" class="space-y-3">
              <div class="h-4 bg-theme-tertiary animate-pulse rounded-lg w-3/4"></div>
              <div class="h-4 bg-theme-tertiary animate-pulse rounded-lg w-1/2"></div>
            </div>
            <div v-else-if="fqdnDetailError" class="text-center py-3">
              <p class="text-xs text-error mb-2">{{ fqdnDetailError }}</p>
              <button @click.stop="loadFQDNDetail(fqdn.fqdn)" class="text-xs text-accent hover:underline">Retry</button>
            </div>
            <div v-else-if="fqdnDetail" class="space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Full FQDN</p>
                  <p class="text-theme-primary font-mono">{{ fqdnDetail.fqdn }}</p>
                </div>
                <div>
                  <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Backend Port</p>
                  <p class="text-theme-primary font-mono">{{ fqdnDetail.backend_port }}</p>
                </div>
                <div>
                  <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">SSL Status</p>
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', fqdnDetail.ssl_enabled ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-secondary']">
                    <Icon :name="fqdnDetail.ssl_enabled ? 'Lock' : 'Unlock'" :size="10" class="mr-1" />{{ fqdnDetail.ssl_enabled ? 'Enabled' : 'Disabled' }}
                  </span>
                </div>
                <div v-if="fqdnDetail.npm_proxy_id">
                  <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">NPM Proxy ID</p>
                  <p class="text-theme-primary font-mono">{{ fqdnDetail.npm_proxy_id }}</p>
                </div>
                <div v-if="fqdnDetail.created_at">
                  <p class="text-theme-muted uppercase tracking-wider text-[10px] mb-0.5">Created</p>
                  <p class="text-theme-secondary flex items-center gap-1"><Icon name="Clock" :size="12" />{{ formatDate(fqdnDetail.created_at) }}</p>
                </div>
              </div>
              <div class="pt-2">
                <button @click.stop="openEditModal(fqdnDetail)" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary rounded-md transition-colors">
                  <Icon name="Edit3" :size="12" />Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════ NPM Sub-tab ═══════════ -->
    <template v-if="activeSubTab === 'npm'">
      <!-- Status card -->
      <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="npmStore.isOnline ? 'bg-success-muted' : 'bg-theme-tertiary'">
              <Icon name="Shield" :size="20" :class="npmStore.isOnline ? 'text-success' : 'text-theme-muted'" />
            </div>
            <div>
              <h3 class="font-semibold text-theme-primary">Nginx Proxy Manager</h3>
              <div v-if="npmStore.loading" class="flex items-center gap-2 text-sm text-theme-muted mt-0.5"><Icon name="Loader2" :size="14" class="animate-spin" />Loading...</div>
              <div v-else class="flex flex-wrap items-center gap-3 text-sm mt-0.5">
                <span class="flex items-center gap-1" :class="npmStore.isOnline ? 'text-success' : 'text-error'">
                  <Icon :name="npmStore.isOnline ? 'CheckCircle' : 'XCircle'" :size="14" />{{ npmStore.isOnline ? 'Running' : 'Stopped' }}
                </span>
                <span class="text-theme-muted">{{ npmStore.hostCount }} host{{ npmStore.hostCount !== 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="openCreateHost" :disabled="!npmStore.isOnline" class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <Icon name="Plus" :size="16" />Add Host
            </button>
            <button @click="npmStore.fetchAll()" :disabled="npmStore.loading" class="p-2 bg-theme-tertiary rounded-lg hover:bg-theme-secondary/50 disabled:opacity-50" title="Refresh" aria-label="Refresh NPM status">
              <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': npmStore.loading }" class="text-theme-secondary" />
            </button>
          </div>
        </div>
      </div>

      <!-- NPM Error -->
      <div v-if="npmError" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
        <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
        <div class="flex-1"><p class="text-sm text-error">{{ npmError }}</p><button @click="npmError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button></div>
      </div>

      <!-- Not running -->
      <div v-if="npmStore.status && !npmStore.isOnline" class="bg-warning-muted border border-warning rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2"><Icon name="AlertCircle" :size="16" class="text-warning" /><p class="text-sm font-medium text-warning">NPM is not running</p></div>
        <p class="text-sm text-theme-muted">Start Nginx Proxy Manager to manage reverse proxy hosts.</p>
      </div>

      <!-- Hosts list -->
      <div v-if="npmStore.hosts.length > 0" class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden">
        <div class="divide-y divide-theme-primary/50">
          <div v-for="host in npmStore.hosts" :key="host.id" class="px-5 py-4 flex items-center gap-4 hover:bg-theme-tertiary/30 transition-colors">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <Icon name="Globe" :size="18" class="text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-theme-primary truncate">{{ getDomainDisplay(host) }}</p>
              <p class="text-xs text-theme-muted font-mono truncate mt-0.5">{{ getForwardDisplay(host) }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded" :class="hostStatusClass(host)">{{ hostStatusText(host) }}</span>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded" :class="host.ssl_forced || host.certificate_id ? 'bg-success-muted text-success' : 'bg-theme-tertiary text-theme-muted'">
                SSL {{ host.ssl_forced || host.certificate_id ? 'On' : 'Off' }}
              </span>
              <button @click="deleteHost(host)" :disabled="deleteHostLoading[host.id]" class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted disabled:opacity-50" :aria-label="'Delete proxy host ' + getDomainDisplay(host)">
                <Icon v-if="deleteHostLoading[host.id]" name="Loader2" :size="14" class="animate-spin" /><Icon v-else name="Trash2" :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-if="npmStore.hosts.length === 0 && npmStore.isOnline && !npmStore.loading" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
        <Icon name="Shield" :size="40" class="mx-auto text-theme-muted mb-4" />
        <h3 class="text-lg font-medium text-theme-primary mb-2">No Proxy Hosts</h3>
        <p class="text-theme-muted text-sm mb-4">Add a proxy host to route traffic to your services.</p>
        <button @click="openCreateHost" class="px-4 py-2 btn-accent rounded-lg text-sm">Add First Host</button>
      </div>
    </template>

    <!-- ═══════════ CasaOS Sub-tab ═══════════ -->
    <template v-if="activeSubTab === 'casaos'">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Browse Stores -->
        <div class="bg-theme-card rounded-lg border border-theme-primary p-6">
          <h3 class="text-lg font-medium text-theme-primary mb-4 flex items-center gap-2">
            <Icon name="Store" :size="20" />Browse CasaOS Stores
          </h3>
          <div class="space-y-2 mb-4">
            <button v-for="s in popularStores" :key="s.url" @click="selectStore(s.url)"
              :class="['w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors', selectedStore === s.url ? 'border-accent bg-accent-muted' : 'border-theme-primary hover:border-accent/50']">
              <span class="text-sm font-medium text-theme-primary">{{ s.name }}</span>
              <Icon name="ChevronRight" :size="16" class="text-theme-muted" />
            </button>
          </div>
          <div class="flex gap-2">
            <input v-model="customStoreUrl" type="text" placeholder="Custom store URL..." aria-label="Custom CasaOS store URL" class="flex-1 rounded-md border-theme-primary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] text-sm px-3 py-2">
            <button @click="loadCustomStore" class="px-3 py-2 text-sm font-medium text-accent hover:bg-accent-muted rounded-md transition-colors" aria-label="Load custom store"><Icon name="ExternalLink" :size="16" /></button>
          </div>
          <div v-if="loadingStore" class="mt-6 flex items-center justify-center py-8"><Icon name="Loader2" :size="24" class="animate-spin text-accent" /></div>
          <div v-else-if="storeApps.length > 0" class="mt-6 space-y-2 max-h-96 overflow-y-auto">
            <div v-for="app in storeApps" :key="app.name" class="flex items-center justify-between p-3 bg-theme-tertiary rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-theme-secondary flex items-center justify-center"><Icon name="Box" :size="16" class="text-accent" /></div>
                <div>
                  <span class="text-sm font-medium text-theme-primary">{{ app.title || app.name }}</span>
                  <p v-if="app.tagline" class="text-xs text-theme-muted line-clamp-1">{{ app.tagline }}</p>
                </div>
              </div>
              <button @click="previewStoreApp(app)" class="px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-muted rounded transition-colors" :aria-label="`Preview ${app.title || app.name}`"><Icon name="Eye" :size="14" /></button>
            </div>
          </div>
        </div>

        <!-- Paste JSON -->
        <div>
          <div class="bg-theme-card rounded-lg border border-theme-primary p-6">
            <h3 class="text-lg font-medium text-theme-primary mb-4 flex items-center gap-2"><Icon name="FileJson" :size="20" />Paste CasaOS JSON</h3>
            <textarea v-model="pastedJson" rows="12" aria-label="Paste CasaOS app JSON" placeholder="Paste CasaOS app JSON here..." class="w-full rounded-md border-theme-primary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] text-sm font-mono px-3 py-2"></textarea>
            <div class="mt-4 flex justify-end">
              <button @click="previewPastedJson" :disabled="!pastedJson.trim()" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"><Icon name="Eye" :size="16" />Preview & Import</button>
            </div>
          </div>
          <div class="mt-4 bg-theme-tertiary rounded-lg p-4">
            <h4 class="text-sm font-medium text-theme-primary mb-2 flex items-center gap-2"><Icon name="HelpCircle" :size="16" />How it works</h4>
            <ul class="text-xs text-theme-secondary space-y-1">
              <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />CasaOS JSON is converted to docker-compose.yml</li>
              <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />Paths are mapped: /DATA/AppData/ becomes /cubeos/userapps/</li>
              <li class="flex items-start gap-2"><Icon name="ChevronRight" :size="12" class="mt-0.5" />App is registered in AppManager with allocated ports</li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════ Modals ═══════════ -->

    <!-- Register FQDN Modal -->
    <Teleport to="body">
      <div v-if="showRegisterModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Register Domain">
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="showRegisterModal = false"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Register Domain</h3>
            <button @click="showRegisterModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="registerFQDN" class="space-y-4">
            <div>
              <label for="mgr-reg-app" class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <select id="mgr-reg-app" v-model="newFQDN.app_name" required @change="onAppSelect(newFQDN.app_name)" class="w-full rounded-md border-theme-primary bg-theme-input text-theme-primary text-sm px-3 py-2">
                <option value="">Select an app...</option>
                <option v-for="app in store.apps" :key="app.id" :value="app.name">{{ app.display_name || app.name }}</option>
              </select>
            </div>
            <div>
              <label for="mgr-reg-sub" class="block text-sm font-medium text-theme-secondary mb-1">Subdomain</label>
              <div class="flex items-center">
                <input id="mgr-reg-sub" v-model="newFQDN.subdomain" type="text" required placeholder="my-app" pattern="[a-z0-9-]+" class="flex-1 rounded-l-md border-theme-primary bg-theme-input text-theme-primary text-sm px-3 py-2">
                <span class="px-3 py-2 bg-theme-tertiary border border-l-0 border-theme-primary rounded-r-md text-sm text-theme-secondary">{{ getDomainSuffix() }}</span>
              </div>
            </div>
            <div>
              <label for="mgr-reg-port" class="block text-sm font-medium text-theme-secondary mb-1">Backend Port</label>
              <input id="mgr-reg-port" v-model.number="newFQDN.backend_port" type="number" required min="1" max="65535" class="w-full rounded-md border-theme-primary bg-theme-input text-theme-primary text-sm px-3 py-2">
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="newFQDN.ssl_enabled" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
              <span class="text-sm text-theme-secondary">Enable SSL (requires NPM proxy)</span>
            </label>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showRegisterModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary">Cancel</button>
              <button type="submit" :disabled="registering" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md disabled:opacity-50">{{ registering ? 'Registering...' : 'Register' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Edit FQDN Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Edit Domain">
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="showEditModal = false"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Edit Domain</h3>
            <button @click="showEditModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="saveEdit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <p class="text-sm text-theme-primary py-2">{{ fqdnDetail?.app_name || '-' }}</p>
            </div>
            <div>
              <label for="mgr-edit-sub" class="block text-sm font-medium text-theme-secondary mb-1">Subdomain</label>
              <div class="flex items-center">
                <input id="mgr-edit-sub" v-model="editData.subdomain" type="text" required placeholder="my-app" pattern="[a-z0-9-]+" class="flex-1 rounded-l-md border-theme-primary bg-theme-input text-theme-primary text-sm px-3 py-2">
                <span class="px-3 py-2 bg-theme-tertiary border border-l-0 border-theme-primary rounded-r-md text-sm text-theme-secondary">{{ getDomainSuffix() }}</span>
              </div>
              <p class="mt-1 text-xs text-theme-muted">Preview: <span class="font-mono text-theme-primary">{{ editPreviewFQDN }}</span></p>
            </div>
            <div>
              <label for="mgr-edit-port" class="block text-sm font-medium text-theme-secondary mb-1">Backend Port</label>
              <input id="mgr-edit-port" v-model.number="editData.backend_port" type="number" required min="1" max="65535" class="w-full rounded-md border-theme-primary bg-theme-input text-theme-primary text-sm px-3 py-2">
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input v-model="editData.ssl_enabled" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
              <span class="text-sm text-theme-secondary">Enable SSL</span>
            </label>
            <p v-if="editError" class="text-xs text-error">{{ editError }}</p>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary">Cancel</button>
              <button type="submit" :disabled="editing" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md disabled:opacity-50">{{ editing ? 'Saving...' : 'Save' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Create NPM Host Modal -->
    <Teleport to="body">
      <div v-if="showCreateHostModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create Proxy Host">
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="showCreateHostModal = false"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary max-h-[90vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary flex-shrink-0">
            <h3 class="text-lg font-semibold text-theme-primary">Create Proxy Host</h3>
            <button @click="showCreateHostModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close"><Icon name="X" :size="18" /></button>
          </div>
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label for="mgr-npm-domains" class="block text-sm font-medium text-theme-secondary mb-1">Domain Name(s)</label>
              <input id="mgr-npm-domains" v-model="hostForm.domain_names" type="text" :placeholder="makePlaceholder('app')" class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent">
              <p class="mt-1 text-xs text-theme-muted">Comma-separated for multiple domains</p>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="mgr-npm-scheme" class="block text-sm font-medium text-theme-secondary mb-1">Scheme</label>
                <select id="mgr-npm-scheme" v-model="hostForm.forward_scheme" class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm">
                  <option value="http">http</option><option value="https">https</option>
                </select>
              </div>
              <div>
                <label for="mgr-npm-host" class="block text-sm font-medium text-theme-secondary mb-1">Host</label>
                <input id="mgr-npm-host" v-model="hostForm.forward_host" type="text" placeholder="192.168.1.100" class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm">
              </div>
              <div>
                <label for="mgr-npm-port" class="block text-sm font-medium text-theme-secondary mb-1">Port</label>
                <input id="mgr-npm-port" v-model.number="hostForm.forward_port" type="number" min="1" max="65535" placeholder="80" class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm">
              </div>
            </div>
            <div class="space-y-3 pt-2">
              <label class="flex items-center gap-3 cursor-pointer"><input v-model="hostForm.ssl_forced" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent"><span class="text-sm text-theme-secondary">Force SSL</span></label>
              <label class="flex items-center gap-3 cursor-pointer"><input v-model="hostForm.block_exploits" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent"><span class="text-sm text-theme-secondary">Block common exploits</span></label>
              <label class="flex items-center gap-3 cursor-pointer"><input v-model="hostForm.allow_websocket_upgrade" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent"><span class="text-sm text-theme-secondary">Allow WebSocket upgrade</span></label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary flex-shrink-0">
            <button @click="showCreateHostModal = false" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">Cancel</button>
            <button @click="saveHost" :disabled="createHostLoading || !hostForm.domain_names.trim() || !hostForm.forward_host.trim()" class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
              <Icon v-if="createHostLoading" name="Loader2" :size="14" class="animate-spin" />Create Host
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CasaOS Preview Modal -->
    <Teleport to="body">
      <div v-if="showPreviewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Preview CasaOS app">
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="showPreviewModal = false"></div>
        <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-2xl border border-theme-primary p-6 max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Preview: {{ previewApp?.title || previewApp?.name }}</h3>
            <button @click="showPreviewModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <div class="mb-4">
            <h4 class="text-sm font-medium text-theme-secondary mb-2">Generated docker-compose.yml</h4>
            <pre class="bg-theme-primary rounded-lg p-4 text-xs font-mono text-theme-primary overflow-x-auto">{{ previewCompose }}</pre>
          </div>
          <div class="flex justify-end gap-3">
            <button @click="showPreviewModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary">Cancel</button>
            <button @click="importApp" :disabled="importing" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md disabled:opacity-50">
              <Icon :name="importing ? 'Loader2' : 'Download'" :size="16" :class="importing ? 'animate-spin' : ''" />{{ importing ? 'Importing...' : 'Import App' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
