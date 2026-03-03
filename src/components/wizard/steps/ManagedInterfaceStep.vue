<script setup>
/**
 * ManagedInterfaceStep.vue — Phase 12: All-in-One interface selector
 *
 * Two cards: WiFi Access Point / Wired LAN (Ethernet)
 * Shown only when access_profile === 'all_in_one' and both WiFi + Ethernet are detected.
 */
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  capabilities: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const selected = computed(() => props.modelValue.managed_interface || '')

function select(iface) {
  update('managed_interface', iface)
}

const wifiAvailable = computed(() => props.capabilities?.wifi_detected !== false)
const ethAvailable = computed(() => props.capabilities?.eth_detected !== false)
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">
      All-in-One mode manages DNS, DHCP, and reverse proxy for your apps.
      Choose which network interface CubeOS should manage.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <!-- WiFi Access Point card -->
      <button
        v-if="wifiAvailable"
        @click="select('wifi')"
        class="relative p-5 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selected === 'wifi'
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selected === 'wifi' ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div v-if="selected === 'wifi'" class="w-2.5 h-2.5 rounded-full bg-accent"></div>
          </div>
          <Icon name="Wifi" :size="20" class="text-theme-secondary" />
          <span class="font-medium text-theme-primary">WiFi Access Point</span>
        </div>
        <p class="text-sm text-theme-secondary ml-8 mb-1">
          CubeOS creates a WiFi hotspot that devices connect to directly.
        </p>
        <p class="text-xs text-theme-muted ml-8">
          Best for portable setups, field deployments, and Raspberry Pi.
        </p>
      </button>

      <!-- Wired LAN (Ethernet) card -->
      <button
        v-if="ethAvailable"
        @click="select('ethernet')"
        class="relative p-5 rounded-xl border-2 text-left transition-all duration-200"
        :class="[
          selected === 'ethernet'
            ? 'border-accent bg-accent/5 shadow-theme-md'
            : 'border-theme-primary bg-theme-card hover:border-theme-secondary hover:shadow-theme-sm'
        ]"
      >
        <div class="flex items-center gap-3 mb-3">
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            :class="selected === 'ethernet' ? 'border-accent' : 'border-theme-tertiary'"
          >
            <div v-if="selected === 'ethernet'" class="w-2.5 h-2.5 rounded-full bg-accent"></div>
          </div>
          <Icon name="Cable" :size="20" class="text-theme-secondary" />
          <span class="font-medium text-theme-primary">Wired LAN (Ethernet)</span>
        </div>
        <p class="text-sm text-theme-secondary ml-8 mb-1">
          CubeOS serves DHCP and DNS on the Ethernet port. No WiFi AP needed.
        </p>
        <p class="text-xs text-theme-muted ml-8">
          Best for NUCs, x86 servers, and setups without WiFi.
        </p>
      </button>
    </div>

    <!-- DHCP conflict warning for Ethernet -->
    <div
      v-if="selected === 'ethernet'"
      class="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning-muted"
    >
      <Icon name="AlertTriangle" :size="20" class="text-warning flex-shrink-0 mt-0.5" />
      <div class="text-sm">
        <p class="font-medium text-warning mb-1">DHCP Conflict Warning</p>
        <p class="text-theme-secondary">
          CubeOS will serve DHCP on Ethernet. If your network already has a DHCP server
          (e.g. a home router), this will cause IP address conflicts.
          Only use this on an isolated network segment.
        </p>
      </div>
    </div>
  </div>
</template>
