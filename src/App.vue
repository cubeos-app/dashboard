<script setup>
import { onMounted, ref, onUnmounted, watch, provide } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import { useSystemStore } from '@/stores/system'
import { useWebSocket } from '@/composables/useWebSocket'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { confirmState, handleConfirm, handleCancel } from '@/utils/confirmDialog'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()
const systemStore = useSystemStore()

// Mobile sidebar state
const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const credentialsBannerDismissed = ref(false)

// HTTP fallback polling interval
let fallbackInterval = null
const FALLBACK_POLL_MS = 5000

/**
 * WebSocket connection for real-time stats.
 * onStats callback maps WS messages into the system store so all views
 * (AppHeader, DashboardView, SystemView) get live data automatically.
 */
const { connected: wsConnected, reconnect: wsReconnect, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket({
  interval: 2,
  autoConnect: false, // We connect manually after auth check
  onStats: (data) => {
    systemStore.updateFromWebSocket(data)
  }
})

// Expose WS subscription to child views (MonitoringView, future views)
provide('wsSubscribe', wsSubscribe)
provide('wsUnsubscribe', wsUnsubscribe)
provide('wsConnected', wsConnected)

// Keep system store's wsConnected in sync with the composable
watch(wsConnected, (isConnected) => {
  systemStore.setWsConnected(isConnected)

  if (isConnected) {
    // WS connected — stop HTTP fallback polling
    stopFallbackPolling()
  } else {
    // WS disconnected — start HTTP fallback polling
    startFallbackPolling()
  }
})

function startFallbackPolling() {
  if (fallbackInterval) return // Already running
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

function toggleSidebar() {
  if (window.innerWidth < 1024) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}

onMounted(async () => {
  // Initialize theme and branding FIRST (synchronous)
  themeStore.initTheme()
  brandingStore.initBranding()
  
  // Initialize auth
  await authStore.init()
  
  // If authenticated, fetch system data and connect WebSocket
  if (authStore.isAuthenticated) {
    // Fetch all system data including battery from HAL
    systemStore.fetchAll()
    
    // Try WebSocket first — if it fails, the watcher above starts HTTP fallback
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
      <AppHeader @toggle-sidebar="toggleSidebar" />
      
      <div class="flex pt-14">
        <AppSidebar 
          :collapsed="sidebarCollapsed"
          :mobile-open="mobileSidebarOpen"
          @close-mobile="closeMobileSidebar"
        />
        
        <main 
          class="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-5 transition-all duration-300"
          :class="sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'"
        >
          <!-- Default credentials warning -->
          <div
            v-if="systemStore.info?.default_credentials && !credentialsBannerDismissed"
            class="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-warning-muted border border-warning-subtle text-warning"
            role="alert"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p class="text-sm flex-1">
              <strong>Security warning:</strong> You are using the default admin password. Please change it in
              <button @click="$router.push('/settings')" class="underline font-medium hover:no-underline">Settings</button>.
            </p>
            <button 
              @click="credentialsBannerDismissed = true"
              class="p-1 rounded hover:bg-theme-tertiary transition-colors"
              aria-label="Dismiss"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <ErrorBoundary>
            <router-view />
          </ErrorBoundary>
        </main>
      </div>
    </template>

    <!-- Login/Setup pages (no layout) -->
    <template v-else>
      <router-view />
    </template>

    <!-- Global confirm dialog (replaces native confirm()) -->
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
  </div>
</template>
