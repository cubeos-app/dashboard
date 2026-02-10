<script setup>
/**
 * USBTab.vue — S07 Component
 *
 * Both modes: USB device detection, mount/unmount/eject, rescan.
 * Wraps the existing USBDevices component which is already fully featured.
 * Standard mode hides the tree view and class filter.
 *
 * Self-managed — uses stores directly (following S06 pattern for non-overview tabs).
 */
import { useMode } from '@/composables/useMode'
import USBDevices from '@/components/storage/USBDevices.vue'

const { isAdvanced } = useMode()
</script>

<template>
  <div class="space-y-6">
    <USBDevices />
  </div>
</template>
