<script setup>
/**
 * DashboardView.vue
 * 
 * Main dashboard view with SwarmOverview widget integrated.
 * Sprint 4: Uses new unified apps.js store.
 * 
 * Fixes:
 * - Search now actually filters apps and shows results
 * - Search can navigate to settings, network, storage, etc.
 * - Better keyboard handling (Escape to clear, Enter to open first result)
 */
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppsStore } from '@/stores/apps'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { safeGetItem, safeSetItem } from '@/utils/storage'   // keep for recentApps
import { useFavoritesStore } from '@/stores/favorites'
import Icon from '@/components/ui/Icon.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'
import AskCubeOS from '@/components/chat/AskCubeOS.vue'
import SwarmOverview from '@/components/swarm/SwarmOverview.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const router = useRouter()
const systemStore = useSystemStore()
const appsStore = useAppsStore()
const { signal } = useAbortOnUnmount()
const favoritesStore = useFavoritesStore()

// State
const searchQuery = ref('')
const showSearchResults = ref(false)
const showHealthModal = ref(false)
const showChatModal = ref(false)
const chatQuery = ref('')
const selectedApp = ref(null)

// Quick actions for search (pages user can navigate to)
const quickActions = [
  { name: 'Settings', icon: 'Settings', route: '/settings', keywords: ['settings', 'preferences', 'theme', 'appearance', 'account', 'password'] },
  { name: 'Services', icon: 'Server', route: '/services', keywords: ['services', 'containers', 'docker', 'swarm'] },
  { name: 'App Store', icon: 'Store', route: '/appstore', keywords: ['store', 'apps', 'install', 'marketplace'] },
  { name: 'App Manager', icon: 'Package', route: '/appmanager', keywords: ['manager', 'installed', 'apps', 'manage'] },
  { name: 'Network', icon: 'Wifi', route: '/network', keywords: ['network', 'wifi', 'ap', 'firewall', 'internet', 'clients'] },
  { name: 'Storage', icon: 'HardDrive', route: '/storage', keywords: ['storage', 'disk', 'usb', 'smb', 'backup'] },
  { name: 'Logs', icon: 'FileText', route: '/logs', keywords: ['logs', 'journal', 'debug', 'errors'] },
  { name: 'Documentation', icon: 'BookOpen', route: '/docs', keywords: ['docs', 'documentation', 'help', 'guide'] },
  { name: 'System', icon: 'Monitor', route: '/system', keywords: ['system', 'reboot', 'shutdown', 'power', 'cpu', 'memory'] },
]

// Computed
const systemInfo = computed(() => systemStore.systemInfo)

// Core apps (system + platform types)
const coreApps = computed(() => appsStore.coreApps)

const runningCount = computed(() => appsStore.runningCount)
const totalCount = computed(() => appsStore.appCount)

const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// Recently used (stored in localStorage)
const recentApps = computed(() => {
  const names = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(names)) return []
  return names
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 6)
})

/**
 * Search results - combines apps and quick actions
 */
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return { apps: [], actions: [] }
  
  const query = searchQuery.value.toLowerCase().trim()
  
  // Filter apps
  const matchedApps = appsStore.allApps.filter(app => {
    const name = (app.display_name || app.name || '').toLowerCase()
    const desc = (app.description || '').toLowerCase()
    return name.includes(query) || desc.includes(query)
  }).slice(0, 5)
  
  // Filter quick actions
  const matchedActions = quickActions.filter(action => {
    const name = action.name.toLowerCase()
    const keywords = action.keywords.join(' ').toLowerCase()
    return name.includes(query) || keywords.includes(query)
  }).slice(0, 3)
  
  return { apps: matchedApps, actions: matchedActions }
})

const hasSearchResults = computed(() => {
  return searchResults.value.apps.length > 0 || searchResults.value.actions.length > 0
})

// Watch search query to show/hide results
watch(searchQuery, (val) => {
  showSearchResults.value = val.trim().length > 0
})

// Search handlers
function handleSearchKeydown(e) {
  if (e.key === 'Escape') {
    searchQuery.value = ''
    showSearchResults.value = false
  } else if (e.key === 'Enter' && hasSearchResults.value) {
    // Open first result
    if (searchResults.value.apps.length > 0) {
      openApp(searchResults.value.apps[0])
    } else if (searchResults.value.actions.length > 0) {
      navigateTo(searchResults.value.actions[0].route)
    }
    searchQuery.value = ''
    showSearchResults.value = false
  }
}

