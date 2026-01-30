<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useServicesStore } from '@/stores/services'
import Icon from '@/components/ui/Icon.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'
import AskCubeOS from '@/components/chat/AskCubeOS.vue'

const systemStore = useSystemStore()
const servicesStore = useServicesStore()

// State
const searchQuery = ref('')
const showHealthModal = ref(false)
const showChatModal = ref(false)
const chatQuery = ref('')
const selectedService = ref(null)
const favorites = ref([])

// Computed
const systemInfo = computed(() => systemStore.systemInfo)
const coreServices = computed(() => servicesStore.coreServices)

const runningCount = computed(() => {
  return servicesStore.services.filter(s => s.state === 'running').length
})

const totalCount = computed(() => servicesStore.services.length)

const favoriteServices = computed(() => {
  return favorites.value
    .map(name => servicesStore.services.find(s => s.name === name))
    .filter(Boolean)
})

const recentServices = computed(() => servicesStore.recentServices)

// Chat functions
function openChatWithQuery() {
  if (chatQuery.value.trim()) {
    showChatModal.value = true
  }
}

function openChat() {
  chatQuery.value = ''
  showChatModal.value = true
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && chatQuery.value.trim()) {
    openChatWithQuery()
  }
}

function closeChatModal() {
  showChatModal.value = false
  chatQuery.value = ''
}

// Service functions
function toggleFavorite(serviceName) {
  const idx = favorites.value.indexOf(serviceName)
  if (idx === -1) {
    favorites.value.push(serviceName)
  } else {
    favorites.value.splice(idx, 1)
  }
  localStorage.setItem('cubeos-favorites', JSON.stringify(favorites.value))
}

function isFavorite(serviceName) {
  return favorites.value.includes(serviceName)
}

function openService(service) {
  servicesStore.trackUsage(service.name)
  
  if (!servicesStore.hasWebUI(service.name)) {
    selectedService.value = service
    showHealthModal.value = true
    return
  }
  
  const url = servicesStore.getServiceUrl(service)
  if (url) {
    window.open(url, '_blank')
  }
}

function getServiceIcon(service) {
  return servicesStore.getServiceIcon(service.name)
}

function getServiceName(service) {
  return servicesStore.getServiceName(service.name)
}

