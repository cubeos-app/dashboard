<script setup>
/**
 * TempGaugeWidget.vue — Session 7
 *
 * Standalone Temperature gauge widget extracted from the DashboardAdvanced gauges section.
 * Shows CPU temperature as a circular ring via StatusCard with custom thresholds.
 *
 * Available in both Standard and Advanced modes via unified WIDGET_REGISTRY.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import StatusCard from './StatusCard.vue'

const systemStore = useSystemStore()

const temperature = computed(() => systemStore.temperature)
const tempPercent = computed(() => {
  const t = temperature.value
  if (t === null || t === undefined) return 0
  return Math.min(100, Math.max(0, (t / 85) * 100))
})
</script>

<template>
  <StatusCard
    label="Temp"
    :value="temperature"
    unit="°C"
    icon="Thermometer"
    :percent="tempPercent"
    :thresholds="{ warning: 65, critical: 80 }"
  />
</template>
