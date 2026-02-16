<template>
  <div class="connecting-container">
    <div class="connecting-card">
      <!-- CubeOS Logo -->
      <div class="logo-section">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="logo-icon">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <h1 class="logo-text">CubeOS</h1>
      </div>

      <!-- Status Message -->
      <div class="status-section">
        <div class="spinner"></div>
        <p class="status-text">{{ statusMessage }}</p>
      </div>

      <!-- Boot Type Badge -->
      <span v-if="bootType" :class="['badge', bootType === 'first' ? 'badge-first' : 'badge-normal']">
        {{ bootType === 'first' ? 'First Boot' : 'Normal Boot' }}
      </span>

      <!-- Boot Log Panel -->
      <div class="log-panel" ref="logPanelRef">
        <pre v-html="colorizedLog"></pre>
      </div>

      <!-- Elapsed Time -->
      <div v-if="elapsed > 0" class="elapsed-section">
        <p class="elapsed-text">{{ elapsedFormatted }}</p>
      </div>

      <!-- Recovery Message (after timeout) -->
      <div v-if="showRecovery" class="recovery-section">
        <p>The system is taking longer than expected to start.</p>
        <p class="recovery-hint">SSH into the device and check:</p>
        <code>docker service ls</code>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSetupStore } from '@/stores/setup'

const router = useRouter()
const setupStore = useSetupStore()
const logPanelRef = ref(null)

const elapsed = ref(0)
const showRecovery = ref(false)
const statusMessage = ref('Connecting to CubeOS...')
const bootType = ref(null)
const bootLog = ref('')

let pollInterval = null
let elapsedInterval = null

const POLL_INTERVAL_MS = 2000
const RECOVERY_TIMEOUT_S = 180

const elapsedFormatted = computed(() => {
  const mins = Math.floor(elapsed.value / 60)
  const secs = elapsed.value % 60
  if (mins > 0) return `Waiting ${mins}m ${secs}s`
  return `Waiting ${secs}s`
})

/**
 * Colorize boot log lines for display.
 * Matches the same format as cubeos-boot.html.
 */
const colorizedLog = computed(() => {
  if (!bootLog.value) return 'Waiting for boot log...'
  return bootLog.value.split('\n').map(line => {
    const escaped = escapeHtml(line)
    if (/\bOK:/.test(line))     return `<span class="log-ok">${escaped}</span>`
    if (/\bWARN:/.test(line))   return `<span class="log-warn">${escaped}</span>`
    if (/\bFAIL:/.test(line))   return `<span class="log-fail">${escaped}</span>`
    if (/\bStep \d/.test(line)) return `<span class="log-step">${escaped}</span>`
    return escaped
  }).join('\n')
})

function escapeHtml(str) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(str))
  return div.innerHTML
}

/**
 * Fetch boot log from host filesystem (served via NPM location block).
 */
async function fetchBootLog() {
  try {
    const resp = await fetch('/cubeos-log', { cache: 'no-store' })
    if (resp.ok) {
      bootLog.value = await resp.text()
    }
  } catch {
    // Log endpoint not available yet — keep trying
  }
}

/**
 * Fetch boot metadata (boot type, started_at, version).
 */
async function fetchBootMeta() {
  try {
    const resp = await fetch('/cubeos-log-meta', { cache: 'no-store' })
    if (resp.ok) {
      const data = await resp.json()
      if (data && data.boot_type) {
        bootType.value = data.boot_type
      }
    }
  } catch {
    // Meta endpoint not available yet
  }
}

/**
 * Auto-scroll log panel to bottom when log content changes.
 */
watch(bootLog, async () => {
  await nextTick()
  if (logPanelRef.value) {
    logPanelRef.value.scrollTop = logPanelRef.value.scrollHeight
  }
})

/**
 * Poll API health + setup status.
 *
 * B13 FIX: When fetchStatus returns { unreachable: true }, we MUST keep polling
 * instead of redirecting to setup. The old code treated unreachable as "setup
 * incomplete", called cleanup() (stopping polls), and tried router.replace to
 * /setup. The router guard bounced it back to /connecting, but with intervals
 * already cleared, polling never resumed — the page was stuck forever.
 */
async function pollStatus() {
  try {
    const data = await setupStore.fetchStatus(true)

    if (!data || data.is_complete === undefined) return

    // B13: Skip redirect if API is unreachable — keep polling
    if (data.unreachable) {
      statusMessage.value = bootType.value === 'first'
        ? 'Provisioning system...'
        : 'Starting services...'
      return
    }

    // API is reachable — we have a definitive answer
    if (data.is_complete) {
      statusMessage.value = 'Connected'
      cleanup()
      router.replace({ name: 'login' })
    } else {
      statusMessage.value = 'Connected'
      cleanup()
      router.replace({ name: 'setup' })
    }
  } catch {
    // API still unreachable — keep polling
  }
}

function cleanup() {
  if (pollInterval) clearInterval(pollInterval)
  if (elapsedInterval) clearInterval(elapsedInterval)
}

onMounted(() => {
  // Start elapsed timer
  elapsedInterval = setInterval(() => {
    elapsed.value++
    if (elapsed.value >= RECOVERY_TIMEOUT_S) {
      showRecovery.value = true
    }
  }, 1000)

  // Start polling — all polls run on the same interval
  function doPoll() {
    pollStatus()
    fetchBootLog()
    fetchBootMeta()
  }
  doPoll() // immediate first attempt
  pollInterval = setInterval(doPoll, POLL_INTERVAL_MS)
})

onUnmounted(cleanup)
</script>

<style scoped>
.connecting-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0f172a;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.connecting-card {
  text-align: center;
  padding: 2rem 1.5rem;
  max-width: 520px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-height: 100vh;
}

.logo-section {
  margin-bottom: 1.5rem;
}

.logo-icon {
  margin: 0 auto 0.75rem;
  color: #60a5fa;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: 0.05em;
}

.status-section {
  margin-bottom: 0.5rem;
}

.status-text {
  font-size: 1rem;
  color: #94a3b8;
  margin-top: 1rem;
}

/* Boot type badges — match cubeos-boot.html */
.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  margin-bottom: 1rem;
}

.badge-first {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.badge-normal {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Boot log panel — match cubeos-boot.html */
.log-panel {
  width: 100%;
  background: #020617;
  border: 1px solid #1e293b;
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
  text-align: left;
  overflow-y: auto;
  max-height: 40vh;
  min-height: 120px;
}

.log-panel pre {
  font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #64748b;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-panel :deep(.log-ok)   { color: #4ade80; }
.log-panel :deep(.log-warn) { color: #facc15; }
.log-panel :deep(.log-fail) { color: #f87171; }
.log-panel :deep(.log-step) { color: #60a5fa; font-weight: 600; }

.elapsed-section {
  margin-bottom: 1rem;
}

.elapsed-text {
  font-size: 0.75rem;
  color: #475569;
}

.recovery-section {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #3730a3;
  border-radius: 0.5rem;
  background-color: rgba(30, 27, 75, 0.5);
  font-size: 0.8rem;
  color: #a5b4fc;
}

.recovery-hint {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.recovery-section code {
  display: block;
  margin-top: 0.5rem;
  background-color: rgba(15, 23, 42, 0.8);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #1e293b;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
