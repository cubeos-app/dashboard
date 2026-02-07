<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSetupStore } from '@/stores/setup'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const setupStore = useSetupStore()

// State
const loading = ref(true)
const saving = ref(false)
const error = ref(null)
const currentStep = ref(0)

// Setup data
const steps = ref([])
const defaults = ref({})
const requirements = ref({})
const timezones = ref([])
const purposes = ref([])
const dnsProviders = ref([])

// Form data
const config = ref({
  // Step 1: Admin
  admin_username: 'admin',
  admin_password: '',
  admin_password_confirm: '',
  admin_email: '',

  // Step 2: Device
  hostname: 'cubeos',
  device_name: 'CubeOS Server',

  // Step 3: WiFi
  wifi_ssid: 'CubeOS',
  wifi_password: '',
  wifi_channel: 6,

  // Step 4: Locale
  timezone: 'UTC',
  language: 'en',

  // Step 5: Theme
  theme: 'dark',
  accent_color: '#60a5fa',

  // Step 6: Purpose
  deployment_purpose: 'generic',
  branding_mode: 'cubeos',

  // Step 7: SSL
  ssl_mode: 'none',
  base_domain: '',

  // Step 8: DNS
  dns_provider: '',
  dns_api_token: '',
  dns_api_secret: '',

  // Step 9: NPM
  npm_admin_email: '',
  npm_admin_password: '',

  // Step 10: Features
  enable_analytics: false,
  enable_auto_updates: true,
  enable_remote_access: false
})

// Validation
const validation = ref({
  valid: true,
  errors: {},
  warnings: {}
})

// Computed
const totalSteps = computed(() => steps.value.length)
const currentStepData = computed(() => steps.value[currentStep.value] || {})
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const progress = computed(() => Math.round((currentStep.value / (totalSteps.value - 1)) * 100))

const canProceed = computed(() => {
  const step = currentStepData.value
  if (!step.required) return true

  switch (step.id) {
    case 'admin':
      return config.value.admin_username.length >= 3 &&
             config.value.admin_password.length >= 8 &&
             config.value.admin_password === config.value.admin_password_confirm
    case 'device':
      return config.value.hostname.length >= 3
    case 'wifi':
      return config.value.wifi_ssid.length >= 1 &&
             (config.value.wifi_password === '' || config.value.wifi_password.length >= 8)
    case 'locale':
      return config.value.timezone !== ''
    default:
      return true
  }
})

// Theme preview colors
const themePreviewColors = {
  dark: { bg: '#0f172a', card: '#1e293b', text: '#f8fafc' },
  light: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a' },
  system: { bg: '#1e293b', card: '#334155', text: '#f8fafc' }
}

const accentColors = [
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Red', value: '#f87171' },
  { name: 'Orange', value: '#fb923c' },
  { name: 'Yellow', value: '#fbbf24' },
  { name: 'Green', value: '#4ade80' },
  { name: 'Teal', value: '#2dd4bf' }
]

const sslModes = [
  { id: 'none', name: 'No SSL', desc: 'HTTP only (not recommended for remote access)', icon: 'ShieldOff' },
  { id: 'self-signed', name: 'Self-Signed Certificate', desc: 'Works offline, browser will show warning', icon: 'ShieldAlert' },
  { id: 'letsencrypt', name: "Let's Encrypt", desc: 'Trusted certificates, requires domain & internet', icon: 'ShieldCheck' }
]

