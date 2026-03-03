<script setup>
/**
 * SignalSparkline.vue
 *
 * Pure SVG signal quality sparkline — no external dependencies.
 * Renders an area chart from time-series signal data (0–5 bars or 0–100 RSSI).
 *
 * Props:
 *   points  — array of { timestamp: number, value: number } sorted ascending
 *   yMin    — minimum y value (default 0)
 *   yMax    — maximum y value (default 5)
 *   height  — SVG height in px (default 72)
 *   loading — show loading placeholder (default false)
 *   empty   — no data yet (default false)
 */
import { computed } from 'vue'

const props = defineProps({
  points: { type: Array, default: () => [] },
  yMin: { type: Number, default: 0 },
  yMax: { type: Number, default: 5 },
  height: { type: Number, default: 72 },
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false }
})

const W = 400
const H = computed(() => props.height)
const PAD = 4 // inner padding px

const hasPoints = computed(() => props.points.length >= 2)

// Map data points to SVG coordinates
const svgPoints = computed(() => {
  if (!hasPoints.value) return []
  const pts = props.points
  const tMin = pts[0].timestamp
  const tMax = pts[pts.length - 1].timestamp
  const tRange = tMax - tMin || 1
  const yRange = props.yMax - props.yMin || 1

  return pts.map(p => {
    const x = PAD + ((p.timestamp - tMin) / tRange) * (W - PAD * 2)
    const y = H.value - PAD - ((p.value - props.yMin) / yRange) * (H.value - PAD * 2)
    return { x, y, value: p.value }
  })
})

// SVG polyline points string
const linePoints = computed(() => {
  return svgPoints.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
})

// Filled area path: line down to baseline then back
const areaPath = computed(() => {
  if (!svgPoints.value.length) return ''
  const pts = svgPoints.value
  const baseline = H.value - PAD
  const first = pts[0]
  const last = pts[pts.length - 1]
  const lineStr = pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return `M${first.x.toFixed(1)},${baseline} ${lineStr} L${last.x.toFixed(1)},${baseline} Z`
})

// Determine color based on average signal
const avgValue = computed(() => {
  if (!props.points.length) return 0
  return props.points.reduce((s, p) => s + p.value, 0) / props.points.length
})

const strokeColor = computed(() => {
  const ratio = (avgValue.value - props.yMin) / (props.yMax - props.yMin || 1)
  if (ratio >= 0.6) return 'var(--color-success, #22c55e)'
  if (ratio >= 0.3) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-error, #ef4444)'
})
</script>

<template>
  <div class="w-full" :style="{ height: height + 'px' }">
    <!-- Loading placeholder -->
    <div
      v-if="loading"
      class="w-full h-full rounded bg-theme-tertiary animate-pulse"
    />

    <!-- Empty / no data -->
    <div
      v-else-if="empty || !hasPoints"
      class="w-full h-full flex items-center justify-center"
    >
      <span class="text-xs text-theme-muted">No signal data yet</span>
    </div>

    <!-- SVG sparkline -->
    <svg
      v-else
      :viewBox="`0 0 ${W} ${height}`"
      preserveAspectRatio="none"
      class="w-full h-full"
      aria-hidden="true"
    >
      <!-- Area fill -->
      <path
        :d="areaPath"
        :fill="strokeColor"
        opacity="0.12"
      />

      <!-- Line -->
      <polyline
        :points="linePoints"
        :stroke="strokeColor"
        stroke-width="1.5"
        fill="none"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Baseline -->
      <line
        :x1="PAD" :y1="height - PAD"
        :x2="W - PAD" :y2="height - PAD"
        stroke="currentColor"
        stroke-width="0.5"
        opacity="0.1"
      />

      <!-- Y-axis ticks (0 and max) -->
      <text
        :x="PAD + 2" :y="PAD + 8"
        class="text-theme-muted"
        font-size="9"
        fill="currentColor"
        opacity="0.4"
      >{{ yMax }}</text>
      <text
        :x="PAD + 2" :y="height - PAD - 2"
        class="text-theme-muted"
        font-size="9"
        fill="currentColor"
        opacity="0.4"
      >{{ yMin }}</text>
    </svg>
  </div>
</template>
