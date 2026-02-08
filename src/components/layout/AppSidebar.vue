<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppsStore } from '@/stores/apps'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  },
  mobileOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close-mobile'])

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()
const brandingStore = useBrandingStore()
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'

// Navigation items
const navItems = [
  { path: '/', name: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/apps', name: 'Apps', icon: 'Grid3X3', badge: () => appsStore.runningCount },
  { path: '/appstore', name: 'App Store', icon: 'Store' },
  { path: '/appmanager', name: 'App Manager', icon: 'Boxes' },
  { path: '/network', name: 'Network', icon: 'Wifi' },
  { path: '/firewall', name: 'Firewall', icon: 'Shield' },
  { path: '/vpn', name: 'VPN', icon: 'Lock' },
  { path: '/storage', name: 'Storage', icon: 'HardDrive' },
  { path: '/logs', name: 'Logs', icon: 'ScrollText' },
  { path: '/monitoring', name: 'Monitoring', icon: 'Activity' },
  { path: '/processes', name: 'Processes', icon: 'Cpu' },
  { path: '/hardware', name: 'Hardware', icon: 'CircuitBoard' },
  { path: '/communication', name: 'Communication', icon: 'Radio' },
  { path: '/media', name: 'Media', icon: 'Volume2' },
  { path: '/docs', name: 'Docs', icon: 'BookOpen' },
  { path: '/system', name: 'System', icon: 'Settings2' }
]

// FQDN mappings for quick links - all services go through NPM reverse proxy
const QUICK_LINK_FQDNS = {
  'dockge': { name: 'Dockge', fqdn: 'dockge.cubeos.cube', icon: 'Box' },
  'portainer': { name: 'Portainer', fqdn: 'portainer.cubeos.cube', icon: 'Box' },
  'uptime': { name: 'Uptime Kuma', fqdn: 'uptime.cubeos.cube', icon: 'Activity' },
  'pihole': { name: 'Pi-hole', fqdn: 'pihole.cubeos.cube', path: '/admin', icon: 'Shield' }
}

// Quick links to external services - using FQDNs, not IP:port
const quickLinks = computed(() => {
  const links = []
  const apps = appsStore.apps || []
  
  // Check for each quick link service
  for (const [key, config] of Object.entries(QUICK_LINK_FQDNS)) {
    const app = apps.find(a => a.name?.toLowerCase().includes(key))
    if (app?.status?.running) {
      const path = config.path || ''
      links.push({
        name: config.name,
        url: `http://${config.fqdn}${path}`,
        icon: config.icon
      })
    }
  }
  
  return links.slice(0, 4)
})

// Check if route is active
function isActive(path) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

// Navigate and close mobile
function navigate(path) {
  router.push(path)
  emit('close-mobile')
}
</script>

<template>
  <!-- Mobile overlay -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 bg-theme-overlay backdrop-blur-sm z-40 lg:hidden"
    @click="$emit('close-mobile')"
  ></div>

  <!-- Sidebar -->
  <aside
    class="fixed top-14 left-0 bottom-0 z-40 flex flex-col bg-theme-secondary border-r border-theme-primary transition-all duration-300"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      collapsed ? 'w-[72px]' : 'w-60'
    ]"
  >
    <!-- Main navigation -->
    <nav aria-label="Main navigation" class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="navigate(item.path)"
        :aria-label="item.name"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
        :class="[
          isActive(item.path)
            ? 'bg-accent-muted text-accent'
            : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'
        ]"
      >
        <Icon 
          :name="item.icon" 
          :size="18" 
          :class="isActive(item.path) ? 'text-accent' : 'text-theme-tertiary'"
        />
        <span v-if="!collapsed" class="flex-1 text-left text-xs">{{ item.name }}</span>
        <span
          v-if="!collapsed && item.badge && item.badge()"
          class="px-1.5 py-0.5 text-[10px] font-semibold rounded"
          :class="isActive(item.path) ? 'bg-accent text-on-accent' : 'bg-success-muted text-success'"
        >
          {{ item.badge() }}
        </span>
      </button>
    </nav>

    <!-- Quick Links -->
    <div v-if="quickLinks.length > 0 && !collapsed" class="px-2 py-3 border-t border-theme-primary">
      <h3 class="px-2.5 mb-1.5 text-[10px] font-semibold text-theme-muted uppercase tracking-wider">
        Quick Links
      </h3>
      <div class="space-y-0.5">
        <a
          v-for="link in quickLinks"
          :key="link.name"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
        >
          <Icon :name="link.icon" :size="14" class="text-theme-muted" />
          <span class="flex-1">{{ link.name }}</span>
          <Icon name="ExternalLink" :size="10" class="text-theme-muted" />
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="!collapsed" class="px-2 py-3 border-t border-theme-primary">
      <div class="px-2.5 space-y-1">
        <a
          :href="brandingStore.currentBrand.github"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-[10px] text-theme-muted hover:text-theme-secondary transition-colors"
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span class="font-mono">{{ brandingStore.brandName }} {{ appVersion }}</span>
        </a>
        <a
          href="/api/v1/docs/"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-[10px] text-theme-muted hover:text-theme-tertiary transition-colors"
        >
          <Icon name="Code2" :size="12" />
          <span>API Documentation</span>
        </a>
      </div>
    </div>
  </aside>
</template>