function navigateTo(route) {
  router.push(route)
  searchQuery.value = ''
  showSearchResults.value = false
}

function clearSearch() {
  searchQuery.value = ''
  showSearchResults.value = false
}

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

// App functions
function toggleFavorite(appName) {
  favoritesStore.toggleFavorite(appName)
}

function isFavorite(appName) {
  return favoritesStore.isFavorite(appName)
}

function trackUsage(appName) {
  let recent = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(recent)) recent = []
  // Remove if exists, add to front
  recent = recent.filter(n => n !== appName)
  recent.unshift(appName)
  // Keep only last 10
  recent = recent.slice(0, 10)
  safeSetItem('cubeos-recent', recent)
}

function openApp(app) {
  trackUsage(app.name)
  clearSearch()
  
  const url = appsStore.getAppUrl(app)
  if (url) {
    window.open(url, '_blank')
  } else {
    // Show health modal for apps without web UI
    selectedApp.value = app
    showHealthModal.value = true
  }
}

function getAppIcon(app) {
  return appsStore.getAppIcon(app)
}

function getAppName(app) {
  return appsStore.getDisplayName(app)
}

function getHealthStatus(app) {
  if (!app.status) return 'unknown'
  if (app.status.health === 'healthy' || app.status.health === 'running') return 'running'
  return app.status.health || 'unknown'
}

// Lifecycle
onMounted(async () => {
  // Load data (pass signal for abort on unmount)
  const s = signal()
  await Promise.all([
    systemStore.fetchAll({ signal: s }),
    appsStore.fetchApps({ signal: s }),
    favoritesStore.fetchAll()
  ])
  
  // Start centralized app polling (stats handled by App.vue WebSocket)
  appsStore.startPolling()
})

