<script setup>
/**
 * SystemVitals.vue — S13 Visual Upgrade
 *
 * Compact system vitals widget for Standard dashboard.
 * Four metrics in a single card: CPU, Memory, Disk, Temperature.
 * Each shows an animated gradient bar with color-coded thresholds.
 *
 * Design: iPhone storage screen meets SpaceX telemetry.
 * Bars fill smoothly on mount via CSS transitions.
 * Temperature uses a number + spark instead of a bar.
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useWallpaper } from '@/composables/useWallpaper'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const systemStore = useSystemStore()
const { isActive: wallpaperActive } = useWallpaper()

// Animate bars on mount
const mounted = ref(false)
onMounted(() => {
  requestAnimationFrame(() => { mounted.value = true })
})

// ─── Metrics ──────────────────────────────────────────────────
const metrics = computed(() => [
  {
    key: 'cpu',
    label: 'CPU',
    icon: 'Cpu',
    value: systemStore.cpuUsage,
    unit: '%',
    gradient: gradientFor(systemStore.cpuUsage, 'cpu')
  },
  {
    key: 'memory',
    label: 'Memory',
    icon: 'MemoryStick',
    value: systemStore.memoryUsage,
    unit: '%',
    subtitle: systemStore.memoryFormatted,
    gradient: gradientFor(systemStore.memoryUsage, 'memory')
  },
  {
    key: 'disk',
    label: 'Storage',
    icon: 'HardDrive',
    value: systemStore.diskUsage,
    unit: '%',
    subtitle: systemStore.diskFormatted,
    gradient: gradientFor(systemStore.diskUsage, 'disk')
  }
])

const temperature = computed(() => {
  const t = systemStore.temperature
  if (t === null || t === undefined) return null
  return {
    value: t,
    color: t >= 80 ? 'text-error' : t >= 70 ? 'text-warning' : 'text-emerald-400',
    bgColor: t >= 80 ? 'bg-error/10' : t >= 70 ? 'bg-warning/10' : 'bg-emerald-500/10',
    borderColor: t >= 80 ? 'border-error/20' : t >= 70 ? 'border-warning/20' : 'border-emerald-500/20'
  }
})

// ─── Gradient logic ───────────────────────────────────────────
function gradientFor(value, type) {
  const v = value ?? 0
  // Green → Amber → Red transition
  if (v >= 90) return 'from-red-500 to-red-400'
  if (v >= 80) return 'from-orange-500 to-red-500'
  if (v >= 70) return 'from-amber-400 to-orange-500'
  if (v >= 50) return 'from-cyan-400 to-amber-400'
  return 'from-cyan-400 to-emerald-400'
}

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer"
    @click="router.push('/system')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Activity" :size="14" class="text-theme-secondary" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">System</span>
      </div>

      <!-- Temperature badge -->
      <div
        v-if="temperature"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
        :class="[temperature.bgColor, temperature.borderColor]"
      >
        <Icon name="Thermometer" :size="12" :class="temperature.color" />
        <span class="text-xs font-semibold tabular-nums" :class="temperature.color">
          {{ temperature.value.toFixed(1) }}°C
        </span>
      </div>
    </div>

    <!-- Metric bars -->
    <div class="space-y-3.5">
      <div
        v-for="(m, idx) in metrics"
        :key="m.key"
        class="group/metric"
        :style="{ animationDelay: `${idx * 80}ms` }"
      >
        <!-- Label row -->
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-1.5">
            <Icon :name="m.icon" :size="12" class="text-theme-muted" />
            <span class="text-xs text-theme-secondary">{{ m.label }}</span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-xs font-semibold text-theme-primary tabular-nums">{{ m.value ?? 0 }}</span>
            <span class="text-[10px] text-theme-muted">{{ m.unit }}</span>
            <span v-if="m.subtitle" class="text-[10px] text-theme-muted ml-1">{{ m.subtitle }}</span>
          </div>
        </div>

        <!-- Bar track -->
        <div class="h-2 rounded-full bg-theme-tertiary overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
            :class="m.gradient"
            :style="{ width: mounted ? `${Math.max(2, m.value ?? 0)}%` : '0%' }"
          />
        </div>
      </div>
    </div>
  </button>
</template>
