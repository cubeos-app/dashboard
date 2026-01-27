import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => api.isAuthenticated())
  const isAdmin = computed(() => user.value?.is_admin ?? false)
  const username = computed(() => user.value?.username ?? '')

  // Actions
  async function login(username, password) {
    loading.value = true
    error.value = null
    try {
      await api.login(username, password)
      await fetchUser()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  async function fetchUser() {
    if (!api.isAuthenticated()) return
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
    if (api.isAuthenticated()) {
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
