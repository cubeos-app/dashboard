<script setup>
/**
 * WelcomeStep.vue — Wizard Step 1
 *
 * Displays CubeOS branding, detected system info, and skip option.
 * B38: Shows swap/ZRAM info from system stats.
 * B39: Device model resolved via /system/info fallback in parent.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const props = defineProps({
  requirements: { type: Object, default: () => ({}) },
  systemStats: { type: Object, default: null }
})

defineEmits(['skip'])

// B38+B10: Format swap/ZRAM info
// Primary: system stats (has used + total in bytes)
// Fallback: requirements (has swap_total_mb + swap_configured from HAL)
const swapInfo = computed(() => {
  // Try system stats first (more detailed — has usage info)
  if (props.systemStats) {
    const total = props.systemStats.swap_total || 0
    if (total > 0) {
      const used = props.systemStats.swap_used || 0
      const totalMB = Math.round(total / 1024 / 1024)
      const usedMB = Math.round(used / 1024 / 1024)
      return `${usedMB} / ${totalMB} MB`
    }
  }
  // Fallback to requirements (swap_total_mb from setup endpoint)
  if (props.requirements?.swap_configured && props.requirements.swap_total_mb > 0) {
    return `${props.requirements.swap_total_mb} MB`
  }
  return null
})
</script>

<template>
  <div class="text-center py-8">
    <div class="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
      <img src="/icon.svg" alt="CubeOS" class="w-10 h-10" />
    </div>
    <h1 class="text-2xl font-bold text-theme-primary mb-3">{{ t('wizard.steps.welcome.heading') }}</h1>
    <p class="text-theme-secondary mb-6 max-w-md mx-auto">
      {{ t('wizard.steps.welcome.description') }}
    </p>

    <!-- System Info -->
    <div v-if="requirements" class="bg-theme-secondary rounded-xl p-4 text-left max-w-sm mx-auto">
      <h3 class="text-sm font-medium text-theme-primary mb-3">{{ t('wizard.steps.welcome.systemDetected') }}</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.device') }}</span>
          <span class="text-theme-primary">{{ requirements.device_model || t('wizard.steps.welcome.detecting') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.ram') }}</span>
          <span class="text-theme-primary">{{ requirements.total_ram_mb || 0 }} MB</span>
        </div>
        <!-- B36: Swap/ZRAM directly under RAM for logical memory grouping -->
        <div v-if="swapInfo" class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.swapZram') }}</span>
          <span class="text-theme-primary">{{ swapInfo }}</span>
        </div>
        <div v-else class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.swapZram') }}</span>
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.notConfigured') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.cpuCores') }}</span>
          <span class="text-theme-primary">{{ requirements.cpu_cores || 0 }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-theme-muted">{{ t('wizard.steps.welcome.wifi') }}</span>
          <span :class="requirements.has_wifi ? 'text-success' : 'text-warning'">
            {{ requirements.has_wifi ? t('wizard.steps.welcome.wifiAvailable') : t('wizard.steps.welcome.wifiNotDetected') }}
          </span>
        </div>
      </div>
    </div>

    <button
      @click="$emit('skip')"
      aria-label="Skip setup wizard and use default settings"
      class="mt-6 text-sm text-theme-muted hover:text-theme-secondary transition-colors underline"
    >
      {{ t('wizard.skipDefault') }}
    </button>
  </div>
</template>
