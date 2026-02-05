<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const emit = defineEmits(['complete'])

// Wizard state
const currentStep = ref(0)
const loading = ref(false)
const error = ref(null)

// Step 1: Welcome
const hostname = ref('')
const timezone = ref('UTC')

// Step 2: WiFi AP Configuration
const wifiEnabled = ref(true)
const wifiSSID = ref('CubeOS')
const wifiPassword = ref('')
const wifiChannel = ref(6)

// Step 3: Profile Selection
const profiles = ref([])
const selectedProfile = ref('minimal')
const customServices = ref([])

// Step 4: Service Selection (from profile)
const categories = ref([])
const selectedServices = ref([])

// Step 5: Admin Account
const adminPassword = ref('')
const confirmPassword = ref('')

// Available timezones (common ones)
const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Australia/Sydney'
]

const steps = [
  { id: 'welcome', title: 'Welcome', icon: 'Sparkles' },
  { id: 'network', title: 'Network', icon: 'Wifi' },
  { id: 'profile', title: 'Profile', icon: 'Layout' },
  { id: 'services', title: 'Services', icon: 'Package' },
  { id: 'account', title: 'Account', icon: 'User' },
  { id: 'complete', title: 'Complete', icon: 'CheckCircle' }
]

const currentStepData = computed(() => steps[currentStep.value])
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const progress = computed(() => ((currentStep.value + 1) / steps.length) * 100)

// Validation
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Welcome
      return hostname.value.length >= 3
    case 1: // Network
      return !wifiEnabled.value || (wifiSSID.value.length >= 2 && wifiPassword.value.length >= 8)
    case 2: // Profile
      return selectedProfile.value !== ''
    case 3: // Services
      return true // Can skip custom selection
    case 4: // Account
      return adminPassword.value.length >= 8 && adminPassword.value === confirmPassword.value
    case 5: // Complete
      return true
    default:
      return false
  }
})

// Selected profile info
const selectedProfileInfo = computed(() => {
  return profiles.value.find(p => p.id === selectedProfile.value) || null
})

// RAM estimate for selected services
const estimatedRAM = computed(() => {
  if (!selectedProfileInfo.value) return 0
  return selectedProfileInfo.value.ram_estimate
})

async function fetchProfiles() {
  try {
    const data = await api.get('/wizard/profiles')
    profiles.value = data.profiles || data || []
  } catch (e) {
    // Profiles fetch failed
  }
}

async function fetchServices() {
  try {
    const data = await api.get('/wizard/services')
    categories.value = data.categories || []
    
    // Pre-select services from profile
    if (selectedProfileInfo.value) {
      selectedServices.value = [...selectedProfileInfo.value.services]
    }
  } catch (e) {
    // Services fetch failed
  }
}

function toggleService(serviceName) {
  const idx = selectedServices.value.indexOf(serviceName)
  if (idx === -1) {
    selectedServices.value.push(serviceName)
  } else {
    selectedServices.value.splice(idx, 1)
  }
}

function isServiceSelected(serviceName) {
  return selectedServices.value.includes(serviceName)
}

