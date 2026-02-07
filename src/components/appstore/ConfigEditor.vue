<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { confirm } from '@/utils/confirmDialog'
import { load as yamlLoad } from 'js-yaml'
import api from '@/api/client'
import Icon from '@/components/ui/Icon.vue'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  appId: {
    type: String,
    required: true
  },
  isCoreApp: {
    type: Boolean,
    default: false
  }
})

// State
const loading = ref(true)
const saving = ref(false)
const applying = ref(false)
const error = ref(null)
const success = ref(null)

const config = ref({
  app_id: '',
  app_path: '',
  is_core_app: false,
  compose_yaml: '',
  env_content: '',
  last_modified: ''
})

const originalConfig = ref({
  compose_yaml: '',
  env_content: ''
})

const backups = ref([])
const activeTab = ref('compose') // compose, env, backups
const showDangerConfirm = ref(false)
const dangerAction = ref(null) // 'save' or 'apply'

// Computed
const hasChanges = computed(() => {
  return config.value.compose_yaml !== originalConfig.value.compose_yaml ||
         config.value.env_content !== originalConfig.value.env_content
})

const appId = computed(() => props.appId || route.params.appId)
const isCoreApp = computed(() => props.isCoreApp || route.query.core === 'true')

// Methods
async function loadConfig() {
  loading.value = true
  error.value = null

  try {
    const endpoint = isCoreApp.value 
      ? `/appstore/coreapps/${appId.value}/config`
      : `/appstore/installed/${appId.value}/config`
    
    const data = await api.get(endpoint)
    
    // Handle core app response structure
    if (data.config) {
      config.value = data.config
    } else {
      config.value = data
    }

    originalConfig.value = {
      compose_yaml: config.value.compose_yaml,
      env_content: config.value.env_content
    }

    // Load backups
    await loadBackups()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadBackups() {
  try {
    const endpoint = isCoreApp.value
      ? `/appstore/coreapps/${appId.value}/config/backups`
      : `/appstore/installed/${appId.value}/config/backups`
    
    const data = await api.get(endpoint)
    backups.value = data.backups || []
  } catch (e) {
    // Backups might not exist yet
    backups.value = []
  }
}

function validateConfig() {
  const yaml = config.value.compose_yaml.trim()
  if (!yaml) {
    error.value = 'Docker Compose configuration cannot be empty'
    return false
  }
  try {
    const parsed = yamlLoad(yaml)
    if (parsed === null || parsed === undefined) {
      error.value = 'Invalid YAML: document is empty or contains only comments'
      return false
    }
    if (typeof parsed !== 'object') {
      error.value = 'Invalid Docker Compose: root must be a mapping, not a scalar value'
      return false
    }
  } catch (e) {
    error.value = `Invalid YAML: ${e.message}`
    return false
  }
  return true
}

async function saveConfig() {
  if (isCoreApp.value && !showDangerConfirm.value) {
    dangerAction.value = 'save'
    showDangerConfirm.value = true
    return
  }

  saving.value = true
  error.value = null
  success.value = null

  if (!validateConfig()) {
    saving.value = false
    return
  }

  try {
    const endpoint = isCoreApp.value
      ? `/appstore/coreapps/${appId.value}/config`
      : `/appstore/installed/${appId.value}/config`

    const payload = {
      compose_yaml: config.value.compose_yaml,
      env_content: config.value.env_content
    }

    if (isCoreApp.value) {
      payload.confirm_dangerous = true
    }

    await api.put(endpoint, payload)

    originalConfig.value = {
      compose_yaml: config.value.compose_yaml,
      env_content: config.value.env_content
    }

    success.value = 'Configuration saved. Click "Apply & Restart" to activate changes.'
    showDangerConfirm.value = false

    // Reload backups
    await loadBackups()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function applyConfig() {
  if (isCoreApp.value && !showDangerConfirm.value) {
    dangerAction.value = 'apply'
    showDangerConfirm.value = true
    return
  }

  applying.value = true
  error.value = null
  success.value = null

  try {
    const endpoint = isCoreApp.value
      ? `/appstore/coreapps/${appId.value}/config/apply`
      : `/appstore/installed/${appId.value}/config/apply`

    const payload = isCoreApp.value ? { confirm_dangerous: true } : {}
    
    await api.post(endpoint, payload)

    success.value = 'App restarted with new configuration!'
    showDangerConfirm.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    applying.value = false
  }
}

async function restoreBackup(backupName) {
  if (!await confirm({
    title: 'Restore Backup',
    message: `Restore backup from ${backupName}? This will overwrite current config.`,
    confirmText: 'Restore',
    variant: 'warning'
  })) {
    return
  }

  try {
    const endpoint = isCoreApp.value
      ? `/appstore/coreapps/${appId.value}/config/restore/${backupName}`
      : `/appstore/installed/${appId.value}/config/restore/${backupName}`

    await api.post(endpoint)
    
    success.value = 'Backup restored. Click "Apply & Restart" to activate.'
    await loadConfig()
  } catch (e) {
    error.value = e.message
  }
}

function cancelDangerConfirm() {
  showDangerConfirm.value = false
  dangerAction.value = null
}

function confirmDangerAction() {
  if (dangerAction.value === 'save') {
    saveConfig()
  } else if (dangerAction.value === 'apply') {
    applyConfig()
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadConfig()
})

onBeforeRouteLeave(async () => {
  if (hasChanges.value) {
    const leave = await confirm({
      title: 'Unsaved Changes',
      message: 'You have unsaved configuration changes. Leave without saving?',
      confirmText: 'Leave',
      cancelText: 'Stay',
      variant: 'warning'
    })
    if (!leave) return false
  }
})

watch(() => route.params.appId, () => {
  if (route.params.appId) {
    loadConfig()
  }
})
</script>

<template>
  <div class="min-h-full pb-8">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <button @click="goBack" aria-label="Back to app list" class="p-2 rounded-lg hover:bg-theme-tertiary transition-colors">
        <Icon name="ArrowLeft" :size="20" class="text-theme-secondary" />
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-semibold text-theme-primary truncate">
            Configure: {{ appId }}
          </h1>
          <span 
            v-if="isCoreApp" 
            class="px-2 py-0.5 text-xs font-medium rounded bg-error-muted text-error flex-shrink-0"
          >
            CORE APP
          </span>
        </div>
        <p class="text-theme-tertiary text-sm truncate">{{ config.app_path }}</p>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <button
          @click="saveConfig"
          :disabled="!hasChanges || saving"
          aria-label="Save configuration"
          class="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors disabled:opacity-50"
        >
          <Icon v-if="saving" name="Loader2" :size="16" class="animate-spin" />
          <Icon v-else name="Save" :size="16" />
          Save
        </button>

        <button
          @click="applyConfig"
          :disabled="applying"
          aria-label="Apply configuration and restart"
          class="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-50"
        >
          <Icon v-if="applying" name="Loader2" :size="16" class="animate-spin" />
          <Icon v-else name="RotateCw" :size="16" />
          Apply & Restart
        </button>
      </div>
    </div>

    <!-- Core App Warning -->
    <div v-if="isCoreApp" class="mb-6 p-4 rounded-xl bg-error-muted border border-error/30">
      <div class="flex items-start gap-3">
        <Icon name="AlertTriangle" :size="20" class="text-error mt-0.5 flex-shrink-0" />
        <div>
          <h3 class="font-semibold text-error">System-Critical Application</h3>
          <p class="text-sm text-error/80 mt-1">
            This is a core system app. Incorrect changes may break your CubeOS installation 
            and require physical access to recover. Proceed with extreme caution.
          </p>
        </div>
      </div>
    </div>

    <!-- Error/Success Messages -->
    <div v-if="error" class="mb-4 p-3 rounded-lg bg-error-muted border border-error/30 flex items-center gap-2">
      <Icon name="XCircle" :size="16" class="text-error" />
      <span class="text-sm text-error">{{ error }}</span>
    </div>

    <div v-if="success" class="mb-4 p-3 rounded-lg bg-success-muted border border-success/30 flex items-center gap-2">
      <Icon name="CheckCircle" :size="16" class="text-success" />
      <span class="text-sm text-success">{{ success }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Icon name="Loader2" :size="32" class="animate-spin text-accent" />
    </div>

    <template v-else>
      <!-- Tabs -->
      <div role="tablist" aria-label="Configuration editor" class="flex items-center gap-1 p-1 bg-theme-tertiary rounded-lg mb-4 w-fit">
        <button
          role="tab"
          :aria-selected="activeTab === 'compose'"
          @click="activeTab = 'compose'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="activeTab === 'compose' 
            ? 'bg-theme-card text-theme-primary shadow-sm' 
            : 'text-theme-secondary hover:text-theme-primary'"
        >
          <Icon name="FileCode" :size="14" class="inline mr-1.5" />
          docker-compose.yml
        </button>
        <button
          role="tab"
          :aria-selected="activeTab === 'env'"
          @click="activeTab = 'env'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="activeTab === 'env' 
            ? 'bg-theme-card text-theme-primary shadow-sm' 
            : 'text-theme-secondary hover:text-theme-primary'"
        >
          <Icon name="Settings" :size="14" class="inline mr-1.5" />
          .env
        </button>
        <button
          role="tab"
          :aria-selected="activeTab === 'backups'"
          @click="activeTab = 'backups'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          :class="activeTab === 'backups' 
            ? 'bg-theme-card text-theme-primary shadow-sm' 
            : 'text-theme-secondary hover:text-theme-primary'"
        >
          <Icon name="History" :size="14" />
          Backups
          <span v-if="backups.length > 0" class="px-1.5 py-0.5 text-[10px] rounded bg-theme-tertiary">
            {{ backups.length }}
          </span>
        </button>
      </div>

      <!-- Compose Editor -->
      <div v-if="activeTab === 'compose'" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-theme-primary bg-theme-secondary">
          <span class="text-xs font-medium text-theme-muted">docker-compose.yml</span>
          <span v-if="config.last_modified" class="text-[10px] text-theme-muted">
            Modified: {{ new Date(config.last_modified).toLocaleString() }}
          </span>
        </div>
        <textarea
          v-model="config.compose_yaml"
          aria-label="docker-compose.yml editor"
          class="w-full h-[500px] p-4 font-mono text-sm bg-transparent text-theme-primary resize-none focus:outline-none"
          placeholder="# docker-compose.yml content"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Env Editor -->
      <div v-if="activeTab === 'env'" class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-theme-primary bg-theme-secondary">
          <span class="text-xs font-medium text-theme-muted">.env</span>
        </div>
        <textarea
          v-model="config.env_content"
          aria-label="Environment variables editor"
          class="w-full h-[500px] p-4 font-mono text-sm bg-transparent text-theme-primary resize-none focus:outline-none"
          placeholder="# Environment variables&#10;KEY=value"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Backups -->
      <div v-if="activeTab === 'backups'" class="rounded-xl border border-theme-primary bg-theme-card p-4">
        <div v-if="backups.length === 0" class="text-center py-8">
          <Icon name="History" :size="32" class="mx-auto text-theme-muted mb-2" />
          <p class="text-theme-tertiary text-sm">No backups yet</p>
          <p class="text-theme-muted text-xs mt-1">Backups are created automatically when you save changes</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="backup in backups"
            :key="backup"
            class="flex items-center justify-between p-3 rounded-lg bg-theme-secondary"
          >
            <div class="flex items-center gap-3">
              <Icon name="Archive" :size="16" class="text-theme-muted" />
              <span class="text-sm text-theme-primary font-mono">{{ backup }}</span>
            </div>
            <button
              @click="restoreBackup(backup)"
              :aria-label="'Restore backup ' + backup"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-muted transition-colors"
            >
              <Icon name="RotateCcw" :size="14" />
              Restore
            </button>
          </div>
        </div>
      </div>

      <!-- Unsaved Changes Warning -->
      <div v-if="hasChanges" class="mt-4 p-3 rounded-lg bg-warning-muted border border-warning/30 flex items-center gap-2">
        <Icon name="AlertCircle" :size="16" class="text-warning" />
        <span class="text-sm text-warning">You have unsaved changes</span>
      </div>
    </template>

    <!-- Danger Confirmation Modal -->
    <div v-if="showDangerConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm" @click="cancelDangerConfirm"></div>
      
      <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-error/50 shadow-theme-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-error-muted flex items-center justify-center">
            <Icon name="AlertTriangle" :size="24" class="text-error" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-error">Danger Zone</h3>
            <p class="text-sm text-theme-secondary">Core system modification</p>
          </div>
        </div>

        <div class="space-y-3 mb-6">
          <p class="text-sm text-theme-secondary">
            You are about to <strong class="text-error">{{ dangerAction === 'save' ? 'modify' : 'restart' }}</strong> 
            a core system application.
          </p>
          <div class="p-3 rounded-lg bg-error-muted/50 border border-error/20">
            <ul class="text-xs text-error space-y-1">
              <li>• Incorrect changes may break CubeOS</li>
              <li>• You may lose access to the dashboard</li>
              <li>• Physical access may be required to recover</li>
            </ul>
          </div>
          <p class="text-sm text-theme-secondary">
            Are you absolutely sure you want to continue?
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="cancelDangerConfirm"
            class="flex-1 px-4 py-2 rounded-lg border border-theme-primary text-sm text-theme-secondary hover:bg-theme-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            @click="confirmDangerAction"
            class="flex-1 px-4 py-2 rounded-lg bg-error text-on-accent text-sm font-medium hover:bg-error/90 transition-colors"
          >
            Yes, I understand the risks
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
