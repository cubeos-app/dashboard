<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()

// Mobile sidebar state
const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

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
  // Initialize theme and branding
  themeStore.initTheme()
  brandingStore.initBranding()
  
  // Initialize auth
  await authStore.init()
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
          <router-view />
        </main>
      </div>
    </template>

    <!-- Login/Setup pages (no layout) -->
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
