/**
 * CubeOS Branding Store
 * 
 * Single brand: CubeOS only.
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useBrandingStore = defineStore('branding', () => {
  // CubeOS brand (single brand, no selection needed)
  const brand = {
    id: 'cubeos',
    name: 'CubeOS',
    tagline: 'Open Source Server OS',
    logo: '/icon.svg',
    logoDark: '/icon.svg',
    primaryColor: '#0ea5e9',
    accentName: 'OS',
    github: 'https://github.com/redrickh/cubeos',
    website: 'https://cubeos.app'
  }

  // For compatibility with existing code
  const brands = ref([brand])
  const currentBrandId = ref('cubeos')

  // Current brand (always CubeOS)
  const currentBrand = computed(() => brand)

  // Convenience getters
  const brandName = computed(() => brand.name)
  const brandLogo = computed(() => brand.logo)
  const brandTagline = computed(() => brand.tagline)
  const isCubeOS = computed(() => true)

  // Format brand name with accent (Cube + OS)
  const brandNameFormatted = computed(() => ({
    prefix: 'Cube',
    accent: 'OS'
  }))

  // Set brand (no-op since we only have CubeOS)
  function setBrand(brandId) {
    // No-op - CubeOS only
  }

  // Initialize branding (no-op)
  function initBranding() {
    // No-op - CubeOS only
  }

  // Compatibility getters
  const hasChosenBrand = computed(() => true)

  function markBrandChosen() {
    // No-op
  }

  return {
    brands,
    currentBrandId,
    currentBrand,
    brandName,
    brandLogo,
    brandTagline,
    isCubeOS,
    brandNameFormatted,
    hasChosenBrand,
    setBrand,
    initBranding,
    markBrandChosen
  }
})
