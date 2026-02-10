<script setup>
/**
 * SMBSharesTab.vue — S07 Component (Advanced only)
 *
 * Samba file sharing management. Absorbed from StorageView.vue SMB tab.
 *
 * Features:
 *   - SMB service status card
 *   - Share list with expandable details
 *   - Create/edit share modal
 *   - Delete with confirmation
 *
 * Self-managed — uses SMB store directly.
 * Wires all 6 SMB endpoints.
 */
import { ref, watch, nextTick, onMounted } from 'vue'
import { useSMBStore } from '@/stores/smb'
import { confirm } from '@/utils/confirmDialog'
import { useFocusTrap } from '@/composables/useFocusTrap'
import Icon from '@/components/ui/Icon.vue'

const smbStore = useSMBStore()
const { trapFocus } = useFocusTrap()

// ─── State ──────────────────────────────────────────────────

const actionError = ref(null)

// Share modal
const showShareModal = ref(false)
const shareModalMode = ref('create')
const shareModalRef = ref(null)
const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  browseable: true,
  read_only: false,
  guest_ok: true
})
const shareLoading = ref(false)

// Detail expansion
const expandedShare = ref(null)
const shareDetailLoading = ref(false)

// Focus modal when shown
watch(showShareModal, (visible) => {
  if (visible) nextTick(() => shareModalRef.value?.focus())
})

// ─── Data Fetching ──────────────────────────────────────────

async function fetchAll() {
  actionError.value = null
  await smbStore.fetchAll()
}

onMounted(() => {
  if (!smbStore.shares.length) fetchAll()
})

// ─── Actions ────────────────────────────────────────────────

function openCreateShare() {
  shareModalMode.value = 'create'
  shareForm.value = {
    name: '',
    path: '/cubeos/shares/',
    comment: '',
    browseable: true,
    read_only: false,
    guest_ok: true
  }
  showShareModal.value = true
}

function openEditShare(share) {
  shareModalMode.value = 'edit'
  shareForm.value = { ...share }
  showShareModal.value = true
}

async function saveShare() {
  if (!shareForm.value.name || !shareForm.value.path) return
  shareLoading.value = true
  actionError.value = null
  try {
    if (shareModalMode.value === 'create') {
      await smbStore.createShare(shareForm.value)
    } else {
      await smbStore.updateShare(shareForm.value.name, shareForm.value)
    }
    showShareModal.value = false
  } catch (e) {
    actionError.value = 'Failed to save share: ' + e.message
  } finally {
    shareLoading.value = false
  }
}

