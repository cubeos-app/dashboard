<script setup>
/**
 * CpuGaugeWidget.vue — Session 7
 *
 * Standalone CPU gauge widget extracted from the DashboardAdvanced gauges section.
 * Wraps StatusCard with CPU-specific data binding from systemStore.
 *
 * Available in both Standard and Advanced modes via unified WIDGET_REGISTRY.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import StatusCard from './StatusCard.vue'

const systemStore = useSystemStore()

const cpuUsage = computed(() => systemStore.cpuUsage)
</script>

<template>
  <StatusCard
    label="CPU"
    :value="cpuUsage"
    unit="%"
    icon="Cpu"
  />
</template>
