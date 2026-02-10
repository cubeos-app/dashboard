<script setup>
/**
 * AppLauncher.vue — S13 Visual Upgrade v2 + Session 3 Config
 *
 * Combined app launcher for Standard dashboard.
 * Sections: Favorites (hero cards), Recently Used (scroll strip), My Apps (grid).
 *
 * Session 3: Accepts config props to control section visibility,
 * favorite grid columns, and my apps row limit.
 * Defaults preserve pre-config behavior.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore, APP_TYPES } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useWallpaper } from '@/composables/useWallpaper'
import { safeGetItem } from '@/utils/storage'
import { getAppColor } from '@/utils/appColors'
import Icon from '@/components/ui/Icon.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps({
  favorites: { type: Array, default: null },
  recentApps: { type: Array, default: null },
  // Dashboard config props (passed from DashboardStandard)
  showFavorites: { type: Boolean, default: true },
  showRecent: { type: Boolean, default: true },
  showMyApps: { type: Boolean, default: true },
  myAppsRows: { type: Number, default: 0 },    // 0 = show all, 1-5 = limit rows
  favoriteCols: { type: Number, default: 4 },   // 2-6
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
  const favNames = new Set(favoritesStore.favoriteNames())
  return names
    .filter(name => !favNames.has(name))
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 6)
})

const userApps = computed(() => {
  const infraTypes = new Set([APP_TYPES.SYSTEM, APP_TYPES.PLATFORM])
  return appsStore.apps.filter(a => !infraTypes.has(a.type))
})

/** User apps limited by myAppsRows config (0 = all, else rows × 3 cols) */
const visibleUserApps = computed(() => {
  if (props.myAppsRows === 0) return userApps.value
  // Max 3 columns on desktop → limit = rows × 3
  const limit = props.myAppsRows * 3
  return userApps.value.slice(0, limit)
})

const hasMoreApps = computed(() => {
  return props.myAppsRows > 0 && userApps.value.length > visibleUserApps.value.length
})

// ─── Favorites grid class (responsive, respects favoriteCols) ──

const favGridClass = computed(() => {
  // Mobile always 2 cols, sm 3 cols (or favCols if smaller), lg uses configured value
  const cols = props.favoriteCols
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
  <div class="space-y-8">
    <!-- ★ Favorites (hero) ──────────────────────────────────────── -->
    <section v-if="showFavorites" class="dash-stagger">
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
    </section>

    <!-- Recently Used (horizontal scroll) ───────────────────────── -->
    <section v-if="showRecent && recentApps.length > 0" class="dash-stagger">
      <h2 class="text-[11px] font-semibold text-theme-tertiary uppercase tracking-widest mb-3 flex items-center gap-2">
        <Icon name="Clock" :size="12" />
        Recent
      </h2>

      <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        <button
          v-for="(app, idx) in recentApps"
          :key="app.name"
          :class="cardBase()"
          class="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-xl w-[72px]
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group"
          :style="{ animationDelay: `${idx * 40}ms` }"
          @click="emit('open-app', app)"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
            :class="getAppColor(app).bg"
          >
            <AppIcon
              :name="app.name"
              :fallback="appsStore.getAppIcon(app)"
              :size="18"
              :class="getAppColor(app).text"
            />
          </div>
          <span class="text-[10px] text-theme-secondary truncate max-w-full leading-tight">
            {{ appsStore.getDisplayName(app) }}
          </span>
        </button>
      </div>
    </section>

    <!-- My Apps (full grid, row-limited) ─────────────────────────── -->
    <section v-if="showMyApps && userApps.length > 0" class="dash-stagger">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-[11px] font-semibold text-theme-tertiary uppercase tracking-widest flex items-center gap-2">
          <Icon name="Grid3x3" :size="12" />
          My Apps
        </h2>
        <button
          class="text-[11px] text-accent hover:text-accent-secondary transition-colors"
          @click="router.push('/apps')"
        >
          See all
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          v-for="(app, idx) in visibleUserApps"
          :key="app.name"
          :class="[
            cardBase(),
            app.status?.running ? '' : 'opacity-50'
          ]"
          class="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200
                 hover:shadow-md hover:-translate-y-px hover:ring-1 group text-left"
          :style="{ animationDelay: `${idx * 40}ms` }"
          @click="emit('open-app', app)"
        >
          <!-- Icon -->
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                   transition-transform duration-200 group-hover:scale-105"
            :class="getAppColor(app).bg"
          >
            <AppIcon
              :name="app.name"
              :fallback="appsStore.getAppIcon(app)"
              :size="20"
              :class="getAppColor(app).text"
            />
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <span class="text-sm font-medium text-theme-primary truncate block">
              {{ appsStore.getDisplayName(app) }}
            </span>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(app)" />
              <span class="text-[10px] text-theme-muted">{{ statusLabel(app) }}</span>
            </div>
          </div>

          <!-- Arrow -->
          <Icon name="ChevronRight" :size="14" class="text-theme-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <!-- "Show more" hint when row-limited -->
      <p v-if="hasMoreApps" class="text-center mt-3">
        <button
          class="text-[11px] text-theme-muted hover:text-accent transition-colors"
          @click="router.push('/apps')"
        >
          +{{ userApps.length - visibleUserApps.length }} more apps
        </button>
      </p>
    </section>

    <!-- No apps at all -->
    <section v-if="showFavorites && showMyApps && favoriteApps.length === 0 && userApps.length === 0" class="dash-stagger">
      <div :class="cardBase()" class="p-10 rounded-2xl text-center">
        <div class="w-16 h-16 rounded-3xl bg-accent-muted flex items-center justify-center mx-auto mb-4">
          <Icon name="Package" :size="28" class="text-accent" />
        </div>
        <p class="text-base font-medium text-theme-primary mb-1">No apps installed yet</p>
        <p class="text-sm text-theme-muted mb-5">Get started by installing your first app</p>
        <button
          class="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-all hover:shadow-lg hover:shadow-accent/20"
          @click="router.push('/apps?tab=store')"
        >
          Browse App Store
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary) transparent;
}
.scrollbar-thin::-webkit-scrollbar { height: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--border-primary);
  border-radius: 2px;
}

.fav-card:hover {
  box-shadow: 0 8px 24px var(--app-glow, rgba(14,165,233,0.1)),
              0 2px 8px rgba(0,0,0,0.2);
}
</style>
