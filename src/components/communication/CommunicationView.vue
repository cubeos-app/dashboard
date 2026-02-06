<script setup>
/**
 * CommunicationView.vue — Stub
 *
 * Sprint 8 G1: Placeholder for build verification.
 * Will be replaced with full tabbed view in G2.
 */
import Icon from '@/components/ui/Icon.vue'
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <Icon name="Radio" :size="24" class="text-theme-primary" />
      <h1 class="text-xl font-semibold text-theme-primary">Communication</h1>
    </div>
    <div class="bg-theme-secondary rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Radio" :size="40" class="text-theme-muted mx-auto mb-3" />
      <p class="text-theme-secondary text-sm">
        Communication panels loading in Sprint 8 Group 2...
      </p>
      <p class="text-theme-muted text-xs mt-1">
        Bluetooth, Cellular, GPS, Meshtastic, Iridium
      </p>
    </div>
  </div>
</template>
