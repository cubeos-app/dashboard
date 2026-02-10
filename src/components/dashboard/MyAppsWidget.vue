<script setup>
/**
 * MyAppsWidget.vue — Session 7
 *
 * Standalone My Apps widget extracted from AppLauncher.vue.
 * Shows a grid of user-installed apps with configurable row limit.
 *
 * Self-contained: reads config from useDashboardConfig directly.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppsStore, APP_TYPES } from '@/stores/apps'
import { useDashboardConfig } from '@/composables/useDashboardConfig'
import { useWallpaper } from '@/composables/useWallpaper'
import { getAppColor } from '@/utils/appColors'
import Icon from '@/components/ui/Icon.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const emit = defineEmits(['open-app'])

const router = useRouter()
const appsStore = useAppsStore()
const { myAppsRows } = useDashboardConfig()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Computed data ───────────────────────────────────────────────

const userApps = computed(() => {
  const infraTypes = new Set([APP_TYPES.SYSTEM, APP_TYPES.PLATFORM])
  return appsStore.apps.filter(a => !infraTypes.has(a.type))
})

/** User apps limited by myAppsRows config (0 = all, else rows x 3 cols) */
const visibleUserApps = computed(() => {
  if (myAppsRows.value === 0) return userApps.value
  const limit = myAppsRows.value * 3
  return userApps.value.slice(0, limit)
})

const hasMoreApps = computed(() => {
  return myAppsRows.value > 0 && userApps.value.length > visibleUserApps.value.length
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
  <div v-if="userApps.length > 0">
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
  </div>

  <!-- No user apps installed -->
  <div v-else class="text-center py-6">
    <div :class="cardBase()" class="p-10 rounded-2xl text-center inline-block w-full">
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
  </div>
</template>
