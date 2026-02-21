<template>
  <Teleport to="body">
    <div v-if="transitionState.active" class="transition-overlay" :class="overlayClass">
      <div class="transition-card">
        <!-- CubeOS Logo -->
        <div class="logo-section">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" :class="['logo-icon', accentClass]">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <h1 class="logo-text">CubeOS</h1>
        </div>

        <!-- ═══════════ REBOOT MODE ═══════════ -->
        <template v-if="transitionState.mode === 'reboot'">
          <!-- Phase 1: Shutting down with countdown -->
          <template v-if="phase === 'countdown'">
            <div class="phase-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </div>
            <h2 class="phase-title">Rebooting System</h2>
            <p class="phase-subtitle">Shutting down services and containers...</p>

            <!-- Countdown ring -->
            <div class="countdown-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" stroke-width="4"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#4ade80" stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="countdownOffset"
                  class="countdown-arc"
                  transform="rotate(-90 40 40)"/>
              </svg>
              <span class="countdown-number text-emerald-400">{{ remainingSeconds }}</span>
            </div>

            <!-- Phase progress -->
            <div class="phase-progress">
              <div class="phase-dot active-green" />
              <div class="phase-line" />
              <div class="phase-dot" />
              <div class="phase-line" />
              <div class="phase-dot" />
            </div>
            <div class="phase-labels">
              <span class="phase-label active-text-green">Shutting Down</span>
              <span class="phase-label">Restarting</span>
              <span class="phase-label">Reconnecting</span>
            </div>
          </template>

          <!-- Phase 2: Waiting for reboot — reconnect guidance -->
          <template v-else-if="phase === 'reconnecting'">
            <div class="phase-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400 animate-pulse-slow">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
            <h2 class="phase-title">Reconnect to WiFi</h2>
            <div class="ssid-display ssid-display-green">
              <span class="ssid-label ssid-label-green">Network Name</span>
              <span class="ssid-value">{{ transitionState.ssid }}</span>
            </div>
            <p class="phase-subtitle">
              Your WiFi connection was dropped during reboot.<br>
              Open your device's WiFi settings and reconnect to the network above.
            </p>

            <div class="spinner spinner-green"></div>
            <p class="attempt-counter">
              Waiting for system... <span class="attempt-num">Attempt {{ reconnect.attempts.value }}</span>
            </p>

            <!-- Phase progress -->
            <div class="phase-progress">
              <div class="phase-dot done-green" />
              <div class="phase-line done-line-green" />
              <div class="phase-dot active-green" />
              <div class="phase-line" />
              <div class="phase-dot" />
            </div>
            <div class="phase-labels">
              <span class="phase-label done-text-green">Shut Down</span>
              <span class="phase-label active-text-green">Restarting</span>
              <span class="phase-label">Reconnecting</span>
            </div>
          </template>

          <!-- Phase 3: Connected — redirecting -->
          <template v-else-if="phase === 'complete'">
            <div class="phase-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 class="phase-title">Connected</h2>
            <p class="phase-subtitle">Redirecting to dashboard...</p>

            <!-- Phase progress -->
            <div class="phase-progress">
              <div class="phase-dot done-green" />
              <div class="phase-line done-line-green" />
              <div class="phase-dot done-green" />
              <div class="phase-line done-line-green" />
              <div class="phase-dot done-green" />
            </div>
            <div class="phase-labels">
              <span class="phase-label done-text-green">Shut Down</span>
              <span class="phase-label done-text-green">Restarted</span>
              <span class="phase-label done-text-green">Connected</span>
            </div>
          </template>
        </template>

        <!-- ═══════════ SHUTDOWN MODE ═══════════ -->
        <template v-if="transitionState.mode === 'shutdown'">
          <!-- Phase 1: Shutting down with countdown -->
          <template v-if="phase === 'countdown'">
            <div class="phase-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </div>
            <h2 class="phase-title">Shutting Down</h2>
            <p class="phase-subtitle">Stopping all services and containers...</p>

            <div class="countdown-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" stroke-width="4"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#f87171" stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="countdownOffset"
                  class="countdown-arc"
                  transform="rotate(-90 40 40)"/>
              </svg>
              <span class="countdown-number text-red-400">{{ remainingSeconds }}</span>
            </div>

            <div class="phase-progress">
              <div class="phase-dot active-red" />
              <div class="phase-line" />
              <div class="phase-dot" />
            </div>
            <div class="phase-labels">
              <span class="phase-label active-text-red">Shutting Down</span>
              <span class="phase-label">Complete</span>
            </div>
          </template>

          <!-- Phase 2: Shutdown complete -->
          <template v-else-if="phase === 'complete'">
            <div class="phase-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 class="phase-title">Shutdown Complete</h2>
            <p class="phase-subtitle-large">You can safely disconnect power.</p>

            <div class="shutdown-info">
              <p>To restart, disconnect and reconnect the power supply,</p>
              <p>or press the power button on your device.</p>
            </div>

            <div class="phase-progress">
              <div class="phase-dot done-red" />
              <div class="phase-line done-line-red" />
              <div class="phase-dot done-red" />
            </div>
            <div class="phase-labels">
              <span class="phase-label done-text-red">Shut Down</span>
              <span class="phase-label done-text-red">Complete</span>
            </div>
          </template>
        </template>

        <!-- ═══════════ WIFI MODE ═══════════ -->
        <template v-if="transitionState.mode === 'wifi'">
          <!-- Phase 1: Countdown before AP restarts -->
          <template v-if="phase === 'countdown'">
            <div class="phase-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
            <h2 class="phase-title">Restarting Access Point</h2>
            <p class="phase-subtitle">WiFi will disconnect momentarily...</p>

            <div class="countdown-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" stroke-width="4"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#60a5fa" stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="countdownOffset"
                  class="countdown-arc"
                  transform="rotate(-90 40 40)"/>
              </svg>
              <span class="countdown-number text-blue-400">{{ remainingSeconds }}</span>
            </div>
          </template>

          <!-- Phase 2: Waiting for reconnect -->
          <template v-else-if="phase === 'reconnecting'">
            <div class="phase-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 animate-pulse-slow">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
            <h2 class="phase-title">Connect to WiFi</h2>
            <div class="ssid-display">
              <span class="ssid-label">Network Name</span>
              <span class="ssid-value">{{ transitionState.ssid }}</span>
            </div>
            <p class="phase-subtitle">
              Open your device's WiFi settings and connect to the network above.
            </p>

            <div class="spinner spinner-blue"></div>
            <p class="attempt-counter">
              Checking connection... <span class="attempt-num">Attempt {{ reconnect.attempts.value }}</span>
            </p>
          </template>

          <!-- Phase 3: Connected -->
          <template v-else-if="phase === 'complete'">
            <div class="phase-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 class="phase-title">Connected</h2>
            <p class="phase-subtitle">Redirecting to login...</p>
          </template>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * SystemTransitionScreen.vue — F1/F2 Feature
 *
 * Full-screen overlay for system reboot, shutdown, and WiFi reconnect flows.
 * Mounted in App.vue, controlled via transitionState from utils/transitionScreen.js.
 *
 * Modes:
 *   reboot   — green, countdown → SSID reconnect guidance + poll → redirect to /dashboard
 *   shutdown — red, countdown → "safe to disconnect" final screen
 *   wifi     — blue, countdown → show SSID + poll → redirect to /login
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { transitionState, hideTransition } from '@/utils/transitionScreen'
import { useReconnect } from '@/composables/useReconnect'

