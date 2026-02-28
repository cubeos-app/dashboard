<script setup>
/**
 * AccessProfileStep.vue — Wizard Step 3 (between Admin and Device)
 *
 * Three cards: Standard / Advanced / All-in-One
 * Advanced → expands credential fields + Test Connection button
 * All-in-One → shows DHCP warning banner
 * Standard on Pi → gates on Ethernet readiness (carrier + DHCP lease)
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true },
  skipApStep: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'update:ethernetIp'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const selectedProfile = computed(() => props.modelValue.access_profile || 'standard')

function selectProfile(profile) {
  update('access_profile', profile)
}

// ─── Ethernet Status (Standard profile gate on Pi) ────────
const ethStatus = ref({ available: false, carrier: false, ip: '' })
const ethChecking = ref(false)
let ethPollTimer = null

const needsEthernetGate = computed(() =>
  selectedProfile.value === 'standard' && !props.skipApStep
)

const ethernetReady = computed(() =>
  ethStatus.value.available && ethStatus.value.carrier && ethStatus.value.ip
)

async function checkEthernetStatus() {
  ethChecking.value = true
  try {
    const result = await api.get('/setup/ethernet-status')
    ethStatus.value = result || { available: false, carrier: false, ip: '' }
    if (ethStatus.value.ip) {
      emit('update:ethernetIp', ethStatus.value.ip)
    } else {
      emit('update:ethernetIp', '')
    }
  } catch {
    ethStatus.value = { available: false, carrier: false, ip: '' }
    emit('update:ethernetIp', '')
  } finally {
    ethChecking.value = false
  }
}

function startEthPolling() {
  stopEthPolling()
  checkEthernetStatus()
  ethPollTimer = setInterval(checkEthernetStatus, 3000)
}

function stopEthPolling() {
  if (ethPollTimer) {
    clearInterval(ethPollTimer)
    ethPollTimer = null
  }
}

watch(needsEthernetGate, (needs) => {
  if (needs) {
    startEthPolling()
  } else {
    stopEthPolling()
    emit('update:ethernetIp', '')
  }
}, { immediate: true })

onUnmounted(() => stopEthPolling())

// ─── Test Connection (Advanced profile) ───────────────────
const testing = ref(false)
const testResult = ref(null)

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const result = await api.post('/system/access-profile/test', {
      ext_npm_url: props.modelValue.ext_npm_url || '',
      ext_npm_token: props.modelValue.ext_npm_token || '',
      ext_pihole_url: props.modelValue.ext_pihole_url || '',
      ext_pihole_password: props.modelValue.ext_pihole_password || ''
    })
    testResult.value = result
  } catch (e) {
    testResult.value = { npm_ok: false, npm_error: e.message, pihole_ok: false, pihole_error: e.message }
  } finally {
    testing.value = false
  }
}

const profiles = [
  {
    id: 'standard',
    icon: 'Monitor',
    recommended: true
  },
  {
    id: 'advanced',
    icon: 'Link'
  },
  {
    id: 'all_in_one',
    icon: 'Radio'
  }
]
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">{{ t('wizard.steps.accessProfile.description') }}</p>

    <!-- Profile Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        @click="selectProfile(profile.id)"
        class="relative p-4 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selectedProfile === profile.id
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <!-- Radio indicator -->
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selectedProfile === profile.id ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div
              v-if="selectedProfile === profile.id"
              class="w-2.5 h-2.5 rounded-full bg-accent"
            ></div>
          </div>
          <div class="flex items-center gap-2">
            <Icon :name="profile.icon" :size="18" class="text-theme-secondary" />
            <span class="font-medium text-theme-primary">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.name`) }}</span>
          </div>
        </div>

        <p class="text-sm text-theme-secondary mb-2 ml-8">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.line1`) }}</p>
        <p class="text-sm text-theme-muted ml-8">{{ t(`wizard.steps.accessProfile.profiles.${profile.id}.line2`) }}</p>

        <!-- Recommended badge -->
        <div
          v-if="profile.recommended"
          class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium"
        >
          {{ t('wizard.steps.accessProfile.recommended') }}
        </div>
      </button>
    </div>

    <!-- Standard on Pi: Ethernet readiness gate -->
    <div
      v-if="needsEthernetGate"
      class="flex items-start gap-3 p-4 rounded-xl border"
      :class="[
        ethernetReady
          ? 'border-success/30 bg-success/5'
          : ethStatus.carrier
            ? 'border-accent/30 bg-accent/5'
            : 'border-warning/30 bg-warning-muted'
      ]"
    >
      <!-- No cable -->
      <template v-if="!ethStatus.available || !ethStatus.carrier">
        <Icon name="Cable" :size="20" class="text-warning flex-shrink-0 mt-0.5" />
        <div class="text-sm">
          <p class="font-medium text-warning mb-1">{{ t('wizard.steps.accessProfile.ethRequired') }}</p>
          <p class="text-theme-secondary">{{ t('wizard.steps.accessProfile.ethRequiredMessage') }}</p>
        </div>
      </template>
      <!-- Carrier but no IP yet -->
      <template v-else-if="!ethStatus.ip">
        <Icon name="Loader2" :size="20" class="text-accent flex-shrink-0 mt-0.5 animate-spin" />
        <div class="text-sm">
          <p class="font-medium text-accent mb-1">{{ t('wizard.steps.accessProfile.ethWaiting') }}</p>
          <p class="text-theme-secondary">{{ t('wizard.steps.accessProfile.ethWaitingMessage') }}</p>
        </div>
      </template>
      <!-- Ready -->
      <template v-else>
        <Icon name="CheckCircle" :size="20" class="text-success flex-shrink-0 mt-0.5" />
        <div class="text-sm">
          <p class="font-medium text-success mb-1">{{ t('wizard.steps.accessProfile.ethReady') }}</p>
          <p class="text-theme-secondary">
            {{ t('wizard.steps.accessProfile.ethReadyMessage', { ip: ethStatus.ip }) }}
          </p>
        </div>
      </template>
    </div>

    <!-- Advanced: credential fields -->
    <div
      v-if="selectedProfile === 'advanced'"
      class="space-y-4 p-4 rounded-xl border border-theme-primary bg-theme-secondary"
    >
      <div>
        <label for="ext-npm-url" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.npmUrl') }}</label>
        <input
          id="ext-npm-url"
          :value="modelValue.ext_npm_url"
          @input="update('ext_npm_url', $event.target.value)"
          type="url"
          placeholder="https://npm.yourdomain.com"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
      </div>

      <div>
        <label for="ext-npm-token" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.npmToken') }}</label>
        <input
          id="ext-npm-token"
          :value="modelValue.ext_npm_token"
          @input="update('ext_npm_token', $event.target.value)"
          type="password"
          placeholder="eyJ..."
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
      </div>

      <div>
        <label for="ext-pihole-url" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.piholeUrl') }}</label>
        <input
          id="ext-pihole-url"
          :value="modelValue.ext_pihole_url"
          @input="update('ext_pihole_url', $event.target.value)"
          type="url"
          placeholder="http://192.168.1.2"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
      </div>

      <div>
        <label for="ext-pihole-pass" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.accessProfile.piholePassword') }}</label>
        <input
          id="ext-pihole-pass"
          :value="modelValue.ext_pihole_password"
          @input="update('ext_pihole_password', $event.target.value)"
          type="password"
          placeholder="Pi-hole admin password"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
      </div>

      <!-- Test Connection -->
      <div class="pt-2">
        <button
          @click="testConnection"
          :disabled="testing || !modelValue.ext_npm_url"
          class="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon v-if="testing" name="Loader2" :size="16" class="animate-spin" />
          <Icon v-else name="Plug" :size="16" />
          {{ t('wizard.steps.accessProfile.testConnection') }}
        </button>

        <!-- Test results -->
        <div v-if="testResult" class="mt-3 space-y-1.5">
          <div class="flex items-center gap-2 text-sm">
            <Icon
              :name="testResult.npm_ok ? 'CheckCircle' : 'XCircle'"
              :size="16"
              :class="testResult.npm_ok ? 'text-success' : 'text-error'"
            />
            <span :class="testResult.npm_ok ? 'text-success' : 'text-error'">
              NPM: {{ testResult.npm_ok ? t('wizard.steps.accessProfile.reachable') : t('wizard.steps.accessProfile.unreachable') }}
              <span v-if="testResult.npm_version" class="text-theme-muted">(v{{ testResult.npm_version }})</span>
              <span v-if="!testResult.npm_ok && testResult.npm_error" class="text-theme-muted"> — {{ testResult.npm_error }}</span>
            </span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <Icon
              :name="testResult.pihole_ok ? 'CheckCircle' : 'XCircle'"
              :size="16"
              :class="testResult.pihole_ok ? 'text-success' : 'text-error'"
            />
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
    <div
      v-if="selectedProfile === 'all_in_one'"
      class="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning-muted"
    >
      <Icon name="AlertTriangle" :size="20" class="text-warning flex-shrink-0 mt-0.5" />
      <div class="text-sm">
        <p class="font-medium text-warning mb-1">{{ t('wizard.steps.accessProfile.aioWarningTitle') }}</p>
        <p class="text-theme-secondary">{{ t('wizard.steps.accessProfile.aioWarningMessage') }}</p>
      </div>
    </div>
  </div>
</template>
