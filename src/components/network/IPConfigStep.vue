<script setup>
/**
 * IPConfigStep.vue — Batch 4 / T18
 *
 * DHCP vs Static IP toggle with validated IPv4 fields.
 * Used inside NetworkConfigDialog for all 4 client modes.
 *
 * Props:
 *   - mode: the target network mode (determines DNS defaults)
 *   - modelValue: the current IP config object (v-model)
 *
 * Emits:
 *   - update:modelValue — reactive two-way binding
 */
import { computed, watch } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  mode: {
    type: String,
    required: true
  },
  modelValue: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

// Determine whether this is an AP mode (DNS default → Pi-hole) or server mode (DNS default → public)
const isAPMode = computed(() => props.mode === 'online_eth' || props.mode === 'online_wifi')
const defaultDNS = computed(() => isAPMode.value ? '10.42.24.1' : '1.1.1.1')

// Two-way binding helper
function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function toggleStatic(val) {
  const updated = { ...props.modelValue, useStaticIP: val }
  // Pre-fill sensible defaults when switching to static
  if (val) {
    if (!updated.netmask) updated.netmask = '255.255.255.0'
    if (!updated.dnsPrimary) updated.dnsPrimary = defaultDNS.value
  }
  emit('update:modelValue', updated)
}

// ── IPv4 Validation ──────────────────────────────────────────
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

function isValidIPv4(value) {
  if (!value) return false
  return ipv4Regex.test(value.trim())
}

function isValidNetmask(value) {
  if (!value) return false
  const v = value.trim()
  if (!ipv4Regex.test(v)) return false
  // Verify it's a valid netmask (contiguous 1-bits)
  const parts = v.split('.').map(Number)
  const num = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  if (num === 0) return false
  const inverted = (~num) >>> 0
  return (inverted & (inverted + 1)) === 0
}

// Per-field validation state
const validation = computed(() => {
  if (!props.modelValue.useStaticIP) {
    return { valid: true, ip: true, netmask: true, gateway: true, dnsPrimary: true, dnsSecondary: true }
  }

  const ip = isValidIPv4(props.modelValue.ip)
  const netmask = isValidNetmask(props.modelValue.netmask)
  const gateway = isValidIPv4(props.modelValue.gateway)
  const dnsPrimary = !props.modelValue.dnsPrimary || isValidIPv4(props.modelValue.dnsPrimary)
  const dnsSecondary = !props.modelValue.dnsSecondary || isValidIPv4(props.modelValue.dnsSecondary)

  return {
    valid: ip && netmask && gateway && dnsPrimary && dnsSecondary,
    ip,
    netmask,
    gateway,
    dnsPrimary,
    dnsSecondary
  }
})

// Expose validation to parent
defineExpose({ validation })

