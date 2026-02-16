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
        <p class="status-detail text-sm text-gray-400 mt-2">{{ statusDetail }}</p>
      </div>

      <!-- Elapsed Time -->
      <div v-if="elapsed > 0" class="elapsed-section">
        <p class="text-xs text-gray-500">{{ elapsedFormatted }}</p>
      </div>

      <!-- Recovery Message (after timeout) -->
      <div v-if="showRecovery" class="recovery-section">
        <p class="text-sm text-amber-400 mb-2">The API is taking longer than expected to start.</p>
        <p class="text-xs text-gray-400">
          Try refreshing this page, or SSH into the device and check service status with:
        </p>
        <code class="text-xs text-gray-300 mt-1 block">docker service ls</code>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSetupStore } from '@/stores/setup'

const router = useRouter()
const setupStore = useSetupStore()

const elapsed = ref(0)
const showRecovery = ref(false)
const statusMessage = ref('Connecting to CubeOS...')
const statusDetail = ref('Waiting for the API to become available')

let pollInterval = null
let elapsedInterval = null

const POLL_INTERVAL_MS = 3000
const RECOVERY_TIMEOUT_S = 120

const elapsedFormatted = computed(() => {
  const mins = Math.floor(elapsed.value / 60)
  const secs = elapsed.value % 60
  if (mins > 0) return `Waiting ${mins}m ${secs}s`
  return `Waiting ${secs}s`
})

async function pollStatus() {
  try {
    const data = await setupStore.fetchStatus(true)
    if (data && data.is_complete !== undefined) {
      // API is reachable — route appropriately
      if (data.is_complete) {
        statusMessage.value = 'Connected'
        statusDetail.value = 'Redirecting to login...'
        cleanup()
        router.replace({ name: 'login' })
      } else {
        statusMessage.value = 'Connected'
        statusDetail.value = 'Starting setup wizard...'
        cleanup()
        router.replace({ name: 'setup' })
      }
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

  // Start polling
  pollStatus() // immediate first attempt
  pollInterval = setInterval(pollStatus, POLL_INTERVAL_MS)
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
  padding: 2rem;
  max-width: 400px;
}

.logo-section {
  margin-bottom: 2rem;
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
  margin-bottom: 1.5rem;
}

.status-text {
  font-size: 1rem;
  color: #94a3b8;
  margin-top: 1rem;
}

.elapsed-section {
  margin-bottom: 1rem;
}

.recovery-section {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid #3730a3;
  border-radius: 0.5rem;
  background-color: rgba(30, 27, 75, 0.5);
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

code {
  background-color: rgba(15, 23, 42, 0.8);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}
</style>
