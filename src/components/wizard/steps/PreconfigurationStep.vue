<script setup>
/**
 * PreconfigurationStep.vue — Wizard step for pre-configured settings
 *
 * Shown when CubeOS detects settings from Pi Imager, Armbian, custom.toml, or LXC.
 * Displays detected settings and confirms them before proceeding.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const props = defineProps({
  preconfiguration: { type: Object, required: true }
})

const sourceLabel = computed(() => {
  const labels = {
    'cloud-init': 'Raspberry Pi Imager',
    'armbian': 'Armbian',
    'custom-toml': 'custom.toml',
    'lxc': 'Proxmox LXC'
  }
  return labels[props.preconfiguration.source] || props.preconfiguration.source
})

const hasWifi = computed(() => !!props.preconfiguration.wifi?.ssid)
const wifiConnectFailed = computed(() => !!props.preconfiguration.wifi_connect_failed)

const networkModeLabel = computed(() => {
  const modes = {
    wifi_client: 'WiFi Client',
    eth_client: 'Ethernet',
    wifi_router: 'Access Point'
  }
  return modes[props.preconfiguration.network_mode_hint] || props.preconfiguration.network_mode_hint
})
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <div class="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
        <Icon name="Settings2" :size="28" class="text-accent" />
      </div>
      <h2 class="text-xl font-semibold text-theme-primary">
        {{ t('wizard.steps.preconfiguration.heading') }}
      </h2>
      <p class="mt-2 text-sm text-theme-secondary">
        {{ t('wizard.steps.preconfiguration.description', { source: sourceLabel }) }}
      </p>
    </div>

    <div class="rounded-xl border border-theme-primary divide-y divide-theme-primary bg-theme-secondary">
      <div v-if="preconfiguration.hostname" class="flex justify-between px-4 py-3">
        <span class="text-sm text-theme-muted">{{ t('wizard.steps.preconfiguration.hostname') }}</span>
        <span class="text-sm font-medium text-theme-primary">{{ preconfiguration.hostname }}</span>
      </div>

      <div v-if="hasWifi" class="flex justify-between px-4 py-3">
        <span class="text-sm text-theme-muted">{{ t('wizard.steps.preconfiguration.wifiNetwork') }}</span>
        <span class="text-sm font-medium text-theme-primary">{{ preconfiguration.wifi.ssid }}</span>
      </div>

      <div v-if="preconfiguration.timezone" class="flex justify-between px-4 py-3">
        <span class="text-sm text-theme-muted">{{ t('wizard.steps.preconfiguration.timezone') }}</span>
        <span class="text-sm font-medium text-theme-primary">{{ preconfiguration.timezone }}</span>
      </div>

      <div v-if="preconfiguration.users?.length" class="flex justify-between px-4 py-3">
        <span class="text-sm text-theme-muted">{{ t('wizard.steps.preconfiguration.adminUser') }}</span>
        <span class="text-sm font-medium text-theme-primary">
          {{ preconfiguration.users.map(u => u.name).join(', ') }}
        </span>
      </div>

      <div class="flex justify-between px-4 py-3">
        <span class="text-sm text-theme-muted">{{ t('wizard.steps.preconfiguration.networkMode') }}</span>
        <span class="text-sm font-medium text-theme-primary">{{ networkModeLabel }}</span>
      </div>
    </div>

    <div v-if="wifiConnectFailed" class="rounded-xl bg-warning/10 border border-warning/30 p-4">
      <div class="flex items-start gap-3">
        <Icon name="AlertTriangle" :size="18" class="text-warning mt-0.5 shrink-0" />
        <p class="text-sm text-warning">
          {{ t('wizard.steps.preconfiguration.wifiFailed', { ssid: preconfiguration.wifi?.ssid }) }}
        </p>
      </div>
    </div>

    <div v-else-if="hasWifi" class="rounded-xl bg-success/10 border border-success/30 p-4">
      <div class="flex items-start gap-3">
        <Icon name="CheckCircle" :size="18" class="text-success mt-0.5 shrink-0" />
        <p class="text-sm text-success">
          {{ t('wizard.steps.preconfiguration.wifiConnected', { hostname: preconfiguration.hostname || 'cubeos' }) }}
        </p>
      </div>
    </div>
  </div>
</template>
