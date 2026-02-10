<script setup>
/**
 * DiskGaugeWidget.vue — Session 7
 *
 * Standalone Disk gauge widget extracted from the DashboardAdvanced gauges section.
 * Shows disk usage as a circular percentage ring via StatusCard.
 *
 * NOTE: This is different from DiskWidget, which shows detailed partition information.
 * DiskGaugeWidget provides a compact gauge view of overall disk usage.
 *
 * Available in both Standard and Advanced modes via unified WIDGET_REGISTRY.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import StatusCard from './StatusCard.vue'

const systemStore = useSystemStore()

const diskUsage = computed(() => systemStore.diskUsage)
const diskFormatted = computed(() => systemStore.diskFormatted)
</script>

<template>
  <StatusCard
    label="Disk"
    :value="diskUsage"
    unit="%"
    icon="HardDrive"
    :subtitle="diskFormatted"
  />
</template>
