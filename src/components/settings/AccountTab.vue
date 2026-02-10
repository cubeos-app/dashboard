<script setup>
/**
 * AccountTab.vue — S10 Component
 *
 * Both modes: Auth profile display, password change, session management.
 * Extracted from SettingsView.vue Account + Session sections.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const authStore = useAuthStore()
const { signal } = useAbortOnUnmount()

// ─── Password Change ─────────────────────────────────────────
const passwordForm = ref({ current: '', new: '', confirm: '' })
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

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
  const success = await authStore.changePassword(passwordForm.value.current, passwordForm.value.new)
  passwordLoading.value = false

  if (success) {
    passwordSuccess.value = 'Password changed successfully'
    passwordForm.value = { current: '', new: '', confirm: '' }
  } else {
    passwordError.value = authStore.error || 'Failed to change password'
  }
}

// ─── Session ─────────────────────────────────────────────────
async function logout() {
  await authStore.logout()
  router.push('/login')
}

// ─── Computed ────────────────────────────────────────────────
const avatarLetter = computed(() => {
  const name = authStore.user?.username || authStore.username || 'A'
  return name.charAt(0).toUpperCase()
})

const lastLoginDisplay = computed(() => {
  const lastLogin = authStore.user?.last_login
  if (!lastLogin) return null
  try {
    return new Date(lastLogin).toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return lastLogin }
})

const createdAtDisplay = computed(() => {
  const created = authStore.user?.created_at
  if (!created) return null
  try {
    return new Date(created).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  } catch { return created }
})

onMounted(async () => {
  await authStore.fetchUser()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Auth Profile -->
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="User" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Profile</h2>
          <p class="text-xs text-theme-tertiary">Your account information</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center">
            <span class="text-lg font-bold text-accent">{{ avatarLetter }}</span>
          </div>
          <div>
            <h3 class="font-semibold text-theme-primary">{{ authStore.user?.username || authStore.username || 'admin' }}</h3>
            <p class="text-xs text-theme-tertiary capitalize">{{ authStore.user?.role || (authStore.isAdmin ? 'admin' : 'user') }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <div v-if="lastLoginDisplay" class="p-2.5 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Last Login</p>
            <p class="text-xs font-medium text-theme-primary">{{ lastLoginDisplay }}</p>
          </div>
          <div v-if="createdAtDisplay" class="p-2.5 rounded-lg bg-theme-tertiary">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Account Created</p>
            <p class="text-xs font-medium text-theme-primary">{{ createdAtDisplay }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Change Password -->
    <section class="animate-fade-in" style="animation-delay: 50ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="KeyRound" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Password</h2>
          <p class="text-xs text-theme-tertiary">Update your login credentials</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div v-if="passwordError" class="mb-3 p-2.5 rounded-lg bg-error-muted border border-error/20">
          <p class="text-xs text-error">{{ passwordError }}</p>
        </div>
        <div v-if="passwordSuccess" class="mb-3 p-2.5 rounded-lg bg-success-muted border border-success/20">
          <p class="text-xs text-success">{{ passwordSuccess }}</p>
        </div>

        <form @submit.prevent="changePassword" class="space-y-3">
          <div>
            <label for="acct-current-password" class="block text-xs font-medium text-theme-secondary mb-1">Current Password</label>
            <input
              id="acct-current-password"
              v-model="passwordForm.current"
              type="password"
              class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label for="acct-new-password" class="block text-xs font-medium text-theme-secondary mb-1">New Password</label>
            <input
              id="acct-new-password"
              v-model="passwordForm.new"
              type="password"
              class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label for="acct-confirm-password" class="block text-xs font-medium text-theme-secondary mb-1">Confirm Password</label>
            <input
              id="acct-confirm-password"
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
    </section>

    <!-- Session (Sign Out) -->
    <section class="animate-fade-in" style="animation-delay: 100ms">
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
            class="px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-on-accent text-xs font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
