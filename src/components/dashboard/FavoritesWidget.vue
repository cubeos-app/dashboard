<script setup>
/**
 * FavoritesWidget.vue — Session 7
 *
 * Standalone Favorites widget extracted from the monolithic AppLauncher.vue.
 * Shows hero cards for user-favorited apps with configurable columns.
 *
 * Self-contained: reads config from useDashboardConfig directly.
 * No parent props needed — visibility controlled by grid layout placement.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useWallpaper } from '@/composables/useWallpaper'
import { getAppColor } from '@/utils/appColors'
import Icon from '@/components/ui/Icon.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const emit = defineEmits(['open-app'])

const router = useRouter()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const { favoriteCols } = useDashboardConfig()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Computed data ───────────────────────────────────────────────

const favoriteApps = computed(() => {
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

// ─── Favorites grid class (responsive, respects favoriteCols) ──

const favGridClass = computed(() => {
  const cols = favoriteCols.value
  const colsMap = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }
  return colsMap[cols] || colsMap[4]
})

// ─── Helpers ─────────────────────────────────────────────────────

function statusDot(app) {
  const health = app.status?.health
  if (health === 'healthy' || health === 'running') return 'bg-success'
  if (health === 'unhealthy') return 'bg-error'
  if (health === 'starting') return 'bg-warning animate-pulse'
  return 'bg-neutral'
}

function statusLabel(app) {
  if (app.status?.running) return 'Running'
  return 'Stopped'
}

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div>
    <h2 class="text-[11px] font-semibold text-theme-tertiary uppercase tracking-widest mb-3 flex items-center gap-2">
      <Icon name="Star" :size="12" class="text-amber-400" />
      Favorites
    </h2>

    <!-- Empty state -->
    <div
      v-if="favoriteApps.length === 0"
      :class="cardBase()"
      class="p-8 rounded-2xl text-center"
    >
      <div class="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
        <Icon name="Star" :size="22" class="text-amber-400" />
      </div>
      <p class="text-sm text-theme-secondary mb-1">Pin your favorites here</p>
      <p class="text-xs text-theme-muted mb-4">Star apps from the Apps page to see them on your dashboard</p>
      <button
        class="px-4 py-2 text-xs font-medium text-accent bg-accent-muted rounded-lg hover:bg-accent/20 transition-colors"
        @click="router.push('/apps')"
      >
        Browse apps
      </button>
    </div>

    <!-- Favorites grid — bigger hero cards, columns from config -->
    <div v-else class="grid gap-3" :class="favGridClass">
      <button
        v-for="(app, idx) in favoriteApps"
        :key="app.name"
        :class="cardBase()"
        class="fav-card flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-300
               hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 group relative overflow-hidden"
        :style="{ animationDelay: `${idx * 60}ms`, '--app-glow': getAppColor(app).glow }"
        @click="emit('open-app', app)"
      >
        <!-- Subtle top glow on hover -->
        <div
          class="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          :class="getAppColor(app).bg.replace('/15', '/40')"
        />

        <!-- Icon — brand SVG with colored background -->
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                 group-hover:scale-110 group-hover:shadow-md"
          :class="getAppColor(app).bg"
        >
          <AppIcon
            :name="app.name"
            :fallback="appsStore.getAppIcon(app)"
            :size="26"
            :class="getAppColor(app).text"
          />
        </div>

        <!-- Name -->
        <span class="text-sm font-medium text-theme-primary truncate max-w-full">
          {{ appsStore.getDisplayName(app) }}
        </span>

        <!-- Status -->
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(app)" />
          <span class="text-[10px] text-theme-muted">{{ statusLabel(app) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.fav-card:hover {
  box-shadow: 0 8px 24px var(--app-glow, rgba(14,165,233,0.1)),
              0 2px 8px rgba(0,0,0,0.2);
}
</style>
