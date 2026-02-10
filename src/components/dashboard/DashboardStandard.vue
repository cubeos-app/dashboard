<script setup>
/**
 * DashboardStandard.vue — S13 Rewrite
 *
 * Standard mode ("consumer mode") dashboard.
 * Thin composition shell — delegates to focused child components:
 *   SearchChatBar → AlertBanner → StatusPill → AppLauncher → Quick Actions
 *
 * No gauge rings, no infrastructure service grid, no sysadmin details.
 * Advanced mode users get DashboardAdvanced.vue instead.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'
import SearchChatBar from './SearchChatBar.vue'
import AlertBanner from './AlertBanner.vue'
import StatusPill from './StatusPill.vue'
import AppLauncher from './AppLauncher.vue'

const router = useRouter()
const { isActive: wallpaperActive } = useWallpaper()

const emit = defineEmits(['open-app', 'toggle-favorite', 'open-chat'])

// Expose searchBar ref so DashboardView can focus it via Ctrl+K
const searchBarRef = ref(null)
defineExpose({ searchBarRef })

// ─── Quick actions ───────────────────────────────────────────────
function goToAppStore() { router.push('/apps?tab=store') }
function goToNetwork() { router.push('/network') }

function cardClass() {
  return wallpaperActive.value ? 'glass rounded-2xl' : 'rounded-2xl border border-theme-primary bg-theme-card'
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Search + Chat bar -->
    <SearchChatBar
      ref="searchBarRef"
      @open-app="(app) => emit('open-app', app)"
      @open-chat="emit('open-chat')"
    />

    <!-- Alert banner (conditional — renders nothing if no alerts) -->
    <AlertBanner />

    <!-- Status pill (single-line health summary) -->
    <StatusPill />

    <!-- App launcher: favorites, recently used, user apps -->
    <AppLauncher
      @open-app="(app) => emit('open-app', app)"
      @toggle-favorite="(name) => emit('toggle-favorite', name)"
    />

    <!-- Quick Actions -->
    <section class="animate-fade-in">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          :class="cardClass()"
          class="p-4 text-left hover:ring-2 hover:ring-accent/20 transition-all group"
          @click="goToAppStore"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="Plus" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">Add new app</span>
              <span class="text-xs text-theme-muted">Browse the store</span>
            </div>
          </div>
        </button>

        <button
          :class="cardClass()"
          class="p-4 text-left hover:ring-2 hover:ring-accent/20 transition-all group"
          @click="goToNetwork"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="Wifi" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">Network</span>
              <span class="text-xs text-theme-muted">WiFi and connectivity</span>
            </div>
          </div>
        </button>

        <button
          :class="cardClass()"
          class="p-4 text-left hover:ring-2 hover:ring-accent/20 transition-all group"
          @click="emit('open-chat')"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Icon name="MessageSquare" :size="18" class="text-accent" />
            </div>
            <div>
              <span class="text-sm font-medium text-theme-primary block">Ask CubeOS</span>
              <span class="text-xs text-theme-muted">AI assistant</span>
            </div>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>
