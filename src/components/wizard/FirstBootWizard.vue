<script setup>
/**
 * FirstBootWizard.vue — S10 Rewrite
 *
 * Lean orchestrator shell that delegates UI to step components in wizard/steps/.
 * Reduced from 916 lines to ~220 lines.
 *
 * 6 core steps: Welcome → Admin → Device → WiFi → Locale → Summary
 *
 * API endpoints used:
 * - GET  /setup/steps, /setup/defaults, /setup/requirements, /setup/timezones
 * - POST /setup/validate
 * - POST /setup/apply
 * - POST /setup/skip
 * - POST /setup/complete
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSetupStore } from '@/stores/setup'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'

import WelcomeStep from './steps/WelcomeStep.vue'
import AdminStep from './steps/AdminStep.vue'
import DeviceStep from './steps/DeviceStep.vue'
import WiFiStep from './steps/WiFiStep.vue'
import LocaleStep from './steps/LocaleStep.vue'
import SummaryStep from './steps/SummaryStep.vue'

const router = useRouter()
const setupStore = useSetupStore()

// ─── State ───────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(false)
const error = ref(null)
const currentStep = ref(0)

const defaults = ref({})
const requirements = ref({})
const timezones = ref([])

// Step definitions — simplified from original 11 to 6 core steps
const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: 'Box', required: true },
  { id: 'admin', title: 'Admin Account', icon: 'UserCog', required: true },
  { id: 'device', title: 'Device Identity', icon: 'Server', required: true },
  { id: 'wifi', title: 'WiFi Access Point', icon: 'Wifi', required: true },
  { id: 'locale', title: 'Time & Language', icon: 'Globe', required: true },
  { id: 'summary', title: 'Complete', icon: 'CheckCircle', required: true }
]

// Form data
const config = ref({
  admin_username: 'admin',
  admin_password: '',
  admin_password_confirm: '',
  admin_email: '',
  hostname: 'cubeos',
  device_name: 'CubeOS Server',
  wifi_ssid: 'CubeOS',
  wifi_password: '',
  wifi_channel: 6,
  country_code: 'US',
  timezone: 'UTC',
  language: 'en',
  theme: 'dark',
  enable_auto_updates: true
})

const validation = ref({ valid: true, errors: {}, warnings: {} })

// ─── Computed ────────────────────────────────────────────────
const totalSteps = computed(() => STEPS.length)
const currentStepData = computed(() => STEPS[currentStep.value] || {})
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const progress = computed(() => Math.round((currentStep.value / (totalSteps.value - 1)) * 100))

const canProceed = computed(() => {
  const step = currentStepData.value
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

// ─── Methods ─────────────────────────────────────────────────
async function loadSetupData() {
  loading.value = true
  error.value = null
  try {
    const [defaultsRes, requirementsRes, timezonesRes] = await Promise.all([
      api.get('/setup/defaults'),
      api.get('/setup/requirements'),
      api.get('/setup/timezones')
    ])
    defaults.value = defaultsRes || {}
    requirements.value = requirementsRes || {}
    timezones.value = timezonesRes.timezones || []
    Object.assign(config.value, defaults.value)

    // B3: If device_model is missing, the API may still be starting.
    // Retry up to 3 times with increasing delay.
    if (!requirements.value.device_model) {
      retryRequirements(3, 2000)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function retryRequirements(attemptsLeft, delayMs) {
  if (attemptsLeft <= 0 || requirements.value.device_model) return
  await new Promise(resolve => setTimeout(resolve, delayMs))
  try {
    const retry = await api.get('/setup/requirements')
    if (retry?.device_model) {
      requirements.value = { ...requirements.value, ...retry }
    } else if (attemptsLeft > 1) {
      retryRequirements(attemptsLeft - 1, delayMs * 1.5)
    }
  } catch { /* ignore — best effort */ }
}

async function validateStep() {
  try {
    const result = await api.post('/setup/validate', config.value)
    validation.value = result
    return result.valid
  } catch (e) {
    error.value = e.message || 'Validation failed'
    return false
  }
}

async function nextStep() {
  if (isLastStep.value) {
    await finishSetup()
    return
  }

  const step = currentStepData.value
  if (step.required && step.id !== 'welcome') {
    const valid = await validateStep()
    if (!valid) return
  }

  currentStep.value++
}

function prevStep() {
  if (!isFirstStep.value) currentStep.value--
}

async function skipWizard() {
  if (!await confirm({
    title: 'Skip Setup Wizard',
    message: 'Are you sure? You can run it again later from Settings.',
    confirmText: 'Skip',
    variant: 'warning'
  })) return

  saving.value = true
  try {
    await api.post('/setup/skip')

    // Auto-login with default credentials so the user has a valid session
    const authStore = useAuthStore()
    try {
      await authStore.login('admin', 'cubeos')
    } catch {
      // If auto-login fails, fall through to login page below
    }

    setupStore.clearStatus()
    router.push('/')
  } catch {
    router.push('/login')
  } finally {
    saving.value = false
  }
}

async function finishSetup() {
  saving.value = true
  error.value = null
  try {
    const result = await api.post('/setup/apply', config.value)
    if (result !== null) {
      setupStore.clearStatus()
      router.push('/login')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(() => { loadSetupData() })
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
          </div>

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
          <WelcomeStep
            v-if="currentStepData.id === 'welcome'"
            :requirements="requirements"
            @skip="skipWizard"
          />
          <AdminStep
            v-else-if="currentStepData.id === 'admin'"
            v-model="config"
            :validation="validation"
          />
          <DeviceStep
            v-else-if="currentStepData.id === 'device'"
            v-model="config"
          />
          <WiFiStep
            v-else-if="currentStepData.id === 'wifi'"
            v-model="config"
          />
          <LocaleStep
            v-else-if="currentStepData.id === 'locale'"
            v-model="config"
            :timezones="timezones"
          />
          <SummaryStep
            v-else-if="currentStepData.id === 'summary'"
            :config="config"
          />
        </div>

        <!-- Footer Navigation -->
        <div class="px-6 py-4 border-t border-theme-primary bg-theme-secondary flex items-center justify-between">
          <button
            v-if="!isFirstStep"
            @click="prevStep"
            :aria-label="`Back to step ${currentStep}: ${STEPS[currentStep - 1]?.title || 'previous'}`"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors"
          >
            <Icon name="ChevronLeft" :size="16" />
            Back
          </button>
          <div v-else></div>

          <button
            @click="nextStep"
            :disabled="!canProceed || saving"
            :aria-label="isLastStep ? 'Finish setup' : `Continue to step ${currentStep + 2}`"
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

      <!-- Step Indicators -->
      <nav class="flex justify-center gap-1.5 mt-6" aria-label="Setup steps">
        <button
          v-for="(step, index) in STEPS"
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
