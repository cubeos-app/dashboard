<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)

async function handleSubmit() {
  const success = await authStore.login(username.value, password.value)
  if (success) {
    // Use window.location for reliable redirect (forces full page load)
    const redirect = route.query.redirect || '/'
    window.location.href = redirect
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#0d1117] p-4">
    <!-- Subtle gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-br from-[#1a2332]/50 via-transparent to-[#0d4949]/30"></div>
    
    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8">
        <img 
          src="/images/cubeos-icon.svg" 
          alt="CubeOS" 
          class="h-20 w-20 mx-auto mb-4"
        />
        <h1 class="text-2xl font-semibold text-white tracking-tight">
          Cube<span class="text-[#2dd4bf]">OS</span>
        </h1>
        <p class="text-gray-400 mt-2">Sign in to your dashboard</p>
      </div>

      <!-- Login form -->
      <form @submit.prevent="handleSubmit" class="bg-[#161b22] rounded-2xl shadow-2xl p-8 border border-gray-800">
        <!-- Error message -->
        <div 
          v-if="authStore.error"
          class="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg"
        >
          <p class="text-sm text-red-400">{{ authStore.error }}</p>
        </div>

        <!-- Username -->
        <div class="mb-4">
          <label for="username" class="block text-sm font-medium text-gray-300 mb-2">
            Username
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="w-full px-4 py-3 rounded-lg border border-gray-700 bg-[#0d1117] text-white placeholder-gray-500 focus:ring-2 focus:ring-[#2dd4bf] focus:border-transparent transition-colors"
            placeholder="admin"
          />
        </div>

        <!-- Password -->
        <div class="mb-6">
          <label for="password" class="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              class="w-full px-4 py-3 pr-12 rounded-lg border border-gray-700 bg-[#0d1117] text-white placeholder-gray-500 focus:ring-2 focus:ring-[#2dd4bf] focus:border-transparent transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-3 px-4 bg-gradient-to-r from-[#2dd4bf] to-[#22d3ee] hover:from-[#14b8a6] hover:to-[#06b6d4] disabled:opacity-50 text-gray-900 font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <svg 
            v-if="authStore.loading" 
            class="w-5 h-5 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ authStore.loading ? 'Signing in...' : 'Sign in' }}</span>
        </button>
      </form>

      <!-- Footer -->
      <p class="text-center text-gray-500 text-sm mt-6">
        CubeOS Dashboard v0.1.0
      </p>
    </div>
  </div>
</template>