// Methods
async function loadSetupData() {
  loading.value = true
  error.value = null

  try {
    // Load all setup data in parallel
    const [stepsRes, defaultsRes, requirementsRes, timezonesRes, purposesRes, dnsRes] = await Promise.all([
      api.get('/setup/steps'),
      api.get('/setup/defaults'),
      api.get('/setup/requirements'),
      api.get('/setup/timezones'),
      api.get('/setup/purposes'),
      api.get('/setup/dns-providers')
    ])

    steps.value = stepsRes.steps || []
    defaults.value = defaultsRes || {}
    requirements.value = requirementsRes || {}
    timezones.value = timezonesRes.timezones || []
    purposes.value = purposesRes.purposes || []
    dnsProviders.value = dnsRes.providers || []

    // Apply defaults to config
    Object.assign(config.value, defaults.value)

    // Set NPM email from admin email initially
    config.value.npm_admin_email = config.value.admin_email

  } catch (e) {
    error.value = e.message
    // Use fallback steps if API fails
    steps.value = [
      { id: 'welcome', number: 0, title: 'Welcome', icon: 'Box', required: true },
      { id: 'admin', number: 1, title: 'Admin Account', icon: 'UserCog', required: true },
      { id: 'device', number: 2, title: 'Device Identity', icon: 'Server', required: true },
      { id: 'wifi', number: 3, title: 'WiFi Access Point', icon: 'Wifi', required: true },
      { id: 'locale', number: 4, title: 'Time & Language', icon: 'Globe', required: true },
      { id: 'theme', number: 5, title: 'Appearance', icon: 'Palette', required: false },
      { id: 'purpose', number: 6, title: 'Deployment Purpose', icon: 'Target', required: false },
      { id: 'ssl', number: 7, title: 'Security & SSL', icon: 'Shield', required: false },
      { id: 'dns', number: 8, title: 'DNS Provider', icon: 'Cloud', required: false },
      { id: 'features', number: 9, title: 'Features', icon: 'Sparkles', required: false },
      { id: 'complete', number: 10, title: 'Complete', icon: 'CheckCircle', required: true }
    ]
  } finally {
    loading.value = false
  }
}

async function validateStep() {
  try {
    const result = await api.post('/setup/validate', config.value)
    validation.value = result
    return result.valid
  } catch (e) {
    // Surface validation error — don't silently allow invalid config to proceed
    error.value = e.message || 'Validation failed — please check your connection'
    return false
  }
}

async function nextStep() {
  if (isLastStep.value) {
    await finishSetup()
    return
  }

  // Validate current step
  if (currentStepData.value.required && currentStepData.value.id !== 'welcome') {
    const valid = await validateStep()
    if (!valid) return
  }

  currentStep.value++
}

function prevStep() {
  if (!isFirstStep.value) {
    currentStep.value--
  }
}

function skipStep() {
  if (!currentStepData.value.required) {
    currentStep.value++
  }
}

async function skipWizard() {
  if (!await confirm({
    title: 'Skip Setup Wizard',
    message: 'Are you sure you want to skip the setup wizard? You can run it again later from Settings.',
    confirmText: 'Skip',
    variant: 'warning'
  })) {
    return
  }
  saving.value = true
  try {
    await api.post('/setup/skip')
    setupStore.clearStatus()
    router.push('/login')
  } catch (e) {
    // If skip endpoint doesnt exist, just mark complete locally
    router.push('/login')
  } finally {
    saving.value = false
  }
}

