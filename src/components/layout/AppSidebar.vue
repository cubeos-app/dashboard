<script setup>
/**
 * AppSidebar.vue
 *
 * S02 — Grouped sidebar navigation: 7 primary items + 2 footer.
 * Replaces flat 16-item sidebar with the new information architecture.
 *
 * Responsive behavior:
 *   ≥1280px (wide):       Fixed 260px sidebar, icons + labels
 *   1024-1279px (desktop): 64px icon rail; hover expands to 260px overlay
 *   768-1023px (tablet):   64px icon rail; hover expands to 260px overlay
 *   <768px (mobile):       Fully hidden — MobileNav.vue handles navigation
 *
 * Mode-aware:
 *   Terminal link only visible in Advanced mode.
 *   Communication/Media gated by HAL hardware detection (S09).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useBrandingStore } from '@/stores/branding'
import { useMode } from '@/composables/useMode'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useHardwareDetection } from '@/composables/useHardwareDetection'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()
const brandingStore = useBrandingStore()
const { isAdvanced } = useMode()
const { isMobile, isWide } = useBreakpoint()
const { hasCommHardware, hasMediaHardware } = useHardwareDetection()
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'

/** Whether icon rail is expanded on hover (tablet/desktop only) */
const hovered = ref(false)

// ─── Navigation Items ─────────────────────────────────────────────

const allPrimaryNavItems = [
  { path: '/', name: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/apps', name: 'Apps', icon: 'Grid3X3', badge: () => appsStore.runningCount },
  { path: '/network', name: 'Network', icon: 'Globe' },
  { path: '/storage', name: 'Storage', icon: 'HardDrive' },
  { path: '/system', name: 'System', icon: 'Settings2' },
  { path: '/communication', name: 'Communication', icon: 'Radio' },
  { path: '/media', name: 'Media', icon: 'Volume2' }
]

const primaryNavItems = computed(() => {
  return allPrimaryNavItems.filter(item => {
    if (item.path === '/communication' && !hasCommHardware.value) return false
    if (item.path === '/media' && !hasMediaHardware.value) return false
    return true
  })
})

const footerNavItems = computed(() => {
  const items = [
    { path: '/docs', name: 'Docs', icon: 'BookOpen' },
    { path: '/settings', name: 'Settings', icon: 'SlidersHorizontal' }
  ]
  if (isAdvanced.value) {
    items.push({ path: '/terminal', name: 'Terminal', icon: 'Terminal', external: true })
  }
  return items
})

// ─── Helpers ──────────────────────────────────────────────────────

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function navigate(path) {
  if (path === '/terminal') {
    window.open('/terminal', '_blank')
    return
  }
  router.push(path)
  hovered.value = false
}

// ─── Layout Computed ──────────────────────────────────────────────

/** Show labels when wide or hovered rail */
const showLabels = computed(() => isWide.value || hovered.value)

/** Sidebar is hidden on mobile — MobileNav handles it */
const isVisible = computed(() => !isMobile.value)

/** Sidebar width: 260px when expanded, 64px rail otherwise */
const sidebarWidth = computed(() => {
  if (isWide.value) return 'w-[260px]'
  if (hovered.value) return 'w-[260px]'
  return 'w-16'
})
</script>

<template>
  <aside
    v-if="isVisible"
    class="fixed top-14 left-0 bottom-0 z-40 flex flex-col bg-theme-secondary border-r border-theme-primary transition-all duration-200 overflow-hidden"
    :class="[
      sidebarWidth,
      !isWide && hovered ? 'shadow-xl' : ''
    ]"
    @mouseenter="!isWide && (hovered = true)"
    @mouseleave="hovered = false"
  >
    <!-- Primary navigation -->
    <nav aria-label="Main navigation" class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
      <button
        v-for="item in primaryNavItems"
        :key="item.path"
        @click="navigate(item.path)"
        :aria-label="item.name"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        class="w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150"
        :class="[
          showLabels ? 'px-2.5 py-2' : 'px-0 py-2 justify-center',
          isActive(item.path)
            ? 'bg-accent-muted text-accent'
            : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'
        ]"
        :title="!showLabels ? item.name : undefined"
      >
        <Icon
          :name="item.icon"
          :size="18"
          class="shrink-0"
          :class="isActive(item.path) ? 'text-accent' : 'text-theme-tertiary'"
        />
        <span
          v-if="showLabels"
          class="flex-1 text-left text-xs whitespace-nowrap overflow-hidden"
        >
          {{ item.name }}
        </span>
        <span
          v-if="showLabels && item.badge && item.badge()"
          class="px-1.5 py-0.5 text-[10px] font-semibold rounded"
          :class="isActive(item.path) ? 'bg-accent text-on-accent' : 'bg-success-muted text-success'"
        >
          {{ item.badge() }}
        </span>
      </button>
    </nav>

    <!-- Footer navigation -->
    <div class="px-2 py-3 border-t border-theme-primary space-y-0.5">
      <button
        v-for="item in footerNavItems"
        :key="item.path"
        @click="navigate(item.path)"
        :aria-label="item.name"
        :aria-current="!item.external && isActive(item.path) ? 'page' : undefined"
        class="w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150"
        :class="[
          showLabels ? 'px-2.5 py-2' : 'px-0 py-2 justify-center',
          !item.external && isActive(item.path)
            ? 'bg-accent-muted text-accent'
            : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'
        ]"
        :title="!showLabels ? item.name : undefined"
      >
        <Icon
          :name="item.icon"
          :size="18"
          class="shrink-0"
          :class="!item.external && isActive(item.path) ? 'text-accent' : 'text-theme-tertiary'"
        />
        <span v-if="showLabels" class="flex-1 text-left text-xs whitespace-nowrap overflow-hidden">
          {{ item.name }}
        </span>
        <Icon
          v-if="showLabels && item.external"
          name="ExternalLink"
          :size="10"
          class="text-theme-muted shrink-0"
        />
      </button>

      <!-- Version + API links (wide mode only) -->
      <div v-if="showLabels" class="pt-2 px-2.5">
        <a
          :href="brandingStore.currentBrand.github"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-[10px] text-theme-muted hover:text-theme-secondary transition-colors"
        >
          <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span class="font-mono">GitHub</span>
        </a>
        <a
          href="//api.cubeos.cube/api/v1/swagger/index.html"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-[10px] text-theme-muted hover:text-theme-tertiary transition-colors mt-1"
        >
          <Icon name="Code2" :size="12" />
          <span>API Docs</span>
        </a>
      </div>
    </div>
  </aside>
</template>
