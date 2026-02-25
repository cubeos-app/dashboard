<script setup>
/**
 * DeviceStep.vue — Wizard Step 3
 *
 * Set hostname and friendly display name.
 */

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">{{ t('wizard.steps.device.description') }}</p>

    <div class="space-y-4">
      <div>
        <label for="device-hostname" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.device.hostname') }}</label>
        <input
          id="device-hostname"
          :value="modelValue.hostname"
          @input="update('hostname', $event.target.value)"
          type="text"
          :placeholder="t('wizard.steps.device.hostnamePlaceholder')"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p class="text-xs text-theme-muted mt-1">
          {{ t('wizard.steps.device.hostnameHelp', { hostname: modelValue.hostname || 'cubeos' }) }}
        </p>
        <p class="mt-1 text-xs text-theme-muted">
          {{ t('wizard.steps.device.hostnameReboot') }}
        </p>
      </div>

      <div>
        <label for="device-display-name" class="block text-sm font-medium text-theme-primary mb-1.5">{{ t('wizard.steps.device.displayName') }}</label>
        <input
          id="device-display-name"
          :value="modelValue.device_name"
          @input="update('device_name', $event.target.value)"
          type="text"
          :placeholder="t('wizard.steps.device.displayNamePlaceholder')"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p class="text-xs text-theme-muted mt-1">{{ t('wizard.steps.device.displayNameHelp') }}</p>
      </div>
    </div>
  </div>
</template>
