<script setup>
/**
 * ClockWidget.vue — S13 Visual Upgrade
 *
 * Live clock with date and contextual greeting.
 * Updates every second for time, every minute for date.
 * Designed as a prominent dashboard anchor — the first thing you see.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useWallpaper } from '@/composables/useWallpaper'

const systemStore = useSystemStore()
const { isActive: wallpaperActive } = useWallpaper()

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

const hostname = computed(() => systemStore.hostname || 'CubeOS')
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

      <!-- Right: Hostname badge -->
      <div
        class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
        :class="wallpaperActive
          ? 'bg-white/[0.06] border border-white/[0.08]'
          : 'bg-theme-tertiary'"
      >
        <span class="w-2 h-2 rounded-full bg-success" />
        <span class="text-xs font-medium text-theme-secondary">{{ hostname }}</span>
      </div>
    </div>
  </div>
</template>
