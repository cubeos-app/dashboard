<script setup>
/**
 * ModeToggle — Global Standard ↔ Advanced mode toggle.
 *
 * S01 — Pill-shaped toggle switch with Standard/Advanced labels.
 * Uses the preferences store to persist mode across devices.
 *
 * Props:
 *   compact  — Smaller variant for header/sidebar use
 *
 * Usage:
 *   <ModeToggle />
 *   <ModeToggle compact />
 */
import { useMode } from '@/composables/useMode'
import Icon from '@/components/ui/Icon.vue'

defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})

const { isAdvanced, isStandard, toggleMode } = useMode()
</script>

<template>
  <div
    class="inline-flex items-center rounded-lg border border-theme-primary"
    :class="compact ? 'p-0.5' : 'p-1'"
    role="radiogroup"
    aria-label="UI mode"
  >
    <button
      role="radio"
      :aria-checked="isStandard"
      class="flex items-center gap-1.5 rounded-md font-medium transition-all duration-200"
      :class="[
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        isStandard
          ? 'bg-accent text-on-accent shadow-sm'
          : 'text-theme-secondary hover:text-theme-primary'
      ]"
      @click="toggleMode('standard')"
    >
      <Icon name="Sparkles" :size="compact ? 12 : 14" />
      <span>Standard</span>
    </button>

    <button
      role="radio"
      :aria-checked="isAdvanced"
      class="flex items-center gap-1.5 rounded-md font-medium transition-all duration-200"
      :class="[
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        isAdvanced
          ? 'bg-accent text-on-accent shadow-sm'
          : 'text-theme-secondary hover:text-theme-primary'
      ]"
      @click="toggleMode('advanced')"
    >
      <Icon name="Terminal" :size="compact ? 12 : 14" />
      <span>Advanced</span>
    </button>
  </div>
</template>
