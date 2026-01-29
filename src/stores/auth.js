import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('cubeos_access_token') || null)
  const loading = ref(false)
  const error = ref(null)

  // Getters - token ref is reactive
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const username = computed(() => user.value?.username ?? '')

  // Actions
  async function login(usernameInput, password) {
    loading.value = true
    error.value = null
    try {
      const response = await api.login(usernameInput, password)
      // Update our reactive token ref
      token.value = response.access_token
      // Set user data from login response
      if (response.user) {
        user.value = response.user
      }
      return true
    } catch (e) {
      error.value = e.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
      // Ignore errors
    }
    token.value = null
    user.value = null
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      user.value = await api.getMe()
    } catch {
      user.value = null
    }
  }

  async function changePassword(currentPassword, newPassword) {
    loading.value = true
    error.value = null
    try {
      await api.changePassword(currentPassword, newPassword)
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // Initialize - check if we have a valid token
  async function init() {
    if (token.value) {
      await fetchUser()
    }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    username,
    login,
    logout,
    fetchUser,
    changePassword,
    init
  }
})
