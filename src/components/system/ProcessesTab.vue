<script setup>
/**
 * ProcessesTab.vue — S08 Component
 *
 * Advanced-only. Wraps the existing ProcessesView functionality.
 * Since ProcessesView is a self-contained component with its own
 * data fetching, search, sorting, and process management, we wrap
 * it directly to avoid duplicating 660 lines of code.
 *
 * Wires: GET /processes/stats/summary (via updated store)
 */
import ProcessesView from '@/components/processes/ProcessesView.vue'
</script>

<template>
  <ProcessesView />
</template>
