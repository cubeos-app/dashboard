<script setup>
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const authStore = useAuthStore()
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
  await authStore.init()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
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
