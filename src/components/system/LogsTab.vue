<script setup>
/**
 * LogsTab.vue — S08 Component
 *
 * Advanced-only. Wraps the existing LogsView functionality.
 * LogsView handles all 12 log endpoints with its own tab bar,
 * filters, auto-refresh, and download. All 9 log sources
 * (system, container, kernel, errors, boot, file, HAL hardware,
 * HAL journal, HAL kernel) are already wired.
 */
import LogsView from '@/components/logs/LogsView.vue'
</script>

<template>
  <LogsView />
</template>
