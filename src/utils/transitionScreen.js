/**
 * transitionScreen.js
 *
 * Global transition screen service for reboot, shutdown, and WiFi reconnect flows.
 * Follows the same pattern as confirmDialog.js — reactive state read by a
 * component mounted in App.vue.
 *
 * Usage:
 *   import { showRebootTransition, showShutdownTransition, showWiFiTransition } from '@/utils/transitionScreen'
 *
 *   // After API call succeeds:
 *   showRebootTransition()
 *   showShutdownTransition()
 *   showWiFiTransition('MyNewSSID')
 */
import { reactive } from 'vue'

export const transitionState = reactive({
  /** Whether the transition screen is visible */
  active: false,
  /** Transition mode: 'reboot' | 'shutdown' | 'wifi' */
  mode: 'reboot',
  /** New SSID to display (wifi mode only) */
  ssid: '',
  /** Countdown duration in seconds before system goes down */
  countdown: 15
})

/**
 * Show reboot transition screen.
 * Green colour scheme, countdown, then redirect to /connecting.
 */
export function showRebootTransition() {
  transitionState.mode = 'reboot'
  transitionState.ssid = ''
  transitionState.countdown = 15
  transitionState.active = true
}

/**
 * Show shutdown transition screen.
 * Red colour scheme, countdown, then "safe to disconnect" final screen.
 */
export function showShutdownTransition() {
  transitionState.mode = 'shutdown'
  transitionState.ssid = ''
  transitionState.countdown = 10
  transitionState.active = true
}

/**
 * Show WiFi reconnect transition screen.
 * Blue colour scheme, displays new SSID, polls health, redirects to /login.
 * @param {string} ssid - The new SSID the user should connect to
 */
export function showWiFiTransition(ssid) {
  transitionState.mode = 'wifi'
  transitionState.ssid = ssid || 'CubeOS'
  transitionState.countdown = 5
  transitionState.active = true
}

/**
 * Hide the transition screen.
 */
export function hideTransition() {
  transitionState.active = false
}
