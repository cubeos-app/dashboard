<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandingStore = useBrandingStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)

onMounted(() => {
  themeStore.initTheme()
  brandingStore.initBranding()
})

async function handleSubmit() {
  const success = await authStore.login(username.value, password.value)
  
  if (success) {
    const redirect = route.query.redirect || '/'
    setTimeout(() => {
      router.push(redirect)
    }, 100)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-theme-primary p-4">
    <!-- Background pattern -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent-secondary/5"></div>
      <img 
        :src="brandingStore.brandLogo" 
        alt="" 
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
        :class="themeStore.isDark ? 'opacity-[0.03]' : 'opacity-[0.02]'"
        :style="{ filter: themeStore.isDark ? 'grayscale(100%) brightness(1.5)' : 'grayscale(100%) brightness(0.5)' }"
      />
    </div>

    <div class="relative w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="flex items-center justify-center mb-3">
          <img :src="brandingStore.brandLogo" :alt="brandingStore.brandName" class="w-14 h-14" />
        </div>
        <h1 class="text-2xl font-bold text-theme-primary">
          {{ brandingStore.brandNameFormatted.prefix }}<span class="text-accent">{{ brandingStore.brandNameFormatted.accent }}</span>
        </h1>
        <p class="text-theme-tertiary mt-1 text-xs">Sign in to your dashboard</p>
      </div>

      <!-- Login form -->
      <form 
        @submit.prevent="handleSubmit" 
        class="bg-theme-card rounded-xl shadow-theme-lg p-6 border border-theme-primary"
      >
        <!-- Error message -->
        <div 
          v-if="authStore.error"
          class="mb-4 p-3 bg-error-muted border border-error/20 rounded-lg"
        >
          <p class="text-xs text-error">{{ authStore.error }}</p>
        </div>

        <!-- Username -->
        <div class="mb-4">
          <label for="username" class="block text-xs font-medium text-theme-secondary mb-1.5">
            Username
          </label>
          <div class="relative">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted">
              <Icon name="User" :size="16" />
            </div>
            <input
              id="username"
              v-model="username"
              type="text"
              required
              autocomplete="username"
              class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              placeholder="Enter your username"
            />
          </div>
        </div>

        <!-- Password -->
        <div class="mb-5">
          <label for="password" class="block text-xs font-medium text-theme-secondary mb-1.5">
            Password
          </label>
          <div class="relative">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted">
              <Icon name="Lock" :size="16" />
            </div>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              class="w-full pl-9 pr-10 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              placeholder="Enter your password"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary transition-colors"
            >
              <Icon :name="showPassword ? 'EyeOff' : 'Eye'" :size="16" />
            </button>
          </div>
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-2.5 px-4 btn-accent font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-theme-sm hover:shadow-theme-md disabled:opacity-50 text-sm"
        >
          <Icon v-if="authStore.loading" name="Loader2" :size="18" class="animate-spin" />
          <span>{{ authStore.loading ? 'Signing in...' : 'Sign in' }}</span>
        </button>
      </form>

      <!-- Footer -->
      <div class="text-center mt-5 space-y-1.5">
        <p class="text-theme-muted text-[10px]">
          {{ brandingStore.brandName }} v2.0.0
        </p>
        <div class="flex items-center justify-center gap-3 text-[10px]">
          <a 
            :href="brandingStore.currentBrand.github" 
            target="_blank"
            class="text-theme-tertiary hover:text-theme-secondary transition-colors flex items-center gap-1"
          >
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
          <span class="text-theme-muted">|</span>
          <a 
            href="/api/v1/docs" 
            target="_blank"
            class="text-theme-tertiary hover:text-theme-secondary transition-colors flex items-center gap-1"
          >
            <Icon name="Code2" :size="12" />
            API Docs
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
