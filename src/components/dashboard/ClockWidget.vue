<script setup>
/**
 * ClockWidget.vue — S13 Visual Upgrade + Session 3 Config
 *
 * Live clock with date and contextual greeting.
 * Reads clock_format, date_format, show_seconds, show_greeting
 * from useDashboardConfig. Parent controls visibility via show_clock.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDashboardConfig } from '@/composables/useDashboardConfig'

const {
  clockFormat,
  dateFormat,
  showSeconds,
  showGreeting,
} = useDashboardConfig()

const now = ref(new Date())
let timer = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})
onUnmounted(() => { clearInterval(timer) })

// ─── Time string (respects 12h/24h) ──────────────────────────
const timeStr = computed(() => {
  const is12h = clockFormat.value === '12h'
  return now.value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: is12h,
  })
})

// ─── Seconds ─────────────────────────────────────────────────
const seconds = computed(() => {
  return now.value.toLocaleTimeString('en-US', { second: '2-digit' }).slice(-2)
})

// ─── Date string (6 format options) ──────────────────────────
const dateStr = computed(() => {
  const d = now.value
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const monShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = d.getDate()
  const mo = d.getMonth()
  const yr = d.getFullYear()
  const dw = d.getDay()
  const pad = (n) => String(n).padStart(2, '0')

  switch (dateFormat.value) {
    case 'medium': return `${days[dw]}, ${day} ${months[mo]}, ${yr}`
    case 'short':  return `${dayShort[dw]} ${day}-${monShort[mo]}-${yr}`
    case 'iso':    return `${yr}-${pad(mo + 1)}-${pad(day)}`
    case 'us':     return `${pad(mo + 1)}/${pad(day)}/${yr}`
    case 'eu':     return `${pad(day)}/${pad(mo + 1)}/${yr}`
    case 'long':
    default:       return `${days[dw]}, ${months[mo]} ${day}, ${yr}`
  }
})

// ─── Greeting ────────────────────────────────────────────────
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
        <!-- Greeting (conditional) -->
        <p v-if="showGreeting" class="text-sm text-theme-muted mb-1">
          {{ greeting }}
        </p>

        <!-- Time -->
        <div class="flex items-baseline gap-1">
          <span class="text-5xl sm:text-6xl font-extralight text-theme-primary tabular-nums tracking-tight leading-none">
            {{ timeStr }}
          </span>
          <span v-if="showSeconds" class="text-lg font-light text-theme-muted tabular-nums">
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
