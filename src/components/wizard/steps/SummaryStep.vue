<script setup>
/**
 * SummaryStep.vue — Wizard Step 6
 *
 * Displays configuration summary before applying.
 */
import { useI18n } from 'vue-i18n'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

defineProps({
  config: { type: Object, required: true }
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
          <span class="text-theme-primary">{{ config.hostname }}.cube</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.dashboardUrl') }}</span>
          <span class="text-theme-primary font-mono text-xs">https://{{ config.hostname }}.cube</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.summary.wifiSsid') }}</span>
          <span class="text-theme-primary">{{ config.wifi_ssid }}</span>
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