onUnmounted(() => {
  appsStore.stopPolling()
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
        role="button"
        tabindex="0"
        aria-label="Open AI assistant chat"
        @click="openChat"
        @keydown.enter="openChat"
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
              placeholder="Ask a question..."
              aria-label="Ask CubeOS AI assistant"
              class="w-full pl-9 pr-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <button
            @click="openChatWithQuery"
            :disabled="!chatQuery.trim()"
            aria-label="Send question to AI assistant"
            class="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </div>
      </div>
    </section>

    <!-- Section: Quick Search -->
    <section class="animate-fade-in relative">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Search" :size="12" />
        Quick Search
      </h2>
      <div class="relative">
        <Icon name="Search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted z-10" />
        <input 
          v-model="searchQuery"
          @keydown="handleSearchKeydown"
          @focus="showSearchResults = searchQuery.trim().length > 0"
          type="text" 
          placeholder="Search services, apps, settings..."
          aria-label="Quick search services, apps, and settings"
          class="w-full pl-11 pr-10 py-3 rounded-xl border border-theme-primary bg-theme-card text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
        />
        <button
          v-if="searchQuery"
          @click="clearSearch"
          aria-label="Clear search"
          class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
        >
          <Icon name="X" :size="16" />
        </button>
        
        <!-- Search Results Dropdown -->
        <div
          v-if="showSearchResults && hasSearchResults"
          class="absolute top-full left-0 right-0 mt-2 rounded-xl border border-theme-primary bg-theme-card shadow-lg z-20 overflow-hidden"
        >
          <!-- Apps -->
          <div v-if="searchResults.apps.length > 0">
            <p class="px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider bg-theme-tertiary">Services</p>
            <button
              v-for="app in searchResults.apps"
              :key="app.name"
              @click="openApp(app)"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="getAppIcon(app)" :size="18" class="text-accent" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-theme-primary">{{ getAppName(app) }}</p>
                <p class="text-xs text-theme-muted truncate">{{ app.description || 'Service' }}</p>
              </div>
              <span 
                class="w-2 h-2 rounded-full"
                :class="{
                  'bg-success': getHealthStatus(app) === 'running',
                  'bg-warning': getHealthStatus(app) === 'starting',
                  'bg-error': getHealthStatus(app) === 'unhealthy',
                  'bg-theme-muted': getHealthStatus(app) === 'stopped' || getHealthStatus(app) === 'unknown'
                }"
              ></span>
            </button>
          </div>
          
          <!-- Quick Actions -->
          <div v-if="searchResults.actions.length > 0">
            <p class="px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider bg-theme-tertiary">Go to</p>
            <button
              v-for="action in searchResults.actions"
              :key="action.route"
              @click="navigateTo(action.route)"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="action.icon" :size="18" class="text-theme-secondary" />
              <span class="text-sm font-medium text-theme-primary">{{ action.name }}</span>
              <Icon name="ChevronRight" :size="14" class="text-theme-muted ml-auto" />
            </button>
          </div>
        </div>
        
        <!-- No Results -->
        <div
          v-if="showSearchResults && searchQuery.trim() && !hasSearchResults"
          class="absolute top-full left-0 right-0 mt-2 rounded-xl border border-theme-primary bg-theme-card shadow-lg z-20 p-4 text-center"
        >
          <Icon name="SearchX" :size="24" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">No results found</p>
        </div>
      </div>
      
      <!-- Clickaway overlay -->
      <div
        v-if="showSearchResults"
        class="fixed inset-0 z-10"
        @click="showSearchResults = false"
      ></div>
    </section>

    <!-- Section: Swarm Overview -->
    <section class="animate-fade-in">
      <SwarmOverview />
    </section>

    <!-- Section: Favorites & Recently Used -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Favorites -->
      <section class="animate-fade-in">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Icon name="Star" :size="12" class="text-warning" />
          Favorites
        </h2>
        <div class="p-4 rounded-2xl border border-theme-primary bg-theme-card min-h-[120px]">
          <div v-if="favoriteApps.length === 0" class="flex flex-col items-center justify-center h-full py-6 text-center">
            <Icon name="Star" :size="24" class="text-theme-muted mb-2" />
            <p class="text-sm text-theme-tertiary">No favorites yet</p>
            <p class="text-xs text-theme-muted">Star services to add them here</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button 
              v-for="app in favoriteApps" 
              :key="app.name"
              @click="openApp(app)"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="getAppIcon(app)" :size="16" class="text-accent" />
              <span class="text-sm text-theme-primary truncate">{{ getAppName(app) }}</span>
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
          <div v-if="recentApps.length === 0" class="flex flex-col items-center justify-center h-full py-6 text-center">
            <Icon name="Clock" :size="24" class="text-theme-muted mb-2" />
            <p class="text-sm text-theme-tertiary">No recent activity</p>
            <p class="text-xs text-theme-muted">Services you use will appear here</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button 
              v-for="app in recentApps" 
              :key="app.name"
              @click="openApp(app)"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-left"
            >
              <Icon :name="getAppIcon(app)" :size="16" class="text-theme-secondary" />
              <span class="text-sm text-theme-primary truncate">{{ getAppName(app) }}</span>
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
      <SkeletonLoader v-if="appsStore.loading && coreApps.length === 0" variant="grid" :count="6" />
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div 
          v-for="app in coreApps" 
          :key="app.name"
          @click="openApp(app)"
          @keydown.enter="openApp(app)"
          role="button"
          tabindex="0"
          :aria-label="`Open ${getAppName(app)}`"
          class="group p-4 rounded-xl border border-theme-primary bg-theme-card hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer relative"
        >
          <!-- Favorite star -->
          <button 
            @click.stop="toggleFavorite(app.name)"
            :aria-label="isFavorite(app.name) ? `Remove ${getAppName(app)} from favorites` : `Add ${getAppName(app)} to favorites`"
            class="absolute top-2 right-2 p-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
            :class="isFavorite(app.name) ? 'text-warning' : 'text-theme-muted hover:text-warning'"
          >
            <Icon name="Star" :size="14" :fill="isFavorite(app.name) ? 'currentColor' : 'none'" />
          </button>
          
          <div class="flex flex-col items-center text-center">
            <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent/10 transition-colors">
              <Icon :name="getAppIcon(app)" :size="20" class="text-theme-secondary group-hover:text-accent transition-colors" />
            </div>
            <span class="text-sm font-medium text-theme-primary">{{ getAppName(app) }}</span>
            <span 
              class="text-xs mt-1"
              :class="{
                'text-success': getHealthStatus(app) === 'running',
                'text-warning': getHealthStatus(app) === 'starting',
                'text-error': getHealthStatus(app) === 'unhealthy',
                'text-theme-muted': getHealthStatus(app) === 'stopped' || getHealthStatus(app) === 'unknown'
              }"
            >
              <template v-if="getHealthStatus(app) === 'running'">Running</template>
              <template v-else-if="getHealthStatus(app) === 'starting'">Starting</template>
              <template v-else-if="getHealthStatus(app) === 'unhealthy'">Unhealthy</template>
              <template v-else>Stopped</template>
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
      v-if="selectedApp"
      :show="showHealthModal" 
      :service="selectedApp"
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
