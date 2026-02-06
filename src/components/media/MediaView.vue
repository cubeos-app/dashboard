<script setup>
/**
 * MediaView.vue — Stub
 *
 * Sprint 8 G1: Placeholder for build verification.
 * Will be replaced with full tabbed view in G4.
 */
import Icon from '@/components/ui/Icon.vue'
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <Icon name="Volume2" :size="24" class="text-theme-primary" />
      <h1 class="text-xl font-semibold text-theme-primary">Media</h1>
    </div>
    <div class="bg-theme-secondary rounded-xl border border-theme-primary p-8 text-center">
      <Icon name="Volume2" :size="40" class="text-theme-muted mx-auto mb-3" />
      <p class="text-theme-secondary text-sm">
        Media panels loading in Sprint 8 Group 4...
      </p>
      <p class="text-theme-muted text-xs mt-1">
        Audio, Camera
      </p>
    </div>
  </div>
</template>
