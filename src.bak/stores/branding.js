import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

export const useBrandingStore = defineStore('branding', () => {
  // Available brands
  const brands = ref([
    {
      id: 'cubeos',
      name: 'CubeOS',
      tagline: 'Open Source Server OS',
      logo: '/icon.svg',
      logoDark: '/icon.svg',
      primaryColor: '#0ea5e9',
      accentName: 'OS',
      github: 'https://github.com/cubeos-app/',
      website: 'https://cubeos.app'
    },
    {
      id: 'mulecube',
      name: 'MuleCube',
      tagline: 'Offline Knowledge Server',
      logo: '/branding/mulecube-icon.svg',
      logoDark: '/branding/mulecube-icon.svg',
      primaryColor: '#f59e0b',
      accentName: 'Cube',
      github: 'https://github.com/nuclearlighters/mulecube',
      website: 'https://mulecube.com'
    }
  ])

  // Current brand ID
  const currentBrandId = ref(localStorage.getItem('cubeos-brand') || 'cubeos')

  // Current brand object
  const currentBrand = computed(() => {
    return brands.value.find(b => b.id === currentBrandId.value) || brands.value[0]
  })

  // Convenience getters
  const brandName = computed(() => currentBrand.value.name)
  const brandLogo = computed(() => currentBrand.value.logo)
  const brandTagline = computed(() => currentBrand.value.tagline)
  const isMuleCube = computed(() => currentBrandId.value === 'mulecube')
  const isCubeOS = computed(() => currentBrandId.value === 'cubeos')

  // Format brand name with accent
  const brandNameFormatted = computed(() => {
    const brand = currentBrand.value
    if (brand.id === 'cubeos') {
      return { prefix: 'Cube', accent: 'OS' }
    } else if (brand.id === 'mulecube') {
      return { prefix: 'Mule', accent: 'Cube' }
    }
    return { prefix: brand.name, accent: '' }
  })

  // Set brand
  function setBrand(brandId) {
    const brand = brands.value.find(b => b.id === brandId)
    if (brand) {
      currentBrandId.value = brandId
      localStorage.setItem('cubeos-brand', brandId)
      
      // Update CSS custom property for accent if needed
      if (brandId === 'mulecube') {
        document.documentElement.style.setProperty('--brand-accent', '#f59e0b')
      } else {
        document.documentElement.style.removeProperty('--brand-accent')
      }
    }
  }

  // Initialize branding on load
  function initBranding() {
    const savedBrand = localStorage.getItem('cubeos-brand') || 'cubeos'
    currentBrandId.value = savedBrand
    
    if (savedBrand === 'mulecube') {
      document.documentElement.style.setProperty('--brand-accent', '#f59e0b')
    }
  }

  // Check if first visit (for showing branding prompt)
  const hasChosenBrand = computed(() => {
    return localStorage.getItem('cubeos-brand-chosen') === 'true'
  })

  function markBrandChosen() {
    localStorage.setItem('cubeos-brand-chosen', 'true')
  }

  return {
    brands,
    currentBrandId,
    currentBrand,
    brandName,
    brandLogo,
    brandTagline,
    isMuleCube,
    isCubeOS,
    brandNameFormatted,
    hasChosenBrand,
    setBrand,
    initBranding,
    markBrandChosen
  }
})
