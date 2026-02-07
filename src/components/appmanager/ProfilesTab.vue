<script setup>
import { ref, computed } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

const showCreateModal = ref(false)
const showConfigureModal = ref(false)
const creating = ref(false)
const activating = ref(null)
const selectedProfile = ref(null)
const profileApps = ref([])
const error = ref('')

const newProfile = ref({ name: '', description: '' })
const activeProfile = computed(() => store.profiles.find(p => p.is_active))

async function createProfile() {
  creating.value = true
  try {
    await store.createProfile(newProfile.value.name, newProfile.value.description)
    showCreateModal.value = false
    newProfile.value = { name: '', description: '' }
  } catch (e) { error.value = e.message || 'Failed to create profile' }
  finally { creating.value = false }
}

async function activateProfile(profile) {
  if (profile.is_active) return
  if (!await confirm({
    title: 'Activate Profile',
    message: `Activate profile "${profile.name}"? This will start/stop containers to match the profile configuration.`,
    confirmText: 'Activate',
    variant: 'warning'
  })) return
  activating.value = profile.name
  try { await store.activateProfile(profile.name) } catch (e) { error.value = e.message || 'Failed to activate profile' }
  finally { activating.value = null }
}

async function deleteProfile(profile) {
  if (profile.is_active) {
    await confirm({
      title: 'Cannot Delete Active Profile',
      message: 'Activate another profile first before deleting this one.',
      confirmText: 'OK',
      cancelText: '',
      variant: 'info'
    })
    return
  }
  if (!await confirm({
    title: 'Delete Profile',
    message: `Delete profile "${profile.name}"?`,
    confirmText: 'Delete',
    variant: 'danger'
  })) return
  try { await store.deleteProfile(profile.name) } catch (e) { error.value = e.message || 'Failed to delete profile' }
}

async function openConfigureModal(profile) {
  selectedProfile.value = profile
  const details = await store.getProfile(profile.name)
  if (details) {
    profileApps.value = store.apps.map(app => ({
      ...app,
      enabled_in_profile: details.apps?.find(a => a.app_id === app.id)?.enabled ?? true
    }))
  }
  showConfigureModal.value = true
}

async function toggleAppInProfile(app) {
  const newEnabled = !app.enabled_in_profile
  try {
    await store.setProfileApp(selectedProfile.value.name, app.id, newEnabled)
    app.enabled_in_profile = newEnabled
  } catch (e) { error.value = e.message || 'Failed to update app in profile' }
}
</script>

<template>
  <div>
    <!-- Info Banner -->
    <div class="bg-warning-muted border border-warning/30 rounded-lg p-4 mb-6">
      <div class="flex items-start">
        <Icon name="Info" :size="20" class="text-warning mt-0.5" />
        <div class="ml-3 text-sm">
          <p class="text-theme-primary font-medium">Operational Profiles</p>
          <p class="mt-1 text-theme-secondary">
            Profiles define which apps should be running. Activating a profile will automatically start/stop containers to match the profile configuration.
          </p>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="bg-error-muted border border-error/30 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Icon name="AlertCircle" :size="20" class="text-error flex-shrink-0" />
        <span class="text-sm text-error">{{ error }}</span>
      </div>
      <button @click="error = ''" class="text-error hover:text-error/80 p-1" aria-label="Dismiss error">
        <Icon name="X" :size="16" />
      </button>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <span class="text-sm text-theme-secondary">{{ store.profiles.length }} profiles</span>
        <span v-if="activeProfile" class="text-sm text-success flex items-center gap-1">
          <Icon name="CheckCircle" :size="14" />Active: {{ activeProfile.name }}
        </span>
      </div>
      <button @click="showCreateModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors">
        <Icon name="Plus" :size="16" />Create Profile
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="store.profiles.length === 0" class="text-center py-12">
      <Icon name="Layers" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No profiles</h3>
      <p class="mt-1 text-sm text-theme-secondary">Create profiles to define different operational modes</p>
    </div>

    <!-- Profiles Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="profile in store.profiles" :key="profile.id" :class="['bg-theme-secondary rounded-lg border p-4 transition-colors', profile.is_active ? 'border-success bg-success-muted/20' : 'border-theme-primary hover:border-accent/50']">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-medium text-theme-primary">{{ profile.name }}</h3>
              <span v-if="profile.is_active" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-muted text-success">
                <Icon name="CheckCircle" :size="10" class="mr-1" />Active
              </span>
            </div>
            <p v-if="profile.description" class="mt-1 text-xs text-theme-secondary">{{ profile.description }}</p>
          </div>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button @click="openConfigureModal(profile)" :aria-label="'Configure profile ' + profile.name" class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary bg-theme-tertiary hover:bg-theme-primary/10 rounded transition-colors">
              <Icon name="Settings" :size="12" />Configure
            </button>
            <button v-if="!profile.is_active" @click="activateProfile(profile)" :disabled="activating === profile.name" :aria-label="'Activate profile ' + profile.name" class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover rounded transition-colors disabled:opacity-50">
              <Icon name="Zap" :size="12" />{{ activating === profile.name ? 'Activating...' : 'Activate' }}
            </button>
          </div>
          <button v-if="!profile.is_active" @click="deleteProfile(profile)" class="p-1.5 text-error hover:bg-error-muted rounded transition-colors" title="Delete profile" :aria-label="'Delete profile ' + profile.name">
            <Icon name="Trash2" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-theme-overlay backdrop-blur-sm" @click="showCreateModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-label="Create Profile">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Create Profile</h3>
            <button @click="showCreateModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="createProfile" class="space-y-4">
            <div>
              <label for="profile-name" class="block text-sm font-medium text-theme-secondary mb-1">Name</label>
              <input id="profile-name" v-model="newProfile.name" type="text" required placeholder="My Profile" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div>
              <label for="profile-description" class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
              <textarea id="profile-description" v-model="newProfile.description" rows="2" placeholder="Profile description..." class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm"></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showCreateModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="creating" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">{{ creating ? 'Creating...' : 'Create' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Configure Modal -->
    <div v-if="showConfigureModal && selectedProfile" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-theme-overlay backdrop-blur-sm" @click="showConfigureModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" role="dialog" aria-modal="true" :aria-label="'Configure profile ' + selectedProfile.name">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Configure: {{ selectedProfile.name }}</h3>
            <button @click="showConfigureModal = false" class="text-theme-muted hover:text-theme-primary" aria-label="Close"><Icon name="X" :size="20" /></button>
          </div>
          <p class="text-sm text-theme-secondary mb-4">Select which apps should be enabled when this profile is active:</p>
          <div class="space-y-2">
            <div v-for="app in profileApps" :key="app.id" class="flex items-center justify-between p-3 bg-theme-tertiary rounded-lg">
              <div class="flex items-center gap-3">
                <Icon name="Box" :size="16" class="text-theme-muted" />
                <div>
                  <span class="text-sm font-medium text-theme-primary">{{ app.display_name || app.name }}</span>
                  <span class="ml-2 text-xs" :class="app.type === 'system' ? 'text-accent' : 'text-theme-muted'">{{ app.type }}</span>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer" :aria-label="'Toggle ' + (app.display_name || app.name) + ' in profile'">
                <input type="checkbox" :checked="app.enabled_in_profile" @change="toggleAppInProfile(app)" class="sr-only peer" :aria-label="'Enable ' + (app.display_name || app.name)">
                <div class="w-9 h-5 bg-theme-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-theme-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-theme-primary after:border-theme-primary after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
          <div class="flex justify-end pt-4">
            <button @click="showConfigureModal = false" class="px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover rounded-md transition-colors">Done</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
