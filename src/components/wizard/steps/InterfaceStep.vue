<script setup>
/**
 * InterfaceStep.vue — Batch 6c / T6c-10
 *
 * Shown during first-boot wizard when interface role assignment is ambiguous.
 * Displays detected interfaces and lets user assign AP + Uplink roles.
 * Skipped automatically when HAL auto-assigns unambiguously.
 */
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['next', 'skip'])

const interfaces = ref([])
const loading = ref(true)
const error = ref(null)
const autoAssigned = ref(false)
const apSelection = ref('')
const uplinkSelection = ref('')

const apCandidates = computed(() =>
  interfaces.value.filter(i => i.type === 'wifi' && i.ap_capable)
)

const uplinkCandidates = computed(() =>
  interfaces.value.filter(i =>
    i.name !== apSelection.value && (i.type === 'ethernet' || i.type === 'wifi')
  )
)

const canProceed = computed(() => apSelection.value || uplinkSelection.value)

onMounted(async () => {
  try {
    const resp = await api.get('/network/interfaces/detect')
    interfaces.value = resp.interfaces || []
    autoAssigned.value = resp.auto_assigned || false
    apSelection.value = resp.ap_interface || ''
    uplinkSelection.value = resp.uplink_interface || ''

    if (autoAssigned.value) {
      emit('skip')
      return
    }
  } catch (e) {
    error.value = e.message
    emit('skip')
  } finally {
    loading.value = false
  }
})

async function saveAndContinue() {
  try {
    await api.post('/network/interfaces/assign', {
      ap_interface: apSelection.value,
      uplink_interface: uplinkSelection.value
    })
    emit('next')
  } catch (e) {
    error.value = e.message
  }
}

function busLabel(bus) {
  const labels = {
    sdio: 'SDIO',
    pci: 'PCIe',
    usb: 'USB',
    platform: 'Platform',
    virtual: 'Virtual',
    unknown: 'Unknown'
  }
  return labels[bus] || bus
}
</script>

<template>
  <div>
    <p class="text-theme-secondary mb-6">
      CubeOS detected multiple network interfaces. Assign roles to configure networking.
    </p>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
      <span class="ml-2 text-theme-secondary">Detecting interfaces...</span>
    </div>

    <!-- Interface table -->
    <div v-else class="space-y-6">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-theme-primary text-left">
              <th class="pb-2 font-medium text-theme-secondary">Interface</th>
              <th class="pb-2 font-medium text-theme-secondary">Type</th>
              <th class="pb-2 font-medium text-theme-secondary">Bus</th>
              <th class="pb-2 font-medium text-theme-secondary">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="iface in interfaces"
              :key="iface.name"
              class="border-b border-theme-primary/50"
            >
              <td class="py-2.5 font-mono text-theme-primary">{{ iface.name }}</td>
              <td class="py-2.5 text-theme-secondary capitalize">{{ iface.type }}</td>
              <td class="py-2.5">
                <span
                  :class="[
                    'inline-flex px-2 py-0.5 text-xs rounded-full',
                    iface.built_in
                      ? 'bg-accent/15 text-accent'
                      : 'bg-theme-tertiary text-theme-secondary'
                  ]"
                >
                  {{ busLabel(iface.bus) }}
                  <span v-if="iface.built_in" class="ml-1">Built-in</span>
                </span>
              </td>
              <td class="py-2.5">
                <span
                  :class="iface.is_up ? 'text-success' : 'text-theme-muted'"
                  class="text-xs"
                >
                  {{ iface.is_up ? 'Up' : 'Down' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Role assignment dropdowns -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="ap-iface" class="block text-sm font-medium text-theme-primary mb-1.5">
            Access Point Interface
          </label>
          <select
            id="ap-iface"
            v-model="apSelection"
            class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">-- None --</option>
            <option v-for="c in apCandidates" :key="c.name" :value="c.name">
              {{ c.name }} ({{ busLabel(c.bus) }})
            </option>
          </select>
          <p class="text-xs text-theme-muted mt-1">WiFi interface for the CubeOS hotspot</p>
        </div>

        <div>
          <label for="uplink-iface" class="block text-sm font-medium text-theme-primary mb-1.5">
            Uplink Interface
          </label>
          <select
            id="uplink-iface"
            v-model="uplinkSelection"
            class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">-- None --</option>
            <option v-for="c in uplinkCandidates" :key="c.name" :value="c.name">
              {{ c.name }} ({{ c.type }}, {{ busLabel(c.bus) }})
            </option>
          </select>
          <p class="text-xs text-theme-muted mt-1">Interface for internet connectivity</p>
        </div>
      </div>

      <!-- Error -->
      <div
        v-if="error"
        class="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm"
      >
        <Icon name="AlertCircle" :size="16" />
        {{ error }}
      </div>

      <!-- Continue button -->
      <div class="flex justify-end">
        <button
          @click="saveAndContinue"
          :disabled="!canProceed"
          class="btn-accent px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  </div>
</template>
