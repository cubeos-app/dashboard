<script setup>
/**
 * AccessProfileSettings.vue — Settings tab for Access Profile management
 *
 * Shows current profile with three cards.
 * Change button opens inline editing with credential fields + Test Connection.
 * Saves via PUT /api/v1/system/access-profile.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import ProfileSwitchProgressModal from './ProfileSwitchProgressModal.vue'

const { t } = useI18n()

// ─── State ───────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(false)
const editing = ref(false)
const error = ref(null)
const successMsg = ref(null)

const currentProfile = ref('standard')
const editProfile = ref('standard')
const credentials = ref({
  ext_npm_url: '',
  ext_npm_token: '',
  ext_pihole_url: '',
  ext_pihole_password: ''
})

const testing = ref(false)
const testResult = ref(null)

// Profile switch workflow state
const showProgressModal = ref(false)
const activeJobId = ref('')
const switchFromProfile = ref('')
const switchToProfile = ref('')

const profiles = [
  { id: 'standard', icon: 'Monitor' },
  { id: 'advanced', icon: 'Link' },
  { id: 'all_in_one', icon: 'Radio' }
]

// ─── Load ────────────────────────────────────────────────────
async function loadProfile() {
  loading.value = true
  try {
    const data = await api.get('/system/access-profile')
    currentProfile.value = data.profile || 'standard'
    editProfile.value = data.profile || 'standard'
    credentials.value = {
      ext_npm_url: data.ext_npm_url || '',
      ext_npm_token: '',
      ext_pihole_url: data.ext_pihole_url || '',
      ext_pihole_password: ''
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// ─── Edit ────────────────────────────────────────────────────
function startEditing() {
  editing.value = true
  editProfile.value = currentProfile.value
  testResult.value = null
  successMsg.value = null
}

function cancelEditing() {
  editing.value = false
  editProfile.value = currentProfile.value
  testResult.value = null
}

async function saveProfile() {
  saving.value = true
  error.value = null
  successMsg.value = null
  try {
    // D2: All-in-One → Standard transition — ask about AP teardown
    if (currentProfile.value === 'all_in_one' && editProfile.value === 'standard') {
      const disableAP = await confirm({
        title: t('settings.accessProfile.apTeardownTitle'),
        message: t('settings.accessProfile.apTeardownMessage'),
        confirmText: t('settings.accessProfile.apTeardownConfirm'),
        cancelText: t('settings.accessProfile.apTeardownKeep'),
        variant: 'warning'
      })
      if (disableAP) {
        try {
          await api.post('/setup/ap-teardown')
        } catch {
          // Non-fatal — continue with profile switch
        }
      }
    }

    const result = await api.put('/system/access-profile', {
      profile: editProfile.value,
      ext_npm_url: credentials.value.ext_npm_url,
      ext_npm_token: credentials.value.ext_npm_token,
      ext_pihole_url: credentials.value.ext_pihole_url,
      ext_pihole_password: credentials.value.ext_pihole_password
    })

    if (result && result.job_id) {
      // 202 Accepted — profile switch workflow started
      switchFromProfile.value = currentProfile.value
      switchToProfile.value = editProfile.value
      activeJobId.value = result.job_id
      showProgressModal.value = true
      editing.value = false
    } else {
      // 200 OK — same profile, just saved config
      currentProfile.value = editProfile.value
      editing.value = false
      successMsg.value = t('settings.accessProfile.saved')
      setTimeout(() => { successMsg.value = null }, 5000)
    }
  } catch (e) {
    error.value = t('settings.accessProfile.saveFailed') + ': ' + (e.message || '')
  } finally {
    saving.value = false
  }
}

function onSwitchDone() {
  showProgressModal.value = false
  currentProfile.value = switchToProfile.value
  successMsg.value = t('settings.accessProfile.saved')
  setTimeout(() => { successMsg.value = null }, 5000)
}

function onSwitchError(msg) {
  // Keep modal open — user closes it manually
}

function onSwitchClose() {
  showProgressModal.value = false
  // Reload profile state in case it partially changed
  loadProfile()
}

// ─── Test Connection ─────────────────────────────────────────
async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const result = await api.post('/system/access-profile/test', {
      ext_npm_url: credentials.value.ext_npm_url,
      ext_npm_token: credentials.value.ext_npm_token,
      ext_pihole_url: credentials.value.ext_pihole_url,
      ext_pihole_password: credentials.value.ext_pihole_password
    })
    testResult.value = result
  } catch (e) {
    testResult.value = { npm_ok: false, npm_error: e.message, pihole_ok: false, pihole_error: e.message }
  } finally {
    testing.value = false
  }
}

const profileLabel = computed(() => {
  const map = { standard: 'Standard', advanced: 'Advanced', all_in_one: 'All-in-One' }
  return map[currentProfile.value] || currentProfile.value
})

onMounted(() => { loadProfile() })
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <Icon name="Loader2" :size="24" class="animate-spin text-accent mx-auto" />
    </div>

    <template v-else>
      <!-- Success toast -->
      <div v-if="successMsg" class="flex items-center gap-2 p-3 rounded-lg bg-success-muted border border-success/30 text-success text-sm">
        <Icon name="CheckCircle" :size="16" />
        {{ successMsg }}
      </div>

      <!-- Error -->
      <div v-if="error" class="flex items-center gap-2 p-3 rounded-lg bg-error-muted border border-error/30 text-error text-sm">
        <Icon name="AlertCircle" :size="16" />
        {{ error }}
      </div>

      <!-- Current Profile Display (non-editing) -->
      <div v-if="!editing" class="bg-theme-card rounded-xl border border-theme-primary p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-medium text-theme-primary">{{ t('settings.accessProfile.title') }}</h3>
            <p class="text-sm text-theme-muted mt-1">{{ t('settings.accessProfile.current') }}: <span class="font-medium text-theme-primary">{{ profileLabel }}</span></p>
          </div>
          <button
            @click="startEditing"
            class="px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors text-sm"
          >
            {{ t('settings.accessProfile.changeProfile') }}
          </button>
        </div>

        <!-- Profile cards (read-only display) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            v-for="profile in profiles"
            :key="profile.id"
            class="p-3 rounded-lg border-2 transition-colors"
            :class="currentProfile === profile.id ? 'border-accent bg-accent/5' : 'border-theme-secondary bg-theme-secondary opacity-50'"
          >
            <div class="flex items-center gap-2 mb-1">
              <Icon :name="profile.icon" :size="16" class="text-theme-secondary" />
              <span class="text-sm font-medium text-theme-primary">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.name`) }}</span>
            </div>
            <p class="text-xs text-theme-muted">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.line1`) }}</p>
          </div>
        </div>

        <!-- Info note -->
        <div class="flex items-start gap-2 mt-4 text-xs text-theme-muted">
          <Icon name="Info" :size="14" class="flex-shrink-0 mt-0.5" />
          <p>{{ t('settings.accessProfile.migrateNote') }}</p>
        </div>
      </div>

      <!-- Editing Mode -->
      <div v-else class="bg-theme-card rounded-xl border border-theme-primary p-6 space-y-6">
        <h3 class="font-medium text-theme-primary">{{ t('settings.accessProfile.changeProfile') }}</h3>

        <!-- Profile selection cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            v-for="profile in profiles"
            :key="profile.id"
            @click="editProfile = profile.id"
            class="relative p-4 rounded-xl border-2 text-left transition-all duration-200"
            :class="[
              editProfile === profile.id
                ? 'border-accent bg-accent/5 shadow-theme-md'
                : 'border-theme-primary bg-theme-card hover:border-theme-secondary'
            ]"
          >
            <div class="flex items-center gap-2 mb-2">
              <div
                class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                :class="editProfile === profile.id ? 'border-accent' : 'border-theme-tertiary'"
              >
                <div v-if="editProfile === profile.id" class="w-2 h-2 rounded-full bg-accent"></div>
              </div>
              <Icon :name="profile.icon" :size="16" class="text-theme-secondary" />
              <span class="font-medium text-sm text-theme-primary">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.name`) }}</span>
            </div>
            <p class="text-xs text-theme-secondary ml-6">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.line1`) }}</p>
            <p class="text-xs text-theme-muted ml-6">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.line2`) }}</p>
          </button>
        </div>

        <!-- Advanced: credential fields -->
        <div v-if="editProfile === 'advanced'" class="space-y-4 p-4 rounded-xl border border-theme-primary bg-theme-secondary">
          <div>
            <label class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.npmUrl') }}</label>
            <input
              v-model="credentials.ext_npm_url"
              type="url"
              placeholder="https://npm.yourdomain.com"
              class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.npmToken') }}</label>
            <input
              v-model="credentials.ext_npm_token"
              type="password"
              placeholder="eyJ..."
              class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.piholeUrl') }}</label>
            <input
              v-model="credentials.ext_pihole_url"
              type="url"
              placeholder="http://192.168.1.2"
              class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.piholePassword') }}</label>
            <input
              v-model="credentials.ext_pihole_password"
              type="password"
              placeholder="Pi-hole admin password"
              class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
            />
          </div>

          <!-- Test Connection -->
          <div class="pt-2">
            <button
              @click="testConnection"
              :disabled="testing || !credentials.ext_npm_url"
              class="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
            >
              <Icon v-if="testing" name="Loader2" :size="16" class="animate-spin" />
              <Icon v-else name="Plug" :size="16" />
              {{ t('wizard.steps.accessProfile.testConnection') }}
            </button>
            <div v-if="testResult" class="mt-3 space-y-1.5">
              <div class="flex items-center gap-2 text-sm">
                <Icon :name="testResult.npm_ok ? 'CheckCircle' : 'XCircle'" :size="16" :class="testResult.npm_ok ? 'text-success' : 'text-error'" />
                <span :class="testResult.npm_ok ? 'text-success' : 'text-error'">
                  NPM: {{ testResult.npm_ok ? t('wizard.steps.accessProfile.reachable') : t('wizard.steps.accessProfile.unreachable') }}
                  <span v-if="testResult.npm_version" class="text-theme-muted">(v{{ testResult.npm_version }})</span>
                  <span v-if="!testResult.npm_ok && testResult.npm_error" class="text-theme-muted"> — {{ testResult.npm_error }}</span>
                </span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <Icon :name="testResult.pihole_ok ? 'CheckCircle' : 'XCircle'" :size="16" :class="testResult.pihole_ok ? 'text-success' : 'text-error'" />
                <span :class="testResult.pihole_ok ? 'text-success' : 'text-error'">
                  Pi-hole: {{ testResult.pihole_ok ? t('wizard.steps.accessProfile.reachable') : t('wizard.steps.accessProfile.unreachable') }}
                  <span v-if="testResult.pihole_version" class="text-theme-muted">(v{{ testResult.pihole_version }})</span>
                  <span v-if="!testResult.pihole_ok && testResult.pihole_error" class="text-theme-muted"> — {{ testResult.pihole_error }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- All-in-One: DHCP warning -->
        <div v-if="editProfile === 'all_in_one'" class="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning-muted">
          <Icon name="AlertTriangle" :size="20" class="text-warning flex-shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-warning mb-1">{{ t('wizard.steps.accessProfile.aioWarningTitle') }}</p>
            <p class="text-theme-secondary">{{ t('wizard.steps.accessProfile.aioWarningMessage') }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            @click="cancelEditing"
            class="px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors text-sm"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="saveProfile"
            :disabled="saving"
            class="flex items-center gap-2 px-4 py-2 rounded-lg btn-accent font-medium text-sm disabled:opacity-50"
          >
            <Icon v-if="saving" name="Loader2" :size="16" class="animate-spin" />
            {{ saving ? t('settings.accessProfile.saving') : t('settings.accessProfile.saveProfile') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Profile Switch Progress Modal -->
    <ProfileSwitchProgressModal
      v-if="showProgressModal"
      :job-id="activeJobId"
      :from-profile="switchFromProfile"
      :to-profile="switchToProfile"
      @done="onSwitchDone"
      @error="onSwitchError"
      @close="onSwitchClose"
    />
  </div>
</template>
