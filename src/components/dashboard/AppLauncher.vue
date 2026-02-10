<script setup>
/**
 * AppLauncher.vue — S13
 *
 * Combined app launcher for Standard dashboard.
 * Sections: Favorites (hero), Recently Used (horizontal scroll), My Apps (grid).
 * Infrastructure/platform apps are excluded from view.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore, APP_TYPES } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useWallpaper } from '@/composables/useWallpaper'
import { safeGetItem } from '@/utils/storage'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Override favorites list (optional, from parent) */
  favorites: { type: Array, default: null },
  /** Override recent apps list (optional, from parent) */
  recentApps: { type: Array, default: null }
})

const emit = defineEmits(['open-app', 'toggle-favorite'])

const router = useRouter()
const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Computed data ───────────────────────────────────────────────

const favoriteApps = computed(() => {
  if (props.favorites) return props.favorites
  return favoritesStore.favoriteNames()
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
})

const recentApps = computed(() => {
  if (props.recentApps) return props.recentApps
  const names = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(names)) return []
  // Exclude favorites from recent (they already show above)
  const favNames = new Set(favoritesStore.favoriteNames())
  return names
    .filter(name => !favNames.has(name))
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 6)
})

// User apps = non-infrastructure, non-platform
const userApps = computed(() => {
  const infraTypes = new Set([APP_TYPES.SYSTEM, APP_TYPES.PLATFORM])
  return appsStore.apps.filter(a => !infraTypes.has(a.type))
})

// ─── Helpers ─────────────────────────────────────────────────────

function statusDot(app) {
  const health = app.status?.health
  if (health === 'healthy' || health === 'running') return 'bg-success'
  if (health === 'unhealthy') return 'bg-error'
  if (health === 'starting') return 'bg-warning'
  return 'bg-neutral'
}

function statusLabel(app) {
  if (app.status?.running) return 'Running'
  return 'Stopped'
}

function cardClass() {
  return wallpaperActive.value ? 'glass' : 'bg-theme-card border border-theme-primary'
}

function appCardClass(app) {
  const base = wallpaperActive.value ? 'glass' : 'bg-theme-card border border-theme-primary'
  const opacity = app.status?.running ? '' : 'opacity-60'
  return `${base} ${opacity}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- ★ Favorites (hero) -->
    <section class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Star" :size="12" class="text-warning" />
        Favorites
      </h2>

      <!-- Empty state -->
      <div
        v-if="favoriteApps.length === 0"
        :class="cardClass()"
        class="p-6 rounded-2xl text-center"
      >
        <Icon name="Star" :size="24" class="text-theme-muted mx-auto mb-2" />
        <p class="text-sm text-theme-muted mb-2">Star your most-used apps to pin them here</p>
        <button
          class="text-xs text-accent hover:underline"
          @click="router.push('/apps')"
        >
          Browse apps
        </button>
      </div>

      <!-- Favorites grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          v-for="app in favoriteApps"
          :key="app.name"
          :class="cardClass()"
          class="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:ring-2 hover:ring-accent/30 group"
          @click="emit('open-app', app)"
          @contextmenu.prevent
        >
          <div class="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Icon :name="appsStore.getAppIcon(app)" :size="24" class="text-accent" />
          </div>
          <span class="text-sm font-medium text-theme-primary truncate max-w-full">
            {{ appsStore.getDisplayName(app) }}
          </span>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(app)" />
            <span class="text-[10px] text-theme-muted">{{ statusLabel(app) }}</span>
          </div>
        </button>
      </div>
    </section>

    <!-- Recently Used (horizontal scroll) -->
    <section v-if="recentApps.length > 0" class="animate-fade-in">
      <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon name="Clock" :size="12" />
        Recently Used
      </h2>

      <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        <button
          v-for="app in recentApps"
          :key="app.name"
          :class="cardClass()"
          class="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl w-20 transition-all hover:ring-2 hover:ring-accent/20"
          @click="emit('open-app', app)"
        >
          <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center">
            <Icon :name="appsStore.getAppIcon(app)" :size="18" class="text-theme-secondary" />
          </div>
          <span class="text-[11px] text-theme-primary truncate max-w-full">
            {{ appsStore.getDisplayName(app) }}
          </span>
        </button>
      </div>
    </section>

    <!-- My Apps (full grid, excludes infrastructure) -->
    <section v-if="userApps.length > 0" class="animate-fade-in">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider flex items-center gap-2">
          <Icon name="Package" :size="12" />
          My Apps
        </h2>
        <button
          class="text-xs text-accent hover:underline"
          @click="router.push('/apps')"
        >
          See all
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <button
          v-for="app in userApps"
          :key="app.name"
          :class="appCardClass(app)"
          class="flex items-center gap-3 p-3 rounded-xl transition-all hover:ring-2 hover:ring-accent/20 text-left"
          @click="emit('open-app', app)"
        >
          <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
            <Icon :name="appsStore.getAppIcon(app)" :size="20" class="text-theme-secondary" />
          </div>
          <div class="min-w-0 flex-1">
            <span class="text-sm font-medium text-theme-primary truncate block">
              {{ appsStore.getDisplayName(app) }}
            </span>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(app)" />
              <span class="text-[10px] text-theme-muted">{{ statusLabel(app) }}</span>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- No apps at all -->
    <section
      v-if="favoriteApps.length === 0 && userApps.length === 0"
      class="animate-fade-in"
    >
      <div :class="cardClass()" class="p-8 rounded-2xl text-center">
        <Icon name="Package" :size="32" class="text-theme-muted mx-auto mb-3" />
        <p class="text-sm text-theme-muted mb-3">No apps installed yet</p>
        <button
          class="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          @click="router.push('/apps?tab=store')"
        >
          Browse App Store
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Thin scrollbar for horizontal scroll */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--color-theme-muted) transparent;
}
.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--color-theme-muted);
  border-radius: 2px;
}
</style>
