<script setup>
/**
 * WiFiStep.vue — Wizard Step 4
 *
 * Configure WiFi access point: SSID, password, channel.
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
    <p class="text-theme-secondary mb-6">Configure the WiFi access point that clients will connect to.</p>

    <div class="space-y-4">
      <div>
        <label for="wifi-ssid" class="block text-sm font-medium text-theme-primary mb-1.5">Network Name (SSID)</label>
        <input
          id="wifi-ssid"
          :value="modelValue.wifi_ssid"
          @input="update('wifi_ssid', $event.target.value)"
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
          :value="modelValue.wifi_password"
          @input="update('wifi_password', $event.target.value)"
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
          :value="modelValue.wifi_channel"
          @change="update('wifi_channel', Number($event.target.value))"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
        >
          <option v-for="ch in [1,2,3,4,5,6,7,8,9,10,11]" :key="ch" :value="ch">
            Channel {{ ch }}{{ ch === 6 ? ' (recommended)' : '' }}
          </option>
        </select>
        <p class="text-xs text-theme-muted mt-1">Channels 1, 6, or 11 typically have least interference</p>
      </div>
    </div>
  </div>
</template>