async function deleteShare(name) {
  if (!await confirm({
    title: 'Delete Share',
    message: `Delete share "${name}"? The shared folder will NOT be deleted.`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return

  actionError.value = null
  try {
    await smbStore.deleteShare(name)
    if (expandedShare.value === name) expandedShare.value = null
  } catch (e) {
    actionError.value = 'Failed to delete share: ' + e.message
  }
}

async function toggleShareDetail(name) {
  if (expandedShare.value === name) {
    expandedShare.value = null
    smbStore.clearSelectedShare()
    return
  }
  expandedShare.value = name
  shareDetailLoading.value = true
  try {
    await smbStore.fetchShareDetail(name)
  } catch (e) {
    // Detail fetch failed — still show the share row
  } finally {
    shareDetailLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error -->
    <div v-if="actionError" class="bg-error-muted border border-error rounded-lg p-4 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-sm text-error">{{ actionError }}</p>
        <button @click="actionError = null" class="text-xs text-theme-muted hover:text-theme-secondary mt-1">Dismiss</button>
      </div>
    </div>

    <!-- SMB Status Card -->
    <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center"
            :class="smbStore.isRunning ? 'bg-success-muted' : 'bg-theme-tertiary'"
          >
            <Icon name="Server" :size="20"
              :class="smbStore.isRunning ? 'text-success' : 'text-theme-muted'"
            />
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">Samba File Server</h3>
            <p class="text-sm text-theme-muted">
              {{ smbStore.status?.installed ? (smbStore.isRunning ? 'Running' : 'Stopped') : 'Not installed' }}
              <span v-if="smbStore.status?.version"> · {{ smbStore.status.version }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="fetchAll"
            :disabled="smbStore.loading"
            class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
            aria-label="Refresh SMB"
          >
            <Icon name="RefreshCw" :size="16" :class="{ 'animate-spin': smbStore.loading }" />
          </button>
          <button
            @click="openCreateShare"
            :disabled="!smbStore.status?.installed"
            class="px-4 py-2 btn-accent rounded-lg hover:bg-[color:var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <Icon name="Plus" :size="16" />
            Add Share
          </button>
        </div>
      </div>
    </div>

    <!-- Not installed warning -->
    <div v-if="smbStore.status && !smbStore.status.installed" class="bg-warning-muted border border-warning rounded-lg p-4">
      <div class="flex items-center gap-2 mb-2">
        <Icon name="AlertCircle" :size="16" class="text-warning" />
        <p class="text-sm font-medium text-warning">Samba is not installed</p>
      </div>
      <p class="text-sm text-theme-muted">Install Samba to create network file shares.</p>
      <code class="block mt-2 p-2 bg-code text-code rounded text-xs font-mono">apt install samba</code>
    </div>

    <!-- Loading -->
    <div v-if="smbStore.loading && !smbStore.shares.length" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="24" class="animate-spin text-theme-muted" />
      <span class="ml-3 text-theme-muted">Loading shares...</span>
    </div>

    <!-- Shares list -->
    <div v-if="smbStore.shares.length > 0" class="space-y-3">
      <div
        v-for="share in smbStore.shares"
        :key="share.name"
        class="bg-theme-card rounded-xl border border-theme-primary overflow-hidden"
      >
        <!-- Share header row -->
        <div class="p-4 flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0 cursor-pointer"
            @click="toggleShareDetail(share.name)"
          >
            <Icon name="FolderOpen" :size="20" class="text-accent" />
          </div>
          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="toggleShareDetail(share.name)"
          >
            <h4 class="font-medium text-theme-primary">{{ share.name }}</h4>
            <p class="text-sm text-theme-muted truncate">{{ share.path }}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span v-if="share.read_only" class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-theme-tertiary text-theme-secondary rounded">Read Only</span>
            <span v-if="share.guest_ok" class="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-success-muted text-success rounded">Guest</span>
            <button @click="openEditShare(share)" class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary" title="Edit share" :aria-label="'Edit share ' + share.name">
              <Icon name="Pencil" :size="14" />
            </button>
            <button @click="deleteShare(share.name)" class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-error-muted" title="Delete share" :aria-label="'Delete share ' + share.name">
              <Icon name="Trash2" :size="14" />
            </button>
            <button @click="toggleShareDetail(share.name)" class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg" :aria-label="'Toggle details for ' + share.name" :aria-expanded="expandedShare === share.name">
              <Icon
                name="ChevronDown"
                :size="14"
                class="transition-transform"
                :class="{ 'rotate-180': expandedShare === share.name }"
              />
            </button>
          </div>
        </div>

        <p v-if="share.comment && expandedShare !== share.name" class="px-4 pb-3 text-sm text-theme-muted -mt-1">{{ share.comment }}</p>

        <!-- Expanded detail panel -->
        <div v-if="expandedShare === share.name" class="px-4 pb-4 border-t border-theme-primary/50">
          <div v-if="shareDetailLoading" class="py-4 flex items-center justify-center">
            <Icon name="Loader2" :size="16" class="animate-spin text-theme-muted" />
            <span class="ml-2 text-sm text-theme-muted">Loading details...</span>
          </div>
          <div v-else class="pt-4">
            <p v-if="share.comment" class="text-sm text-theme-muted mb-3">{{ share.comment }}</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span class="text-xs text-theme-muted block">Path</span>
                <span class="text-theme-primary font-mono text-xs">{{ smbStore.selectedShare?.path || share.path }}</span>
              </div>
              <div>
                <span class="text-xs text-theme-muted block">Browseable</span>
                <span class="text-theme-primary">{{ (smbStore.selectedShare?.browseable ?? share.browseable) ? 'Yes' : 'No' }}</span>
              </div>
              <div>
                <span class="text-xs text-theme-muted block">Read Only</span>
                <span class="text-theme-primary">{{ (smbStore.selectedShare?.read_only ?? share.read_only) ? 'Yes' : 'No' }}</span>
              </div>
              <div>
                <span class="text-xs text-theme-muted block">Guest Access</span>
                <span class="text-theme-primary">{{ (smbStore.selectedShare?.guest_ok ?? share.guest_ok) ? 'Yes' : 'No' }}</span>
              </div>
              <div v-if="smbStore.selectedShare?.valid_users">
                <span class="text-xs text-theme-muted block">Valid Users</span>
                <span class="text-theme-primary">{{ smbStore.selectedShare.valid_users }}</span>
              </div>
              <div v-if="smbStore.selectedShare?.write_list">
                <span class="text-xs text-theme-muted block">Write List</span>
                <span class="text-theme-primary">{{ smbStore.selectedShare.write_list }}</span>
              </div>
            </div>
            <!-- Mobile badges -->
            <div class="flex gap-2 mt-3 sm:hidden">
              <span v-if="share.read_only" class="px-2 py-0.5 text-[10px] font-semibold bg-theme-tertiary text-theme-secondary rounded">Read Only</span>
              <span v-if="share.guest_ok" class="px-2 py-0.5 text-[10px] font-semibold bg-success-muted text-success rounded">Guest</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="smbStore.status?.installed && !smbStore.loading" class="bg-theme-card rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="FolderOpen" :size="40" class="mx-auto text-theme-muted mb-4" />
      <h3 class="text-lg font-medium text-theme-primary mb-2">No Shares Configured</h3>
      <p class="text-theme-muted mb-4">Create a network share to access files from other devices.</p>
      <button @click="openCreateShare" class="px-4 py-2 btn-accent rounded-lg text-sm">Create First Share</button>
    </div>

    <!-- ==================== Share Modal ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showShareModal"
          ref="shareModalRef"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          :aria-label="shareModalMode === 'create' ? 'Create Share' : 'Edit Share'"
          tabindex="-1"
          @keydown.escape="showShareModal = false"
          @keydown="trapFocus"
        >
          <div class="absolute inset-0 bg-theme-overlay" @click="showShareModal = false"></div>
          <div class="relative bg-theme-card rounded-2xl shadow-xl w-full max-w-md border border-theme-primary">
            <div class="flex items-center justify-between px-6 py-4 border-b border-theme-primary">
              <h3 class="text-lg font-semibold text-theme-primary">
                {{ shareModalMode === 'create' ? 'Create Share' : 'Edit Share' }}
              </h3>
              <button @click="showShareModal = false" class="p-1 text-theme-muted hover:text-theme-secondary rounded-lg" aria-label="Close">
                <Icon name="X" :size="18" />
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Share Name</label>
                <input
                  v-model="shareForm.name"
                  type="text"
                  :disabled="shareModalMode === 'edit'"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent disabled:opacity-50"
                  placeholder="documents"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Folder Path</label>
                <input
                  v-model="shareForm.path"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="/cubeos/shares/documents"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
                <input
                  v-model="shareForm.comment"
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
                  placeholder="My documents"
                >
              </div>
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.guest_ok" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Allow guest access (no password)</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.read_only" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Read only</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="shareForm.browseable" type="checkbox" class="w-4 h-4 rounded border-theme-secondary text-accent focus:ring-[color:var(--accent-primary)]">
                  <span class="text-sm text-theme-secondary">Visible in network browser</span>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme-primary">
              <button @click="showShareModal = false" class="px-4 py-2 text-theme-secondary hover:bg-theme-tertiary rounded-lg text-sm">
                Cancel
              </button>
              <button
                @click="saveShare"
                :disabled="shareLoading || !shareForm.name || !shareForm.path"
                class="px-4 py-2 btn-accent rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon v-if="shareLoading" name="Loader2" :size="14" class="animate-spin" />
                {{ shareModalMode === 'create' ? 'Create' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
