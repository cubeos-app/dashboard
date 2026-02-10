<script setup>
/**
 * BatteryWidget.vue — Session 3
 *
 * Battery / UPS status widget. Shows when HAL reports battery hardware.
 * Uses systemStore.battery data (from /hardware/battery endpoint).
 *
 * Design: Compact card. Horizontal battery icon with fill level.
 * Percentage number large. "Charging" / "On battery" status text.
 * Estimated time remaining if available. Color shifts:
 *   green >50%, yellow 20-50%, red <20%.
 *
 * Conditionally visible: only shows when batteryAvailable is true.
 * The parent widget registry controls this via show_battery + hardware check.
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const { isActive: wallpaperActive } = useWallpaper()

// Animate bar on mount
const mounted = ref(false)
onMounted(() => {
  requestAnimationFrame(() => { mounted.value = true })
})

// ─── Battery data ─────────────────────────────────────────────
const percent = computed(() => systemStore.batteryPercent ?? 0)
const isAvailable = computed(() => systemStore.batteryAvailable)
const isCharging = computed(() => systemStore.isCharging)
const onBattery = computed(() => systemStore.onBattery)

const voltage = computed(() => {
  const v = systemStore.battery?.voltage
  if (v == null) return null
  return v.toFixed(2)
})

const timeRemaining = computed(() => {
  const mins = systemStore.battery?.time_remaining_minutes
    ?? systemStore.battery?.estimated_minutes
  if (mins == null || mins <= 0) return null
  if (mins < 60) return `${Math.round(mins)}m remaining`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${m}m remaining`
})

// ─── Color theming ────────────────────────────────────────────
const levelColor = computed(() => {
  const p = percent.value
  if (p <= 10) return {
    bar: 'from-red-500 to-red-400',
    text: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/20',
    icon: 'text-red-400',
  }
  if (p <= 20) return {
    bar: 'from-orange-500 to-red-500',
    text: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/20',
    icon: 'text-orange-400',
  }
  if (p <= 50) return {
    bar: 'from-amber-400 to-orange-500',
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
  }
  return {
    bar: 'from-emerald-400 to-cyan-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
  }
})

const batteryIcon = computed(() => {
  if (isCharging.value) return 'BatteryCharging'
  const p = percent.value
  if (p <= 10) return 'BatteryWarning'
  if (p <= 25) return 'BatteryLow'
  if (p <= 50) return 'BatteryMedium'
  return 'BatteryFull'
})

const statusLabel = computed(() => {
  if (isCharging.value) return 'Charging'
  if (onBattery.value) return 'On Battery'
  return 'AC Power'
})

const statusIcon = computed(() => {
  if (isCharging.value) return 'Zap'
  if (onBattery.value) return 'BatteryWarning'
  return 'Plug'
})

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    v-if="isAvailable"
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer"
    @click="router.push('/system')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center" :class="levelColor.bg">
          <Icon :name="batteryIcon" :size="14" :class="levelColor.icon" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Battery</span>
      </div>

      <!-- Status badge -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
        :class="[
          isCharging ? 'bg-emerald-500/10 border-emerald-500/20' : levelColor.bg + ' ' + levelColor.border
        ]"
      >
        <Icon
          :name="statusIcon"
          :size="12"
          :class="isCharging ? 'text-emerald-400' : levelColor.text"
        />
        <span
          class="text-[11px] font-medium"
          :class="isCharging ? 'text-emerald-400' : levelColor.text"
        >
          {{ statusLabel }}
        </span>
      </div>
    </div>

    <!-- Percentage display -->
    <div class="flex items-baseline gap-2 mb-3">
      <span class="text-2xl font-bold tabular-nums" :class="levelColor.text">
        {{ percent }}
      </span>
      <span class="text-sm text-theme-muted">%</span>
      <span v-if="timeRemaining" class="text-[11px] text-theme-muted ml-auto">
        {{ timeRemaining }}
      </span>
    </div>

    <!-- Battery bar -->
    <div class="mb-3">
      <div class="h-3 rounded-full bg-theme-tertiary overflow-hidden relative">
        <!-- Animated fill -->
        <div
          class="h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
          :class="levelColor.bar"
          :style="{ width: mounted ? `${Math.max(3, percent)}%` : '0%' }"
        />
        <!-- Charging pulse overlay -->
        <div
          v-if="isCharging"
          class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
        />
      </div>
    </div>

    <!-- Details row -->
    <div class="flex items-center gap-4 text-[11px] text-theme-muted">
      <div v-if="voltage" class="flex items-center gap-1">
        <Icon name="Gauge" :size="11" />
        <span class="tabular-nums">{{ voltage }}V</span>
      </div>
      <div class="flex items-center gap-1">
        <Icon name="Power" :size="11" />
        <span>{{ onBattery ? 'Discharging' : 'AC Connected' }}</span>
      </div>
    </div>
  </button>

  <!-- Hidden state: widget wrapper will not render this if battery not available,
       but in case it does, show nothing gracefully -->
  <div
    v-else
    class="w-full rounded-2xl p-5 flex items-center justify-center text-[11px] text-theme-muted"
    :class="cardClass()"
  >
    <Icon name="BatteryOff" :size="14" class="mr-2" />
    No battery detected
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
}
</style>
