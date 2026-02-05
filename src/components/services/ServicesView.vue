<script setup>
/**
 * ServicesView.vue
 * 
 * Services listing with StackList integration.
 * Sprint 4: Uses new unified apps.js store.
 */
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore, APP_TYPES } from '@/stores/apps'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import StackList from '@/components/swarm/StackList.vue'
import ServiceHealthModal from '@/components/services/ServiceHealthModal.vue'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()
const { signal } = useAbortOnUnmount()

// State
const searchQuery = ref('')
const viewMode = ref('stacks') // 'stacks' | 'grid'
const showCoreApps = ref(true)
const activeCategory = ref(null)

// Health modal
const showHealthModal = ref(false)
const selectedApp = ref(null)

// Refresh interval
// Sync search with store
watch(searchQuery, (value) => {
  appsStore.searchQuery = value
})

// Watch route for category
watch(() => route.query.category, (category) => {
  activeCategory.value = category || null
}, { immediate: true })

// Computed
const displayedApps = computed(() => {
  let apps = appsStore.filteredApps
  
  // Filter by category if active
  if (activeCategory.value) {
    const categoryTypes = getCategoryTypes(activeCategory.value)
    if (categoryTypes.length > 0) {
      apps = apps.filter(a => categoryTypes.includes(a.type))
    }
  }
  
  // Filter core apps unless toggled
  if (!showCoreApps.value) {
    apps = apps.filter(a => 
      a.type !== APP_TYPES.SYSTEM && a.type !== APP_TYPES.PLATFORM
    )
  }
  
  return apps
})

const categoryTitle = computed(() => {
  if (activeCategory.value) {
    return getCategoryTitle(activeCategory.value)
  }
  return 'All Services'
})

const categoryIconName = computed(() => {
  if (activeCategory.value) {
    return getCategoryIcon(activeCategory.value)
  }
  return null
})

// Category mapping
function getCategoryTypes(key) {
  const mapping = {
    infrastructure: [APP_TYPES.SYSTEM],
    platform: [APP_TYPES.PLATFORM],
    network: [APP_TYPES.NETWORK],
    ai: [APP_TYPES.AI],
    user: [APP_TYPES.USER]
  }
  return mapping[key] || []
}

function getCategoryTitle(key) {
  const titles = {
    infrastructure: 'Infrastructure',
    platform: 'Platform Services',
    network: 'Network & Privacy',
    ai: 'AI & Machine Learning',
    user: 'User Applications'
  }
  return titles[key] || 'Services'
}

function getCategoryIcon(key) {
  const icons = {
    infrastructure: 'Server',
    platform: 'LayoutDashboard',
    network: 'Shield',
    ai: 'Brain',
    user: 'Package'
  }
  return icons[key] || 'Package'
}

// Category chips data
const categories = computed(() => {
  const cats = []
  
  const categoryDefs = [
    { key: 'infrastructure', title: 'Infrastructure', icon: 'Server', types: [APP_TYPES.SYSTEM] },
    { key: 'platform', title: 'Platform', icon: 'LayoutDashboard', types: [APP_TYPES.PLATFORM] },
    { key: 'ai', title: 'AI & ML', icon: 'Brain', types: [APP_TYPES.AI] },
    { key: 'network', title: 'Network', icon: 'Shield', types: [APP_TYPES.NETWORK] },
    { key: 'user', title: 'Applications', icon: 'Package', types: [APP_TYPES.USER] }
  ]
  
  for (const def of categoryDefs) {
    const count = appsStore.apps.filter(a => def.types.includes(a.type)).length
    if (count > 0) {
      cats.push({ ...def, count })
    }
  }
  
  return cats
})

// Navigation
function selectCategory(key) {
  activeCategory.value = key
  router.push({ query: { category: key } })
}

function clearCategory() {
  activeCategory.value = null
  router.push({ query: {} })
}

// Service actions
function handleShowHealth(app) {
  selectedApp.value = app
  showHealthModal.value = true
}

function closeHealthModal() {
  showHealthModal.value = false
  selectedApp.value = null
}

function openApp(app) {
  const url = appsStore.getAppUrl(app)
  if (url) {
    window.open(url, '_blank')
  } else {
    handleShowHealth(app)
  }
}

function getHealthStatus(app) {
  if (!app.status) return 'unknown'
  const health = app.status.health
  if (health === 'healthy' || health === 'running') return 'healthy'
  return health || 'unknown'
}

// Lifecycle
onMounted(() => {
  appsStore.fetchApps({ signal: signal() })
  appsStore.startPolling()
})

