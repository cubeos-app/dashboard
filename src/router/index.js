/**
 * CubeOS Router
 *
 * S02 — Route structure aligned with the 7+2 sidebar IA.
 *
 * New consolidated pages will be built in S03-S10. Until then, routes
 * point to existing view components. Old bookmark URLs redirect to
 * the new consolidated paths with ?tab= query params.
 *
 * Route structure:
 *   /               → Dashboard
 *   /apps           → Apps (tabs: my-apps, store, manager)
 *   /apps/:name     → App detail
 *   /network        → Network (tabs: overview, wifi, firewall, vpn, dns, clients, traffic)
 *   /storage        → Storage (tabs: overview, usb, backups, devices, mounts, smb)
 *   /system         → System (tabs: overview, monitoring, processes, logs, hardware)
 *   /communication  → Communication
 *   /media          → Media
 *   /docs           → Docs
 *   /settings       → Settings
 *   /login          → Login (guest only)
 *   /setup          → First boot wizard (guest only)
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSetupStore } from '@/stores/setup'

const routes = [
  // ─── Guest routes ─────────────────────────────────────────────
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/components/wizard/FirstBootWizard.vue'),
    meta: { guest: true, setup: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/components/auth/LoginView.vue'),
    meta: { guest: true }
  },

  // ─── Primary pages (sidebar items) ────────────────────────────
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/components/dashboard/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/apps',
    name: 'apps',
    component: () => import('@/components/apps/AppsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/apps/:name',
    name: 'app-detail',
    component: () => import('@/components/services/ServiceDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('@/components/network/NetworkPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/storage',
    name: 'storage',
    component: () => import('@/components/storage/StorageView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/system',
    name: 'system',
    component: () => import('@/components/system/SystemView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/communication',
    name: 'communication',
    component: () => import('@/components/communication/CommunicationView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/media',
    name: 'media',
    component: () => import('@/components/media/MediaView.vue'),
    meta: { requiresAuth: true }
  },

  // ─── Footer pages ─────────────────────────────────────────────
  {
    path: '/docs/:pathMatch(.*)*',
    name: 'docs',
    component: () => import('@/components/docs/DocsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/components/settings/SettingsView.vue'),
    meta: { requiresAuth: true }
  },

  // ─── App Store / Manager (still accessible, will become tabs) ─
  {
    path: '/appstore',
    name: 'appstore',
    redirect: '/apps?tab=store'
  },
  {
    path: '/appstore/config/:appId',
    name: 'app-config',
    component: () => import('@/components/appstore/ConfigEditor.vue'),
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/appmanager',
    name: 'appmanager',
    redirect: '/apps?tab=manager',
    meta: { requiresAuth: true }
  },

  // ─── Backward-compat redirects ────────────────────────────────
  // Old standalone routes → consolidated pages with tab query param.
  // These ensure bookmarks and external links keep working.
  {
    path: '/services',
    redirect: '/apps'
  },
  {
    path: '/services/:name',
    redirect: to => `/apps/${to.params.name}`
  },
  {
    path: '/firewall',
    redirect: '/network?tab=firewall'
  },
  {
    path: '/vpn',
    redirect: '/network?tab=vpn'
  },
  {
    path: '/monitoring',
    redirect: '/system?tab=monitoring'
  },
  {
    path: '/processes',
    redirect: '/system?tab=processes'
  },
  {
    path: '/logs',
    redirect: '/system?tab=logs'
  },
  {
    path: '/hardware',
    redirect: '/system?tab=hardware'
  },

  // ─── Catch-all ────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/components/NotFoundView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    return { top: 0 }
  }
})

// ─── Navigation Guard ─────────────────────────────────────────────

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const setupStore = useSetupStore()

  // Always check setup status first
  const statusData = await setupStore.fetchStatus()
  const isSetupDone = statusData?.is_complete === true

  if (!isSetupDone && to.name !== 'setup') {
    next({ name: 'setup' })
    return
  }

  // Initialize auth on first navigation if we have a token but no user
  if (authStore.token && !authStore.user) {
    await authStore.init()
  }

  const requiresAuth = to.meta.requiresAuth
  const isGuest = to.meta.guest
  const isSetup = to.meta.setup
  const isAuthenticated = authStore.isAuthenticated

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (isGuest && isAuthenticated && !isSetup) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router

// Reset setup store on HMR
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    try {
      const setupStore = useSetupStore()
      setupStore.clearStatus()
    } catch (e) {
      // Pinia may not be ready during HMR
    }
  })
}
