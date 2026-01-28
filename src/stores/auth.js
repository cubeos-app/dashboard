import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)
  // Track authentication state reactively (not via localStorage check)
  const _isAuthenticated = ref(api.isAuthenticated())

  // Getters
  const isAuthenticated = computed(() => _isAuthenticated.value)
  const isAdmin = computed(() => user.value?.is_admin ?? false)
  const username = computed(() => user.value?.username ?? '')

  // Actions
  async function login(usernameVal, password) {
    loading.value = true
    error.value = null
    try {
      await api.login(usernameVal, password)
      _isAuthenticated.value = true  // Update reactive state
      await fetchUser()
      return true
    } catch (e) {
      error.value = e.message
      _isAuthenticated.value = false
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await api.logout()
    user.value = null
    _isAuthenticated.value = false  // Update reactive state
  }

  async function fetchUser() {
    if (!api.isAuthenticated()) {
      _isAuthenticated.value = false
      return
    }
    try {
      user.value = await api.getMe()
      _isAuthenticated.value = true
    } catch {
      user.value = null
      _isAuthenticated.value = false
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
    _isAuthenticated.value = api.isAuthenticated()
    if (_isAuthenticated.value) {
      await fetchUser()
    }
  }

  return {
    user,
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
