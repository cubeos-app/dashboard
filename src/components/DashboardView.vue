<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useServicesStore } from '@/stores/services'
import { useSystemStore } from '@/stores/system'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'

const servicesStore = useServicesStore()
const systemStore = useSystemStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()

// Version info
const appVersion = ref('2.0.0')

// Search
const searchQuery = ref('')
const showSearchResults = computed(() => searchQuery.value.length > 0)
const searchResults = computed(() => {
  if (!searchQuery.value) return []
  const query = searchQuery.value.toLowerCase()
  return servicesStore.services
    .filter(s => 
      s.name.toLowerCase().includes(query) ||
      servicesStore.getServiceName(s.name).toLowerCase().includes(query)
    )
    .slice(0, 8)
})

// Health modal for no-UI services
const showHealthModal = ref(false)
const selectedService = ref(null)

function handleShowHealth(service) {
  selectedService.value = service
  showHealthModal.value = true
}

function closeHealthModal() {
  showHealthModal.value = false
  selectedService.value = null
}

// Service sections
const favoriteServices = computed(() => servicesStore.favoriteServices.slice(0, 8))
const recentServices = computed(() => servicesStore.recentServices)
const userApps = computed(() => 
  servicesStore.userInstalledServices
    .filter(s => s.state === 'running')
    .slice(0, 12)
)
const adminServices = computed(() => 
  servicesStore.services
    .filter(s => ['dockge', 'dozzle', 'cubeos-dockge', 'cubeos-logs'].some(n => s.name.includes(n)))
    .filter(s => s.state === 'running')
)
const coreServices = computed(() => 
  servicesStore.coreServices.filter(s => s.state === 'running')
)

// Get service URL
function getServiceUrl(service) {
  return servicesStore.getServiceUrl(service)
}

function getServiceName(name) {
  return servicesStore.getServiceName(name)
}

function getServiceIcon(name) {
  return servicesStore.getServiceIcon(name)
}

function hasWebUI(name) {
  return servicesStore.hasWebUI(name)
}

function handleServiceClick(service) {
  if (!service || service.state !== 'running') return
  
  if (hasWebUI(service.name)) {
    servicesStore.trackUsage(service.name)
    const url = getServiceUrl(service)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    handleShowHealth(service)
  }
}

onMounted(async () => {
  servicesStore.loadRecentlyUsed()
  await Promise.all([
    servicesStore.fetchServices(),
    servicesStore.fetchFavorites(),
    systemStore.fetchAll()
  ])
})