const router = useRouter()
const reconnect = useReconnect({ intervalMs: 3000 })

// ─── Phase management ────────────────────────────────────────
const phase = ref('countdown')
const remainingSeconds = ref(0)
let countdownTimer = null

// SVG countdown ring
const circumference = 2 * Math.PI * 34 // r=34
const countdownOffset = computed(() => {
  if (!transitionState.active || transitionState.countdown <= 0) return 0
  const progress = remainingSeconds.value / transitionState.countdown
  return circumference * (1 - progress)
})

// ─── Overlay + accent classes ────────────────────────────────
const overlayClass = computed(() => {
  return `mode-${transitionState.mode}`
})

const accentClass = computed(() => {
  const map = { reboot: 'text-emerald-400', shutdown: 'text-red-400', wifi: 'text-blue-400' }
  return map[transitionState.mode] || 'text-blue-400'
})

// ─── Watch for activation ────────────────────────────────────
watch(() => transitionState.active, (active) => {
  if (active) {
    startTransition()
  } else {
    cleanup()
  }
})

function startTransition() {
  phase.value = 'countdown'
  remainingSeconds.value = transitionState.countdown

  // Start countdown
  countdownTimer = setInterval(() => {
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      onCountdownComplete()
    }
  }, 1000)
}

function onCountdownComplete() {
  const mode = transitionState.mode

  if (mode === 'reboot') {
    // Show reconnect guidance with SSID and start health polling
    phase.value = 'reconnecting'
    reconnect.start()
  }

  if (mode === 'shutdown') {
    // Show "shutdown complete" final screen
    phase.value = 'complete'
    // Stay on this screen forever — no redirect
  }

  if (mode === 'wifi') {
    // Start polling for reconnection
    phase.value = 'reconnecting'
    reconnect.start()
  }
}

