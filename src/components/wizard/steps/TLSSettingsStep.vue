<script setup>
/**
 * TLSSettingsStep.vue — Phase 12: TLS mode selector for All-in-One profile
 *
 * Three cards: Plain HTTP (default) / Let's Encrypt / Self-signed CA
 * Conditional fields expand when Let's Encrypt is selected.
 */
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const selected = computed(() => props.modelValue.tls_mode || 'http')

function select(mode) {
  update('tls_mode', mode)
}

const dnsProviders = [
  { value: 'cloudflare', label: 'Cloudflare' },
  { value: 'duckdns', label: 'DuckDNS' },
  { value: 'route53', label: 'AWS Route 53' },
  { value: 'digitalocean', label: 'DigitalOcean' }
]
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">
      Choose how HTTPS certificates are handled for your apps.
      This affects all reverse-proxied app domains.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <!-- Plain HTTP -->
      <button
        @click="select('http')"
        class="relative p-4 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selected === 'http'
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selected === 'http' ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div v-if="selected === 'http'" class="w-2.5 h-2.5 rounded-full bg-accent"></div>
          </div>
          <Icon name="Globe" :size="18" class="text-theme-secondary" />
          <span class="font-medium text-theme-primary">Plain HTTP</span>
        </div>
        <p class="text-sm text-theme-secondary ml-8">No HTTPS — apps accessed over HTTP only.</p>
        <p class="text-xs text-theme-muted ml-8 mt-1">Simplest option. Fine for local networks.</p>
        <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
          Default
        </div>
      </button>

      <!-- Let's Encrypt -->
      <button
        @click="select('letsencrypt')"
        class="relative p-4 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selected === 'letsencrypt'
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selected === 'letsencrypt' ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div v-if="selected === 'letsencrypt'" class="w-2.5 h-2.5 rounded-full bg-accent"></div>
          </div>
          <Icon name="Shield" :size="18" class="text-theme-secondary" />
          <span class="font-medium text-theme-primary">Let's Encrypt</span>
        </div>
        <p class="text-sm text-theme-secondary ml-8">Free, trusted HTTPS via DNS challenge.</p>
        <p class="text-xs text-theme-muted ml-8 mt-1">Requires a domain and DNS API access.</p>
      </button>

      <!-- Self-signed CA -->
      <button
        @click="select('self_signed_ca')"
        class="relative p-4 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selected === 'self_signed_ca'
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selected === 'self_signed_ca' ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div v-if="selected === 'self_signed_ca'" class="w-2.5 h-2.5 rounded-full bg-accent"></div>
          </div>
          <Icon name="Lock" :size="18" class="text-theme-secondary" />
          <span class="font-medium text-theme-primary">Self-signed CA</span>
        </div>
        <p class="text-sm text-theme-secondary ml-8">CubeOS generates its own CA certificate.</p>
        <p class="text-xs text-theme-muted ml-8 mt-1">HTTPS everywhere, but devices need the CA installed.</p>
      </button>
    </div>

    <!-- Let's Encrypt config fields -->
    <div
      v-if="selected === 'letsencrypt'"
      class="space-y-4 p-4 rounded-xl border border-theme-primary bg-theme-secondary"
    >
      <div>
        <label class="block text-sm font-medium text-theme-primary mb-1.5">Domain</label>
        <input
          :value="modelValue.le_domain"
          @input="update('le_domain', $event.target.value)"
          type="text"
          placeholder="home.example.com"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
        <p class="text-xs text-theme-muted mt-1">Apps will be accessible at appname.home.example.com</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-theme-primary mb-1.5">DNS Provider</label>
        <select
          :value="modelValue.le_dns_provider"
          @change="update('le_dns_provider', $event.target.value)"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
        >
          <option value="">Select a DNS provider...</option>
          <option v-for="p in dnsProviders" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-theme-primary mb-1.5">DNS API Token</label>
        <input
          :value="modelValue.le_dns_token"
          @input="update('le_dns_token', $event.target.value)"
          type="password"
          placeholder="API token for DNS provider"
          class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-sm"
        />
      </div>
    </div>

    <!-- Self-signed CA info -->
    <div
      v-if="selected === 'self_signed_ca'"
      class="flex items-start gap-3 p-4 rounded-xl border border-accent/30 bg-accent/5"
    >
      <Icon name="Info" :size="20" class="text-accent flex-shrink-0 mt-0.5" />
      <div class="text-sm">
        <p class="font-medium text-accent mb-1">CA Certificate Required</p>
        <p class="text-theme-secondary">
          After setup, you'll need to download and install the CubeOS CA certificate
          on each device that accesses your apps. This is available in Settings after setup completes.
        </p>
      </div>
    </div>
  </div>
</template>
