<script setup>
/**
 * HardwareTab.vue — S08 Component
 *
 * Advanced-only. Wraps the existing HardwareView functionality.
 * HardwareView already has sub-tabs for Overview, GPIO, I2C,
 * Sensors, RTC/Watchdog, and HAL Services, plus lazy-loaded
 * panel components (GPIOPanel, I2CPanel, SensorsPanel,
 * RTCPanel, WatchdogPanel).
 *
 * Reuses all existing panel components as specified in the
 * master plan rather than duplicating them.
 */
import HardwareView from '@/components/hardware/HardwareView.vue'
</script>

<template>
  <HardwareView />
</template>
