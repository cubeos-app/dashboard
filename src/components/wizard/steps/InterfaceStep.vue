<script setup>
/**
 * InterfaceStep.vue — Batch 6c / T6c-10
 *
 * Shown during first-boot wizard when interface role assignment is ambiguous.
 * Displays detected interfaces and lets user assign AP + Uplink roles.
 * Skipped automatically when HAL auto-assigns unambiguously.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'
import ResponsiveTable from '@/components/ui/ResponsiveTable.vue'

const { t } = useI18n()
const emit = defineEmits(['next', 'skip'])

const interfaces = ref([])
const loading = ref(true)
const error = ref(null)
const autoAssigned = ref(false)
const apSelection = ref('')
const uplinkSelection = ref('')

const interfaceColumns = computed(() => [
  { key: 'name', label: t('wizard.steps.interface.interface') },
  { key: 'type', label: t('wizard.steps.interface.type') },
  { key: 'bus', label: t('wizard.steps.interface.bus') },
  { key: 'status', label: t('wizard.steps.interface.status') }
])

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
      {{ $t('wizard.steps.interface.description') }}
    </p>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Icon name="Loader2" :size="24" class="animate-spin text-accent" />
      <span class="ml-2 text-theme-secondary">{{ $t('wizard.steps.interface.detecting') }}</span>
    </div>

    <!-- Interface table -->
    <div v-else class="space-y-6">
      <ResponsiveTable
        :columns="interfaceColumns"
        :rows="interfaces"
        row-key="name"
        :empty-text="$t('wizard.steps.interface.noInterfaces')"
        compact
      >
        <template #cell-name="{ row }">
          <span class="font-mono text-theme-primary">{{ row.name }}</span>
        </template>
        <template #cell-type="{ row }">
          <span class="text-theme-secondary capitalize">{{ row.type }}</span>
        </template>
        <template #cell-bus="{ row }">
          <span
            :class="[
              'inline-flex px-2 py-0.5 text-xs rounded-full',
              row.built_in
                ? 'bg-accent/15 text-accent'
                : 'bg-theme-tertiary text-theme-secondary'
            ]"
          >
            {{ busLabel(row.bus) }}
            <span v-if="row.built_in" class="ml-1">{{ $t('wizard.steps.interface.builtIn') }}</span>
          </span>
        </template>
        <template #cell-status="{ row }">
          <span
            :class="row.is_up ? 'text-success' : 'text-theme-muted'"
            class="text-xs"
          >
            {{ row.is_up ? $t('wizard.steps.interface.up') : $t('wizard.steps.interface.down') }}
          </span>
        </template>
      </ResponsiveTable>

      <!-- Role assignment dropdowns -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="ap-iface" class="block text-sm font-medium text-theme-primary mb-1.5">
            {{ $t('wizard.steps.interface.apInterface') }}
          </label>
          <select
            id="ap-iface"
            v-model="apSelection"
            class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">{{ $t('wizard.steps.interface.nonePlaceholder') }}</option>
            <option v-for="c in apCandidates" :key="c.name" :value="c.name">
              {{ c.name }} ({{ busLabel(c.bus) }})
            </option>
          </select>
          <p class="text-xs text-theme-muted mt-1">{{ $t('wizard.steps.interface.apHelp') }}</p>
        </div>

        <div>
          <label for="uplink-iface" class="block text-sm font-medium text-theme-primary mb-1.5">
            {{ $t('wizard.steps.interface.uplinkInterface') }}
          </label>
          <select
            id="uplink-iface"
            v-model="uplinkSelection"
            class="w-full px-4 py-2.5 rounded-lg border border-theme-primary bg-theme-input text-theme-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">{{ $t('wizard.steps.interface.nonePlaceholder') }}</option>
            <option v-for="c in uplinkCandidates" :key="c.name" :value="c.name">
              {{ c.name }} ({{ c.type }}, {{ busLabel(c.bus) }})
            </option>
          </select>
          <p class="text-xs text-theme-muted mt-1">{{ $t('wizard.steps.interface.uplinkHelp') }}</p>
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
          {{ $t('wizard.continue') }}
        </button>
      </div>
    </div>
  </div>
</template>
