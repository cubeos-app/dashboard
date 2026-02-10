<script setup>
/**
 * DeviceStep.vue — Wizard Step 3
 *
 * Set hostname and friendly display name.
 */

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
    <p class="text-theme-secondary mb-6">Give your device a name for easy identification on your network.</p>

    <div class="space-y-4">
      <div>
        <label for="device-hostname" class="block text-sm font-medium text-theme-primary mb-1.5">Hostname</label>
        <input
          id="device-hostname"
          :value="modelValue.hostname"
          @input="update('hostname', $event.target.value)"
          type="text"
          placeholder="cubeos"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p class="text-xs text-theme-muted mt-1">
          Network hostname (e.g., <code class="text-accent">{{ modelValue.hostname || 'cubeos' }}.cube</code>)
        </p>
      </div>

      <div>
        <label for="device-display-name" class="block text-sm font-medium text-theme-primary mb-1.5">Display Name</label>
        <input
          id="device-display-name"
          :value="modelValue.device_name"
          @input="update('device_name', $event.target.value)"
          type="text"
          placeholder="CubeOS Server"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <p class="text-xs text-theme-muted mt-1">Friendly name shown in the dashboard</p>
      </div>
    </div>
  </div>
</template>
