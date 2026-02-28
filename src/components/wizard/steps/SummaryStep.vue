<script setup>
/**
 * SummaryStep.vue — Wizard final step
 *
 * Displays configuration summary before applying.
 * For Standard profile on Pi: shows Ethernet IP and AP teardown notice.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const props = defineProps({
  config: { type: Object, required: true },
  ethernetIp: { type: String, default: '' },
  skipApStep: { type: Boolean, default: true }
})

const isStandardOnPi = computed(() =>
  props.config.access_profile === 'standard' && !props.skipApStep && props.ethernetIp
)

const dashboardUrl = computed(() => {
  if (isStandardOnPi.value) {
    return `http://${props.ethernetIp}:6011`
  }
  return `http://${window.location.hostname}:${window.location.port || '6011'}`
})
</script>

<template>
  <div class="text-center py-8">
    <div class="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
      <Icon name="CheckCircle" :size="40" class="text-success" />
    </div>
    <h1 class="text-2xl font-bold text-theme-primary mb-3">{{ t('wizard.steps.summary.heading') }}</h1>
    <p class="text-theme-secondary mb-6 max-w-md mx-auto">
      {{ t('wizard.steps.summary.description') }}
    </p>

    <!-- Standard on Pi: Ethernet transition notice -->
    <div
      v-if="isStandardOnPi"
      class="flex items-start gap-3 p-4 rounded-xl border border-accent/30 bg-accent/5 mb-6 text-left max-w-sm mx-auto"
    >
      <Icon name="Cable" :size="20" class="text-accent flex-shrink-0 mt-0.5" />
      <div class="text-sm">
        <p class="font-medium text-accent mb-1">{{ t('wizard.steps.summary.ethTransitionTitle') }}</p>
        <p class="text-theme-secondary">
          {{ t('wizard.steps.summary.ethTransitionMessage', { url: dashboardUrl }) }}
        </p>
      </div>
    </div>

    <!-- Summary -->
    <div class="bg-theme-secondary rounded-xl p-4 text-left max-w-sm mx-auto">
      <h3 class="text-sm font-medium text-theme-primary mb-3">{{ t('wizard.steps.summary.configSummary') }}</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.admin') }}</span>
          <span class="text-theme-primary">{{ config.admin_username }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.hostname') }}</span>
          <span class="text-theme-primary">{{ config.hostname }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.dashboardUrl') }}</span>
          <span class="text-theme-primary font-mono text-xs">{{ dashboardUrl }}</span>
        </div>
        <div v-if="config.access_profile === 'all_in_one'" class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.wifiSsid') }}</span>
          <span class="text-theme-primary">{{ config.wifi_ssid }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.profile') }}</span>
          <span class="text-theme-primary capitalize">{{ config.access_profile?.replace('_', '-') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.region') }}</span>
          <span class="text-theme-primary">{{ config.country_code || 'NL' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.timezone') }}</span>
          <span class="text-theme-primary">{{ config.timezone }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.language') }}</span>
          <span class="text-theme-primary uppercase">{{ config.language }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
