<script setup>
/**
 * SkeletonLoader.vue
 *
 * Shimmer placeholder shown while data is loading.
 * Accepts a variant to render common patterns.
 *
 * Variants:
 *   card   — a card-shaped skeleton
 *   text   — 3 lines of text
 *   grid   — 4×2 card grid
 *   stats  — row of 4 stat boxes
 */
const props = defineProps({
  variant: {
    type: String,
    default: 'card',
    validator: (v) => ['card', 'text', 'grid', 'stats'].includes(v)
  },
  count: {
    type: Number,
    default: 1
  }
})
</script>

<template>
  <!-- Stats row -->
  <div v-if="variant === 'stats'" class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div v-for="i in 4" :key="i" class="p-4 rounded-xl bg-theme-card border border-theme-primary">
      <div class="h-3 w-16 bg-theme-tertiary rounded animate-pulse mb-2"></div>
      <div class="h-6 w-24 bg-theme-tertiary rounded animate-pulse"></div>
    </div>
  </div>

  <!-- Card grid -->
  <div v-else-if="variant === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
    <div v-for="i in (count || 8)" :key="i" class="p-4 rounded-xl bg-theme-card border border-theme-primary">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-xl bg-theme-tertiary animate-pulse"></div>
        <div class="flex-1">
          <div class="h-4 w-24 bg-theme-tertiary rounded animate-pulse mb-1"></div>
          <div class="h-3 w-16 bg-theme-tertiary rounded animate-pulse"></div>
        </div>
      </div>
      <div class="h-3 w-full bg-theme-tertiary rounded animate-pulse"></div>
    </div>
  </div>

  <!-- Text block -->
  <div v-else-if="variant === 'text'" class="space-y-3">
    <div class="h-4 w-3/4 bg-theme-tertiary rounded animate-pulse"></div>
    <div class="h-4 w-full bg-theme-tertiary rounded animate-pulse"></div>
    <div class="h-4 w-2/3 bg-theme-tertiary rounded animate-pulse"></div>
  </div>

  <!-- Default card -->
  <div v-else v-for="i in count" :key="i" class="p-6 rounded-xl bg-theme-card border border-theme-primary">
    <div class="flex items-center gap-4 mb-4">
      <div class="w-12 h-12 rounded-xl bg-theme-tertiary animate-pulse"></div>
      <div class="flex-1">
        <div class="h-5 w-32 bg-theme-tertiary rounded animate-pulse mb-2"></div>
        <div class="h-3 w-48 bg-theme-tertiary rounded animate-pulse"></div>
      </div>
    </div>
    <div class="space-y-2">
      <div class="h-3 w-full bg-theme-tertiary rounded animate-pulse"></div>
      <div class="h-3 w-3/4 bg-theme-tertiary rounded animate-pulse"></div>
    </div>
  </div>
</template>
