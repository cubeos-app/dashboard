<script setup>
import { ref } from 'vue'
import { useAppManagerStore } from '@/stores/appmanager'
import Icon from '@/components/ui/Icon.vue'

const store = useAppManagerStore()

const showAllocateModal = ref(false)
const allocating = ref(false)
const newPort = ref({ app_name: '', port: null, protocol: 'tcp', description: '' })

async function allocatePort() {
  allocating.value = true
  try {
    await store.allocatePort(newPort.value)
    showAllocateModal.value = false
    newPort.value = { app_name: '', port: null, protocol: 'tcp', description: '' }
  } catch (e) {}
  finally { allocating.value = false }
}

async function findNextPort() {
  const port = await store.getAvailablePort('user')
  if (port) newPort.value.port = port
}

async function releasePort(port, protocol) {
  if (!confirm(`Release port ${port}/${protocol}?`)) return
  try { await store.releasePort(port, protocol) } catch (e) {}
}
</script>

<template>
  <div>
    <!-- Info Banner -->
    <div class="bg-accent-muted border border-accent/30 rounded-lg p-4 mb-6">
      <div class="flex items-start">
        <Icon name="Info" :size="20" class="text-accent mt-0.5" />
        <div class="ml-3 text-sm">
          <p class="text-theme-primary font-medium">Port Allocation Ranges</p>
          <p class="mt-1 text-theme-secondary">
            <strong>System apps:</strong> 6000-6999 | <strong>User apps:</strong> 7000-7999 | <strong>Reserved:</strong> 22, 53, 80, 81, 443, 5001, 8000, 8080, 9009, 11434
          </p>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <span class="text-sm text-theme-secondary">{{ store.ports.length }} allocated ports</span>
      <button @click="showAllocateModal = true" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors">
        <Icon name="Plus" :size="16" />Allocate Port
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="store.ports.length === 0" class="text-center py-12">
      <Icon name="Plug" :size="48" class="mx-auto text-theme-muted" />
      <h3 class="mt-4 text-lg font-medium text-theme-primary">No ports allocated</h3>
      <p class="mt-1 text-sm text-theme-secondary">Allocate ports to apps to manage network access</p>
    </div>

    <!-- Ports Table -->
    <div v-else class="bg-theme-secondary rounded-lg border border-theme-primary overflow-hidden">
      <table class="min-w-full divide-y divide-theme-primary">
        <thead class="bg-theme-tertiary">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Port</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Protocol</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Application</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-theme-secondary uppercase tracking-wider">Description</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-theme-secondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-theme-primary">
          <tr v-for="port in store.ports" :key="`${port.port}-${port.protocol}`" class="hover:bg-theme-tertiary/50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-theme-primary">{{ port.port }}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase', port.protocol === 'tcp' ? 'bg-accent-muted text-accent' : 'bg-warning-muted text-warning']">{{ port.protocol }}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-theme-primary">{{ port.app_name || '-' }}</td>
            <td class="px-6 py-4 text-sm text-theme-secondary">{{ port.description || '-' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <button @click="releasePort(port.port, port.protocol)" class="p-1.5 text-error hover:bg-error-muted rounded transition-colors" title="Release port">
                <Icon name="Trash2" :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Allocate Modal -->
    <div v-if="showAllocateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="showAllocateModal = false"></div>
        <div class="relative bg-theme-secondary rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-theme-primary">Allocate Port</h3>
            <button @click="showAllocateModal = false" class="text-theme-muted hover:text-theme-primary"><Icon name="X" :size="20" /></button>
          </div>
          <form @submit.prevent="allocatePort" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Application</label>
              <select v-model="newPort.app_name" required class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                <option value="">Select an app...</option>
                <option v-for="app in store.apps" :key="app.id" :value="app.name">{{ app.display_name || app.name }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Port</label>
                <div class="flex gap-2">
                  <input v-model.number="newPort.port" type="number" min="1024" max="65535" placeholder="Auto" class="flex-1 rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <button type="button" @click="findNextPort" class="px-3 py-2 text-xs font-medium text-accent hover:bg-accent-muted rounded-md transition-colors" title="Find next available">
                    <Icon name="Search" :size="14" />
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-theme-secondary mb-1">Protocol</label>
                <select v-model="newPort.protocol" class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-theme-secondary mb-1">Description (optional)</label>
              <input v-model="newPort.description" type="text" placeholder="Web UI, API, etc." class="w-full rounded-md border-theme-primary bg-theme-primary text-theme-primary focus:ring-accent focus:border-accent text-sm">
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="showAllocateModal = false" class="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">Cancel</button>
              <button type="submit" :disabled="allocating" class="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50">{{ allocating ? 'Allocating...' : 'Allocate' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