async function nextStep() {
  if (currentStep.value === 1) {
    // After network step, fetch profiles
    await fetchProfiles()
  }
  
  if (currentStep.value === 2) {
    // After profile step, fetch services and pre-select
    await fetchServices()
  }
  
  if (currentStep.value === 4) {
    // Before complete step, apply configuration
    await applyConfiguration()
  }
  
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function applyConfiguration() {
  loading.value = true
  error.value = null
  
  try {
    // Apply hostname
    if (hostname.value) {
      await api.post('/system/hostname', { hostname: hostname.value })
    }
    
    // Apply WiFi AP configuration
    if (wifiEnabled.value) {
      await api.put('/network/ap/config', {
        enabled: true,
        ssid: wifiSSID.value,
        password: wifiPassword.value,
        channel: wifiChannel.value
      })
    }
    
    // Apply profile/services
    await api.post('/wizard/apply', {
      profile: selectedProfile.value,
      additional_services: selectedServices.value.filter(s => 
        !selectedProfileInfo.value?.services?.includes(s)
      ),
      excluded_services: selectedProfileInfo.value?.services?.filter(s => 
        !selectedServices.value.includes(s)
      ) || []
    })
    
    // Change admin password
    if (adminPassword.value) {
      await api.post('/auth/password', {
        current_password: 'admin', // Default password
        new_password: adminPassword.value
      })
    }
    
    // Mark setup as complete
    await api.put('/preferences', {
      setup_complete: true
    })
    
  } catch (e) {
    error.value = e.message || 'Failed to apply configuration'
  } finally {
    loading.value = false
  }
}

function finishWizard() {
  emit('complete')
  router.push('/')
}

onMounted(async () => {
  // Check if already set up
  try {
    const prefs = await api.get('/preferences')
    if (prefs.setup_complete) {
      router.push('/')
      return
    }
  } catch (e) {
    // Continue with wizard
  }
  
  // Set default hostname
  try {
    const info = await api.getSystemInfo()
    hostname.value = info.hostname || 'cubeos'
  } catch (e) {
    hostname.value = 'cubeos'
  }
})
</script>

<template>
  <div class="min-h-screen wizard-gradient flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <!-- Progress bar -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-theme-tertiary">Step {{ currentStep + 1 }} of {{ steps.length }}</span>
          <span class="text-sm text-theme-tertiary">{{ currentStepData.title }}</span>
        </div>
        <div class="h-1 bg-theme-tertiary rounded-full overflow-hidden">
          <div 
            class="h-full bg-accent transition-all duration-500"
            :style="{ width: progress + '%' }"
          ></div>
        </div>
      </div>
      
      <!-- Step indicators -->
      <div class="flex justify-center gap-2 mb-8">
        <div 
          v-for="(step, idx) in steps" 
          :key="step.id"
          class="w-10 h-10 rounded-full flex items-center justify-center transition-all"
          :class="idx === currentStep ? 'bg-accent text-white' : idx < currentStep ? 'bg-accent-muted text-accent' : 'bg-theme-tertiary text-theme-muted'"
        >
          <Icon :name="step.icon" :size="20" />
        </div>
      </div>
      
      <!-- Card -->
      <div class="bg-theme-card rounded-2xl shadow-2xl overflow-hidden border border-theme-primary">
        <!-- Step Content -->
        <div class="p-8">
          <!-- Step 0: Welcome -->
          <div v-if="currentStep === 0" class="space-y-6">
            <div class="text-center">
              <div class="w-20 h-20 mx-auto mb-6 rounded-2xl accent-gradient flex items-center justify-center">
                <Icon name="Box" :size="40" class="text-white" />
              </div>
              <h1 class="text-3xl font-bold text-theme-primary mb-2">Welcome to CubeOS</h1>
              <p class="text-theme-tertiary">Let's set up your offline server in just a few steps.</p>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Device Name</label>
                <input
                  v-model="hostname"
                  type="text"
                  placeholder="cubeos"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                />
                <p class="text-xs text-theme-muted mt-1">This will be the network name of your device</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Timezone</label>
                <select
                  v-model="timezone"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary focus:ring-2 ring-accent focus:border-transparent"
                >
                  <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Step 1: Network -->
          <div v-if="currentStep === 1" class="space-y-6">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-theme-primary mb-2">WiFi Access Point</h2>
              <p class="text-theme-tertiary">Configure how devices will connect to CubeOS</p>
            </div>
            
            <div class="flex items-center justify-between p-4 bg-theme-tertiary rounded-xl">
              <div>
                <p class="font-medium text-theme-primary">Enable WiFi Access Point</p>
                <p class="text-sm text-theme-tertiary">Allow devices to connect directly</p>
              </div>
              <button 
                @click="wifiEnabled = !wifiEnabled"
                class="relative w-12 h-6 rounded-full transition-colors"
                :class="wifiEnabled ? 'bg-accent' : 'bg-theme-muted'"
              >
                <div 
                  class="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                  :class="wifiEnabled ? 'translate-x-7' : 'translate-x-1'"
                ></div>
              </button>
            </div>
            
            <div v-if="wifiEnabled" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Network Name (SSID)</label>
                <input
                  v-model="wifiSSID"
                  type="text"
                  placeholder="CubeOS"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Password</label>
                <input
                  v-model="wifiPassword"
                  type="password"
                  placeholder="Minimum 8 characters"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Channel</label>
                <select
                  v-model="wifiChannel"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary focus:ring-2 ring-accent focus:border-transparent"
                >
                  <option v-for="ch in [1,2,3,4,5,6,7,8,9,10,11]" :key="ch" :value="ch">Channel {{ ch }}</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Step 2: Profile -->
          <div v-if="currentStep === 2" class="space-y-6">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-theme-primary mb-2">Choose Your Profile</h2>
              <p class="text-theme-tertiary">Select a preset that matches your use case</p>
            </div>
            
            <div class="space-y-3">
              <button
                v-for="profile in profiles"
                :key="profile.id"
                @click="selectedProfile = profile.id"
                class="w-full p-4 rounded-xl border-2 text-left transition-all"
                :class="selectedProfile === profile.id 
                  ? 'border-theme-accent bg-accent-muted' 
                  : 'border-theme-secondary bg-theme-tertiary hover:border-theme-primary'"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="font-semibold text-theme-primary">{{ profile.name }}</h3>
                    <p class="text-sm text-theme-tertiary mt-1">{{ profile.description }}</p>
                    <p class="text-xs text-theme-muted mt-2">
                      {{ profile.services?.length || 0 }} services • ~{{ profile.ram_estimate }}MB RAM
                    </p>
                  </div>
                  <div 
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    :class="selectedProfile === profile.id ? 'border-theme-accent bg-accent' : 'border-theme-secondary'"
                  >
                    <svg v-if="selectedProfile === profile.id" class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          <!-- Step 3: Services -->
          <div v-if="currentStep === 3" class="space-y-6">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-theme-primary mb-2">Customize Services</h2>
              <p class="text-theme-tertiary">Fine-tune which services to enable</p>
            </div>
            
            <div class="bg-theme-tertiary rounded-xl p-4 mb-4">
              <div class="flex items-center justify-between">
                <span class="text-theme-secondary">Estimated RAM Usage</span>
                <span class="font-semibold text-accent">~{{ estimatedRAM }}MB</span>
              </div>
            </div>
            
            <div class="space-y-4 max-h-80 overflow-y-auto pr-2">
              <div v-for="category in categories" :key="category.id" class="space-y-2">
                <h3 class="text-sm font-semibold text-theme-tertiary uppercase tracking-wider">{{ category.name }}</h3>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="service in category.services"
                    :key="service.name"
                    @click="toggleService(service.name)"
                    class="p-3 rounded-lg border text-left transition-all"
                    :class="isServiceSelected(service.name) 
                      ? 'border-theme-accent bg-accent-muted' 
                      : 'border-theme-secondary bg-theme-tertiary hover:border-theme-primary'"
                  >
                    <p class="text-sm font-medium text-theme-primary truncate">{{ service.display_name || service.name }}</p>
                    <p class="text-xs text-theme-muted">~{{ service.ram_estimate }}MB</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 4: Account -->
          <div v-if="currentStep === 4" class="space-y-6">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-theme-primary mb-2">Secure Your Device</h2>
              <p class="text-theme-tertiary">Set a strong password for the admin account</p>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">New Password</label>
                <input
                  v-model="adminPassword"
                  type="password"
                  placeholder="Minimum 8 characters"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-2">Confirm Password</label>
                <input
                  v-model="confirmPassword"
                  type="password"
                  placeholder="Repeat password"
                  class="w-full px-4 py-3 bg-theme-input border border-theme-secondary rounded-xl text-theme-primary placeholder-theme-muted focus:ring-2 ring-accent focus:border-transparent"
                  :class="confirmPassword && confirmPassword !== adminPassword ? 'border-error' : ''"
                />
                <p v-if="confirmPassword && confirmPassword !== adminPassword" class="text-xs text-error mt-1">
                  Passwords do not match
                </p>
              </div>
              
              <div class="p-4 bg-warning-muted border border-warning-subtle rounded-xl">
                <p class="text-sm text-warning">
                  <strong>Important:</strong> Remember this password. You'll need it to access the dashboard.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Step 5: Complete -->
          <div v-if="currentStep === 5" class="text-center space-y-6">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-success-muted flex items-center justify-center">
              <Icon name="CheckCircle" :size="48" class="text-success" />
            </div>
            <h2 class="text-2xl font-bold text-theme-primary">Setup Complete!</h2>
            <p class="text-theme-tertiary">Your CubeOS device is ready to use.</p>
            
            <div class="bg-theme-tertiary rounded-xl p-6 text-left space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-theme-tertiary">Device Name</span>
                <span class="text-theme-primary font-medium">{{ hostname }}</span>
              </div>
              <div v-if="wifiEnabled" class="flex items-center justify-between">
                <span class="text-theme-tertiary">WiFi Network</span>
                <span class="text-theme-primary font-medium">{{ wifiSSID }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-tertiary">Profile</span>
                <span class="text-theme-primary font-medium">{{ selectedProfileInfo?.name }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-theme-tertiary">Services</span>
                <span class="text-theme-primary font-medium">{{ selectedServices.length }} enabled</span>
              </div>
            </div>
            
            <p class="text-sm text-theme-muted">
              Connect to <strong class="text-accent">{{ wifiSSID }}</strong> and open <strong class="text-accent">http://{{ hostname }}.local</strong>
            </p>
          </div>
          
          <!-- Error message -->
          <div v-if="error" class="mt-4 p-4 bg-error-muted border border-error-subtle rounded-xl">
            <p class="text-sm text-error">{{ error }}</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="px-8 py-4 bg-theme-secondary border-t border-theme-primary flex items-center justify-between">
          <button
            v-if="!isFirstStep && !isLastStep"
            @click="prevStep"
            class="px-6 py-2 text-theme-tertiary hover:text-theme-primary transition-colors"
          >
            Back
          </button>
          <div v-else></div>
          
          <button
            v-if="!isLastStep"
            @click="nextStep"
            :disabled="!canProceed || loading"
            class="btn-accent px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ currentStep === 4 ? 'Apply & Finish' : 'Continue' }}
          </button>
          
          <button
            v-if="isLastStep"
            @click="finishWizard"
            class="btn-accent px-6 py-2 rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
