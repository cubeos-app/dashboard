/**
 * CubeOS API Client
 * 
 * Updated for Sprint 4: Uses unified /api/v1/apps endpoints.
 * Deprecated /services/* endpoints removed.
 * 
 * All service operations should use the apps.js store instead.
 */

import { safeGetRaw, safeSetRaw, safeRemoveItem } from '@/utils/storage'

const API_BASE = '/api/v1'

class ApiClient {
  constructor() {
    this.accessToken = safeGetRaw('cubeos_access_token')
    this.refreshToken = safeGetRaw('cubeos_refresh_token')
    // Guard against concurrent refresh attempts
    this._refreshPromise = null
  }

  /**
   * Get authorization headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }
    return headers
  }

  /**
   * Make an authenticated API request with optional retry
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    }

    let response
    try {
      response = await fetch(url, config)
    } catch (err) {
      // Don't treat aborted requests as errors
      if (err.name === 'AbortError') return null
      throw err
    }

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken()
      if (refreshed) {
        config.headers = this.getHeaders()
        try {
          response = await fetch(url, config)
        } catch (err) {
          if (err.name === 'AbortError') return null
          throw err
        }
      }
    }

    return response
  }

  /**
   * Make a request with automatic retry for transient failures.
   * Retries up to maxRetries times with exponential backoff.
   * Does NOT retry auth endpoints or aborted requests.
   */
  async requestWithRetry(endpoint, options = {}, maxRetries = 2) {
    // Skip retry for auth endpoints
    if (endpoint.startsWith('/auth')) {
      return this.request(endpoint, options)
    }

    let lastError
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.request(endpoint, options)
        // Don't retry on client errors (4xx) except 408/429
        // Also skip 503 (Service Unavailable) — hardware absence won't resolve on retry
        if (response && response.ok) return response
        if (response && (response.status < 500 || response.status === 503) && response.status !== 408 && response.status !== 429) {
          return response
        }
        // Server error or rate-limited — retry
        lastError = new Error(`HTTP ${response?.status || 'error'}`)
      } catch (err) {
        if (err.name === 'AbortError') return null
        lastError = err
      }

      // Exponential backoff: 500ms, 1500ms
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt)))
      }
    }
    throw lastError
  }

  // ==========================================
  // Authentication
  // ==========================================

  /**
   * Login with username and password
   */
  async login(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }))
      throw new Error(error.error || error.message || 'Login failed')
    }

    const data = await response.json()
    this.setTokens(data.access_token || data.token, data.refresh_token)
    return data
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) return false

    // If a refresh is already in progress, wait for it instead of starting another
    if (this._refreshPromise) {
      return this._refreshPromise
    }

    this._refreshPromise = this._doRefresh()
    try {
      return await this._refreshPromise
    } finally {
      this._refreshPromise = null
    }
  }

  /**
   * Internal: perform the actual token refresh
   */
  async _doRefresh() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken })
      })

      if (!response.ok) {
        this.clearTokens()
        return false
      }

      const data = await response.json()
      this.setTokens(data.access_token || data.token, data.refresh_token)
      return true
    } catch {
      this.clearTokens()
      return false
    }
  }

  /**
   * Store tokens
   */
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken
    if (accessToken) {
      safeSetRaw('cubeos_access_token', accessToken)
    }
    if (refreshToken) {
      this.refreshToken = refreshToken
      safeSetRaw('cubeos_refresh_token', refreshToken)
    }
  }

  /**
   * Clear tokens (logout)
   */
  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    safeRemoveItem('cubeos_access_token')
    safeRemoveItem('cubeos_refresh_token')
    // Notify auth store of token invalidation
    window.dispatchEvent(new Event('cubeos:auth-expired'))
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors
    }
    this.clearTokens()
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken
  }

  /**
   * Get current user info
   */
  async getMe() {
    const response = await this.request('/auth/me')
    if (!response.ok) throw new Error('Failed to get user info')
    return response.json()
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    const response = await this.request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed' }))
      throw new Error(error.error || error.message || 'Failed to change password')
    }
    return response.json()
  }

  // ==========================================
  // System endpoints (verified working)
  // ==========================================

  async getSystemInfo() {
    const response = await this.request('/system/info')
    if (!response.ok) throw new Error('Failed to get system info')
    return response.json()
  }

  async getSystemStats() {
    const response = await this.request('/system/stats')
    if (!response.ok) throw new Error('Failed to get system stats')
    return response.json()
  }

  async getSystemTemperature() {
    const response = await this.request('/system/temperature')
    if (!response.ok) throw new Error('Failed to get temperature')
    return response.json()
  }

  async reboot() {
    const response = await this.request('/system/reboot', { method: 'POST' })
    if (!response.ok) throw new Error('Failed to reboot')
    return response.json()
  }

  async shutdown() {
    const response = await this.request('/system/shutdown', { method: 'POST' })
    if (!response.ok) throw new Error('Failed to shutdown')
    return response.json()
  }

  // ==========================================
  // Generic REST helpers (used by stores)
  // ==========================================

  /**
   * Create an error that carries the HTTP status code.
   * Components can check err.status to differentiate 501 (not supported)
   * from 500 (server error) or 503 (service unavailable).
   */
  _createApiError(message, status) {
    const err = new Error(message)
    err.status = status
    return err
  }

  async get(endpoint, params = {}, options = {}) {
    const queryString = Object.keys(params).length 
      ? '?' + new URLSearchParams(params).toString()
      : ''
    const response = await this.requestWithRetry(endpoint + queryString, options)
    if (!response) return null // Request was aborted
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw this._createApiError(error.error || error.message || 'Request failed', response.status)
    }
    return response.json()
  }

  async post(endpoint, data = {}, options = {}) {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    })
    if (!response) return null // Request was aborted
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw this._createApiError(error.error || error.message || 'Request failed', response.status)
    }
    if (response.status === 204) return { success: true }
    return response.json()
  }

  async put(endpoint, data = {}, options = {}) {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    })
    if (!response) return null // Request was aborted
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw this._createApiError(error.error || error.message || 'Request failed', response.status)
    }
    if (response.status === 204) return { success: true }
    return response.json()
  }

  async delete(endpoint, data = null, options = {}) {
    const opts = { method: 'DELETE', ...options }
    if (data !== null) {
      opts.body = JSON.stringify(data)
    }
    const response = await this.request(endpoint, opts)
    if (!response) return null // Request was aborted
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw this._createApiError(error.error || error.message || 'Request failed', response.status)
    }
    if (response.status === 204) return { success: true }
    return response.json()
  }
}

export const api = new ApiClient()
export default api
