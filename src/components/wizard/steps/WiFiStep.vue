<script setup>
/**
 * WiFiStep.vue — Wizard Step 4
 *
 * Configure WiFi access point: SSID, password, channel, country code.
 */

const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

// ISO 3166-1 alpha-2 country codes for WiFi regulatory domains.
// Common choices first, then alphabetical.
const COUNTRY_CODES = [
  { code: 'NL', label: 'Netherlands' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'JP', label: 'Japan' },
  { code: '——', label: '──────────', disabled: true },
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CN', label: 'China' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'ES', label: 'Spain' },
  { code: 'FI', label: 'Finland' },
  { code: 'GR', label: 'Greece' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IL', label: 'Israel' },
  { code: 'IN', label: 'India' },
  { code: 'IT', label: 'Italy' },
  { code: 'KR', label: 'South Korea' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NO', label: 'Norway' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RO', label: 'Romania' },
  { code: 'RU', label: 'Russia' },
  { code: 'SE', label: 'Sweden' },
  { code: 'SG', label: 'Singapore' },
  { code: 'TH', label: 'Thailand' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'ZA', label: 'South Africa' },
]
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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <p class="text-xs text-theme-muted mt-1">1, 6, or 11 have least interference</p>
        </div>

        <div>
          <label for="wifi-country" class="block text-sm font-medium text-theme-primary mb-1.5">Country / Region</label>
          <select
            id="wifi-country"
            :value="modelValue.country_code"
            @change="update('country_code', $event.target.value)"
            class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent"
          >
            <option
              v-for="country in COUNTRY_CODES"
              :key="country.code"
              :value="country.code"
              :disabled="country.disabled"
            >
              {{ country.label }} ({{ country.code }})
            </option>
          </select>
          <p class="text-xs text-theme-muted mt-1">Required for WiFi regulatory compliance</p>
        </div>
      </div>
    </div>
  </div>
</template>
