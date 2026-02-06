<script setup>
/**
 * GPIOPanel.vue
 *
 * Sprint 7 Group 3: GPIO pin management panel.
 * Displays a responsive grid of GPIO pins with mode/value display,
 * toggle controls for OUTPUT pins, and mode selector with safety confirms.
 *
 * Lazy-loaded by HardwareView via defineAsyncComponent.
 * Store: useHardwareStore — fetchGPIO, fetchGPIOPin, setGPIOPin, setGPIOMode
 */
import { ref, computed, onMounted } from 'vue'
import { useHardwareStore } from '@/stores/hardware'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import { confirm } from '@/utils/confirmDialog'
import Icon from '@/components/ui/Icon.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

const hardwareStore = useHardwareStore()
const { signal } = useAbortOnUnmount()

const loading = ref(true)
const error = ref(null)
const actionLoading = ref({})

// ==========================================
// Data
// ==========================================

const pins = computed(() => {
  const data = hardwareStore.gpioPins
  if (!data) return []
  // Handle both { pins: [...] } and direct array
  return Array.isArray(data) ? data : (data.pins || [])
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    await hardwareStore.fetchGPIO({ signal: signal() })
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message
  } finally {
    loading.value = false
  }
})

// ==========================================
// Actions
// ==========================================

async function togglePin(pin) {
  const id = pinId(pin)
  const newVal = !pinValue(pin)

  actionLoading.value = { ...actionLoading.value, [`toggle-${id}`]: true }
  try {
    await hardwareStore.setGPIOPin(id, newVal, { signal: signal() })
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`toggle-${id}`]: false }
  }
}

async function changeMode(pin, newMode) {
  const id = pinId(pin)
  const currentMode = (pin.mode || pin.function || '').toLowerCase()

  // Confirm when switching to output — could damage hardware
  if (newMode === 'output' && currentMode !== 'output') {
    const ok = await confirm({
      title: 'Change to OUTPUT mode',
      message: `Setting GPIO ${id} to OUTPUT mode. Incorrect usage can damage your hardware. Continue?`,
      confirmText: 'Set Output',
      variant: 'warning'
    })
    if (!ok) return
  }

  actionLoading.value = { ...actionLoading.value, [`mode-${id}`]: true }
  try {
    await hardwareStore.setGPIOMode(id, newMode)
  } catch {
    // Store sets error
  } finally {
    actionLoading.value = { ...actionLoading.value, [`mode-${id}`]: false }
  }
}

// ==========================================
// Helpers
// ==========================================

function pinId(pin) {
  return pin.pin ?? pin.gpio ?? pin.number ?? 0
}

function pinLabel(pin) {
  const id = pinId(pin)
  const name = pin.name || pin.label || ''
  if (name) return `GPIO${id} / ${name}`
  return `GPIO${id}`
}

function pinMode(pin) {
  const mode = (pin.mode || pin.function || 'unknown').toUpperCase()
  if (mode === 'INPUT' || mode === 'IN') return 'IN'
  if (mode === 'OUTPUT' || mode === 'OUT') return 'OUT'
  return mode
}

function isOutput(pin) {
  const m = pinMode(pin)
  return m === 'OUT' || m === 'OUTPUT'
}

function pinValue(pin) {
  return pin.value ?? pin.level ?? 0
}

function modeBadgeClass(pin) {
  const m = pinMode(pin)
  if (m === 'OUT') return 'bg-accent-muted text-accent'
  if (m === 'IN') return 'bg-success-muted text-success'
  return 'bg-neutral-muted text-theme-tertiary'
}

const modeOptions = ['input', 'output']
</script>

<template>
  <div class="space-y-4">

    <!-- Safety warning banner -->
    <div class="bg-warning-muted border border-warning-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-warning mt-0.5 shrink-0" />
      <p class="text-sm text-warning">Incorrect GPIO usage can damage your hardware. Only modify pins you understand.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-8">
      <SkeletonLoader variant="grid" :count="8" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-error-muted border border-error-subtle rounded-lg p-4 flex items-start gap-3">
      <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5" />
      <div>
        <h3 class="text-sm font-medium text-error">Failed to load GPIO data</h3>
        <p class="mt-1 text-sm text-error">{{ error }}</p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!pins.length" class="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="ToggleRight" :size="36" class="text-theme-muted mb-3" />
      <p class="text-sm text-theme-tertiary">No GPIO pins detected</p>
    </div>

    <!-- Pin grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div
        v-for="pin in pins"
        :key="pinId(pin)"
        class="bg-theme-card border border-theme-primary rounded-xl p-4"
      >
        <!-- Pin header: name + mode badge -->
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium font-mono text-theme-primary truncate">{{ pinLabel(pin) }}</span>
          <span
            :class="[
              'text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2',
              modeBadgeClass(pin)
            ]"
          >
            {{ pinMode(pin) }}
          </span>
        </div>

        <!-- Value display -->
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-theme-secondary">Value</span>
          <span
            :class="[
              'text-sm font-semibold',
              pinValue(pin) ? 'text-accent' : 'text-theme-muted'
            ]"
          >
            {{ pinValue(pin) ? 'HIGH' : 'LOW' }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <!-- Toggle button (output only) -->
          <button
            v-if="isOutput(pin)"
            @click="togglePin(pin)"
            :disabled="actionLoading[`toggle-${pinId(pin)}`]"
            :class="[
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50',
              pinValue(pin)
                ? 'bg-accent-muted text-accent hover:bg-theme-tertiary'
                : 'bg-neutral-muted text-theme-tertiary hover:bg-theme-tertiary'
            ]"
          >
            <Icon v-if="actionLoading[`toggle-${pinId(pin)}`]" name="Loader2" :size="12" class="inline-block animate-spin mr-1" />
            {{ pinValue(pin) ? 'Set LOW' : 'Set HIGH' }}
          </button>

          <!-- Mode selector -->
          <div class="relative">
            <select
              :value="(pin.mode || pin.function || 'input').toLowerCase()"
              @change="changeMode(pin, $event.target.value)"
              :disabled="actionLoading[`mode-${pinId(pin)}`]"
              class="appearance-none bg-theme-input border border-theme-primary rounded-lg px-3 py-1.5 pr-7 text-xs text-theme-primary cursor-pointer disabled:opacity-50"
            >
              <option v-for="mode in modeOptions" :key="mode" :value="mode">
                {{ mode.toUpperCase() }}
              </option>
            </select>
            <Icon name="ChevronDown" :size="12" class="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          </div>
        </div>
      </div>
    </div>

    <!-- Store error -->
    <div v-if="hardwareStore.error && !error" class="bg-error-muted border border-error-subtle rounded-lg p-3 flex items-start gap-2">
      <Icon name="AlertTriangle" :size="16" class="text-error mt-0.5" />
      <span class="text-sm text-error">{{ hardwareStore.error }}</span>
    </div>
  </div>
</template>
