<script setup>
/**
 * StatusCard.vue
 *
 * S03 — Reusable gauge card with circular SVG progress ring.
 * Shows a percentage value with color-coded status thresholds.
 *
 * Usage:
 *   <StatusCard
 *     label="CPU"
 *     :value="42"
 *     unit="%"
 *     icon="Cpu"
 *     :thresholds="{ warning: 70, critical: 90 }"
 *   />
 */
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Display label */
  label: {
    type: String,
    required: true
  },
  /** Numeric value (0-100 for percentage, or any number) */
  value: {
    type: Number,
    default: null
  },
  /** Unit string displayed after value (e.g. '%', '°C', 'GB') */
  unit: {
    type: String,
    default: '%'
  },
  /** Lucide icon name */
  icon: {
    type: String,
    default: ''
  },
  /** Optional secondary text below the value */
  subtitle: {
    type: String,
    default: ''
  },
  /** Percentage for the ring (0-100). If not provided, uses value */
  percent: {
    type: Number,
    default: null
  },
  /** Thresholds for color coding */
  thresholds: {
    type: Object,
    default: () => ({ warning: 70, critical: 90 })
  },
  /** Compact mode (smaller ring) */
  compact: {
    type: Boolean,
    default: false
  }
})

// Ring geometry
const RADIUS = 36
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const VIEWBOX_SIZE = 80

const ringPercent = computed(() => {
  const pct = props.percent ?? props.value ?? 0
  return Math.min(100, Math.max(0, pct))
})

const strokeOffset = computed(() => {
  return CIRCUMFERENCE - (ringPercent.value / 100) * CIRCUMFERENCE
})

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '—'
  return props.unit === '°C' ? props.value.toFixed(1) : Math.round(props.value)
})

/** Color class based on thresholds */
const statusColor = computed(() => {
  const pct = ringPercent.value
  if (pct >= props.thresholds.critical) return 'text-error'
  if (pct >= props.thresholds.warning) return 'text-warning'
  return 'text-success'
})

const strokeColor = computed(() => {
  const pct = ringPercent.value
  if (pct >= props.thresholds.critical) return 'var(--error)'
  if (pct >= props.thresholds.warning) return 'var(--warning)'
  return 'var(--success)'
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 p-4 rounded-xl border border-theme-primary bg-theme-card"
    :class="compact ? 'p-3' : 'p-4'"
  >
    <!-- SVG Ring -->
    <div class="relative" :class="compact ? 'w-16 h-16' : 'w-20 h-20'">
      <svg
        :viewBox="`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`"
        class="w-full h-full -rotate-90"
      >
        <!-- Track -->
        <circle
          :cx="VIEWBOX_SIZE / 2"
          :cy="VIEWBOX_SIZE / 2"
          :r="RADIUS"
          fill="none"
          stroke="var(--border-primary)"
          stroke-width="6"
        />
        <!-- Progress -->
        <circle
          :cx="VIEWBOX_SIZE / 2"
          :cy="VIEWBOX_SIZE / 2"
          :r="RADIUS"
          fill="none"
          :stroke="strokeColor"
          stroke-width="6"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="strokeOffset"
          class="transition-all duration-500 ease-out"
        />
      </svg>
      <!-- Center value -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="font-bold text-theme-primary" :class="compact ? 'text-sm' : 'text-base'">
          {{ displayValue }}
        </span>
        <span class="text-theme-muted" :class="compact ? 'text-[9px]' : 'text-[10px]'">
          {{ unit }}
        </span>
      </div>
    </div>

    <!-- Label row -->
    <div class="flex items-center gap-1.5">
      <Icon v-if="icon" :name="icon" :size="compact ? 12 : 14" :class="statusColor" />
      <span class="text-xs font-medium text-theme-secondary">{{ label }}</span>
    </div>

    <!-- Subtitle -->
    <span v-if="subtitle" class="text-[10px] text-theme-muted text-center leading-tight">
      {{ subtitle }}
    </span>
  </div>
</template>