// Lifecycle
onMounted(async () => {
  // Load favorites
  try {
    const stored = localStorage.getItem('cubeos-favorites')
    if (stored) favorites.value = JSON.parse(stored)
  } catch (e) {}
  
  // Load data
  await Promise.all([
    systemStore.fetchSystemInfo(),
    systemStore.fetchStats(),
    servicesStore.fetchServices()
  ])
  servicesStore.loadRecentlyUsed()
  
  // Auto-refresh stats
  setInterval(() => systemStore.fetchStats(), 5000)
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-theme-primary">Dashboard</h1>
        <p class="text-sm text-theme-tertiary mt-1">Your offline services at a glance</p>
      </div>
    </div>

    <!-- Section: AI Assistant -->
    <section class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Sparkles" :size="12" class="text-accent" />
        AI Assistant
      </h2>
      <div 
        class="p-4 rounded-2xl border border-theme-primary bg-theme-card hover:border-accent/30 transition-all cursor-pointer group"
        @click="openChat"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Icon name="MessageSquare" :size="20" class="text-accent" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-theme-primary text-sm">Ask CubeOS</h3>
            <p class="text-xs text-theme-tertiary">Chat with your local AI assistant</p>
          </div>
        </div>
        
        <!-- Search-style input -->
        <div class="mt-3 flex gap-2" @click.stop>
          <div class="relative flex-1">
            <Icon name="Search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              v-model="chatQuery"
              @keydown="handleChatKeydown"
              type="text"
              placeholder="Ask anything about CubeOS..."
              class="w-full pl-9 pr-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
            />
          </div>
          <button
            @click="openChatWithQuery"
            :disabled="!chatQuery.trim()"
            class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon name="Send" :size="16" />
            <span class="hidden sm:inline">Ask</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Section: Quick Search -->
    <section class="animate-fade-in">
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
          class="w-full pl-11 pr-4 py-3 rounded-xl border border-theme-primary bg-theme-card text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
        />
      </div>
    </section>

    <!-- Section: Favorites & Recently Used -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Favorites -->
      <section class="animate-fade-in">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Star" :size="12" class="text-yellow-500" />
          Favorites
        </h2>
        <div class="p-4 rounded-2xl border border-theme-primary bg-theme-card min-h-[120px]">
          <div v-if="favoriteServices.length === 0" class="flex flex-col items-center justify-center h-full py-6 text-center">
            <Icon name="Star" :size="24" class="text-theme-muted mb-2" />
            <p class="text-sm text-theme-tertiary">No favorites yet</p>
            <p class="text-xs text-theme-muted">Star services to add them here</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button 
              v-for="service in favoriteServices" 
              :key="service.name"
              @click="openService(service)"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="getServiceIcon(service)" :size="16" class="text-accent" />
              <span class="text-sm text-theme-primary truncate">{{ getServiceName(service) }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Recently Used -->
      <section class="animate-fade-in">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Clock" :size="12" />
          Recently Used
        </h2>
        <div class="p-4 rounded-2xl border border-theme-primary bg-theme-card min-h-[120px]">
          <div v-if="recentServices.length === 0" class="flex flex-col items-center justify-center h-full py-6 text-center">
            <Icon name="Clock" :size="24" class="text-theme-muted mb-2" />
            <p class="text-sm text-theme-tertiary">No recent activity</p>
            <p class="text-xs text-theme-muted">Services you use will appear here</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button 
              v-for="service in recentServices" 
              :key="service.name"
              @click="openService(service)"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="getServiceIcon(service)" :size="16" class="text-theme-secondary" />
              <span class="text-sm text-theme-primary truncate">{{ getServiceName(service) }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Section: Core Apps -->
    <section class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Box" :size="12" class="text-accent" />
        CubeOS Core Apps
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div 
          v-for="service in coreServices" 
          :key="service.name"
          @click="openService(service)"
          class="group p-4 rounded-xl border border-theme-primary bg-theme-card hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer relative"
        >
          <!-- Favorite star -->
          <button 
            @click.stop="toggleFavorite(service.name)"
            class="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            :class="isFavorite(service.name) ? 'text-yellow-500' : 'text-theme-muted hover:text-yellow-500'"
          >
            <Icon :name="isFavorite(service.name) ? 'Star' : 'Star'" :size="14" :fill="isFavorite(service.name) ? 'currentColor' : 'none'" />
          </button>
          
          <div class="flex flex-col items-center text-center">
            <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent/10 transition-colors">
              <Icon :name="getServiceIcon(service)" :size="20" class="text-theme-secondary group-hover:text-accent transition-colors" />
            </div>
            <span class="text-sm font-medium text-theme-primary">{{ getServiceName(service) }}</span>
            <span 
              class="text-xs mt-1"
              :class="service.state === 'running' ? 'text-success' : 'text-error'"
            >
              {{ service.state === 'running' ? '● Running' : '● Stopped' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Status summary -->
      <div class="mt-4 flex items-center justify-end gap-4 text-xs text-theme-muted">
        <span>{{ runningCount }} of {{ totalCount }} services running</span>
        <span v-if="systemInfo?.device_id" class="font-mono">{{ systemInfo.device_id.slice(0, 12) }}</span>
      </div>
    </section>

    <!-- Modals -->
    <AskCubeOS 
      :show="showChatModal" 
      :initial-query="chatQuery"
      @close="closeChatModal" 
    />

    <ServiceHealthModal 
      v-if="selectedService"
      :show="showHealthModal" 
      :service="selectedService"
      @close="showHealthModal = false" 
    />
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
