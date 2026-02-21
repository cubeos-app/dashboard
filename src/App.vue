<script setup>
/**
 * App.vue
 *
 * S02 — Root layout component with responsive sidebar/mobile navigation.
 *
 * Layout behavior:
 *   ≥768px:  AppHeader + AppSidebar + content area
 *   <768px:  AppHeader + content area + MobileNav (bottom tab bar)
 *
 * Wallpaper: In Standard mode, the main content area gets a background
 * wallpaper with glassmorphism panels via useWallpaper().
 *
 * WebSocket + HTTP fallback polling for system stats is unchanged.
 */
import { onMounted, ref, onUnmounted, watch, provide } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import { useSystemStore } from '@/stores/system'
import { useWebSocket } from '@/composables/useWebSocket'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useWallpaper } from '@/composables/useWallpaper'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import MobileNav from '@/components/layout/MobileNav.vue'
import Icon from '@/components/ui/Icon.vue'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SystemTransitionScreen from '@/components/system/SystemTransitionScreen.vue'
import { confirmState, handleConfirm, handleCancel } from '@/utils/confirmDialog'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()
const systemStore = useSystemStore()
const { isMobile, isWide } = useBreakpoint()
const { wallpaperStyle, isActive: wallpaperActive } = useWallpaper()

// Credentials banner
const credentialsBannerDismissed = ref(false)

// HTTP fallback polling
let fallbackInterval = null
const FALLBACK_POLL_MS = 5000

// ─── WebSocket ────────────────────────────────────────────────────

const {
  connected: wsConnected,
  reconnect: wsReconnect,
  subscribe: wsSubscribe,
  unsubscribe: wsUnsubscribe
} = useWebSocket({
  interval: 2,
  autoConnect: false,
  onStats: (data) => {
    systemStore.updateFromWebSocket(data)
  }
})

provide('wsSubscribe', wsSubscribe)
provide('wsUnsubscribe', wsUnsubscribe)
provide('wsConnected', wsConnected)

watch(wsConnected, (isConnected) => {
  systemStore.setWsConnected(isConnected)
  if (isConnected) {
    stopFallbackPolling()
  } else {
    startFallbackPolling()
  }
})

function startFallbackPolling() {
  if (fallbackInterval) return
  fallbackInterval = setInterval(() => {
    systemStore.fetchStats()
  }, FALLBACK_POLL_MS)
}

function stopFallbackPolling() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval)
    fallbackInterval = null
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────

onMounted(async () => {
  themeStore.initTheme()
  brandingStore.initBranding()
  await authStore.init()

  if (authStore.isAuthenticated) {
    systemStore.fetchAll()
    wsReconnect()
  }
})

// B46: When user logs in after mount (e.g. first boot wizard → login),
// the header shows but stats are 0 because fetchAll was skipped at mount.
// Watch auth state to start fetching immediately on login.
watch(() => authStore.isAuthenticated, (isAuth, wasAuth) => {
  if (isAuth && !wasAuth) {
    systemStore.fetchAll()
    wsReconnect()
  }
})

onUnmounted(() => {
  stopFallbackPolling()
})
</script>

<template>
  <div class="min-h-screen bg-theme-primary transition-colors duration-200">
    <!-- Authenticated layout -->
    <template v-if="authStore.isAuthenticated">
      <AppHeader />

      <div class="flex pt-14">
        <!-- Sidebar (tablet+ only — self-manages visibility) -->
        <AppSidebar />

        <!-- Main content area -->
        <main
          class="flex-1 min-h-[calc(100vh-3.5rem)] transition-all duration-200"
          :class="[
            isMobile ? 'pb-16' : '',
            isWide ? 'ml-[260px]' : isMobile ? 'ml-0' : 'ml-16'
          ]"
        >
          <!-- Wallpaper container (Standard mode only) -->
          <div
            class="min-h-full p-4 lg:p-5"
            :style="wallpaperActive ? wallpaperStyle : {}"
          >
            <!-- Default credentials warning -->
            <div
              v-if="systemStore.info?.default_credentials && !credentialsBannerDismissed"
              class="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-warning-muted border border-warning-subtle text-warning"
              :class="wallpaperActive ? 'glass' : ''"
              role="alert"
            >
              <Icon name="AlertTriangle" :size="20" class="shrink-0" />
              <p class="text-sm flex-1">
                <strong>Security warning:</strong> You are using the default admin password. Please change it in
                <button @click="$router.push('/settings')" class="underline font-medium hover:no-underline">Settings</button>.
              </p>
              <button
                @click="credentialsBannerDismissed = true"
                class="p-1 rounded hover:bg-theme-tertiary transition-colors"
                aria-label="Dismiss"
              >
                <Icon name="X" :size="16" />
              </button>
            </div>

            <ErrorBoundary>
              <router-view />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <!-- Mobile bottom navigation (<768px only) -->
      <MobileNav />
    </template>

    <!-- Login/Setup pages (no layout) -->
    <template v-else>
      <router-view />
    </template>

    <!-- Global confirm dialog -->
    <ConfirmDialog
      :show="confirmState.show"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :variant="confirmState.variant"
      :loading="confirmState.loading"
      :checkbox-label="confirmState.checkboxLabel"
      :checkbox-checked="confirmState.checkboxChecked"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @checkbox-change="(v) => confirmState.checkboxChecked = v"
    />

    <!-- Global transition screen (reboot/shutdown/wifi) -->
    <SystemTransitionScreen />
  </div>
</template>
