<script setup>
/**
 * ClientsTab.vue — S06 Component
 *
 * Advanced only. Connected AP clients with kick, block, unblock actions.
 * Extracted from NetworkView Clients tab.
 *
 * Store: clients.js (fetchClients, kickClient, blockClient, unblockClient)
 * Emits: refresh
 */
import { onMounted } from 'vue'
import { useClientsStore } from '@/stores/clients'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits(['refresh'])

const clientsStore = useClientsStore()

// ─── Load on mount ───────────────────────────────────────────
onMounted(() => {
  clientsStore.fetchClients()
})

// ─── Helpers ─────────────────────────────────────────────────
function signalColor(pct) {
  if (!pct) return 'text-theme-muted'
  if (pct >= 70) return 'text-success'
  if (pct >= 40) return 'text-warning'
  return 'text-error'
}

function formatDuration(seconds) {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
</script>

<template>
  <div class="space-y-4">
    <!-- Active Clients -->
    <div class="bg-theme-card rounded-xl border border-theme-primary">
      <div class="px-4 py-3 border-b border-theme-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 class="font-semibold text-theme-primary">Connected Clients</h3>
          <p class="text-sm text-theme-muted">
            {{ clientsStore.activeCount }} active{{ clientsStore.blockedCount ? `, ${clientsStore.blockedCount} blocked` : '' }}
          </p>
        </div>
        <button
          @click="clientsStore.fetchClients()"
          :disabled="clientsStore.loading"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-theme-tertiary text-theme-secondary hover:bg-theme-card flex items-center gap-1.5"
          aria-label="Refresh client list"
        >
          <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': clientsStore.loading }" />
          Refresh
        </button>
      </div>

      <div class="divide-y divide-[color:var(--border-primary)]">
        <div v-for="client in clientsStore.activeClients" :key="client.mac || client.mac_address" class="px-4 py-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 sm:gap-4 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-theme-tertiary flex items-center justify-center shrink-0">
                <Icon name="Smartphone" :size="20" class="text-theme-tertiary" />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-theme-primary truncate">
                  {{ client.hostname || 'Unknown Device' }}
                </p>
                <p class="text-sm text-theme-muted">{{ client.ip || client.ip_address || 'No IP' }}</p>
                <p class="text-xs text-theme-muted font-mono hidden sm:block">{{ client.mac || client.mac_address }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 sm:gap-4 shrink-0">
              <!-- Signal strength -->
              <div v-if="client.signal_percent" class="text-center hidden sm:block">
                <div class="flex items-center gap-1">
                  <Icon name="Wifi" :size="14" :class="signalColor(client.signal_percent)" />
                  <span class="text-xs" :class="signalColor(client.signal_percent)">{{ client.signal_percent }}%</span>
                </div>
              </div>

              <!-- Connected duration -->
              <div v-if="client.connected_seconds" class="text-xs text-theme-muted text-right hidden sm:block">
                {{ formatDuration(client.connected_seconds) }}
              </div>

              <!-- Kick -->
              <button
                @click="clientsStore.kickClient(client.mac || client.mac_address)"
                class="p-2 text-theme-muted hover:text-warning rounded-lg hover:bg-theme-tertiary transition-colors"
                title="Kick client (disconnect)"
                :aria-label="'Kick ' + (client.hostname || 'device') + ' (' + (client.mac || client.mac_address) + ')'"
              >
                <Icon name="LogOut" :size="18" />
              </button>

              <!-- Block -->
              <button
                @click="clientsStore.blockClient(client.mac || client.mac_address)"
                class="p-2 text-theme-muted hover:text-error rounded-lg hover:bg-theme-tertiary transition-colors"
                title="Block client"
                :aria-label="'Block ' + (client.hostname || 'device') + ' (' + (client.mac || client.mac_address) + ')'"
              >
                <Icon name="Ban" :size="18" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="clientsStore.activeClients.length === 0 && clientsStore.blockedClients.length === 0" class="px-4 py-12 text-center">
          <Icon name="Wifi" :size="48" class="mx-auto text-theme-muted mb-4" />
          <p class="text-theme-muted">No clients connected</p>
        </div>
      </div>
    </div>

    <!-- Blocked Clients -->
    <div v-if="clientsStore.blockedClients.length > 0" class="bg-theme-card rounded-xl border border-theme-primary">
      <div class="px-4 py-3 border-b border-theme-primary">
        <h3 class="font-semibold text-theme-primary">Blocked Clients</h3>
      </div>
      <div class="divide-y divide-[color:var(--border-primary)]">
        <div v-for="client in clientsStore.blockedClients" :key="client.mac || client.mac_address" class="px-4 py-3 opacity-60">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-error-muted flex items-center justify-center shrink-0">
                <Icon name="Ban" :size="16" class="text-error" />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-theme-primary truncate">{{ client.hostname || 'Unknown Device' }}</p>
                <p class="text-xs text-theme-muted font-mono">{{ client.mac || client.mac_address }}</p>
              </div>
            </div>
            <button
              @click="clientsStore.unblockClient(client.mac || client.mac_address)"
              class="px-3 py-1 text-xs font-medium text-accent hover:bg-accent-muted rounded-lg transition-colors"
              :aria-label="'Unblock ' + (client.hostname || 'device') + ' (' + (client.mac || client.mac_address) + ')'"
            >Unblock</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
