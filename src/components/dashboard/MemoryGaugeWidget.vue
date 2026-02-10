<script setup>
/**
 * MemoryGaugeWidget.vue — Session 7
 *
 * Standalone Memory gauge widget extracted from the DashboardAdvanced gauges section.
 * Wraps StatusCard with memory-specific data binding from systemStore.
 *
 * Available in both Standard and Advanced modes via unified WIDGET_REGISTRY.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import StatusCard from './StatusCard.vue'

const systemStore = useSystemStore()

const memoryUsage = computed(() => systemStore.memoryUsage)
const memoryFormatted = computed(() => systemStore.memoryFormatted)
</script>

<template>
  <StatusCard
    label="Memory"
    :value="memoryUsage"
    unit="%"
    icon="MemoryStick"
    :subtitle="memoryFormatted"
  />
</template>
