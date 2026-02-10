<script setup>
/**
 * RecentAppsWidget.vue — Session 7
 *
 * Standalone Recently Used apps widget extracted from AppLauncher.vue.
 * Shows a horizontal scroll strip of recently accessed apps (excluding favorites).
 *
 * Self-contained: reads from stores directly.
 * Only renders if there are recent apps to show.
 */
import { computed } from 'vue'
import { useAppsStore } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import { useWallpaper } from '@/composables/useWallpaper'
import { safeGetItem } from '@/utils/storage'
import { getAppColor } from '@/utils/appColors'
import Icon from '@/components/ui/Icon.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const emit = defineEmits(['open-app'])

const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()
const { isActive: wallpaperActive } = useWallpaper()

// ─── Computed data ───────────────────────────────────────────────

const recentApps = computed(() => {
  const names = safeGetItem('cubeos-recent', [])
  if (!Array.isArray(names)) return []
  const favNames = new Set(favoritesStore.favoriteNames())
  return names
    .filter(name => !favNames.has(name))
    .map(name => appsStore.getAppByName(name))
    .filter(Boolean)
    .slice(0, 6)
})

function cardBase() {
  return wallpaperActive.value
    ? 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <div v-if="recentApps.length > 0">
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
  </div>

  <!-- Empty state: nothing to render when no recent apps -->
  <div v-else class="text-center py-4">
    <p class="text-xs text-theme-muted">No recently used apps</p>
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
</style>
