<script setup>
/**
 * DNSTab.vue — S06 Component
 *
 * Advanced only. DNS upstream server configuration.
 * Extracted from NetworkView DNS tab.
 *
 * Store: network.js (fetchDNS, saveDNS, primaryDNS, secondaryDNS)
 * Emits: refresh
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNetworkStore } from '@/stores/network'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const emit = defineEmits(['refresh'])

const networkStore = useNetworkStore()

// ─── Offline mode awareness (B36) ─────────────────────────
const isOffline = computed(() => {
  const mode = (networkStore.networkMode?.mode || networkStore.status?.mode || '').toLowerCase()
  return mode === 'offline_hotspot' || mode === ''
})

// ─── State ───────────────────────────────────────────────────
const dnsLoading = ref(false)
const dnsPrimary = ref('')
const dnsSecondary = ref('')
const dnsSaveSuccess = ref(false)
let dnsSaveTimeout = null

// ─── Load ────────────────────────────────────────────────────
async function loadDNS() {
  dnsLoading.value = true
  try {
    await networkStore.fetchDNS()
    dnsPrimary.value = networkStore.primaryDNS
    dnsSecondary.value = networkStore.secondaryDNS
  } finally {
    dnsLoading.value = false
  }
}

// ─── Save ────────────────────────────────────────────────────
async function saveDNS() {
  dnsLoading.value = true
  dnsSaveSuccess.value = false
  try {
    const success = await networkStore.saveDNS({
      primary_dns: dnsPrimary.value,
      secondary_dns: dnsSecondary.value
    })
    if (success) {
      dnsSaveSuccess.value = true
      if (dnsSaveTimeout) clearTimeout(dnsSaveTimeout)
      dnsSaveTimeout = setTimeout(() => { dnsSaveSuccess.value = false }, 3000)
      emit('refresh')
    }
  } finally {
    dnsLoading.value = false
  }
}

onMounted(() => {
  loadDNS()
})

onUnmounted(() => {
  if (dnsSaveTimeout) clearTimeout(dnsSaveTimeout)
})
</script>

<template>
  <div class="space-y-6">
    <div class="bg-theme-card rounded-xl border border-theme-primary p-4 sm:p-6">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Globe" :size="20" class="text-accent" />
        </div>
        <div>
          <h3 class="font-semibold text-theme-primary">{{ $t('network.dnsConfig.title') }}</h3>
          <p class="text-sm text-theme-muted">{{ $t('network.dnsConfig.subtitle') }}</p>
        </div>
      </div>

      <div class="space-y-4 max-w-lg">
        <!-- Primary DNS -->
        <div>
          <label for="dns-primary" class="block text-sm font-medium text-theme-secondary mb-1.5">{{ $t('network.dnsConfig.primaryServer') }}</label>
          <input
            id="dns-primary"
            v-model="dnsPrimary"
            type="text"
            :placeholder="$t('network.dnsConfig.primaryPlaceholder')"
            class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary placeholder-theme-muted focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono"
          >
        </div>

        <!-- Secondary DNS -->
        <div>
          <label for="dns-secondary" class="block text-sm font-medium text-theme-secondary mb-1.5">{{ $t('network.dnsConfig.secondaryServer') }}</label>
          <input
            id="dns-secondary"
            v-model="dnsSecondary"
            type="text"
            :placeholder="$t('network.dnsConfig.secondaryPlaceholder')"
            class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary placeholder-theme-muted focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent font-mono"
          >
        </div>

        <!-- Pi-hole indicator -->
        <div class="flex items-center gap-2 p-3 bg-theme-secondary rounded-lg text-sm">
          <Icon name="Info" :size="16" class="text-theme-muted shrink-0" />
          <p class="text-theme-muted">{{ $t('network.dnsConfig.piholeInfo') }}</p>
        </div>

        <!-- Offline mode warning (B36) -->
        <div v-if="isOffline" class="flex items-center gap-2 p-3 bg-warning-muted rounded-lg text-sm">
          <Icon name="WifiOff" :size="16" class="text-warning shrink-0" />
          <p class="text-warning">{{ $t('network.dnsConfig.offlineWarning') }}</p>
        </div>

        <!-- Save button -->
        <div class="flex items-center gap-3">
          <button
            @click="saveDNS"
            :disabled="dnsLoading"
            class="px-4 py-2 btn-accent rounded-lg hover:bg-[color:var(--accent-hover)] disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            <Icon v-if="dnsLoading" name="Loader2" :size="16" class="animate-spin" />
            {{ $t('network.dnsConfig.saveSettings') }}
          </button>
          <span v-if="dnsSaveSuccess" class="text-success text-sm flex items-center gap-1">
            <Icon name="Check" :size="16" />
            {{ $t('common.saved') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
