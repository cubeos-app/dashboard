<script setup>
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const authStore = useAuthStore()
// Default to dark mode (CubeOS branding is designed for dark)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')

// Apply dark mode class
watch(darkMode, (value) => {
  document.documentElement.classList.toggle('dark', value)
  localStorage.setItem('darkMode', value)
}, { immediate: true })

function toggleDarkMode() {
  darkMode.value = !darkMode.value
}

onMounted(async () => {
  // Always start in dark mode for CubeOS branding
  document.documentElement.classList.add('dark')
  await authStore.init()
})
</script>

<template>
  <div class="min-h-screen bg-[#0d1117] transition-colors">
    <!-- Authenticated layout -->
    <template v-if="authStore.isAuthenticated">
      <AppHeader :dark-mode="darkMode" @toggle-dark-mode="toggleDarkMode" />
      <div class="flex">
        <AppSidebar />
        <main class="flex-1 p-4 lg:p-6 lg:ml-64">
          <router-view />
        </main>
      </div>
    </template>

    <!-- Login page (no layout) -->
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