// ─── Reconnect detection (shared by reboot + wifi modes) ────
watch(() => reconnect.reconnected.value, (val) => {
  if (!val) return
  const mode = transitionState.mode

  if (mode === 'reboot') {
    phase.value = 'complete'
    reconnect.stop()
    setTimeout(() => {
      hideTransition()
      router.replace({ name: 'dashboard' })
    }, 1500)
  }

  if (mode === 'wifi') {
    phase.value = 'complete'
    reconnect.stop()
    setTimeout(() => {
      hideTransition()
      router.replace({ name: 'login' })
    }, 1500)
  }
})

// Handle fast reconnect (AP came back quickly / user already on CubeOS network)
watch(() => reconnect.connected.value, (connected) => {
  if (!connected || phase.value !== 'reconnecting') return
  const mode = transitionState.mode
  if (mode !== 'reboot' && mode !== 'wifi') return

  const target = mode === 'reboot' ? 'dashboard' : 'login'
  setTimeout(() => {
    if (reconnect.connected.value) {
      phase.value = 'complete'
      reconnect.stop()
      setTimeout(() => {
        hideTransition()
        router.replace({ name: target })
      }, 1500)
    }
  }, 2000)
})

// ─── Cleanup ─────────────────────────────────────────────────
function cleanup() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  reconnect.stop()
  phase.value = 'countdown'
  remainingSeconds.value = 0
}

onUnmounted(cleanup)
</script>

<style scoped>
.transition-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0f172a;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.transition-card {
  text-align: center;
  padding: 2rem 1.5rem;
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

/* ─── Logo ──────────────────────────────── */

.logo-section {
  margin-bottom: 1.5rem;
}

.logo-icon {
  margin: 0 auto 0.75rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: 0.05em;
}

/* ─── Phase icon ────────────────────────── */

.phase-icon {
  margin-bottom: 0.75rem;
}

/* ─── Phase text ────────────────────────── */

.phase-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 0.25rem;
}

.phase-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-bottom: 1.25rem;
  line-height: 1.5;
  max-width: 320px;
}

.phase-subtitle-large {
  font-size: 1rem;
  color: #94a3b8;
  margin-bottom: 0.75rem;
}

/* ─── Countdown ring ────────────────────── */

.countdown-ring {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0.75rem 0 1.5rem;
}

.countdown-arc {
  transition: stroke-dashoffset 1s linear;
}

.countdown-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ─── Phase progress dots ───────────────── */

.phase-progress {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.phase-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #334155;
  flex-shrink: 0;
}

.phase-line {
  width: 48px;
  height: 2px;
  background: #334155;
}

/* Green mode dots */
.active-green {
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
}
.done-green {
  background: #4ade80;
}
.done-line-green {
  background: #4ade80;
}

/* Red mode dots */
.active-red {
  background: #f87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.4);
}
.done-red {
  background: #f87171;
}
.done-line-red {
  background: #f87171;
}

/* ─── Phase labels ──────────────────────── */

.phase-labels {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.phase-label {
  font-size: 0.7rem;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.active-text-green { color: #4ade80; }
.active-text-red { color: #f87171; }
.done-text-green { color: #4ade80; opacity: 0.7; }
.done-text-red { color: #f87171; opacity: 0.7; }

/* ─── Spinner ───────────────────────────── */

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #1e293b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0.75rem 0;
}

.spinner-green {
  border-top-color: #4ade80;
}

.spinner-blue {
  border-top-color: #60a5fa;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── WiFi SSID display (blue — WiFi mode) ─── */

.ssid-display {
  background: rgba(30, 58, 138, 0.3);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  margin: 0.5rem 0 0.75rem;
  text-align: center;
}

.ssid-label {
  display: block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #60a5fa;
  margin-bottom: 0.25rem;
  font-weight: 600;
}

/* ─── SSID display (green — reboot mode) ─── */

.ssid-display-green {
  background: rgba(6, 78, 59, 0.3);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.ssid-label-green {
  color: #4ade80;
}

.ssid-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.02em;
}

/* ─── Attempt counter ───────────────────── */

.attempt-counter {
  font-size: 0.75rem;
  color: #64748b;
}

.attempt-num {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

/* ─── Shutdown info ─────────────────────── */

.shutdown-info {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 0.75rem;
  background: rgba(127, 29, 29, 0.15);
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

/* ─── Pulse animation for WiFi icon ─────── */

.animate-pulse-slow {
  animation: pulseSlow 2s ease-in-out infinite;
}

@keyframes pulseSlow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ─── Color accents ─────────────────────── */

.text-emerald-400 { color: #4ade80; }
.text-red-400 { color: #f87171; }
.text-blue-400 { color: #60a5fa; }
</style>
