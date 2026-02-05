<script setup>
/**
 * SettingsView.vue
 * 
 * User settings: Appearance, Account, System Configuration, System Info, Session.
 * 
 * Sprint 2 G4: Added System Configuration section with hostname and timezone management.
 * 
 * Sections (in order):
 * 1. Appearance — theme toggle (dark/light)
 * 2. Account — user info + change password
 * 3. System Configuration — hostname edit, timezone dropdown (NEW in G4)
 * 4. System Information — host info, Pi serial, version
 * 5. Session — sign out
 */
import { ref, onMounted, computed, watch } from 'vue'
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

// Version info - hardcoded since /system/version doesn't exist in API
const versionInfo = ref({
  version: '0.0.11',
  api_version: 'v1'
})

// ==========================================
// System Configuration — Hostname
// ==========================================

const hostnameInput = ref('')
const hostnameLoading = ref(false)
const hostnameSuccess = ref(false)
const hostnameError = ref('')

// DNS-safe hostname validation: lowercase letters, digits, hyphens, no leading/trailing hyphen
function isValidHostname(name) {
  if (!name || name.length === 0 || name.length > 63) return false
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name.toLowerCase())
}

const hostnameValid = computed(() => {
  if (!hostnameInput.value) return false
  return isValidHostname(hostnameInput.value)
})

const hostnameDirty = computed(() => {
  return hostnameInput.value !== (systemStore.hostnameValue || '')
})

async function saveHostname() {
  if (!hostnameValid.value) {
    hostnameError.value = 'Invalid hostname. Use lowercase letters, digits, and hyphens only.'
    return
  }
  
  hostnameLoading.value = true
  hostnameError.value = ''
  hostnameSuccess.value = false
  
  try {
    const success = await systemStore.setHostname(hostnameInput.value.toLowerCase())
    if (success) {
      hostnameSuccess.value = true
      setTimeout(() => { hostnameSuccess.value = false }, 3000)
    } else {
      hostnameError.value = systemStore.error || 'Failed to set hostname'
    }
  } catch (e) {
    hostnameError.value = e.message || 'Failed to set hostname'
  } finally {
    hostnameLoading.value = false
  }
}

// ==========================================
// System Configuration — Timezone
// ==========================================

const timezoneInput = ref('')
const timezoneLoading = ref(false)
const timezoneSuccess = ref(false)
const timezoneError = ref('')
const timezoneSearch = ref('')
const showTimezoneDropdown = ref(false)

// Filtered timezones based on search
const filteredTimezones = computed(() => {
  const list = systemStore.timezonesList || []
  if (!timezoneSearch.value) return list.slice(0, 50)
  const q = timezoneSearch.value.toLowerCase()
  return list.filter(tz => tz.toLowerCase().includes(q)).slice(0, 50)
})

const timezoneDirty = computed(() => {
  return timezoneInput.value !== (systemStore.timezone || '')
})

