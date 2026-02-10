<script setup>
/**
 * ClockWidget.vue — S13 Visual Upgrade
 *
 * Live clock with date and contextual greeting.
 * Updates every second for time, every minute for date.
 * Designed as a prominent dashboard anchor — the first thing you see.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

const now = ref(new Date())
let timer = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})
onUnmounted(() => { clearInterval(timer) })

const timeStr = computed(() => {
  return now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const seconds = computed(() => {
  return now.value.toLocaleTimeString([], { second: '2-digit' }).slice(-2)
})

const dateStr = computed(() => {
  return now.value.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
})

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
})
</script>

<template>
  <div class="dash-stagger">
    <div class="flex items-end justify-between gap-4 py-2">
      <!-- Left: Clock + date -->
      <div>
        <!-- Greeting -->
        <p class="text-sm text-theme-muted mb-1">
          {{ greeting }}
        </p>

        <!-- Time -->
        <div class="flex items-baseline gap-1">
          <span class="text-5xl sm:text-6xl font-extralight text-theme-primary tabular-nums tracking-tight leading-none">
            {{ timeStr }}
          </span>
          <span class="text-lg font-light text-theme-muted tabular-nums">
            {{ seconds }}
          </span>
        </div>

        <!-- Date -->
        <p class="text-sm text-theme-secondary mt-2">
          {{ dateStr }}
        </p>
      </div>
    </div>
  </div>
</template>