onUnmounted(() => {
  appsStore.stopPolling()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <button 
            v-if="activeCategory"
            @click="clearCategory"
            class="p-1.5 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          >
            <Icon name="ChevronLeft" :size="20" />
          </button>
          <div class="flex items-center gap-2">
            <Icon v-if="categoryIconName" :name="categoryIconName" :size="24" class="text-theme-secondary" />
            <h1 class="text-2xl font-semibold text-theme-primary">{{ categoryTitle }}</h1>
          </div>
        </div>
        <p class="text-theme-tertiary mt-1 text-sm">
          {{ displayedApps.length }} service{{ displayedApps.length !== 1 ? 's' : '' }}
          <span v-if="appsStore.runningCount > 0" class="text-success">
            - {{ appsStore.runningCount }} running
          </span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- View mode toggle -->
        <div class="flex items-center bg-theme-tertiary rounded-lg p-1">
          <button
            @click="viewMode = 'stacks'"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="viewMode === 'stacks' ? 'bg-theme-card text-theme-primary shadow-sm' : 'text-theme-secondary hover:text-theme-primary'"
          >
            <Icon name="Layers" :size="16" />
          </button>
          <button
            @click="viewMode = 'grid'"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="viewMode === 'grid' ? 'bg-theme-card text-theme-primary shadow-sm' : 'text-theme-secondary hover:text-theme-primary'"
          >
            <Icon name="Grid3X3" :size="16" />
          </button>
        </div>
        
        <!-- Search -->
        <div class="relative w-full sm:w-72">
          <Icon name="Search" :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search services..."
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
      </div>
    </div>

    <!-- Category chips -->
    <div v-if="!activeCategory" class="flex flex-wrap gap-2">
      <button
        v-for="category in categories"
        :key="category.key"
        @click="selectCategory(category.key)"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-theme-tertiary text-theme-secondary hover:bg-theme-card hover:text-theme-primary"
      >
        <Icon :name="category.icon" :size="18" class="opacity-70" />
        <span>{{ category.title }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-theme-secondary text-theme-tertiary text-xs">
          {{ category.count }}
        </span>
      </button>
      
      <!-- Core Services toggle -->
      <button
        @click="showCoreApps = !showCoreApps"
        :class="[
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          showCoreApps 
            ? 'bg-accent-muted text-accent ring-1 ring-accent/30' 
            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-card hover:text-theme-primary'
        ]"
      >
        <Icon name="Box" :size="18" class="opacity-70" />
        <span>Show Core</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="appsStore.loading && appsStore.apps.length === 0" class="text-center py-16">
      <Icon name="Loader2" :size="32" class="mx-auto text-accent animate-spin mb-4" />
      <p class="text-sm text-theme-muted">Loading services...</p>
    </div>

    <!-- Stack List View -->
    <div v-else-if="viewMode === 'stacks'">
      <StackList />
    </div>

    <!-- Grid View -->
    <div v-else-if="displayedApps.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <div
        v-for="app in displayedApps"
        :key="app.name"
        @click="openApp(app)"
        class="group p-4 rounded-xl border border-theme-primary bg-theme-card hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer"
      >
        <div class="flex flex-col items-center text-center">
          <div class="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center mb-2 group-hover:bg-accent/10 transition-colors">
            <Icon :name="appsStore.getAppIcon(app)" :size="20" class="text-theme-secondary group-hover:text-accent transition-colors" />
          </div>
          <span class="text-sm font-medium text-theme-primary">{{ appsStore.getDisplayName(app) }}</span>
          <span 
            class="text-xs mt-1"
            :class="{
              'text-success': getHealthStatus(app) === 'healthy',
              'text-warning': getHealthStatus(app) === 'starting',
              'text-error': getHealthStatus(app) === 'unhealthy',
              'text-theme-muted': getHealthStatus(app) === 'stopped' || getHealthStatus(app) === 'unknown'
            }"
          >
            {{ getHealthStatus(app) === 'healthy' ? 'Running' : getHealthStatus(app) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-16">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-tertiary mb-4">
        <Icon name="Package" :size="32" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-semibold text-theme-primary mb-2">No services found</h3>
      <p class="text-theme-tertiary text-sm">
        {{ searchQuery ? 'Try adjusting your search.' : 'No services are available.' }}
      </p>
    </div>

    <!-- Health Modal -->
    <ServiceHealthModal
      :service="selectedApp"
      :show="showHealthModal"
      @close="closeHealthModal"
    />
  </div>
</template>
