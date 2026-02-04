import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  // Two themes: one dark, one light
  const themes = ref([
    {
      id: 'dark',
      name: 'Dark',
      description: 'Deep blacks with cyan accents',
      mode: 'dark',
      preview: {
        bg: '#09090b',
        card: '#1a1a1f',
        accent: '#0ea5e9',
        text: '#fafafa'
      }
    },
    {
      id: 'light',
      name: 'Light',
      description: 'Clean white with blue accents',
      mode: 'light',
      preview: {
        bg: '#ffffff',
        card: '#ffffff',
        accent: '#0ea5e9',
        text: '#18181b'
      }
    }
  ])

  // Migrate old theme IDs to new ones
  function migrateThemeId(id) {
    if (id === 'obsidian' || id === 'midnight') return 'dark'
    if (id === 'snow' || id === 'pearl') return 'light'
    if (id === 'dark' || id === 'light') return id
    return 'dark'
  }

  // Current theme ID
  const storedTheme = localStorage.getItem('cubeos-theme')
  const currentThemeId = ref(migrateThemeId(storedTheme || 'dark'))

  // Current theme object
  const currentTheme = computed(() => {
    return themes.value.find(t => t.id === currentThemeId.value) || themes.value[0]
  })

  // Is dark mode
  const isDark = computed(() => {
    return currentTheme.value?.mode === 'dark'
  })

  // Dark themes (for settings grid)
  const darkThemes = computed(() => {
    return themes.value.filter(t => t.mode === 'dark')
  })

  // Light themes (for settings grid)
  const lightThemes = computed(() => {
    return themes.value.filter(t => t.mode === 'light')
  })

  // Set theme
  function setTheme(themeId) {
    const theme = themes.value.find(t => t.id === themeId)
    if (theme) {
      currentThemeId.value = themeId
      localStorage.setItem('cubeos-theme', themeId)
      applyTheme(themeId)
    }
  }

  // Apply theme to document
  function applyTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId)
    
    // Set dark class for Tailwind compatibility
    const theme = themes.value.find(t => t.id === themeId)
    if (theme?.mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Initialize theme on load
  function initTheme() {
    const saved = migrateThemeId(localStorage.getItem('cubeos-theme') || 'dark')
    currentThemeId.value = saved
    localStorage.setItem('cubeos-theme', saved)
    applyTheme(saved)
  }

  // Watch for theme changes
  watch(currentThemeId, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    themes,
    currentThemeId,
    currentTheme,
    isDark,
    darkThemes,
    lightThemes,
    setTheme,
    initTheme
  }
})
