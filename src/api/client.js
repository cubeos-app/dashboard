/**
 * CubeOS API Client
 * Handles authentication and API requests
 */

const API_BASE = '/api/v1'

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('cubeos_access_token')
    this.refreshToken = localStorage.getItem('cubeos_refresh_token')
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
   * Make an authenticated API request
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

    let response = await fetch(url, config)

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken()
      if (refreshed) {
        config.headers = this.getHeaders()
        response = await fetch(url, config)
      }
    }

    return response
  }

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
      const error = await response.json()
      throw new Error(error.message || 'Login failed')
    }

    const data = await response.json()
    this.setTokens(data.access_token, data.refresh_token)
    return data
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) return false

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
      this.setTokens(data.access_token, data.refresh_token)
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
    this.refreshToken = refreshToken
    localStorage.setItem('cubeos_access_token', accessToken)
    localStorage.setItem('cubeos_refresh_token', refreshToken)
  }

  /**
   * Clear tokens (logout)
   */
  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem('cubeos_access_token')
    localStorage.removeItem('cubeos_refresh_token')
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

  // ==========================================
  // Auth endpoints
  // ==========================================

  async getMe() {
    const response = await this.request('/auth/me')
    if (!response.ok) throw new Error('Failed to get user info')
    return response.json()
  }

  async changePassword(currentPassword, newPassword) {
    const response = await this.request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to change password')
    }
    return response.json()
  }

  // ==========================================
  // System endpoints
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
  // Services endpoints
  // ==========================================

  async getServices() {
    const response = await this.request('/services')
    if (!response.ok) throw new Error('Failed to get services')
    return response.json()
  }

  async getService(name) {
    const response = await this.request(`/services/${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error('Failed to get service')
    return response.json()
  }

  async getServicesStatus() {
    const response = await this.request('/services/status')
    if (!response.ok) throw new Error('Failed to get services status')
    return response.json()
  }

  async startService(name) {
    const response = await this.request(`/services/${encodeURIComponent(name)}/start`, { method: 'POST' })
    if (!response.ok) throw new Error('Failed to start service')
    return response.json()
  }

  async stopService(name) {
    const response = await this.request(`/services/${encodeURIComponent(name)}/stop`, { method: 'POST' })
    if (!response.ok) throw new Error('Failed to stop service')
    return response.json()
  }

  async restartService(name) {
    const response = await this.request(`/services/${encodeURIComponent(name)}/restart`, { method: 'POST' })
    if (!response.ok) throw new Error('Failed to restart service')
    return response.json()
  }

  async getServiceLogs(name, lines = 100) {
    const response = await this.request(`/services/${encodeURIComponent(name)}/logs?lines=${lines}`)
    if (!response.ok) throw new Error('Failed to get service logs')
    return response.json()
  }

  async getServiceStats(name) {
    const response = await this.request(`/services/${encodeURIComponent(name)}/stats`)
    if (!response.ok) throw new Error('Failed to get service stats')
    return response.json()
  }
}

export const api = new ApiClient()
export default api
