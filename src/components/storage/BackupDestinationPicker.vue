<script setup>
/**
 * BackupDestinationPicker.vue — Reusable destination selector + test
 *
 * Radio buttons: Local, USB Drive, NFS Share, SMB Share
 * - Local: no config needed (default)
 * - USB: shows detected USB devices, refresh button
 * - NFS: server + share path + test button
 * - SMB: server + share + username + password + test button
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useBackupsStore } from '@/stores/backups'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ type: 'local' })
  }
})

const emit = defineEmits(['update:modelValue'])

const backupsStore = useBackupsStore()

const destType = ref(props.modelValue?.type || 'local')
const usbDevice = ref(props.modelValue?.device || '')
const nfsServer = ref(props.modelValue?.server || '')
const nfsPath = ref(props.modelValue?.path || '')
const smbServer = ref(props.modelValue?.server || '')
const smbShare = ref(props.modelValue?.share || '')
const smbUsername = ref(props.modelValue?.username || '')
const smbPassword = ref(props.modelValue?.password || '')

const testResult = ref(null)
const testLoading = ref(false)

const DEST_OPTIONS = [
  { value: 'local', label: 'Local', icon: 'HardDrive' },
  { value: 'usb', label: 'USB Drive', icon: 'Usb' },
  { value: 'nfs', label: 'NFS Share', icon: 'FolderOpen' },
  { value: 'smb', label: 'SMB Share', icon: 'Share2' },
]

const usbDevices = computed(() => {
  return backupsStore.destinations.filter(d => d.type === 'usb')
})

function emitValue() {
  const base = { type: destType.value }
  if (destType.value === 'usb') {
    base.device = usbDevice.value
  } else if (destType.value === 'nfs') {
    base.server = nfsServer.value
    base.path = nfsPath.value
  } else if (destType.value === 'smb') {
    base.server = smbServer.value
    base.share = smbShare.value
    base.username = smbUsername.value
    base.password = smbPassword.value
  }
  emit('update:modelValue', base)
}

watch([destType, usbDevice, nfsServer, nfsPath, smbServer, smbShare, smbUsername, smbPassword], () => {
  testResult.value = null
  emitValue()
})

async function refreshUSB() {
  await backupsStore.fetchDestinations()
}

async function testConnection() {
  testLoading.value = true
  testResult.value = null
  try {
    const config = { type: destType.value }
    if (destType.value === 'nfs') {
      config.server = nfsServer.value
      config.path = nfsPath.value
    } else if (destType.value === 'smb') {
      config.server = smbServer.value
      config.share = smbShare.value
      config.username = smbUsername.value
      config.password = smbPassword.value
    }
    const result = await backupsStore.testDestination(config)
    testResult.value = { success: true, message: result?.message || 'Connection successful' }
  } catch (e) {
    testResult.value = { success: false, message: e.message || 'Connection failed' }
  } finally {
    testLoading.value = false
  }
}

onMounted(() => {
  if (!backupsStore.destinations.length) {
    backupsStore.fetchDestinations()
  }
})
</script>

<template>
  <div class="space-y-3">
    <label class="block text-sm font-medium text-theme-secondary">Destination</label>

    <!-- Destination type selector -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <button
        v-for="opt in DEST_OPTIONS"
        :key="opt.value"
        type="button"
        @click="destType = opt.value"
        class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
        :class="destType === opt.value
          ? 'border-[color:var(--accent-primary)] bg-accent-muted text-accent'
          : 'border-theme-primary text-theme-muted hover:text-theme-secondary hover:bg-theme-tertiary'"
      >
        <Icon :name="opt.icon" :size="14" />
        {{ opt.label }}
      </button>
    </div>

    <!-- USB config -->
    <div v-if="destType === 'usb'" class="space-y-2">
      <div class="flex items-center gap-2">
        <select
          v-model="usbDevice"
          class="flex-1 px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
        >
          <option value="">Select USB device...</option>
          <option v-for="dev in usbDevices" :key="dev.path || dev.id" :value="dev.path || dev.id">
            {{ dev.label || dev.name || dev.path }} ({{ dev.size_human || '' }})
          </option>
        </select>
        <button
          type="button"
          @click="refreshUSB"
          :disabled="backupsStore.destinationsLoading"
          class="p-2 text-theme-muted hover:text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50"
          title="Refresh USB devices"
        >
          <Icon name="RefreshCw" :size="14" :class="{ 'animate-spin': backupsStore.destinationsLoading }" />
        </button>
      </div>
      <p v-if="!usbDevices.length && !backupsStore.destinationsLoading" class="text-xs text-theme-muted">
        No USB devices detected. Insert a USB drive and click refresh.
      </p>
    </div>

    <!-- NFS config -->
    <div v-if="destType === 'nfs'" class="space-y-2">
      <input
        v-model="nfsServer"
        type="text"
        placeholder="Server address (e.g. 192.168.1.100)"
        class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
      >
      <input
        v-model="nfsPath"
        type="text"
        placeholder="Share path (e.g. /backups/cubeos)"
        class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
      >
      <button
        type="button"
        @click="testConnection"
        :disabled="testLoading || !nfsServer || !nfsPath"
        class="px-3 py-1.5 text-xs border border-theme-secondary text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50 flex items-center gap-1.5"
      >
        <Icon v-if="testLoading" name="Loader2" :size="12" class="animate-spin" />
        <Icon v-else name="Plug" :size="12" />
        Test Connection
      </button>
    </div>

    <!-- SMB config -->
    <div v-if="destType === 'smb'" class="space-y-2">
      <input
        v-model="smbServer"
        type="text"
        placeholder="Server address (e.g. 192.168.1.100)"
        class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
      >
      <input
        v-model="smbShare"
        type="text"
        placeholder="Share name (e.g. backups)"
        class="w-full px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
      >
      <div class="grid grid-cols-2 gap-2">
        <input
          v-model="smbUsername"
          type="text"
          placeholder="Username"
          class="px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
        >
        <input
          v-model="smbPassword"
          type="password"
          placeholder="Password"
          class="px-3 py-2 rounded-lg border border-theme-secondary bg-theme-input text-theme-primary text-sm focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:border-transparent"
        >
      </div>
      <button
        type="button"
        @click="testConnection"
        :disabled="testLoading || !smbServer || !smbShare"
        class="px-3 py-1.5 text-xs border border-theme-secondary text-theme-secondary rounded-lg hover:bg-theme-tertiary disabled:opacity-50 flex items-center gap-1.5"
      >
        <Icon v-if="testLoading" name="Loader2" :size="12" class="animate-spin" />
        <Icon v-else name="Plug" :size="12" />
        Test Connection
      </button>
    </div>

    <!-- Test result -->
    <div v-if="testResult" class="flex items-center gap-2 text-xs p-2 rounded-lg" :class="testResult.success ? 'bg-success-muted text-success' : 'bg-error-muted text-error'">
      <Icon :name="testResult.success ? 'CheckCircle' : 'XCircle'" :size="14" />
      {{ testResult.message }}
    </div>
  </div>
</template>
