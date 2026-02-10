<script setup>
/**
 * MobileNav.vue
 *
 * S02 — Bottom tab bar for mobile viewports (<768px).
 * Shows 5 items: Dashboard, Apps, Network, Storage, More.
 * "More" opens the NavDrawer with full navigation.
 *
 * Touch targets: min 44×44pt per Apple/Material guidelines.
 * Fixed to bottom, sits above content. Safe area padding for notch devices.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreakpoint } from '@/composables/useBreakpoint'
import Icon from '@/components/ui/Icon.vue'
import NavDrawer from '@/components/layout/NavDrawer.vue'

const route = useRoute()
const router = useRouter()
const { isMobile } = useBreakpoint()

const drawerOpen = ref(false)

const tabItems = [
  { path: '/', name: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/apps', name: 'Apps', icon: 'Grid3X3' },
  { path: '/network', name: 'Network', icon: 'Globe' },
  { path: '/storage', name: 'Storage', icon: 'HardDrive' }
]

/** Pages that live under the "More" menu — if active, highlight More tab */
const morePages = ['/system', '/communication', '/media', '/docs', '/settings']

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function isMoreActive() {
  return morePages.some(p => route.path.startsWith(p))
}

function navigate(path) {
  router.push(path)
}

function openDrawer() {
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

function onDrawerNavigate(path) {
  router.push(path)
  drawerOpen.value = false
}
</script>

<template>
  <div v-if="isMobile">
    <!-- Bottom tab bar -->
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 bg-theme-secondary border-t border-theme-primary safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div class="flex items-stretch h-14">
        <!-- Tab items -->
        <button
          v-for="item in tabItems"
          :key="item.path"
          @click="navigate(item.path)"
          :aria-label="item.name"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[64px] transition-colors"
          :class="isActive(item.path) ? 'text-accent' : 'text-theme-muted'"
        >
          <Icon :name="item.icon" :size="20" />
          <span class="text-[10px] font-medium leading-tight">{{ item.name }}</span>
        </button>

        <!-- More button -->
        <button
          @click="openDrawer"
          aria-label="More navigation options"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[64px] transition-colors"
          :class="isMoreActive() || drawerOpen ? 'text-accent' : 'text-theme-muted'"
        >
          <Icon name="MoreHorizontal" :size="20" />
          <span class="text-[10px] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>

    <!-- Navigation drawer -->
    <NavDrawer
      :open="drawerOpen"
      @close="closeDrawer"
      @navigate="onDrawerNavigate"
    />
  </div>
</template>

<style scoped>
/* Safe area for devices with bottom notch/gesture bar */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
