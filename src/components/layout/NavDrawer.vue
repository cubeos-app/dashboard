<script setup>
/**
 * NavDrawer.vue
 *
 * S02 — Full-screen navigation drawer for mobile.
 * Triggered by the "More" tab in MobileNav.vue.
 * Shows all navigation items including those not in the bottom tab bar,
 * plus mode toggle and version info.
 *
 * Slides up from bottom with backdrop overlay.
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBrandingStore } from '@/stores/branding'
import { useMode } from '@/composables/useMode'
import { useHardwareDetection } from '@/composables/useHardwareDetection'
import Icon from '@/components/ui/Icon.vue'
import ModeToggle from '@/components/ui/ModeToggle.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'navigate'])
const route = useRoute()
const brandingStore = useBrandingStore()
const { isAdvanced } = useMode()
const { hasCommHardware, hasMediaHardware } = useHardwareDetection()
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'

// ─── All Navigation Items ─────────────────────────────────────────
// Includes items not in the bottom tab bar, filtered by hardware detection
const drawerItems = computed(() => {
  const items = [
    { heading: 'Main' },
    { path: '/', name: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/apps', name: 'Apps', icon: 'Grid3X3' },
    { path: '/network', name: 'Network', icon: 'Globe' },
    { path: '/storage', name: 'Storage', icon: 'HardDrive' },
    { path: '/system', name: 'System', icon: 'Settings2' }
  ]
  if (hasCommHardware.value || hasMediaHardware.value) {
    items.push({ heading: 'Hardware' })
    if (hasCommHardware.value) items.push({ path: '/communication', name: 'Communication', icon: 'Radio' })
    if (hasMediaHardware.value) items.push({ path: '/media', name: 'Media', icon: 'Volume2' })
  }
  items.push(
    { heading: 'Other' },
    { path: '/docs', name: 'Docs', icon: 'BookOpen' },
    { path: '/settings', name: 'Settings', icon: 'SlidersHorizontal' }
  )
  return items
})

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function navigate(path) {
  emit('navigate', path)
}

// Prevent body scroll when drawer is open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="fixed inset-0 z-[60]">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="$emit('close')"
        ></div>

        <!-- Drawer panel — slides up from bottom -->
        <div class="drawer-panel absolute bottom-14 left-0 right-0 max-h-[80vh] bg-theme-secondary rounded-t-2xl overflow-hidden flex flex-col safe-area-bottom">
          <!-- Handle bar -->
          <div class="flex justify-center pt-3 pb-1">
            <div class="w-10 h-1 rounded-full bg-theme-primary"></div>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <template v-for="(item, i) in drawerItems" :key="i">
              <!-- Section heading -->
              <div
                v-if="item.heading"
                class="px-2 pt-4 pb-1.5 text-[10px] font-semibold text-theme-muted uppercase tracking-wider"
                :class="{ 'pt-2': i === 0 }"
              >
                {{ item.heading }}
              </div>

              <!-- Navigation item -->
              <button
                v-else
                @click="navigate(item.path)"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors"
                :class="isActive(item.path)
                  ? 'bg-accent-muted text-accent'
                  : 'text-theme-secondary active:bg-theme-tertiary'
                "
              >
                <Icon
                  :name="item.icon"
                  :size="20"
                  :class="isActive(item.path) ? 'text-accent' : 'text-theme-tertiary'"
                />
                <span>{{ item.name }}</span>
              </button>
            </template>

            <!-- Terminal (Advanced only) -->
            <a
              v-if="isAdvanced"
              href="/terminal"
              target="_blank"
              rel="noopener"
              class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-theme-secondary active:bg-theme-tertiary transition-colors"
            >
              <Icon name="Terminal" :size="20" class="text-theme-tertiary" />
              <span>Terminal</span>
              <Icon name="ExternalLink" :size="12" class="text-theme-muted ml-auto" />
            </a>

            <!-- Mode toggle -->
            <div class="mt-4 pt-4 border-t border-theme-primary">
              <div class="flex items-center justify-between px-2">
                <span class="text-xs text-theme-muted">UI Mode</span>
                <ModeToggle compact />
              </div>
            </div>

            <!-- Version -->
            <div class="mt-3 px-2">
              <span class="text-[10px] text-theme-muted font-mono">
                {{ brandingStore.brandName }} {{ appVersion }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* NavDrawer transitions — unscoped so Teleport + Transition works */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateY(100%);
}
</style>

<style scoped>
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
