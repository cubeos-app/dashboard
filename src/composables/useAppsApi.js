/**
 * CubeOS Apps API Composable
 *
 * Shared low-level API methods for /apps/* endpoints.
 * Used by both apps.js (main UI store) and appmanager.js (admin store)
 * to eliminate duplicated HTTP calls.
 *
 * Each store wraps these with its own error handling, state management,
 * and post-mutation refresh logic — this composable only handles the
 * raw API transport.
 *
 * Endpoints covered:
 *   GET    /apps                       - List all apps
 *   GET    /apps/{name}                - Get single app
 *   POST   /apps/{name}/start          - Start app
 *   POST   /apps/{name}/stop           - Stop app
 *   POST   /apps/{name}/restart        - Restart app
 *   POST   /apps/{name}/enable         - Enable app (start on boot)
 *   POST   /apps/{name}/disable        - Disable app
 *   POST   /apps/{name}/tor            - Set Tor routing
 *   POST   /apps/{name}/vpn            - Set VPN routing
 *   POST   /apps                       - Install/register app
 *   DELETE /apps/{name}                - Uninstall/unregister app
 *   GET    /apps/{name}/logs           - Get app logs
 */

import api from '@/api/client'

function encodeName(name) {
  return encodeURIComponent(name)
}

export function useAppsApi() {
  /**
   * List all apps, with optional query params and abort signal
   * @param {Object} params - Query params (type, enabled, etc.)
   * @param {Object} options - { signal } for AbortController
   * @returns {Promise<Object>} - { apps: [...] }
   */
  function listApps(params = {}, options = {}) {
    return api.get('/apps', params, options)
  }

  /**
   * Get a single app by name
   * @param {string} name
   * @param {Object} options - { signal } for AbortController
   * @returns {Promise<Object>} - App object
   */
  function getApp(name, options = {}) {
    return api.get(`/apps/${encodeName(name)}`, {}, options)
  }

  /**
   * Start an app
   * @param {string} name
   * @returns {Promise<Object>}
   */
  function startApp(name) {
    return api.post(`/apps/${encodeName(name)}/start`)
  }

  /**
   * Stop an app
   * @param {string} name
   * @returns {Promise<Object>}
   */
  function stopApp(name) {
    return api.post(`/apps/${encodeName(name)}/stop`)
  }

  /**
   * Restart an app
   * @param {string} name
   * @returns {Promise<Object>}
   */
  function restartApp(name) {
    return api.post(`/apps/${encodeName(name)}/restart`)
  }

  /**
   * Enable an app (start on boot)
   * @param {string} name
   * @returns {Promise<Object>}
   */
  function enableApp(name) {
    return api.post(`/apps/${encodeName(name)}/enable`)
  }

  /**
   * Disable an app (don't start on boot)
   * @param {string} name
   * @returns {Promise<Object>}
   */
  function disableApp(name) {
    return api.post(`/apps/${encodeName(name)}/disable`)
  }

  /**
   * Set Tor routing for an app
   * @param {string} name
   * @param {boolean} enabled
   * @returns {Promise<Object>}
   */
  function setAppTor(name, enabled) {
    return api.post(`/apps/${encodeName(name)}/tor`, { enabled })
  }

  /**
   * Set VPN routing for an app
   * @param {string} name
   * @param {boolean} enabled
   * @returns {Promise<Object>}
   */
  function setAppVPN(name, enabled) {
    return api.post(`/apps/${encodeName(name)}/vpn`, { enabled })
  }

  /**
   * Install/register a new app
   * @param {Object} data - App registration data
   * @returns {Promise<Object>}
   */
  function installApp(data) {
    return api.post('/apps', data)
  }

  /**
   * Uninstall/unregister an app
   * @param {string} name
   * @param {boolean} keepData - Preserve volumes/data
   * @returns {Promise<Object>}
   */
  function uninstallApp(name, keepData = false) {
    return api.delete(`/apps/${encodeName(name)}?keep_data=${keepData}`)
  }

  /**
   * Get logs for an app
   * @param {string} name
   * @param {number} lines - Number of log lines
   * @param {Object} options - { signal } for AbortController
   * @returns {Promise<Object>} - { logs: [...] }
   */
  function getAppLogs(name, lines = 100, options = {}) {
    return api.get(`/apps/${encodeName(name)}/logs`, { lines }, options)
  }

  return {
    listApps,
    getApp,
    startApp,
    stopApp,
    restartApp,
    enableApp,
    disableApp,
    setAppTor,
    setAppVPN,
    installApp,
    uninstallApp,
    getAppLogs
  }
}
