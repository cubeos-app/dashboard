<script setup>
import { ref, onMounted } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import Icon from '@/components/ui/Icon.vue'
import AppsTab from './AppsTab.vue'
import PortsTab from './PortsTab.vue'
import FQDNsTab from './FQDNsTab.vue'
import ProfilesTab from './ProfilesTab.vue'
import RegistryTab from './RegistryTab.vue'
import CasaOSTab from './CasaOSTab.vue'
import NPMTab from './NPMTab.vue'

const store = useAppManagerStore()

const tabs = [
  { id: 'apps', name: 'Applications', icon: 'Boxes' },
  { id: 'ports', name: 'Ports', icon: 'Plug' },
  { id: 'fqdns', name: 'Domains', icon: 'Globe' },
  { id: 'profiles', name: 'Profiles', icon: 'Layers' },
  { id: 'registry', name: 'Registry', icon: 'Container' },
  { id: 'npm', name: 'Proxy', icon: 'Shield' },
  { id: 'casaos', name: 'Import', icon: 'Download' }
]

const activeTab = ref('apps')

onMounted(() => {
  store.init()
})
</script>

<template>
  <div class="min-h-screen bg-theme-primary">
    <!-- Header -->
    <div class="bg-theme-secondary border-b border-theme-primary">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-theme-primary">App Manager</h1>
            <p class="mt-1 text-sm text-theme-secondary">
              Manage applications, ports, domains, and operational profiles
            </p>
          </div>
          
          <!-- Quick Stats -->
          <div class="hidden sm:flex items-center gap-6">
            <div class="text-center">
              <div class="text-2xl font-bold text-accent">{{ store.apps.length }}</div>
              <div class="text-xs text-theme-muted">Apps</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-success">{{ store.allocatedPortCount }}</div>
              <div class="text-xs text-theme-muted">Ports</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-warning">{{ store.fqdnCount }}</div>
              <div class="text-xs text-theme-muted">Domains</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="border-b border-theme-primary overflow-x-auto">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-secondary hover:text-theme-primary hover:border-theme-tertiary',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
            ]"
          >
            <Icon :name="tab.icon" :size="16" />
            <span>{{ tab.name }}</span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div v-if="store.loading" class="flex items-center justify-center py-12">
        <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        <span class="ml-3 text-theme-secondary">Loading...</span>
      </div>

      <div v-else-if="store.error" class="bg-error-muted border border-error rounded-lg p-4">
        <div class="flex">
          <Icon name="AlertTriangle" :size="20" class="text-error" />
          <div class="ml-3">
            <h3 class="text-sm font-medium text-error">Error</h3>
            <p class="mt-1 text-sm text-error">{{ store.error }}</p>
          </div>
        </div>
      </div>

      <template v-else>
        <AppsTab v-if="activeTab === 'apps'" />
        <PortsTab v-else-if="activeTab === 'ports'" />
        <FQDNsTab v-else-if="activeTab === 'fqdns'" />
        <ProfilesTab v-else-if="activeTab === 'profiles'" />
        <RegistryTab v-else-if="activeTab === 'registry'" />
        <NPMTab v-else-if="activeTab === 'npm'" />
        <CasaOSTab v-else-if="activeTab === 'casaos'" />
      </template>
    </div>
  </div>
</template>
