import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  // Available themes
  const themes = ref([
    {
      id: 'obsidian',
      name: 'Obsidian',
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
      id: 'midnight',
      name: 'Midnight',
      description: 'Elegant purple tones',
      mode: 'dark',
      preview: {
        bg: '#0f0f14',
        card: '#1c1c28',
        accent: '#8b5cf6',
        text: '#f8f8fc'
      }
    },
    {
      id: 'snow',
      name: 'Snow',
      description: 'Clean white with blue accents',
      mode: 'light',
      preview: {
        bg: '#ffffff',
        card: '#ffffff',
        accent: '#0ea5e9',
        text: '#18181b'
      }
    },
    {
      id: 'pearl',
      name: 'Pearl',
      description: 'Warm cream with teal accents',
      mode: 'light',
      preview: {
        bg: '#fffffe',
        card: '#fffffe',
        accent: '#14b8a6',
        text: '#1c1917'
      }
    }
  ])

  // Current theme ID
  const currentThemeId = ref(localStorage.getItem('cubeos-theme') || 'obsidian')

  // Current theme object
  const currentTheme = computed(() => {
    return themes.value.find(t => t.id === currentThemeId.value) || themes.value[0]
  })

  // Is dark mode
  const isDark = computed(() => {
    return currentTheme.value?.mode === 'dark'
  })

  // Dark themes
  const darkThemes = computed(() => {
    return themes.value.filter(t => t.mode === 'dark')
  })

  // Light themes
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
    
    // Also set dark class for Tailwind compatibility
    const theme = themes.value.find(t => t.id === themeId)
    if (theme?.mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Initialize theme on load
  function initTheme() {
    const savedTheme = localStorage.getItem('cubeos-theme') || 'obsidian'
    currentThemeId.value = savedTheme
    applyTheme(savedTheme)
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
