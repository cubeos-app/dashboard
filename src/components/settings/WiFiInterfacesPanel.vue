<script setup>
/**
 * WiFiInterfacesPanel.vue — Shows detected WiFi interfaces with AP capability status
 *
 * Displays USB WiFi adapter whitelist/blacklist status and allows re-testing
 * blacklisted adapters. Part of the Advanced settings for WiFi AP interface
 * preference (Batch 5).
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const { t } = useI18n()

const loading = ref(true)
const interfaces = ref([])
const whitelist = ref([])
const blacklist = ref([])
const retesting = ref('')

async function loadData() {
  loading.value = true
  try {
    const [ifaceData, wl, bl] = await Promise.all([
      api.get('/network/interfaces/detect'),
      api.get('/system/wifi-ap/whitelist').catch(() => []),
      api.get('/system/wifi-ap/blacklist').catch(() => [])
    ])
    interfaces.value = (ifaceData.interfaces || []).filter(i => i.type === 'wifi')
    whitelist.value = wl || []
    blacklist.value = bl || []
  } catch {
    // Silent — panel is informational
  } finally {
    loading.value = false
  }
}

function getAPStatus(iface) {
  if (iface.vendor_id && iface.product_id) {
    const wlEntry = whitelist.value.find(e => e.vendor_id === iface.vendor_id && e.product_id === iface.product_id)
    if (wlEntry) return 'whitelisted'
    const blEntry = blacklist.value.find(e => e.vendor_id === iface.vendor_id && e.product_id === iface.product_id)
    if (blEntry) return 'blacklisted'
    return 'untested'
  }
  return iface.ap_capable ? 'capable' : 'incapable'
}

async function retestAdapter(iface) {
  if (!iface.vendor_id || !iface.product_id) return
  const deviceId = `${iface.vendor_id}:${iface.product_id}`
  retesting.value = deviceId
  try {
    await api.post(`/system/wifi-ap/retest/${deviceId}`)
    await loadData()
  } catch {
    // Will show in refreshed data
  } finally {
    retesting.value = ''
  }
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="bg-theme-card rounded-xl border border-theme-primary p-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="font-medium text-theme-primary">{{ t('settings.wifiInterfaces.title') }}</h3>
        <p class="text-sm text-theme-muted mt-1">{{ t('settings.wifiInterfaces.subtitle') }}</p>
      </div>
      <button
        @click="loadData"
        :disabled="loading"
        class="p-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors"
      >
        <Icon :name="loading ? 'Loader2' : 'RefreshCw'" :size="16" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <div v-if="loading" class="text-center py-4">
      <Icon name="Loader2" :size="20" class="animate-spin text-accent mx-auto" />
    </div>

    <div v-else-if="interfaces.length === 0" class="text-sm text-theme-muted py-4 text-center">
      {{ t('settings.wifiInterfaces.noInterfaces') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="iface in interfaces"
        :key="iface.name"
        class="flex items-center justify-between p-3 rounded-lg border border-theme-secondary"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :class="iface.role === 'ap' ? 'bg-accent/10 text-accent' : 'bg-theme-secondary text-theme-muted'"
          >
            <Icon :name="iface.bus === 'usb' ? 'Usb' : 'Wifi'" :size="16" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-theme-primary">{{ iface.name }}</span>
              <span v-if="iface.role === 'ap'" class="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">AP</span>
              <span v-else-if="iface.role === 'uplink'" class="text-xs px-1.5 py-0.5 rounded bg-theme-secondary text-theme-muted">Uplink</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-theme-muted mt-0.5">
              <span>{{ iface.built_in ? t('settings.wifiInterfaces.builtIn') : 'USB' }}</span>
              <span v-if="iface.driver">{{ iface.driver }}</span>
              <span v-if="iface.vendor_id">{{ iface.vendor_id }}:{{ iface.product_id }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- AP status indicator -->
          <div class="flex items-center gap-1.5">
            <Icon
              :name="iface.ap_capable ? 'CheckCircle' : 'XCircle'"
              :size="14"
              :class="iface.ap_capable ? 'text-success' : 'text-error'"
            />
            <span class="text-xs" :class="iface.ap_capable ? 'text-success' : 'text-error'">
              {{ iface.ap_capable ? t('settings.wifiInterfaces.apCapable') : t('settings.wifiInterfaces.apIncapable') }}
            </span>
          </div>

          <!-- Re-test button for blacklisted USB adapters -->
          <button
            v-if="getAPStatus(iface) === 'blacklisted'"
            @click="retestAdapter(iface)"
            :disabled="retesting === `${iface.vendor_id}:${iface.product_id}`"
            class="flex items-center gap-1 px-2 py-1 rounded text-xs border border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            <Icon
              :name="retesting === `${iface.vendor_id}:${iface.product_id}` ? 'Loader2' : 'RotateCcw'"
              :size="12"
              :class="retesting === `${iface.vendor_id}:${iface.product_id}` ? 'animate-spin' : ''"
            />
            {{ t('settings.wifiInterfaces.retest') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Info note -->
    <div class="flex items-start gap-2 mt-4 text-xs text-theme-muted">
      <Icon name="Info" :size="14" class="flex-shrink-0 mt-0.5" />
      <p>{{ t('settings.wifiInterfaces.note') }}</p>
    </div>
  </div>
</template>
