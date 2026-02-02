<script setup>
/**
 * AppsView.vue - Sprint 4 Component
 * 
 * Main apps/services view using the unified apps store.
 * Replaces ServicesView.vue with new API structure.
 */
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import AppCard from '@/components/apps/AppCard.vue'
import AppHealthModal from '@/components/apps/AppHealthModal.vue'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()

const searchQuery = ref('')
const showSystemApps = ref(false)
const activeCategory = ref(null)

// Health modal
const showHealthModal = ref(false)
const selectedApp = ref(null)

function handleShowHealth(app) {
  selectedApp.value = app
  showHealthModal.value = true
}

function closeHealthModal() {
  showHealthModal.value = false
  selectedApp.value = null
}

watch(searchQuery, (value) => {
  appsStore.setSearchQuery(value)
})

watch(() => route.query.category, (category) => {
  activeCategory.value = category || null
}, { immediate: true })

const displayedApps = computed(() => {
  if (activeCategory.value) {
    const category = appsStore.categorizedApps[activeCategory.value]
    return category?.items || []
  }
  // Filter out system/platform apps unless showSystemApps is toggled
  return appsStore.filteredApps.filter(app => {
    const isCore = appsStore.isCore(app)
    return !isCore || showSystemApps.value
  })
})

const categoryTitle = computed(() => {
  if (activeCategory.value) {
    const category = appsStore.categorizedApps[activeCategory.value]
    return category?.title || 'Apps'
  }
  return 'All Apps'
})

const categoryIconName = computed(() => {
  if (activeCategory.value) {
    const category = appsStore.categorizedApps[activeCategory.value]
    return category?.icon || 'Package'
  }
  return null
})

function selectCategory(key) {
  activeCategory.value = key
  router.push({ query: { category: key } })
}

function clearCategory() {
  activeCategory.value = null
  router.push({ query: {} })
}

onMounted(() => {
  appsStore.fetchApps()
})

let refreshInterval = null
onMounted(() => {
  refreshInterval = setInterval(() => appsStore.fetchApps(), 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="space-y-6">
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
          {{ displayedApps.length }} app{{ displayedApps.length !== 1 ? 's' : '' }}
          <span v-if="appsStore.runningCount > 0" class="text-success">
            - {{ appsStore.runningCount }} running
          </span>
        </p>
      </div>

      <!-- Search -->
      <div class="relative w-full sm:w-72">
        <Icon name="Search" :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search apps..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </div>
    </div>

    <!-- Category chips -->
    <div v-if="!activeCategory" class="flex flex-wrap gap-2">
      <button
        v-for="(category, key) in appsStore.categorizedApps"
        :key="key"
        @click="selectCategory(key)"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-theme-tertiary text-theme-secondary hover:bg-theme-card hover:text-theme-primary"
      >
        <Icon :name="category.icon" :size="18" class="opacity-70" />
        <span>{{ category.title }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-theme-secondary text-theme-tertiary text-xs">
          {{ category.items.length }}
        </span>
      </button>
      
      <!-- System Apps toggle -->
      <button
        @click="showSystemApps = !showSystemApps"
        :class="[
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          showSystemApps 
            ? 'bg-accent-muted text-accent ring-1 ring-accent/30' 
            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-card hover:text-theme-primary'
        ]"
      >
        <Icon name="Box" :size="18" class="opacity-70" />
        <span>CubeOS Core Apps</span>
        <span :class="[
          'px-1.5 py-0.5 rounded-md text-xs',
          showSystemApps 
            ? 'bg-accent/20 text-accent'
            : 'bg-theme-secondary text-theme-tertiary'
        ]">
          {{ appsStore.coreApps.length }}
        </span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="appsStore.loading && appsStore.apps.length === 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="h-20 bg-theme-tertiary rounded-xl"></div>
      </div>
    </div>

    <!-- Apps grid -->
    <div v-else-if="displayedApps.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <AppCard
        v-for="app in displayedApps"
        :key="app.id"
        :app="app"
        compact
        @showHealth="handleShowHealth"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-16">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-tertiary mb-4">
        <Icon name="Package" :size="32" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-semibold text-theme-primary mb-2">No apps found</h3>
      <p class="text-theme-tertiary text-sm">
        {{ searchQuery ? 'Try adjusting your search.' : 'No apps are available.' }}
      </p>
    </div>

    <!-- Health Modal -->
    <AppHealthModal
      :app="selectedApp"
      :show="showHealthModal"
      @close="closeHealthModal"
    />
  </div>
</template>
