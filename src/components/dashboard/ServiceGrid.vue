<script setup>
/**
 * ServiceGrid.vue
 *
 * S03 — Responsive service/app card grid for the dashboard.
 * Standard mode: simple cards with icon, name, status pill.
 * Advanced mode: adds resource usage hints and deploy mode badge.
 *
 * Usage:
 *   <ServiceGrid :apps="coreApps" :detailed="isAdvanced" @open="openApp" />
 */
import { useAppsStore, DEPLOY_MODES } from '@/stores/apps'
import { useFavoritesStore } from '@/stores/favorites'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const props = defineProps({
  /** Array of app objects from the apps store */
  apps: {
    type: Array,
    default: () => []
  },
  /** Show detailed cards (deploy mode, type badge) */
  detailed: {
    type: Boolean,
    default: false
  },
  /** Show loading skeleton */
  loading: {
    type: Boolean,
    default: false
  },
  /** Title above the grid */
  title: {
    type: String,
    default: ''
  },
  /** Icon for the section header */
  titleIcon: {
    type: String,
    default: ''
  },
  /** Max items to show (0 = show all) */
  limit: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['open', 'toggle-favorite'])

const appsStore = useAppsStore()
const favoritesStore = useFavoritesStore()

function getIcon(app) {
  return appsStore.getAppIcon(app)
}

function getName(app) {
  return appsStore.getDisplayName(app)
}

function getHealth(app) {
  if (!app.status) return 'unknown'
  if (app.status.health === 'healthy' || app.status.health === 'running') return 'running'
  return app.status.health || 'unknown'
}

function healthLabel(health) {
  const labels = { running: 'Running', starting: 'Starting', unhealthy: 'Unhealthy', stopped: 'Stopped', unknown: 'Unknown' }
  return labels[health] || 'Unknown'
}

function isFav(name) {
  return favoritesStore.isFavorite(name)
}

function displayedApps() {
  if (props.limit > 0) return props.apps.slice(0, props.limit)
  return props.apps
}
</script>

<template>
  <section v-if="loading || apps.length > 0" class="animate-fade-in">
    <!-- Section header -->
    <h2
      v-if="title"
      class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider mb-3 flex items-center gap-2"
    >
      <Icon v-if="titleIcon" :name="titleIcon" :size="12" class="text-accent" />
      {{ title }}
    </h2>

    <SkeletonLoader v-if="loading && apps.length === 0" variant="grid" :count="6" />

    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    >
      <div
        v-for="app in displayedApps()"
        :key="app.name"
        role="button"
        tabindex="0"
        :aria-label="`Open ${getName(app)}`"
        class="group p-3 rounded-xl border border-theme-primary bg-theme-card hover:border-accent/40 hover:shadow-lg transition-all cursor-pointer relative"
        @click="emit('open', app)"
        @keydown.enter="emit('open', app)"
      >
        <!-- Favorite star -->
        <button
          class="absolute top-2 right-2 p-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
          :class="isFav(app.name) ? 'text-warning' : 'text-theme-muted hover:text-warning'"
          :aria-label="isFav(app.name) ? `Remove ${getName(app)} from favorites` : `Add ${getName(app)} to favorites`"
          @click.stop="emit('toggle-favorite', app.name)"
        >
          <Icon name="Star" :size="13" :fill="isFav(app.name) ? 'currentColor' : 'none'" />
        </button>

        <div class="flex flex-col items-center text-center gap-1.5">
          <!-- Icon -->
          <div class="w-9 h-9 rounded-lg bg-theme-tertiary flex items-center justify-center group-hover:bg-accent/10 transition-colors">
            <Icon :name="getIcon(app)" :size="18" class="text-theme-secondary group-hover:text-accent transition-colors" />
          </div>

          <!-- Name -->
          <span class="text-xs font-medium text-theme-primary leading-tight truncate w-full">
            {{ getName(app) }}
          </span>

          <!-- Status pill -->
          <span
            class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            :class="{
              'bg-success-muted text-success': getHealth(app) === 'running',
              'bg-warning-muted text-warning': getHealth(app) === 'starting',
              'bg-error-muted text-error': getHealth(app) === 'unhealthy',
              'bg-neutral-muted text-neutral': getHealth(app) === 'stopped' || getHealth(app) === 'unknown'
            }"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-success': getHealth(app) === 'running',
                'bg-warning': getHealth(app) === 'starting',
                'bg-error': getHealth(app) === 'unhealthy',
                'bg-neutral': getHealth(app) === 'stopped' || getHealth(app) === 'unknown'
              }"
            ></span>
            {{ healthLabel(getHealth(app)) }}
          </span>

          <!-- Advanced: deploy mode badge -->
          <span
            v-if="detailed && app.deploy_mode"
            class="text-[9px] text-theme-muted font-mono"
          >
            {{ app.deploy_mode === DEPLOY_MODES.STACK ? 'swarm' : 'compose' }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
