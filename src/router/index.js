import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSetupStore } from '@/stores/setup'

const routes = [
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
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/components/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/services',
    name: 'services',
    component: () => import('@/components/apps/AppsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/apps',
    redirect: '/services'
  },
  {
    path: '/services/:name',
    name: 'service-detail',
    component: () => import('@/components/services/ServiceDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/apps/:name',
    redirect: to => `/services/${to.params.name}`
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('@/components/network/NetworkView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/firewall',
    name: 'firewall',
    component: () => import('@/components/firewall/FirewallView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/vpn',
    name: 'vpn',
    component: () => import('@/components/vpn/VPNManager.vue'),
    meta: { requiresAuth: true }
  },
  // Sprint 8: Communication & Media
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
  {
    path: '/logs',
    name: 'logs',
    component: () => import('@/components/logs/LogsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/storage',
    name: 'storage',
    component: () => import('@/components/storage/StorageView.vue'),
    meta: { requiresAuth: true }
  },
  // Sprint 4: Monitoring & Processes
  {
    path: '/monitoring',
    name: 'monitoring',
    component: () => import('@/components/monitoring/MonitoringView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/processes',
    name: 'processes',
    component: () => import('@/components/processes/ProcessesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/hardware',
    name: 'hardware',
    component: () => import('@/components/hardware/HardwareView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/system',
    name: 'system',
    component: () => import('@/components/system/SystemView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/components/settings/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/appstore',
    name: 'appstore',
    component: () => import('@/components/appstore/AppStoreView.vue'),
    meta: { requiresAuth: true }
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
    component: () => import('@/components/appmanager/AppManagerView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/docs/:pathMatch(.*)*',
    name: 'docs',
    component: () => import('@/components/docs/DocsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/components/NotFoundView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication and setup status
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  // useSetupStore() is safe here — pinia is installed before router in main.js
  const setupStore = useSetupStore()

  // Always check setup status first (before auth)
  // fetchStatus() returns cached data on subsequent calls (no redundant API hits)
  const statusData = await setupStore.fetchStatus()
  const isSetupDone = statusData?.is_complete === true

  // If setup not done and not going to setup page, redirect to setup
  if (!isSetupDone && to.name !== 'setup') {
    next({ name: 'setup' })
    return
  }

  // If setup is done, proceed with normal auth flow
  // Initialize auth on first navigation if we have a token but no user
  if (authStore.token && !authStore.user) {
    await authStore.init()
  }

  const requiresAuth = to.meta.requiresAuth
  const isGuest = to.meta.guest
  const isSetup = to.meta.setup
  const isAuthenticated = authStore.isAuthenticated

  if (requiresAuth && !isAuthenticated) {
    // Redirect to login if not authenticated
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (isGuest && isAuthenticated && !isSetup) {
    // Redirect to dashboard if already authenticated (except for setup)
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router

// Reset setup store on HMR to prevent stale state during development
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    try {
      const setupStore = useSetupStore()
      setupStore.clearStatus()
    } catch (e) {
      // Pinia may not be ready during HMR — safe to ignore
    }
  })
}