// Interface label for context
const interfaceLabel = computed(() => {
  switch (props.mode) {
    case 'online_eth': return 'eth0 (Ethernet uplink)'
    case 'online_wifi': return 'wlan1 (WiFi uplink)'
    case 'server_eth': return 'eth0 (Ethernet)'
    case 'server_wifi': return 'wlan0 (WiFi)'
    default: return 'upstream interface'
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Interface context -->
    <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary text-sm">
      <Icon name="Monitor" :size="16" class="text-theme-muted shrink-0" />
      <span class="text-theme-secondary">Configuring: <span class="font-medium text-theme-primary">{{ interfaceLabel }}</span></span>
    </div>

    <!-- DHCP / Static toggle -->
    <div class="grid grid-cols-2 gap-2">
      <button
        @click="toggleStatic(false)"
        :class="[
          'p-3 rounded-xl border-2 text-left transition-all duration-200',
          !modelValue.useStaticIP
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : 'border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary'
        ]"
      >
        <div class="flex items-center gap-2 mb-1">
          <Icon name="Zap" :size="16" :class="!modelValue.useStaticIP ? 'text-accent' : 'text-theme-muted'" />
          <span class="font-medium text-sm" :class="!modelValue.useStaticIP ? 'text-accent' : 'text-theme-primary'">DHCP</span>
        </div>
        <p class="text-xs text-theme-tertiary">Automatic IP assignment</p>
      </button>

      <button
        @click="toggleStatic(true)"
        :class="[
          'p-3 rounded-xl border-2 text-left transition-all duration-200',
          modelValue.useStaticIP
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : 'border-theme-primary hover:border-theme-secondary hover:bg-theme-tertiary'
        ]"
      >
        <div class="flex items-center gap-2 mb-1">
          <Icon name="PenTool" :size="16" :class="modelValue.useStaticIP ? 'text-accent' : 'text-theme-muted'" />
          <span class="font-medium text-sm" :class="modelValue.useStaticIP ? 'text-accent' : 'text-theme-primary'">Static IP</span>
        </div>
        <p class="text-xs text-theme-tertiary">Manual configuration</p>
      </button>
    </div>

    <!-- Static IP fields (shown only when static is selected) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="modelValue.useStaticIP" class="space-y-3">
        <!-- IP Address -->
        <div>
          <label class="block text-xs font-medium text-theme-secondary mb-1.5">
            IP Address <span class="text-error">*</span>
          </label>
          <input
            :value="modelValue.ip"
            @input="update('ip', $event.target.value)"
            type="text"
            placeholder="e.g. 192.168.1.100"
            inputmode="decimal"
            class="w-full px-3 py-2 rounded-lg border bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            :class="modelValue.ip && !validation.ip ? 'border-error' : 'border-theme-primary focus:border-accent'"
          />
          <p v-if="modelValue.ip && !validation.ip" class="text-xs text-error mt-1">
            Enter a valid IPv4 address
          </p>
        </div>

        <!-- Subnet Mask -->
        <div>
          <label class="block text-xs font-medium text-theme-secondary mb-1.5">
            Subnet Mask <span class="text-error">*</span>
          </label>
          <input
            :value="modelValue.netmask"
            @input="update('netmask', $event.target.value)"
            type="text"
            placeholder="255.255.255.0"
            inputmode="decimal"
            class="w-full px-3 py-2 rounded-lg border bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            :class="modelValue.netmask && !validation.netmask ? 'border-error' : 'border-theme-primary focus:border-accent'"
          />
          <p v-if="modelValue.netmask && !validation.netmask" class="text-xs text-error mt-1">
            Enter a valid subnet mask
          </p>
        </div>

        <!-- Gateway -->
        <div>
          <label class="block text-xs font-medium text-theme-secondary mb-1.5">
            Gateway <span class="text-error">*</span>
          </label>
          <input
            :value="modelValue.gateway"
            @input="update('gateway', $event.target.value)"
            type="text"
            placeholder="e.g. 192.168.1.1"
            inputmode="decimal"
            class="w-full px-3 py-2 rounded-lg border bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            :class="modelValue.gateway && !validation.gateway ? 'border-error' : 'border-theme-primary focus:border-accent'"
          />
          <p v-if="modelValue.gateway && !validation.gateway" class="text-xs text-error mt-1">
            Enter a valid gateway address
          </p>
        </div>

        <!-- DNS (side by side) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-theme-secondary mb-1.5">
              Primary DNS
            </label>
            <input
              :value="modelValue.dnsPrimary"
              @input="update('dnsPrimary', $event.target.value)"
              type="text"
              :placeholder="defaultDNS"
              inputmode="decimal"
              class="w-full px-3 py-2 rounded-lg border bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              :class="modelValue.dnsPrimary && !validation.dnsPrimary ? 'border-error' : 'border-theme-primary focus:border-accent'"
            />
            <p v-if="modelValue.dnsPrimary && !validation.dnsPrimary" class="text-xs text-error mt-1">
              Invalid DNS address
            </p>
          </div>
          <div>
            <label class="block text-xs font-medium text-theme-secondary mb-1.5">
              Secondary DNS
            </label>
            <input
              :value="modelValue.dnsSecondary"
              @input="update('dnsSecondary', $event.target.value)"
              type="text"
              placeholder="optional"
              inputmode="decimal"
              class="w-full px-3 py-2 rounded-lg border bg-theme-input text-theme-primary placeholder-theme-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              :class="modelValue.dnsSecondary && !validation.dnsSecondary ? 'border-error' : 'border-theme-primary focus:border-accent'"
            />
            <p v-if="modelValue.dnsSecondary && !validation.dnsSecondary" class="text-xs text-error mt-1">
              Invalid DNS address
            </p>
          </div>
        </div>

        <p class="text-xs text-theme-muted">
          DNS defaults to {{ isAPMode ? 'Pi-hole (10.42.24.1)' : '1.1.1.1 / 8.8.8.8' }} if left empty.
        </p>
      </div>
    </Transition>

    <!-- DHCP info note -->
    <div v-if="!modelValue.useStaticIP" class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent/5 text-sm">
      <Icon name="Info" :size="16" class="text-accent shrink-0 mt-0.5" />
      <p class="text-theme-secondary">
        The interface will obtain an IP address automatically from your network's DHCP server.
      </p>
    </div>
  </div>
</template>
