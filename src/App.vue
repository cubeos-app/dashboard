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
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </div>
</template>
