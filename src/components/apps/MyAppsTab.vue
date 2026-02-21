<script setup>
/**
 * MyAppsTab.vue — S04 Component
 *
 * Standard mode: Clean app grid with status pills, favorite toggle,
 * start/stop/restart. Tap card → AppDetailSheet.
 *
 * Advanced mode: Same grid PLUS deploy mode badge, port info,
 * and more action controls.
 *
 * Reuses ServiceGrid from S03 where applicable,
 * but provides its own richer card layout for the main apps page.
 */
import { ref, computed, watch } from 'vue'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useMode } from '@/composables/useMode'
import { useWallpaper } from '@/composables/useWallpaper'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const emit = defineEmits(['openDetail', 'openStore'])

const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const { isAdvanced } = useMode()
const { panelClass, isActive: wallpaperActive } = useWallpaper()

// ─── Filters ─────────────────────────────────────────────────
const searchQuery = ref('')
const showSystemApps = ref(false)
const activeCategory = ref(null)

watch(searchQuery, (value) => {
  appsStore.setSearchQuery(value)
})

const displayedApps = computed(() => {
  let apps = activeCategory.value
    ? (appsStore.categorizedApps[activeCategory.value]?.items || [])
    : appsStore.filteredApps

  if (!activeCategory.value && !showSystemApps.value) {
    apps = apps.filter(app => !appsStore.isCore(app))
  }

  return apps
})