// Format current time in selected timezone
const currentTimeInZone = computed(() => {
  if (!timezoneInput.value) return ''
  try {
    const now = new Date()
    return now.toLocaleString('en-GB', {
      timeZone: timezoneInput.value,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return ''
  }
})

function selectTimezone(tz) {
  timezoneInput.value = tz
  timezoneSearch.value = ''
  showTimezoneDropdown.value = false
}

async function saveTimezone() {
  if (!timezoneInput.value) {
    timezoneError.value = 'Please select a timezone'
    return
  }
  
  timezoneLoading.value = true
  timezoneError.value = ''
  timezoneSuccess.value = false
  
  try {
    const success = await systemStore.setTimezone(timezoneInput.value)
    if (success) {
      timezoneSuccess.value = true
      setTimeout(() => { timezoneSuccess.value = false }, 3000)
    } else {
      timezoneError.value = systemStore.error || 'Failed to set timezone'
    }
  } catch (e) {
    timezoneError.value = e.message || 'Failed to set timezone'
  } finally {
    timezoneLoading.value = false
  }
}

// Close timezone dropdown when clicking outside
function handleTimezoneBlur() {
  setTimeout(() => { showTimezoneDropdown.value = false }, 150)
}

// ==========================================
// Password Change
// ==========================================

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

/**
 * System info computed - intelligently merges data from multiple sources:
 * - /system/info (may show container data like Alpine)
 * - /hardware/eeprom (Pi model from EEPROM)
 */
const hostInfo = computed(() => {
  const info = systemStore.info
  const kernel = info?.kernel || ''
  const osName = info?.os_name || ''
  
  const isRaspberryPi = kernel.includes('raspi') || kernel.includes('rpi')
  
  let platform = osName
  if (isRaspberryPi && (osName.includes('Alpine') || osName === '')) {
    platform = 'Raspberry Pi OS'
  }
  if (systemStore.piModel) {
    platform = systemStore.piModel
  }
  
  let hostname = info?.hostname || 'CubeOS'
  if (hostname === 'cubeos-api' || hostname === 'cubeos_api') {
    hostname = systemStore.piModel || 'CubeOS'
  }
  
  return {
    hostname: hostname,
    platform: platform || 'Raspberry Pi OS',
    architecture: info?.architecture || 'arm64',
    kernel: kernel || 'Unknown'
  }
})

const piInfo = computed(() => ({
  model: systemStore.piModel,
  serial: systemStore.piSerial,
  revision: systemStore.piRevision
}))

onMounted(async () => {
  await systemStore.fetchAll()
  
  // Fetch hostname and timezone for System Configuration section
  await Promise.all([
    systemStore.fetchHostname(),
    systemStore.fetchTimezone(),
    systemStore.fetchTimezones()
  ])
  
  // Initialize local inputs from store
  hostnameInput.value = systemStore.hostnameValue || ''
  timezoneInput.value = systemStore.timezone || ''
})

// Sync store values to local inputs when they change
watch(() => systemStore.hostnameValue, (val) => {
  if (val && !hostnameDirty.value) hostnameInput.value = val
})
watch(() => systemStore.timezone, (val) => {
  if (val && !timezoneDirty.value) timezoneInput.value = val
})
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6 pb-8">
    <!-- Page header -->
    <div>
      <h1 class="text-xl font-semibold text-theme-primary tracking-tight">Settings</h1>
      <p class="text-theme-tertiary text-sm">Customize your experience</p>
    </div>

    <!-- Theme Selection (Appearance) -->
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
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Icon :name="themeStore.isDark ? 'Moon' : 'Sun'" :size="20" class="text-accent" />
            <div>
              <p class="text-sm font-medium text-theme-primary">{{ themeStore.isDark ? 'Dark Mode' : 'Light Mode' }}</p>
              <p class="text-xs text-theme-muted">{{ themeStore.currentTheme.description }}</p>
            </div>
          </div>
          
          <button
            @click="themeStore.setTheme(themeStore.isDark ? 'light' : 'dark')"
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200"
            :class="themeStore.isDark ? 'bg-accent' : 'bg-theme-tertiary border border-theme-secondary'"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transform transition-transform duration-200"
              :class="themeStore.isDark ? 'translate-x-6' : 'translate-x-1'"
            >
              <Icon :name="themeStore.isDark ? 'Moon' : 'Sun'" :size="12" class="text-theme-secondary" />
            </span>
          </button>
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

    <!-- ==================== System Configuration (G4) ==================== -->
    <section class="animate-fade-in" style="animation-delay: 75ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Settings" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">System Configuration</h2>
          <p class="text-xs text-theme-tertiary">Device name and regional settings</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card space-y-5">
        <!-- Hostname -->
        <div>
          <label class="block text-xs font-semibold text-theme-primary mb-2">Hostname</label>
          
          <div v-if="hostnameError" class="mb-2 p-2 rounded-lg bg-error-muted border border-error/20">
            <p class="text-xs text-error">{{ hostnameError }}</p>
          </div>
          
          <div class="flex gap-2">
            <div class="flex-1">
              <input
                v-model="hostnameInput"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="cubeos"
                maxlength="63"
                @keydown.enter="saveHostname"
              />
            </div>
            <button
              @click="saveHostname"
              :disabled="hostnameLoading || !hostnameValid || !hostnameDirty"
              class="px-4 py-2 rounded-lg btn-accent text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Icon v-if="hostnameLoading" name="Loader2" :size="12" class="animate-spin" />
              <Icon v-else-if="hostnameSuccess" name="Check" :size="12" />
              {{ hostnameSuccess ? 'Saved' : 'Save' }}
            </button>
          </div>
          <p class="text-xs text-theme-muted mt-1.5">Device name on the network. Letters, digits, and hyphens only.</p>
        </div>

        <div class="border-t border-theme-primary"></div>

        <!-- Timezone -->
        <div>
          <label class="block text-xs font-semibold text-theme-primary mb-2">Timezone</label>
          
          <div v-if="timezoneError" class="mb-2 p-2 rounded-lg bg-error-muted border border-error/20">
            <p class="text-xs text-error">{{ timezoneError }}</p>
          </div>
          
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input
                v-model="timezoneSearch"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-theme-primary bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                :placeholder="timezoneInput || 'Search timezones...'"
                @focus="showTimezoneDropdown = true"
                @blur="handleTimezoneBlur"
              />
              
              <!-- Selected timezone overlay (when not searching) -->
              <div
                v-if="timezoneInput && !showTimezoneDropdown && !timezoneSearch"
                class="absolute inset-0 flex items-center px-3 pointer-events-none"
              >
                <span class="text-sm text-theme-primary">{{ timezoneInput }}</span>
              </div>

              <!-- Dropdown -->
              <div
                v-if="showTimezoneDropdown && filteredTimezones.length > 0"
                class="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-theme-primary bg-theme-card shadow-theme-lg"
              >
                <button
                  v-for="tz in filteredTimezones"
                  :key="tz"
                  @mousedown.prevent="selectTimezone(tz)"
                  :class="[
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    tz === timezoneInput
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-theme-primary hover:bg-theme-tertiary'
                  ]"
                >
                  {{ tz }}
                </button>
              </div>

              <!-- No results -->
              <div
                v-if="showTimezoneDropdown && timezoneSearch && filteredTimezones.length === 0"
                class="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-theme-primary bg-theme-card shadow-theme-lg p-3"
              >
                <p class="text-xs text-theme-muted text-center">No matching timezones</p>
              </div>
            </div>
            
            <button
              @click="saveTimezone"
              :disabled="timezoneLoading || !timezoneInput || !timezoneDirty"
              class="px-4 py-2 rounded-lg btn-accent text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Icon v-if="timezoneLoading" name="Loader2" :size="12" class="animate-spin" />
              <Icon v-else-if="timezoneSuccess" name="Check" :size="12" />
              {{ timezoneSuccess ? 'Saved' : 'Save' }}
            </button>
          </div>
          
          <p v-if="currentTimeInZone" class="text-xs text-theme-muted mt-1.5">
            Current: {{ currentTimeInZone }}
          </p>
          <p v-else class="text-xs text-theme-muted mt-1.5">
            System clock and log timestamps
          </p>
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
          <div v-if="piInfo.serial" class="p-3 rounded-lg bg-theme-tertiary col-span-2">
            <p class="text-[10px] text-theme-muted uppercase tracking-wider mb-0.5">Pi Serial</p>
            <p class="text-xs font-medium text-theme-primary font-mono">{{ piInfo.serial }}</p>
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