async function finishSetup() {
  saving.value = true
  error.value = null

  try {
    // Sync NPM email if not set
    if (!config.value.npm_admin_email) {
      config.value.npm_admin_email = config.value.admin_email
    }
    if (!config.value.npm_admin_password) {
      config.value.npm_admin_password = config.value.admin_password
    }

    const result = await api.post('/setup/apply', config.value)
    
    // If request didn't throw and wasn't aborted, setup succeeded
    if (result !== null) {
      // Setup complete - clear cached status and redirect to login
      setupStore.clearStatus()
      router.push('/login')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

// Watch for step changes to update NPM email
watch(() => config.value.admin_email, (newEmail) => {
  if (!config.value.npm_admin_email || config.value.npm_admin_email === defaults.value.admin_email) {
    config.value.npm_admin_email = newEmail
  }
})

// Watch for SSL mode changes
watch(() => config.value.ssl_mode, (mode) => {
  if (mode !== 'letsencrypt') {
    config.value.dns_provider = ''
    config.value.dns_api_token = ''
  }
})

onMounted(() => {
  loadSetupData()
})
</script>

<template>
  <div class="min-h-screen bg-theme-base flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-12">
        <Icon name="Loader2" :size="48" class="animate-spin text-accent mx-auto mb-4" />
        <p class="text-theme-secondary">Loading setup wizard...</p>
      </div>

      <!-- Wizard Card -->
      <div v-else class="bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden">
        <!-- Progress Header -->
        <div class="px-6 py-4 border-b border-theme-primary bg-theme-secondary">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Icon :name="currentStepData.icon || 'Settings'" :size="20" class="text-accent" />
              </div>
              <div>
                <h2 class="font-semibold text-theme-primary">{{ currentStepData.title }}</h2>
                <p class="text-xs text-theme-muted">Step {{ currentStep + 1 }} of {{ totalSteps }}</p>
              </div>
            </div>
            <span 
              v-if="!currentStepData.required" 
              class="text-xs px-2 py-1 rounded bg-theme-tertiary text-theme-muted"
            >
              Optional
            </span>
          </div>

          <!-- Progress Bar -->
          <div 
            class="h-1.5 bg-theme-tertiary rounded-full overflow-hidden"
            role="progressbar"
            :aria-valuenow="currentStep + 1"
            :aria-valuemin="1"
            :aria-valuemax="totalSteps"
            :aria-label="`Setup progress: step ${currentStep + 1} of ${totalSteps}`"
          >
            <div 
              class="h-full bg-accent transition-all duration-500 ease-out"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
        </div>

        <!-- Error Banner -->
        <div v-if="error" class="px-6 py-3 bg-error-muted border-b border-error/30">
          <div class="flex items-center gap-2 text-error text-sm">
            <Icon name="AlertCircle" :size="16" />
            {{ error }}
          </div>
        </div>

        <!-- Step Content -->
        <div class="p-6 min-h-[400px]">
          <!-- Step 0: Welcome -->
          <template v-if="currentStepData.id === 'welcome'">
            <div class="text-center py-8">
              <div class="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
                <img src="/icon.svg" alt="CubeOS" class="w-10 h-10" />
              </div>
              <h1 class="text-2xl font-bold text-theme-primary mb-3">Welcome to CubeOS</h1>
              <p class="text-theme-secondary mb-6 max-w-md mx-auto">
                Let's set up your device. This wizard will guide you through the initial configuration.
              </p>

              <!-- System Info -->
              <div v-if="requirements" class="bg-theme-secondary rounded-xl p-4 text-left max-w-sm mx-auto">
                <h3 class="text-sm font-medium text-theme-primary mb-3">System Detected</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-theme-muted">Device</span>
                    <span class="text-theme-primary">{{ requirements.device_model || 'Unknown' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">RAM</span>
                    <span class="text-theme-primary">{{ requirements.total_ram_mb || 0 }} MB</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">CPU Cores</span>
                    <span class="text-theme-primary">{{ requirements.cpu_cores || 0 }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">WiFi</span>
                    <span :class="requirements.has_wifi ? 'text-success' : 'text-warning'">
                      {{ requirements.has_wifi ? 'Available' : 'Not detected' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              <!-- Skip Wizard Option -->
              <button
                @click="skipWizard"
                aria-label="Skip setup wizard and use default settings"
                class="mt-6 text-sm text-theme-muted hover:text-theme-secondary transition-colors underline"
              >
                Skip wizard and use defaults
              </button>
          </template>

          <!-- Step 1: Admin Account -->
          <template v-else-if="currentStepData.id === 'admin'">
            <p class="text-theme-secondary mb-6">Create your administrator account. This will be used to log into the dashboard.</p>
            
            <div class="space-y-4">
              <div>
                <label for="admin-username" class="block text-sm font-medium text-theme-primary mb-1.5">Username</label>
                <input
                  id="admin-username"
                  v-model="config.admin_username"
                  type="text"
                  placeholder="admin"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  :class="{ 'border-error': validation.errors?.admin_username }"
                />
                <p v-if="validation.errors?.admin_username" class="text-xs text-error mt-1">{{ validation.errors.admin_username }}</p>
                <p v-else class="text-xs text-theme-muted mt-1">Lowercase letters, numbers, underscores (3-32 chars)</p>
              </div>

              <div>
                <label for="admin-email" class="block text-sm font-medium text-theme-primary mb-1.5">Email</label>
                <input
                  id="admin-email"
                  v-model="config.admin_email"
                  type="email"
                  placeholder="admin@example.com"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">Used for notifications and some app configurations</p>
              </div>

              <div>
                <label for="admin-password" class="block text-sm font-medium text-theme-primary mb-1.5">Password</label>
                <input
                  id="admin-password"
                  v-model="config.admin_password"
                  type="password"
                  placeholder="••••••••"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  :class="{ 'border-error': validation.errors?.admin_password }"
                />
                <p v-if="validation.errors?.admin_password" class="text-xs text-error mt-1">{{ validation.errors.admin_password }}</p>
                <p v-else-if="validation.warnings?.admin_password" class="text-xs text-warning mt-1">{{ validation.warnings.admin_password }}</p>
                <p v-else class="text-xs text-theme-muted mt-1">Minimum 8 characters (12+ recommended)</p>
              </div>

              <div>
                <label for="admin-password-confirm" class="block text-sm font-medium text-theme-primary mb-1.5">Confirm Password</label>
                <input
                  id="admin-password-confirm"
                  v-model="config.admin_password_confirm"
                  type="password"
                  placeholder="••••••••"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  :class="{ 'border-error': config.admin_password && config.admin_password !== config.admin_password_confirm }"
                />
                <p v-if="config.admin_password && config.admin_password !== config.admin_password_confirm" class="text-xs text-error mt-1">Passwords do not match</p>
              </div>
            </div>
          </template>

          <!-- Step 2: Device Identity -->
          <template v-else-if="currentStepData.id === 'device'">
            <p class="text-theme-secondary mb-6">Give your device a name for easy identification on your network.</p>
            
            <div class="space-y-4">
              <div>
                <label for="device-hostname" class="block text-sm font-medium text-theme-primary mb-1.5">Hostname</label>
                <input
                  id="device-hostname"
                  v-model="config.hostname"
                  type="text"
                  placeholder="cubeos"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">
                  Network hostname (e.g., <code class="text-accent">{{ config.hostname || 'cubeos' }}.cube</code>)
                </p>
              </div>

              <div>
                <label for="device-display-name" class="block text-sm font-medium text-theme-primary mb-1.5">Display Name</label>
                <input
                  id="device-display-name"
                  v-model="config.device_name"
                  type="text"
                  placeholder="CubeOS Server"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">Friendly name shown in the dashboard</p>
              </div>
            </div>
          </template>

          <!-- Step 3: WiFi AP -->
          <template v-else-if="currentStepData.id === 'wifi'">
            <p class="text-theme-secondary mb-6">Configure the WiFi access point that clients will connect to.</p>
            
            <div class="space-y-4">
              <div>
                <label for="wifi-ssid" class="block text-sm font-medium text-theme-primary mb-1.5">Network Name (SSID)</label>
                <input
                  id="wifi-ssid"
                  v-model="config.wifi_ssid"
                  type="text"
                  placeholder="CubeOS"
                  maxlength="32"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">The name devices will see when connecting (max 32 chars)</p>
              </div>

              <div>
                <label for="wifi-password" class="block text-sm font-medium text-theme-primary mb-1.5">WiFi Password</label>
                <input
                  id="wifi-password"
                  v-model="config.wifi_password"
                  type="password"
                  placeholder="Leave empty for open network"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">Minimum 8 characters for WPA2 security</p>
              </div>

              <div>
                <label for="wifi-channel" class="block text-sm font-medium text-theme-primary mb-1.5">Channel</label>
                <select
                  id="wifi-channel"
                  v-model="config.wifi_channel"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
                >
                  <option v-for="ch in [1,2,3,4,5,6,7,8,9,10,11]" :key="ch" :value="ch">
                    Channel {{ ch }}{{ ch === 6 ? ' (recommended)' : '' }}
                  </option>
                </select>
                <p class="text-xs text-theme-muted mt-1">Channel 1, 6, or 11 typically have least interference</p>
              </div>
            </div>
          </template>

          <!-- Step 4: Locale -->
          <template v-else-if="currentStepData.id === 'locale'">
            <p class="text-theme-secondary mb-6">Set your timezone and language preferences.</p>
            
            <div class="space-y-4">
              <div>
                <label for="locale-timezone" class="block text-sm font-medium text-theme-primary mb-1.5">Timezone</label>
                <select
                  id="locale-timezone"
                  v-model="config.timezone"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
                >
                  <option value="UTC">UTC (Coordinated Universal)</option>
                  <optgroup v-for="region in ['Americas', 'Europe', 'Asia', 'Pacific', 'Africa']" :key="region" :label="region">
                    <option 
                      v-for="tz in timezones.filter(t => t.region === region)" 
                      :key="tz.id" 
                      :value="tz.id"
                    >
                      {{ tz.name }} ({{ tz.offset }})
                    </option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label for="locale-language" class="block text-sm font-medium text-theme-primary mb-1.5">Language</label>
                <select
                  id="locale-language"
                  v-model="config.language"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="nl">Nederlands</option>
                  <option value="pt">Português</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          </template>

          <!-- Step 5: Theme -->
          <template v-else-if="currentStepData.id === 'theme'">
            <p class="text-theme-secondary mb-6">Choose your visual style.</p>
            
            <div class="space-y-6">
              <!-- Theme Selection -->
              <div>
                <label id="theme-mode-label" class="block text-sm font-medium text-theme-primary mb-3">Theme Mode</label>
                <div class="grid grid-cols-3 gap-3" role="radiogroup" aria-labelledby="theme-mode-label">
                  <button
                    v-for="theme in ['dark', 'light', 'system']"
                    :key="theme"
                    @click="config.theme = theme"
                    role="radio"
                    :aria-checked="config.theme === theme ? 'true' : 'false'"
                    :aria-label="`${theme} theme`"
                    class="p-4 rounded-xl border-2 transition-colors text-center"
                    :class="config.theme === theme 
                      ? 'border-accent bg-accent/10' 
                      : 'border-theme-primary hover:border-theme-secondary'"
                  >
                    <div 
                      class="w-full h-12 rounded-lg mb-2 border border-theme-primary"
                      :style="{ backgroundColor: themePreviewColors[theme].bg }"
                    >
                      <div 
                        class="w-1/2 h-full rounded-l-lg"
                        :style="{ backgroundColor: themePreviewColors[theme].card }"
                      ></div>
                    </div>
                    <span class="text-sm text-theme-primary capitalize">{{ theme }}</span>
                  </button>
                </div>
              </div>

              <!-- Accent Color -->
              <div>
                <label id="accent-color-label" class="block text-sm font-medium text-theme-primary mb-3">Accent Color</label>
                <div class="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="accent-color-label">
                  <button
                    v-for="color in accentColors"
                    :key="color.value"
                    @click="config.accent_color = color.value"
                    role="radio"
                    :aria-checked="config.accent_color === color.value ? 'true' : 'false'"
                    :aria-label="color.name"
                    class="w-10 h-10 rounded-full border-2 transition-all"
                    :style="{ backgroundColor: color.value }"
                    :class="config.accent_color === color.value 
                      ? 'border-theme-accent ring-2 ring-offset-2 ring-offset-theme-card' 
                      : 'border-transparent'"
                    :title="color.name"
                  ></button>
                </div>
              </div>
            </div>
          </template>

          <!-- Step 6: Purpose -->
          <template v-else-if="currentStepData.id === 'purpose'">
            <p class="text-theme-secondary mb-6">What will you primarily use CubeOS for?</p>
            
            <div class="space-y-3" role="radiogroup" aria-label="Deployment purpose">
              <button
                v-for="purpose in purposes"
                :key="purpose.id"
                @click="config.deployment_purpose = purpose.id"
                role="radio"
                :aria-checked="config.deployment_purpose === purpose.id ? 'true' : 'false'"
                :aria-label="purpose.name"
                class="w-full p-4 rounded-xl border-2 text-left transition-colors"
                :class="config.deployment_purpose === purpose.id 
                  ? 'border-accent bg-accent/10' 
                  : 'border-theme-primary hover:border-theme-secondary'"
              >
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                    <Icon :name="purpose.icon" :size="20" class="text-accent" />
                  </div>
                  <div class="flex-1">
                    <h3 class="font-medium text-theme-primary">{{ purpose.name }}</h3>
                    <p class="text-xs text-theme-muted mt-0.5">{{ purpose.description }}</p>
                    <div class="flex flex-wrap gap-1 mt-2">
                      <span 
                        v-for="feature in (purpose.features || []).slice(0, 3)" 
                        :key="feature"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-theme-tertiary text-theme-muted"
                      >
                        {{ feature }}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </template>

          <!-- Step 7: SSL -->
          <template v-else-if="currentStepData.id === 'ssl'">
            <p class="text-theme-secondary mb-6">Configure HTTPS for secure connections.</p>
            
            <div class="space-y-4">
              <div class="space-y-3" role="radiogroup" aria-label="SSL mode">
                <button
                  v-for="mode in sslModes"
                  :key="mode.id"
                  @click="config.ssl_mode = mode.id"
                  role="radio"
                  :aria-checked="config.ssl_mode === mode.id ? 'true' : 'false'"
                  :aria-label="mode.name"
                  class="w-full p-4 rounded-xl border-2 text-left transition-colors"
                  :class="config.ssl_mode === mode.id 
                    ? 'border-accent bg-accent/10' 
                    : 'border-theme-primary hover:border-theme-secondary'"
                >
                  <div class="flex items-center gap-3">
                    <Icon :name="mode.icon" :size="20" :class="config.ssl_mode === mode.id ? 'text-accent' : 'text-theme-muted'" />
                    <div>
                      <h3 class="font-medium text-theme-primary">{{ mode.name }}</h3>
                      <p class="text-xs text-theme-muted">{{ mode.desc }}</p>
                    </div>
                  </div>
                </button>
              </div>

              <div v-if="config.ssl_mode === 'letsencrypt'">
                <label for="ssl-base-domain" class="block text-sm font-medium text-theme-primary mb-1.5">Base Domain</label>
                <input
                  id="ssl-base-domain"
                  v-model="config.base_domain"
                  type="text"
                  placeholder="home.example.com"
                  class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p class="text-xs text-theme-muted mt-1">Apps will be available at *.{{ config.base_domain || 'your-domain.com' }}</p>
              </div>
            </div>
          </template>

          <!-- Step 8: DNS -->
          <template v-else-if="currentStepData.id === 'dns'">
            <div v-if="config.ssl_mode !== 'letsencrypt'" class="text-center py-8">
              <Icon name="SkipForward" :size="48" class="text-theme-muted mx-auto mb-4" />
              <p class="text-theme-secondary">DNS configuration is only needed for Let's Encrypt certificates.</p>
              <p class="text-theme-muted text-sm mt-2">You can skip this step.</p>
            </div>

            <template v-else>
              <p class="text-theme-secondary mb-6">Select your DNS provider for automatic certificate validation.</p>
              
              <div class="space-y-4">
                <div>
                  <label for="dns-provider" class="block text-sm font-medium text-theme-primary mb-1.5">DNS Provider</label>
                  <select
                    id="dns-provider"
                    v-model="config.dns_provider"
                    class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
                  >
                    <option value="">Select a provider...</option>
                    <option v-for="provider in dnsProviders" :key="provider.id" :value="provider.id">
                      {{ provider.name }}
                    </option>
                  </select>
                </div>

                <div v-if="config.dns_provider">
                  <label for="dns-api-token" class="block text-sm font-medium text-theme-primary mb-1.5">API Token</label>
                  <input
                    id="dns-api-token"
                    v-model="config.dns_api_token"
                    type="password"
                    placeholder="Your DNS provider API token"
                    class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <p class="text-xs text-theme-muted mt-1">
                    <a 
                      v-if="dnsProviders.find(p => p.id === config.dns_provider)?.docs_url"
                      :href="dnsProviders.find(p => p.id === config.dns_provider)?.docs_url"
                      target="_blank"
                      class="text-accent hover:underline"
                    >
                      How to get your API token →
                    </a>
                  </p>
                </div>
              </div>
            </template>
          </template>

          <!-- Step 9: Features -->
          <template v-else-if="currentStepData.id === 'features'">
            <p class="text-theme-secondary mb-6">Enable additional features and preferences.</p>
            
            <div class="space-y-4">
              <label class="flex items-start gap-3 p-4 rounded-xl border border-theme-primary hover:bg-theme-secondary cursor-pointer transition-colors">
                <input
                  v-model="config.enable_auto_updates"
                  type="checkbox"
                  class="mt-0.5 rounded border-theme-primary text-accent focus:ring-accent"
                />
                <div>
                  <span class="font-medium text-theme-primary">Automatic Security Updates</span>
                  <p class="text-xs text-theme-muted mt-0.5">Keep your system secure with automatic patches</p>
                </div>
              </label>

              <label class="flex items-start gap-3 p-4 rounded-xl border border-theme-primary hover:bg-theme-secondary cursor-pointer transition-colors">
                <input
                  v-model="config.enable_analytics"
                  type="checkbox"
                  class="mt-0.5 rounded border-theme-primary text-accent focus:ring-accent"
                />
                <div>
                  <span class="font-medium text-theme-primary">Anonymous Analytics</span>
                  <p class="text-xs text-theme-muted mt-0.5">Help improve CubeOS by sharing anonymous usage data</p>
                </div>
              </label>

              <label class="flex items-start gap-3 p-4 rounded-xl border border-theme-primary hover:bg-theme-secondary cursor-pointer transition-colors">
                <input
                  v-model="config.enable_remote_access"
                  type="checkbox"
                  class="mt-0.5 rounded border-theme-primary text-accent focus:ring-accent"
                />
                <div>
                  <span class="font-medium text-theme-primary">Remote Access (VPN)</span>
                  <p class="text-xs text-theme-muted mt-0.5">Enable WireGuard VPN for secure remote connections</p>
                </div>
              </label>
            </div>
          </template>

          <!-- Step 10: Complete -->
          <template v-else-if="currentStepData.id === 'complete'">
            <div class="text-center py-8">
              <div class="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                <Icon name="CheckCircle" :size="40" class="text-success" />
              </div>
              <h1 class="text-2xl font-bold text-theme-primary mb-3">Setup Complete!</h1>
              <p class="text-theme-secondary mb-6 max-w-md mx-auto">
                Your CubeOS is configured and ready to use. Click finish to apply all settings and restart services.
              </p>

              <!-- Summary -->
              <div class="bg-theme-secondary rounded-xl p-4 text-left max-w-sm mx-auto">
                <h3 class="text-sm font-medium text-theme-primary mb-3">Configuration Summary</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-theme-muted">Admin</span>
                    <span class="text-theme-primary">{{ config.admin_username }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">Hostname</span>
                    <span class="text-theme-primary">{{ config.hostname }}.cube</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">Dashboard</span>
                    <span class="text-theme-primary font-mono text-xs">https://{{ config.hostname }}.cube</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">WiFi</span>
                    <span class="text-theme-primary">{{ config.wifi_ssid }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">Timezone</span>
                    <span class="text-theme-primary">{{ config.timezone }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-theme-muted">SSL</span>
                    <span class="text-theme-primary capitalize">{{ config.ssl_mode || 'None' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer Navigation -->
        <div class="px-6 py-4 border-t border-theme-primary bg-theme-secondary flex items-center justify-between">
          <button
            v-if="!isFirstStep"
            @click="prevStep"
            :aria-label="`Back to step ${currentStep}: ${steps[currentStep - 1]?.title || 'previous'}`"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors"
          >
            <Icon name="ChevronLeft" :size="16" />
            Back
          </button>
          <div v-else></div>

          <div class="flex items-center gap-2">
            <button
              v-if="!currentStepData.required && !isLastStep"
              @click="skipStep"
              :aria-label="`Skip ${currentStepData.title} step`"
              class="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-secondary transition-colors"
            >
              Skip
            </button>

            <button
              @click="nextStep"
              :disabled="!canProceed || saving"
              :aria-label="isLastStep ? 'Finish setup' : `Continue to step ${currentStep + 2}: ${steps[currentStep + 1]?.title || 'next'}`"
              class="flex items-center gap-2 px-6 py-2 rounded-lg btn-accent font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon v-if="saving" name="Loader2" :size="16" class="animate-spin" />
              <template v-else>
                {{ isLastStep ? 'Finish Setup' : 'Continue' }}
                <Icon v-if="!isLastStep" name="ChevronRight" :size="16" />
              </template>
            </button>
          </div>
        </div>
      </div>

      <!-- Step Indicators -->
      <nav class="flex justify-center gap-1.5 mt-6" aria-label="Setup steps">
        <button
          v-for="(step, index) in steps"
          :key="step.id"
          @click="index < currentStep && (currentStep = index)"
          :aria-label="`Step ${index + 1}: ${step.title}${index === currentStep ? ' (current)' : ''}`"
          :aria-current="index === currentStep ? 'step' : undefined"
          class="w-2 h-2 rounded-full transition-all"
          :class="[
            index === currentStep ? 'w-6 bg-accent' : '',
            index < currentStep ? 'bg-accent/60 cursor-pointer hover:bg-accent' : 'bg-theme-tertiary'
          ]"
          :disabled="index > currentStep"
        ></button>
      </nav>
    </div>
  </div>
</template>