// ─── Favorites ───────────────────────────────────────────────
const favoriteApps = computed(() => {
  const names = favoritesStore.favoriteNames()
  return names
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// ─── Categories ──────────────────────────────────────────────
function selectCategory(key) {
  activeCategory.value = key
}

function clearCategory() {
  activeCategory.value = null
}

const categoryTitle = computed(() => {
  if (activeCategory.value) {
    return appsStore.categorizedApps[activeCategory.value]?.title || 'Apps'
  }
  return null
})

// ─── Actions ─────────────────────────────────────────────────
const actionLoading = ref(null) // appName being actioned

async function handleAction(app, action, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  const displayName = appsStore.getAppDisplayName(app)

  if (action !== 'start' && !await confirm({
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName}?`,
    message: `This will ${action} the ${displayName} service.`,
    confirmText: action.charAt(0).toUpperCase() + action.slice(1),
    variant: action === 'stop' ? 'danger' : 'warning'
  })) return

  actionLoading.value = app.name
  try {
    if (action === 'start') await appsStore.startApp(app.name)
    else if (action === 'stop') await appsStore.stopApp(app.name)
    else if (action === 'restart') await appsStore.restartApp(app.name)
    await appsStore.fetchApps()
  } finally {
    actionLoading.value = null
  }
}

function handleFavorite(app, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  favoritesStore.toggleFavorite(app.name)
}

function handleCardClick(app) {
  // Running apps with web UI: open directly (what users expect)
  if (appsStore.isRunning(app) && appsStore.hasWebUI(app)) {
    const url = appsStore.getAppUrl(app)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
  }
  // Stopped apps or apps without web UI: open detail sheet
  emit('openDetail', app)
}

function openApp(app, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  const url = appsStore.getAppUrl(app)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Favorites Section (if any) -->
    <div v-if="favoriteApps.length > 0" class="space-y-3">
      <h3 class="text-sm font-medium text-theme-secondary flex items-center gap-2">
        <Icon name="Star" :size="14" />
        Favorites
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <button
          v-for="app in favoriteApps"
          :key="'fav-' + app.name"
          @click="handleCardClick(app)"
          class="group relative flex items-center gap-3 p-3 rounded-xl border border-theme-primary transition-all duration-200 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5 text-left"
          :class="[
            wallpaperActive ? panelClass : 'bg-theme-card',
            appsStore.isRunning(app) ? 'cursor-pointer' : 'border-l-2 border-l-theme-muted cursor-default'
          ]"
        >
          <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0 group-hover:bg-accent-muted transition-colors">
            <Icon
              :name="appsStore.getAppIcon(app)"
              :size="18"
              class="text-theme-secondary group-hover:text-accent transition-colors"
              :stroke-width="1.5"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-theme-primary truncate">
              {{ appsStore.getAppDisplayName(app) }}
            </p>
            <p
              class="text-xs"
              :class="appsStore.isRunning(app) ? 'text-success' : 'text-theme-muted'"
            >
              {{ appsStore.isRunning(app) ? 'Running' : 'Stopped' }}
            </p>
          </div>
          <!-- Status dot -->
          <span
            class="flex-shrink-0 w-2 h-2 rounded-full"
            :class="[
              appsStore.isRunning(app)
                ? (appsStore.isHealthy(app) ? 'bg-success' : 'bg-warning animate-pulse-status')
                : 'bg-theme-muted'
            ]"
          ></span>
        </button>
      </div>
    </div>

    <!-- Search + Filter Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <!-- Category breadcrumb (only rendered when a category is active) -->
      <div v-if="activeCategory" class="flex items-center gap-3 flex-1">
        <button
          @click="clearCategory"
          class="p-1.5 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
          aria-label="Back to all apps"
        >
          <Icon name="ChevronLeft" :size="20" />
        </button>
        <h2 class="text-lg font-semibold text-theme-primary">
          {{ categoryTitle }}
        </h2>
      </div>

      <div class="relative" :class="activeCategory ? 'w-full sm:w-72' : 'w-full sm:w-80'">
        <Icon name="Search" :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search apps..."
          aria-label="Search apps"
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-sm"
        />
      </div>
    </div>

    <!-- Category Chips (when no category selected) -->
    <div v-if="!activeCategory" class="flex flex-wrap gap-2">
      <!-- "All Apps" chip — always first -->
      <button
        @click="showSystemApps = true; activeCategory = null"
        :class="[
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          showSystemApps && !activeCategory
            ? 'bg-accent-muted text-accent ring-1 ring-accent/30'
            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-card hover:text-theme-primary'
        ]"
      >
        <Icon name="LayoutGrid" :size="18" class="opacity-70" />
        <span>All Apps</span>
        <span :class="[
          'px-1.5 py-0.5 rounded-md text-xs',
          showSystemApps && !activeCategory
            ? 'bg-accent/20 text-accent'
            : 'bg-theme-secondary text-theme-tertiary'
        ]">
          {{ appsStore.apps.length }}
        </span>
      </button>

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
        <span>CubeOS Core</span>
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

    <!-- Loading State -->
    <SkeletonLoader
      v-if="appsStore.loading && appsStore.apps.length === 0"
      variant="grid"
      :count="8"
    />

    <!-- Apps Grid -->
    <div
      v-else-if="displayedApps.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
    >
      <div
        v-for="app in displayedApps"
        :key="app.name || app.id"
        @click="handleCardClick(app)"
        class="group relative rounded-xl border border-theme-primary overflow-hidden transition-all duration-200 hover:border-theme-secondary hover:shadow-theme-md hover:-translate-y-0.5 cursor-pointer"
        :class="[
          wallpaperActive ? panelClass : 'bg-theme-card',
          !appsStore.isRunning(app) ? 'border-l-2 border-l-theme-muted' : ''
        ]"
      >
        <div class="p-4">
          <div class="flex items-center gap-3">
            <!-- Icon -->
            <div
              class="flex-shrink-0 w-11 h-11 rounded-xl bg-theme-tertiary flex items-center justify-center group-hover:bg-accent-muted transition-colors duration-200"
            >
              <Icon
                :name="appsStore.getAppIcon(app)"
                :size="22"
                class="text-theme-secondary group-hover:text-accent transition-colors duration-200"
                :stroke-width="1.5"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-theme-primary truncate text-sm">
                  {{ appsStore.getAppDisplayName(app) }}
                </h3>
                <span
                  class="flex-shrink-0 w-2 h-2 rounded-full"
                  :class="[
                    appsStore.isRunning(app)
                      ? (appsStore.isHealthy(app) ? 'bg-success' : 'bg-warning animate-pulse-status')
                      : 'bg-theme-muted'
                  ]"
                ></span>
              </div>
              <!-- Standard: simple status text -->
              <p class="text-xs text-theme-tertiary truncate mt-0.5">
                {{ appsStore.isRunning(app) ? 'Running' : 'Stopped' }}
                <template v-if="isAdvanced && app.deploy_mode">
                  <span class="text-theme-muted"> · </span>
                  <span class="capitalize">{{ app.deploy_mode }}</span>
                </template>
              </p>
            </div>

            <!-- Actions -->
            <div class="flex-shrink-0 flex items-center gap-1">
              <!-- Favorite toggle -->
              <button
                @click="handleFavorite(app, $event)"
                class="p-1.5 rounded-lg transition-colors"
                :class="favoritesStore.isFavorite(app.name)
                  ? 'text-warning'
                  : 'text-theme-muted opacity-0 group-hover:opacity-100'"
                :title="favoritesStore.isFavorite(app.name) ? 'Remove from favorites' : 'Add to favorites'"
                :aria-label="favoritesStore.isFavorite(app.name) ? 'Remove from favorites' : 'Add to favorites'"
              >
                <Icon
                  name="Star"
                  :size="16"
                  :class="favoritesStore.isFavorite(app.name) ? 'fill-current' : ''"
                />
              </button>

              <!-- Open Web UI — always visible for running apps -->
              <button
                v-if="appsStore.isRunning(app) && appsStore.hasWebUI(app)"
                @click="openApp(app, $event)"
                class="p-1.5 text-accent hover:bg-accent-muted rounded-lg transition-colors"
                title="Open"
                aria-label="Open web UI"
              >
                <Icon name="ExternalLink" :size="16" />
              </button>

              <!-- Start/Stop/Restart (visible on hover / always on mobile) -->
              <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <!-- Start: available for ALL stopped apps (core apps can crash too) -->
                <button
                  v-if="!appsStore.isRunning(app)"
                  @click="handleAction(app, 'start', $event)"
                  :disabled="actionLoading === app.name"
                  class="p-1.5 text-theme-tertiary hover:text-success hover:bg-success-muted rounded-lg transition-colors"
                  title="Start"
                  aria-label="Start app"
                >
                  <Icon name="Play" :size="16" />
                </button>

                <!-- Stop: blocked for core apps to prevent accidental shutdown -->
                <button
                  v-if="appsStore.isRunning(app) && !appsStore.isCore(app)"
                  @click="handleAction(app, 'stop', $event)"
                  :disabled="actionLoading === app.name"
                  class="p-1.5 text-theme-tertiary hover:text-error hover:bg-error-muted rounded-lg transition-colors"
                  title="Stop"
                  aria-label="Stop app"
                >
                  <Icon name="Square" :size="16" />
                </button>

                <!-- Restart: available for ALL running apps -->
                <button
                  v-if="appsStore.isRunning(app)"
                  @click="handleAction(app, 'restart', $event)"
                  :disabled="actionLoading === app.name"
                  class="p-1.5 text-theme-tertiary hover:text-warning hover:bg-warning-muted rounded-lg transition-colors"
                  title="Restart"
                  aria-label="Restart app"
                >
                  <Icon name="RotateCw" :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Advanced: Port footer -->
        <div
          v-if="app.ports?.length > 0"
          class="px-4 py-2 bg-theme-secondary border-t border-theme-primary"
        >
          <div class="flex items-center gap-2 text-xs">
            <span class="text-theme-muted">Ports</span>
            <div class="flex items-center gap-1">
              <span
                v-for="port in app.ports.filter(p => p.port).slice(0, 3)"
                :key="port.port"
                class="px-1.5 py-0.5 rounded bg-theme-tertiary text-theme-secondary font-mono text-[11px]"
              >
                {{ port.port }}
              </span>
              <span
                v-if="app.ports.filter(p => p.port).length > 3"
                class="text-theme-muted"
              >
                +{{ app.ports.filter(p => p.port).length - 3 }}
              </span>
            </div>
          </div>
        </div>

        <!-- Loading overlay -->
        <div
          v-if="actionLoading === app.name"
          class="absolute inset-0 bg-theme-card/80 backdrop-blur-sm flex items-center justify-center"
        >
          <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-tertiary mb-4">
        <Icon name="Package" :size="32" class="text-theme-muted" />
      </div>
      <h3 class="text-lg font-semibold text-theme-primary mb-2">
        {{ searchQuery ? 'No apps found' : 'No apps installed' }}
      </h3>
      <p class="text-theme-tertiary text-sm mb-4">
        {{ searchQuery ? 'Try adjusting your search.' : 'Browse the App Store to get started.' }}
      </p>
      <button
        v-if="!searchQuery || activeCategory"
        @click="$emit('openStore')"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
      >
        <Icon name="Store" :size="16" />
        Browse App Store
      </button>
    </div>
  </div>
</template>
