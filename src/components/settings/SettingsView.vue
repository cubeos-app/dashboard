<script setup>
/**
 * SettingsView.vue
 * 
 * User settings: Appearance, Account, System Info, Session.
 * Fixed: Theme switching, system info from host, API docs link, sign out redirect.
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import Icon from '@/components/ui/Icon.vue'
import api from '@/api/client'

const router = useRouter()
const themeStore = useThemeStore()
const systemStore = useSystemStore()
const authStore = useAuthStore()
const brandingStore = useBrandingStore()

// Password change
const passwordForm = ref({
  current: '',
  new: '',
  confirm: ''
})
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

// Version info fetched from API
const versionInfo = ref({
  version: '0.0.11',
  api_version: 'v1'
})

async function fetchVersion() {
  try {
    const data = await api.get('/system/version')
    if (data) {
      versionInfo.value = {
        version: data.version || '0.0.11',
        api_version: data.api_version || 'v1'
      }
    }
  } catch (e) {
    // Use defaults
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    passwordError.value = 'New passwords do not match'
    return
  }
  
  if (passwordForm.value.new.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
    return
  }
  
  passwordLoading.value = true
  try {
    await api.post('/auth/password', {
      current_password: passwordForm.value.current,
      new_password: passwordForm.value.new
    })
    passwordSuccess.value = 'Password changed successfully'
    passwordForm.value = { current: '', new: '', confirm: '' }
  } catch (err) {
    passwordError.value = err.response?.data?.error || err.message || 'Failed to change password'
  } finally {
    passwordLoading.value = false
  }
}

// Logout with redirect
async function logout() {
  await authStore.logout()
  router.push('/login')
}

// System info computed (from host, not container)
const hostInfo = computed(() => ({
  hostname: systemStore.info?.hostname || 'CubeOS',
  platform: systemStore.info?.platform || systemStore.info?.os_name || 'Linux',
  architecture: systemStore.info?.architecture || systemStore.info?.arch || 'arm64',
  kernel: systemStore.info?.kernel_version || systemStore.info?.kernel || 'Unknown'
}))

onMounted(async () => {
  await systemStore.fetchInfo()
  await fetchVersion()
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6 pb-8">
    <!-- Page header -->
    <div>
      <h1 class="text-xl font-semibold text-theme-primary tracking-tight">Settings</h1>
      <p class="text-theme-tertiary text-sm">Customize your experience</p>
    </div>

    <!-- Theme Selection (Appearance) - FIRST -->
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Palette" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Appearance</h2>
          <p class="text-xs text-theme-tertiary">Choose your preferred theme</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <!-- Dark Themes -->
        <div class="mb-4">
          <h3 class="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-2">Dark Themes</h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="theme in themeStore.darkThemes"
              :key="theme.id"
              @click="themeStore.setTheme(theme.id)"
              class="relative flex items-center gap-2.5 p-2.5 rounded-lg border-2 transition-all duration-150 text-left"
              :class="themeStore.currentThemeId === theme.id 
                ? 'border-accent bg-accent-muted' 
                : 'border-theme-primary hover:border-theme-secondary bg-theme-tertiary'"
            >
              <!-- Theme preview -->
              <div 
                class="w-10 h-10 rounded-md flex-shrink-0 overflow-hidden border border-white/10"
                :style="{ backgroundColor: theme.preview.bg }"
              >
                <div class="p-1.5 space-y-1">
                  <div class="w-full h-1.5 rounded" :style="{ backgroundColor: theme.preview.card }"></div>
                  <div class="w-3/4 h-1.5 rounded" :style="{ backgroundColor: theme.preview.accent }"></div>
                </div>
              </div>
              
              <!-- Theme info -->
              <div class="flex-1 min-w-0">
                <span class="font-medium text-theme-primary text-xs">{{ theme.name }}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: theme.preview.accent }"></div>
                  <span class="text-[10px] text-theme-muted font-mono">{{ theme.preview.accent }}</span>
                </div>
              </div>
              
              <!-- Check -->
              <Icon v-if="themeStore.currentThemeId === theme.id" name="Check" :size="14" class="text-accent" :stroke-width="3" />
            </button>
          </div>
        </div>

        <!-- Light Themes -->
        <div>
          <h3 class="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-2">Light Themes</h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="theme in themeStore.lightThemes"
              :key="theme.id"
              @click="themeStore.setTheme(theme.id)"
              class="relative flex items-center gap-2.5 p-2.5 rounded-lg border-2 transition-all duration-150 text-left"
              :class="themeStore.currentThemeId === theme.id 
                ? 'border-accent bg-accent-muted' 
                : 'border-theme-primary hover:border-theme-secondary bg-theme-tertiary'"
            >
              <!-- Theme preview -->
              <div 
                class="w-10 h-10 rounded-md flex-shrink-0 overflow-hidden border"
                :style="{ backgroundColor: theme.preview.bg, borderColor: theme.preview.card === '#ffffff' ? '#e4e4e7' : theme.preview.card }"
              >
                <div class="p-1.5 space-y-1">
                  <div class="w-full h-1.5 rounded" :style="{ backgroundColor: '#e4e4e7' }"></div>
                  <div class="w-3/4 h-1.5 rounded" :style="{ backgroundColor: theme.preview.accent }"></div>
                </div>
              </div>
              
              <!-- Theme info -->
              <div class="flex-1 min-w-0">
                <span class="font-medium text-theme-primary text-xs">{{ theme.name }}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: theme.preview.accent }"></div>
                  <span class="text-[10px] text-theme-muted font-mono">{{ theme.preview.accent }}</span>
                </div>
              </div>
              
              <!-- Check -->
              <Icon v-if="themeStore.currentThemeId === theme.id" name="Check" :size="14" class="text-accent" :stroke-width="3" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Account Section -->
    <section class="animate-fade-in" style="animation-delay: 50ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="User" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Account</h2>
          <p class="text-xs text-theme-tertiary">Manage your account settings</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <!-- User info -->
        <div class="flex items-center gap-3 pb-4 border-b border-theme-primary">
          <div class="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center">
            <span class="text-lg font-bold text-accent">A</span>
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">admin</h3>
            <p class="text-xs text-theme-tertiary">Administrator</p>
          </div>
        </div>

        <!-- Change password -->
        <div class="pt-4">
          <h4 class="text-xs font-semibold text-theme-primary mb-3">Change Password</h4>
          
          <div v-if="passwordError" class="mb-3 p-2.5 rounded-lg bg-error-muted border border-error/20">
            <p class="text-xs text-error">{{ passwordError }}</p>
          </div>
          
          <div v-if="passwordSuccess" class="mb-3 p-2.5 rounded-lg bg-success-muted border border-success/20">
            <p class="text-xs text-success">{{ passwordSuccess }}</p>
          </div>
          
          <form @submit.prevent="changePassword" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-theme-secondary mb-1">Current Password</label>
              <input
                v-model="passwordForm.current"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-theme-secondary mb-1">New Password</label>
              <input
                v-model="passwordForm.new"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-theme-secondary mb-1">Confirm Password</label>
              <input
                v-model="passwordForm.confirm"
                type="password"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="Confirm new password"
              />
            </div>
            <button
              type="submit"
              :disabled="passwordLoading"
              class="px-4 py-2 rounded-lg btn-accent text-xs font-medium disabled:opacity-50"
            >
              {{ passwordLoading ? 'Changing...' : 'Change Password' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- System Info -->
    <section class="animate-fade-in" style="animation-delay: 100ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Info" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">System Information</h2>
          <p class="text-xs text-theme-tertiary">About this installation</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="grid grid-cols-2 gap-2">
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Hostname</p>
            <p class="text-xs font-medium text-theme-primary">{{ hostInfo.hostname }}</p>
          </div>
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Platform</p>
            <p class="text-xs font-medium text-theme-primary">{{ hostInfo.platform }}</p>
          </div>
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Architecture</p>
            <p class="text-xs font-medium text-theme-primary">{{ hostInfo.architecture }}</p>
          </div>
          <div class="p-3 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Kernel</p>
            <p class="text-xs font-medium text-theme-primary truncate">{{ hostInfo.kernel }}</p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-theme-primary">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-theme-primary">CubeOS v{{ versionInfo.version }}</p>
              <p class="text-[10px] text-theme-muted">API {{ versionInfo.api_version }}</p>
            </div>
            <div class="flex items-center gap-2">
              <a
                :href="brandingStore.currentBrand.github"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme-primary text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </a>
              <a
                href="http://cubeos.cube:6010/api/v1/docs/"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme-primary text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
              >
                <Icon name="Code2" :size="14" />
                API Docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Session -->
    <section class="animate-fade-in" style="animation-delay: 150ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-error-muted flex items-center justify-center">
          <Icon name="LogOut" :size="16" class="text-error" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Session</h2>
          <p class="text-xs text-theme-tertiary">Manage your current session</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-error/20 bg-error-muted/30">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-semibold text-theme-primary">Sign Out</h4>
            <p class="text-xs text-theme-tertiary">End your current session</p>
          </div>
          <button
            @click="logout"
            class="px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-white text-xs font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
