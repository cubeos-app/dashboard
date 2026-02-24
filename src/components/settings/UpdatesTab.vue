<script setup>
/**
 * UpdatesTab.vue — System Update Management
 *
 * Settings tab for system updates: current version, available updates,
 * apply with confirmation, and update history.
 *
 * Sections:
 *   - Current version: version, channel, last checked, check button
 *   - Available update (conditional): release notes, breaking changes, apply button
 *   - Update history: table of past updates with status badges
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useUpdatesStore } from '@/stores/updates'
import { confirm } from '@/utils/confirmDialog'
import { safeGetRaw } from '@/utils/storage'
import Icon from '@/components/ui/Icon.vue'

const updates = useUpdatesStore()

const showProgress = ref(false)
const progressSteps = ref([])
const progressDone = ref(false)
const progressError = ref(false)
const progressErrorMessage = ref('')
let eventSource = null

onMounted(() => {
  updates.checkForUpdates()
  updates.fetchHistory()
})

onUnmounted(() => {
  closeSSE()
})

// ── Apply Update ──────────────────────────────────────────────

async function handleApply() {
  const title = updates.hasBreakingChanges ? 'Breaking Changes' : 'Apply Update'
  const variant = updates.hasBreakingChanges ? 'warning' : 'info'
  const message = updates.hasBreakingChanges
    ? `This update includes breaking changes:\n\n${updates.release.breaking.join('\n')}\n\nUpdate to ${updates.latestVersion}?`
    : `Update CubeOS to ${updates.latestVersion}?`

  const confirmed = await confirm({
    title,
    message,
    confirmText: 'Apply Update',
    variant
  })
  if (!confirmed) return

  try {
    const data = await updates.applyUpdate(updates.latestVersion, updates.hasBreakingChanges)
    if (data?.workflow_id) {
      startProgress(data.workflow_id)
    }
  } catch {
    // Error is stored in updates.error
  }
}

// ── SSE Progress ──────────────────────────────────────────────

const UPDATE_STEPS = [
  { key: 'validate', label: 'Validating update' },
  { key: 'download', label: 'Downloading release' },
  { key: 'backup', label: 'Backing up current version' },
  { key: 'apply', label: 'Applying update' },
  { key: 'verify', label: 'Verifying installation' },
  { key: 'complete', label: 'Update complete' }
]

function startProgress(workflowId) {
  showProgress.value = true
  progressDone.value = false
  progressError.value = false
  progressErrorMessage.value = ''
  progressSteps.value = UPDATE_STEPS.map(s => ({ ...s, status: 'pending' }))

  const token = safeGetRaw('cubeos_access_token') || ''
  const url = `/api/v1/workflows/${encodeURIComponent(workflowId)}/progress${token ? '?token=' + encodeURIComponent(token) : ''}`

  eventSource = new EventSource(url)

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      handleProgressEvent(event)
    } catch {
      // Ignore parse errors
    }
  }

  eventSource.onerror = () => {
    if (progressDone.value || progressError.value) {
      closeSSE()
      return
    }
    setTimeout(() => {
      if (!progressDone.value && !progressError.value && eventSource?.readyState === EventSource.CLOSED) {
        progressError.value = true
        progressErrorMessage.value = 'Connection to server lost'
        closeSSE()
      }
    }, 5000)
  }
}

function handleProgressEvent(event) {
  const stepKeys = UPDATE_STEPS.map(s => s.key)
  const idx = stepKeys.indexOf(event.step)

  if (idx >= 0) {
    progressSteps.value = UPDATE_STEPS.map((s, i) => ({
      ...s,
      status: i < idx ? 'done' : i === idx ? 'active' : 'pending'
    }))
  }

  if (event.status === 'done') {
    progressSteps.value = UPDATE_STEPS.map(s => ({ ...s, status: 'done' }))
    progressDone.value = true
    closeSSE()
    updates.checkForUpdates()
    updates.fetchHistory()
  } else if (event.status === 'error') {
    progressError.value = true
    progressErrorMessage.value = event.error || event.detail || 'Update failed'
    closeSSE()
    updates.fetchHistory()
  }
}

function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function closeProgress() {
  showProgress.value = false
  closeSSE()
}

// ── Formatting ────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return 'Never'
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function formatDuration(start, end) {
  if (!start || !end) return '-'
  try {
    const ms = new Date(end) - new Date(start)
    if (ms < 1000) return '<1s'
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return `${minutes}m ${remaining}s`
  } catch {
    return '-'
  }
}

function statusClass(status) {
  switch (status) {
    case 'completed': return 'bg-success/10 text-success'
    case 'failed': return 'bg-error/10 text-error'
    case 'rolled_back': return 'bg-warning/10 text-warning'
    case 'applying': return 'bg-accent/10 text-accent animate-pulse'
    default: return 'bg-theme-tertiary text-theme-muted'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Current Version -->
    <section class="animate-fade-in">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Info" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Current Version</h2>
          <p class="text-xs text-theme-tertiary">CubeOS system version information</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-theme-primary">
                {{ updates.currentVersion || 'Unknown' }}
              </p>
              <span
                v-if="updates.channel"
                class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-muted text-accent uppercase tracking-wider"
              >
                {{ updates.channel }}
              </span>
            </div>
            <p class="text-xs text-theme-tertiary mt-0.5">
              Last checked: {{ formatDate(updates.lastChecked) }}
            </p>
          </div>
          <button
            @click="updates.checkForUpdates()"
            :disabled="updates.checking"
            class="px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 flex-shrink-0 ml-4"
            :class="updates.checking
              ? 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              : 'btn-accent'"
          >
            <Icon
              v-if="updates.checking"
              name="Loader2"
              :size="14"
              class="animate-spin"
            />
            <Icon v-else name="RefreshCw" :size="14" />
            {{ updates.checking ? 'Checking...' : 'Check Now' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Available Update -->
    <section v-if="updates.hasUpdate" class="animate-fade-in" style="animation-delay: 50ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon name="Download" :size="16" class="text-accent" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Update Available</h2>
          <p class="text-xs text-theme-tertiary">A new version of CubeOS is ready</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-theme-primary bg-theme-card space-y-4">
        <!-- Version badge -->
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-lg bg-accent-muted text-accent">
            {{ updates.latestVersion }}
          </span>
          <span class="text-xs text-theme-tertiary">available</span>
        </div>

        <!-- Release notes -->
        <div v-if="updates.release?.notes" class="text-sm text-theme-secondary">
          <pre class="whitespace-pre-wrap font-sans text-xs leading-relaxed">{{ updates.release.notes }}</pre>
        </div>

        <!-- Breaking changes warning -->
        <div
          v-if="updates.hasBreakingChanges"
          class="p-3 rounded-lg bg-warning/10 border border-warning/20"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <Icon name="AlertTriangle" :size="14" class="text-warning flex-shrink-0" />
            <p class="text-xs font-semibold text-warning">Breaking Changes</p>
          </div>
          <ul class="space-y-1 ml-5">
            <li
              v-for="(change, i) in updates.release.breaking"
              :key="i"
              class="text-xs text-warning/80 list-disc"
            >
              {{ change }}
            </li>
          </ul>
        </div>

        <!-- Apply button -->
        <div class="flex items-center justify-end">
          <button
            @click="handleApply"
            :disabled="updates.applying"
            class="px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
            :class="updates.applying
              ? 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              : 'btn-accent'"
          >
            <Icon
              v-if="updates.applying"
              name="Loader2"
              :size="14"
              class="animate-spin"
            />
            <Icon v-else name="Download" :size="14" />
            {{ updates.applying ? 'Applying...' : 'Apply Update' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Update Progress Modal -->
    <Teleport to="body">
      <div
        v-if="showProgress"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Update progress"
      >
        <div class="absolute inset-0 bg-theme-overlay backdrop-blur-sm"></div>

        <div class="relative w-full max-w-md bg-theme-card rounded-2xl border border-theme-primary shadow-theme-xl overflow-hidden animate-fade-in flex flex-col">
          <!-- Header -->
          <div class="flex items-center gap-3 p-5 border-b border-theme-primary">
            <div class="w-12 h-12 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
              <Icon name="Download" :size="24" class="text-theme-muted" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-semibold text-theme-primary truncate">
                {{ progressDone ? 'Update Complete' : progressError ? 'Update Failed' : 'Updating CubeOS' }}
              </h2>
              <p class="text-xs text-theme-muted mt-0.5">
                {{ progressDone ? 'Restart to apply changes' : progressError ? '' : `Updating to ${updates.latestVersion}` }}
              </p>
            </div>
            <button
              v-if="progressDone || progressError"
              @click="closeProgress"
              aria-label="Close"
              class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            >
              <Icon name="X" :size="18" />
            </button>
          </div>

          <!-- Steps -->
          <div class="p-5 space-y-2.5 max-h-80 overflow-y-auto">
            <div
              v-for="step in progressSteps"
              :key="step.key"
              class="flex items-center gap-3 text-sm"
              :class="{
                'text-theme-muted': step.status === 'pending',
                'text-theme-primary font-medium': step.status === 'active',
                'text-success': step.status === 'done',
              }"
            >
              <div class="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <div
                  v-if="step.status === 'pending'"
                  class="w-3 h-3 rounded-full border-2 border-theme-tertiary"
                ></div>
                <Icon
                  v-else-if="step.status === 'active'"
                  name="Loader2"
                  :size="16"
                  class="animate-spin text-accent"
                />
                <Icon
                  v-else-if="step.status === 'done'"
                  name="CheckCircle"
                  :size="16"
                  class="text-success"
                />
              </div>
              <span>{{ step.label }}</span>
            </div>
          </div>

          <!-- Error message -->
          <div v-if="progressError" class="px-5 pb-4">
            <div class="p-3 rounded-lg bg-error/10 border border-error/20">
              <p class="text-sm text-error font-medium">Error</p>
              <p class="text-xs text-error/80 mt-1">{{ progressErrorMessage }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-theme-primary bg-theme-secondary">
            <button
              v-if="progressDone || progressError"
              @click="closeProgress"
              class="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="progressDone ? 'btn-accent' : 'border border-theme-primary text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'"
            >
              {{ progressDone ? 'Done' : 'Close' }}
            </button>
            <span v-else class="text-xs text-theme-muted">
              Updating...
            </span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Update History -->
    <section class="animate-fade-in" style="animation-delay: 100ms">
      <div class="flex items-center gap-2.5 mb-3">
        <div class="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
          <Icon name="Clock" :size="16" class="text-theme-secondary" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-theme-primary">Update History</h2>
          <p class="text-xs text-theme-tertiary">Previous system updates</p>
        </div>
      </div>

      <div class="rounded-xl border border-theme-primary bg-theme-card overflow-hidden">
        <!-- Empty state -->
        <div v-if="!updates.history.length && !updates.loading" class="p-8 text-center">
          <Icon name="Clock" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-muted">No updates applied yet</p>
        </div>

        <!-- Loading -->
        <div v-else-if="updates.loading" class="p-8 text-center">
          <Icon name="Loader2" :size="24" class="text-theme-muted mx-auto mb-2 animate-spin" />
          <p class="text-sm text-theme-muted">Loading history...</p>
        </div>

        <!-- History table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-theme-primary">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-theme-tertiary uppercase tracking-wider">Version</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-theme-tertiary uppercase tracking-wider">Status</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-theme-tertiary uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-theme-tertiary uppercase tracking-wider hidden sm:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in updates.history"
                :key="entry.id"
                class="border-b border-theme-primary last:border-0"
              >
                <td class="px-4 py-3">
                  <span class="text-theme-primary font-medium">{{ entry.from_version }}</span>
                  <Icon name="ArrowRight" :size="12" class="text-theme-muted mx-1 inline" />
                  <span class="text-theme-primary font-medium">{{ entry.to_version }}</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full"
                    :class="statusClass(entry.status)"
                  >
                    {{ entry.status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-theme-tertiary text-xs hidden sm:table-cell">
                  {{ formatDate(entry.started_at) }}
                </td>
                <td class="px-4 py-3 text-theme-tertiary text-xs hidden sm:table-cell">
                  {{ formatDuration(entry.started_at, entry.completed_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Error banner -->
    <div
      v-if="updates.error"
      class="p-3 rounded-lg bg-error/10 border border-error/20 animate-fade-in"
    >
      <div class="flex items-center gap-2">
        <Icon name="AlertTriangle" :size="14" class="text-error flex-shrink-0" />
        <p class="text-xs text-error">{{ updates.error }}</p>
      </div>
    </div>
  </div>
</template>
