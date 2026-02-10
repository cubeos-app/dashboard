<script setup>
/**
 * PowerCard.vue — S08 Component
 *
 * Shared power/battery status card. Displays battery level,
 * charging state, UPS info, and voltage when available.
 * Used in SystemOverviewTab and potentially DashboardView.
 */
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** Power status object from HAL /hardware/battery */
  powerStatus: { type: Object, default: null }
})

const hasPower = computed(() => props.powerStatus?.available)

const batteryPercent = computed(() => Math.round(props.powerStatus?.battery_percent || 0))

const batteryLevelClass = computed(() => {
  const pct = batteryPercent.value
  if (pct < 10) return 'text-error'
  if (pct < 20) return 'text-warning'
  return 'text-theme-primary'
})

const batteryBarClass = computed(() => {
  const pct = batteryPercent.value
  if (pct < 10) return 'bg-error'
  if (pct < 20) return 'bg-warning'
  if (pct < 50) return 'bg-warning'
  return 'bg-success'
})

const statusTextClass = computed(() => {
  const status = props.powerStatus?.status
  if (status === 'critical' || status === 'low') return 'text-error'
  if (status === 'discharging') return 'text-warning'
  if (status === 'charging') return 'text-accent'
  return 'text-success'
})

const statusDotClass = computed(() => {
  const status = props.powerStatus?.status
  if (status === 'critical' || status === 'low') return 'bg-error'
  if (status === 'discharging') return 'bg-warning'
  if (status === 'charging') return 'bg-accent animate-pulse'
  return 'bg-success'
})

function formatPowerStatus(status) {
  const labels = {
    'charging': 'Charging',
    'discharging': 'Discharging',
    'full': 'Full',
    'plugged_in': 'Plugged In',
    'critical': 'Critical',
    'low': 'Low Battery',
    'unavailable': 'Unavailable'
  }
  return labels[status] || status || 'Unknown'
}

const batteryIcon = computed(() => {
  const pct = batteryPercent.value
  if (props.powerStatus?.is_charging) return 'BatteryCharging'
  if (pct > 75) return 'BatteryFull'
  if (pct > 50) return 'BatteryMedium'
  if (pct > 25) return 'BatteryLow'
  return 'Battery'
})
</script>

<template>
  <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
    <div class="px-6 py-4 bg-theme-secondary border-b border-theme-primary">
      <div class="flex items-center gap-2">
        <Icon :name="batteryIcon" :size="18" class="text-accent" />
        <h2 class="font-semibold text-theme-primary">Power Status</h2>
      </div>
    </div>
    <div class="p-6">
      <!-- Battery available -->
      <template v-if="hasPower">
        <div class="space-y-4">
          <!-- Battery level bar -->
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm text-theme-tertiary">Battery Level</span>
              <span class="text-sm font-medium" :class="batteryLevelClass">
                {{ batteryPercent }}%
              </span>
            </div>
            <div class="h-3 bg-theme-tertiary rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-500 rounded-full"
                :class="batteryBarClass"
                :style="{ width: `${batteryPercent}%` }"
              />
            </div>
          </div>

          <!-- Status -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-theme-tertiary">Status</span>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" :class="statusDotClass" />
              <span class="text-sm font-medium" :class="statusTextClass">
                {{ formatPowerStatus(powerStatus.status) }}
              </span>
            </div>
          </div>

          <!-- Voltage -->
          <div v-if="powerStatus.voltage" class="flex items-center justify-between">
            <span class="text-sm text-theme-tertiary">Voltage</span>
            <span class="text-sm font-medium text-theme-primary">{{ powerStatus.voltage.toFixed(2) }}V</span>
          </div>

          <!-- AC Present -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-theme-tertiary">AC Power</span>
            <span
              class="text-sm font-medium"
              :class="powerStatus.ac_present ? 'text-success' : 'text-theme-muted'"
            >
              {{ powerStatus.ac_present ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </div>
      </template>

      <!-- No battery detected -->
      <div v-else class="flex items-center gap-3 text-theme-muted">
        <Icon name="BatteryWarning" :size="20" class="opacity-50" />
        <p class="text-sm">No UPS/battery hardware detected</p>
      </div>
    </div>
  </div>
</template>