// Poll stats every 5 seconds
let statsInterval = null
onMounted(() => {
  statsInterval = setInterval(() => {
    systemStore.fetchStats()
    systemStore.fetchPower()
  }, 5000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
})
</script>

<template>
  <div class="relative min-h-full">
    <!-- Watermark Logo -->
    <div class="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
      <img 
        :src="brandingStore.brandLogo" 
        alt="" 
        class="w-[400px] h-[400px]"
        :class="themeStore.isDark ? 'opacity-[0.03]' : 'opacity-[0.02]'"
        :style="{ filter: themeStore.isDark ? 'grayscale(100%) brightness(1.5)' : 'grayscale(100%) brightness(0.5)' }"
      />
    </div>

    <!-- Content -->
    <div class="relative z-10 space-y-8 pb-8">
      <!-- Page header -->
      <div>
        <h1 class="text-xl font-semibold text-theme-primary tracking-tight">Dashboard</h1>
        <p class="text-theme-tertiary text-sm">Your offline services at a glance</p>
      </div>

      <!-- Section 1: AI Chat (Placeholder) -->
      <section class="animate-fade-in">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Bot" :size="12" class="text-accent" />
          AI Assistant
        </h2>
        <div class="p-6 rounded-2xl border border-theme-primary bg-theme-card">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center">
              <Icon name="MessageSquare" :size="24" class="text-accent" />
            </div>
            <div class="flex-1">
              <h3 class="font-medium text-theme-primary">Ask CubeOS</h3>
              <p class="text-sm text-theme-tertiary">Chat with your local AI assistant</p>
            </div>
            <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors">
              Coming Soon
            </button>
          </div>
        </div>
      </section>

      <!-- Section 2: Search -->
      <section class="animate-fade-in" style="animation-delay: 50ms">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Search" :size="12" />
          Quick Search
        </h2>
        <div class="relative">
          <Icon name="Search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search services, apps, settings..."
            class="w-full pl-11 pr-4 py-3 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
          
          <!-- Search Results -->
          <div 
            v-if="showSearchResults"
            class="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl border border-theme-primary bg-theme-card shadow-theme-lg z-20"
          >
            <div v-if="searchResults.length > 0" class="space-y-1">
              <button
                v-for="service in searchResults"
                :key="service.id"
                @click="handleServiceClick(service); searchQuery = ''"
                class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
              >
                <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
                  <Icon :name="getServiceIcon(service.name)" :size="16" class="text-theme-secondary" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-theme-primary truncate">{{ getServiceName(service.name) }}</p>
                  <p class="text-xs text-theme-muted">{{ service.state }}</p>
                </div>
                <Icon :name="hasWebUI(service.name) ? 'ExternalLink' : 'Info'" :size="14" class="text-theme-muted" />
              </button>
            </div>
            <p v-else class="text-sm text-theme-muted text-center py-4">No results found</p>
          </div>
        </div>
      </section>

      <!-- Section 3: Favorites | Recently Used -->
      <section class="animate-fade-in" style="animation-delay: 100ms">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Favorites -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider flex items-center gap-2">
                <Icon name="Star" :size="12" class="text-warning" />
                Favorites
              </h2>
              <router-link 
                v-if="favoriteServices.length > 0"
                to="/services" 
                class="text-xs text-accent hover:text-accent-secondary"
              >
                View All
              </router-link>
            </div>
            
            <div v-if="favoriteServices.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                v-for="service in favoriteServices"
                :key="service.id"
                @click="handleServiceClick(service)"
                class="group flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-warning/40 hover:shadow-theme-md hover:-translate-y-0.5"
              >
                <div class="w-10 h-10 rounded-xl bg-warning-muted flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Icon :name="getServiceIcon(service.name)" :size="20" class="text-warning" />
                </div>
                <span class="text-xs font-medium text-theme-primary text-center truncate w-full">
                  {{ getServiceName(service.name) }}
                </span>
                <div class="flex items-center gap-1 mt-1">
                  <span class="w-1.5 h-1.5 rounded-full" :class="service.state === 'running' ? 'bg-success' : 'bg-theme-muted'"></span>
                  <span class="text-[10px]" :class="service.state === 'running' ? 'text-success' : 'text-theme-muted'">
                    {{ service.state === 'running' ? 'Running' : 'Stopped' }}
                  </span>
                </div>
              </button>
            </div>
            <div v-else class="p-6 rounded-xl border border-dashed border-theme-primary text-center">
              <Icon name="Star" :size="24" class="text-theme-muted mx-auto mb-2" />
              <p class="text-sm text-theme-muted">No favorites yet</p>
              <p class="text-xs text-theme-muted">Star services to add them here</p>
            </div>
          </div>
          
          <!-- Recently Used -->
          <div>
            <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Icon name="Clock" :size="12" />
              Recently Used
            </h2>
            
            <div v-if="recentServices.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="service in recentServices"
                :key="service.id"
                @click="handleServiceClick(service)"
                class="group flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5"
              >
                <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted group-hover:scale-105 transition-all">
                  <Icon :name="getServiceIcon(service.name)" :size="20" class="text-theme-secondary group-hover:text-accent" />
                </div>
                <span class="text-xs font-medium text-theme-primary text-center truncate w-full">
                  {{ getServiceName(service.name) }}
                </span>
              </button>
            </div>
            <div v-else class="p-6 rounded-xl border border-dashed border-theme-primary text-center">
              <Icon name="Clock" :size="24" class="text-theme-muted mx-auto mb-2" />
              <p class="text-sm text-theme-muted">No recent activity</p>
              <p class="text-xs text-theme-muted">Services you use will appear here</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: User Installed Apps -->
      <section v-if="userApps.length > 0" class="animate-fade-in" style="animation-delay: 150ms">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider flex items-center gap-2">
            <Icon name="Package" :size="12" />
            Your Apps
          </h2>
          <router-link to="/services" class="text-xs text-accent hover:text-accent-secondary flex items-center gap-1">
            View All
            <Icon name="ChevronRight" :size="14" />
          </router-link>
        </div>
        
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <button
            v-for="service in userApps"
            :key="service.id"
            @click="handleServiceClick(service)"
            class="group flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-accent/40 hover:shadow-theme-md hover:-translate-y-0.5"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted group-hover:scale-105 transition-all">
              <Icon :name="getServiceIcon(service.name)" :size="20" class="text-theme-secondary group-hover:text-accent" />
            </div>
            <span class="text-xs font-medium text-theme-primary text-center truncate w-full">
              {{ getServiceName(service.name) }}
            </span>
            <div class="flex items-center gap-1 mt-1">
              <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span class="text-[10px] text-success">Running</span>
            </div>
          </button>
        </div>
      </section>

      <!-- Section 5: Admin -->
      <section v-if="adminServices.length > 0" class="animate-fade-in" style="animation-delay: 200ms">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Settings" :size="12" />
          Admin Tools
        </h2>
        
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            v-for="service in adminServices"
            :key="service.id"
            @click="handleServiceClick(service)"
            class="group flex items-center gap-3 p-3 rounded-xl border border-theme-primary bg-theme-card transition-all duration-150 hover:border-theme-secondary hover:shadow-theme-md"
          >
            <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center group-hover:bg-accent-muted transition-colors">
              <Icon :name="getServiceIcon(service.name)" :size="20" class="text-theme-secondary group-hover:text-accent" />
            </div>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-medium text-theme-primary truncate">{{ getServiceName(service.name) }}</p>
              <p class="text-xs text-success">Running</p>
            </div>
            <Icon :name="hasWebUI(service.name) ? 'ExternalLink' : 'Info'" :size="14" class="text-theme-muted" />
          </button>
        </div>
      </section>

      <!-- Section 6: CubeOS Core Apps -->
      <section class="animate-fade-in" style="animation-delay: 250ms">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Box" :size="12" class="text-accent" />
          CubeOS Core Apps
        </h2>
        
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <button
            v-for="service in coreServices"
            :key="service.id"
            @click="handleServiceClick(service)"
            class="group flex flex-col items-center p-3 rounded-xl border border-theme-primary bg-theme-secondary/50 transition-all duration-150 hover:border-accent/40 hover:shadow-theme-sm"
          >
            <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent-muted transition-colors">
              <Icon :name="getServiceIcon(service.name)" :size="16" class="text-theme-secondary group-hover:text-accent" />
            </div>
            <span class="text-[11px] font-medium text-theme-secondary text-center truncate w-full">
              {{ getServiceName(service.name) }}
            </span>
            <div class="flex items-center gap-1 mt-1">
              <span class="w-1 h-1 rounded-full" :class="service.state === 'running' ? 'bg-success' : 'bg-theme-muted'"></span>
              <span class="text-[9px]" :class="service.state === 'running' ? 'text-success' : 'text-theme-muted'">
                {{ service.state === 'running' ? 'Running' : 'Stopped' }}
              </span>
            </div>
          </button>
        </div>
      </section>

      <!-- Stats Footer -->
      <section class="pt-4">
        <div class="flex items-center justify-center gap-3 text-[10px] text-theme-muted">
          <span>{{ servicesStore.runningCount }} of {{ servicesStore.serviceCount }} services running</span>
          <span class="w-1 h-1 rounded-full bg-theme-tertiary"></span>
          <span>{{ systemStore.hostname || 'CubeOS' }}</span>
        </div>
      </section>
    </div>

    <!-- Version Footer -->
    <div class="fixed bottom-3 left-3 z-20 flex flex-col gap-1 lg:left-[252px]">
      <a 
        :href="brandingStore.currentBrand.github" 
        target="_blank" 
        rel="noopener"
        class="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-md text-[10px] text-theme-secondary hover:text-theme-primary transition-colors"
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
        <span class="font-mono">CubeOS v{{ appVersion }}</span>
      </a>
      <a 
        href="/api/v1/docs" 
        target="_blank" 
        rel="noopener"
        class="flex items-center gap-1.5 px-2.5 py-1.5 glass rounded-md text-[10px] text-theme-muted hover:text-accent transition-colors"
      >
        <Icon name="Code2" :size="12" />
        <span>API Docs (v1)</span>
      </a>
    </div>

    <!-- Health Modal -->
    <ServiceHealthModal
      :service="selectedService"
      :show="showHealthModal"
      @close="closeHealthModal"
    />
  </div>
</template>
