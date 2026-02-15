<script setup>
/**
 * MemoryGaugeWidget.vue — Session 7
 *
 * Standalone Memory gauge widget extracted from the DashboardAdvanced gauges section.
 * Wraps StatusCard with memory-specific data binding from systemStore.
 *
 * B18: Now shows swap/ZRAM info beneath the main memory stats.
 *
 * Available in both Standard and Advanced modes via unified WIDGET_REGISTRY.
 */
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import StatusCard from './StatusCard.vue'

const systemStore = useSystemStore()

const memoryUsage = computed(() => systemStore.memoryUsage)
const memoryFormatted = computed(() => systemStore.memoryFormatted)

// B18: Combine RAM + swap into subtitle
const subtitle = computed(() => {
  const ram = memoryFormatted.value
  const swap = systemStore.swapFormatted
  if (!swap) return ram
  return `${ram}\n${swap}`
})
</script>

<template>
  <StatusCard
    label="Memory"
    :value="memoryUsage"
    unit="%"
    icon="MemoryStick"
    :subtitle="subtitle"
  />
</template>
