<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSystemStore } from '@/stores/system'
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  darkMode: Boolean
})

const emit = defineEmits(['toggle-dark-mode'])

const authStore = useAuthStore()
const systemStore = useSystemStore()
const showUserMenu = ref(false)
const showMobileMenu = ref(false)

let statsInterval = null

onMounted(() => {
  systemStore.fetchStats()
  statsInterval = setInterval(() => systemStore.fetchStats(), 5000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
})

async function handleLogout() {
  await authStore.logout()
  window.location.href = '/login'
}
</script>

<template>
  <header class="fixed top-0 left-0 right-0 z-40 bg-[#0d1117] border-b border-gray-800">
    <div class="flex items-center justify-between h-16 px-4 lg:px-6">
      <!-- Left: Logo & mobile menu -->
      <div class="flex items-center gap-4">
        <!-- Mobile menu button -->
        <button 
          @click="showMobileMenu = !showMobileMenu"
          class="lg:hidden p-2 rounded-lg hover:bg-gray-800"
        >
          <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3">
          <img 
            src="/images/cubeos-icon.svg" 
            alt="CubeOS" 
            class="h-8 w-8"
          />
          <img 
            src="/images/cubeos-logo-dark.svg" 
            alt="CubeOS" 
            class="h-6 hidden sm:block"
            style="margin-left: -8px;"
          />
        </router-link>
      </div>

      <!-- Center: System stats -->
      <div class="hidden md:flex items-center gap-6 text-sm">
        <div class="flex items-center gap-2 text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ systemStore.uptime }}</span>
        </div>
        <div class="flex items-center gap-2 text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span>{{ systemStore.cpuUsage }}%</span>
        </div>
        <div class="flex items-center gap-2 text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{{ systemStore.memoryUsage }}%</span>
        </div>
        <div v-if="systemStore.temperature" class="flex items-center gap-2 text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>{{ systemStore.temperature }}°C</span>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2">
        <!-- Dark mode toggle -->
        <button 
          @click="emit('toggle-dark-mode')"
          class="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          :title="darkMode ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <svg v-if="darkMode" class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <!-- User menu -->
        <div class="relative">
          <button 
            @click="showUserMenu = !showUserMenu"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div class="w-8 h-8 bg-gradient-to-br from-[#2dd4bf] to-[#22d3ee] rounded-full flex items-center justify-center">
              <span class="text-gray-900 font-semibold text-sm">
                {{ authStore.username.charAt(0).toUpperCase() }}
              </span>
            </div>
            <span class="hidden sm:block text-sm text-gray-300">
              {{ authStore.username }}
            </span>
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown -->
          <div 
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 bg-[#161b22] rounded-lg shadow-lg border border-gray-800 py-1 z-50"
          >
            <router-link 
              to="/system" 
              class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
              @click="showUserMenu = false"
            >
              System Settings
            </router-link>
            <hr class="my-1 border-gray-800">
            <button 
              @click="handleLogout"
              class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div 
      v-if="showMobileMenu"
      class="lg:hidden border-t border-gray-800 bg-[#0d1117] py-4 px-4"
    >
      <nav class="space-y-2">
        <router-link 
          to="/" 
          class="block px-4 py-2 rounded-lg hover:bg-gray-800 text-gray-300"
          @click="showMobileMenu = false"
        >
          Dashboard
        </router-link>
        <router-link 
          to="/services" 
          class="block px-4 py-2 rounded-lg hover:bg-gray-800 text-gray-300"
          @click="showMobileMenu = false"
        >
          Services
        </router-link>
        <router-link 
          to="/system" 
          class="block px-4 py-2 rounded-lg hover:bg-gray-800 text-gray-300"
          @click="showMobileMenu = false"
        >
          System
        </router-link>
      </nav>
    </div>
  </header>

  <!-- Spacer for fixed header -->
  <div class="h-16"></div>
</template>
