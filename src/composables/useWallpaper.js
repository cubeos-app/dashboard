/**
 * CubeOS Wallpaper Composable
 *
 * S01 — Reactive wallpaper loader for Standard mode.
 * Reads wallpaper preference, resolves the image URL, and provides CSS
 * bindings for the main content area background.
 *
 * Wallpaper types:
 *   preset  — Bundled image from public/wallpapers/{value}-{theme}.webp
 *   custom  — User-uploaded via POST /preferences/wallpaper, served from API
 *   none    — Solid theme background color, no image
 *
 * Usage:
 *   const { wallpaperStyle, isActive } = useWallpaper()
 *
 *   <main :style="wallpaperStyle">...</main>
 */
import { computed, watch } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useThemeStore } from '@/stores/theme'

/** Available preset wallpapers — each has -light.svg and -dark.svg variants */
export const WALLPAPER_PRESETS = [
  { id: 'topo', name: 'Topographic', description: 'Abstract contour lines' },
  { id: 'mesh', name: 'Gradient Mesh', description: 'Soft color gradients' },
  { id: 'grid', name: 'Grid', description: 'Minimal dot grid' },
  { id: 'waves', name: 'Waves', description: 'Flowing wave lines' },
  { id: 'circuit', name: 'Circuit', description: 'Circuit board traces' },
  { id: 'peaks', name: 'Peaks', description: 'Mountain ridgeline' }
]

/**
 * Resolve the wallpaper image URL based on preference and theme.
 * @param {{ type: string, value: string|null }} wp - Wallpaper preference
 * @param {string} theme - Current theme ('dark' | 'light')
 * @returns {string|null} URL or null for 'none'
 */
function resolveWallpaperUrl(wp, theme) {
  if (!wp || wp.type === 'none') return null

  if (wp.type === 'preset') {
    const variant = theme === 'light' ? 'light' : 'dark'
    return `/wallpapers/${wp.value}-${variant}.svg`
  }

  if (wp.type === 'custom') {
    return '/api/v1/preferences/wallpaper'
  }

  return null
}

export function useWallpaper() {
  const preferencesStore = usePreferencesStore()
  const themeStore = useThemeStore()

  /** Current theme for wallpaper variant selection */
  const currentTheme = computed(() => themeStore.currentThemeId || 'dark')

  /** Whether wallpaper should be active (Standard mode + non-'none' type) */
  const isActive = computed(() => {
    return preferencesStore.isStandard && preferencesStore.wallpaper?.type !== 'none'
  })

  /** Resolved wallpaper image URL */
  const wallpaperUrl = computed(() => {
    if (!isActive.value) return null
    return resolveWallpaperUrl(preferencesStore.wallpaper, currentTheme.value)
  })

  /** Overlay opacity — slightly higher for light theme for readability */
  const overlayOpacity = computed(() => {
    return currentTheme.value === 'light' ? 0.4 : 0.3
  })

  /**
   * CSS style object for the main content container.
   * Apply with :style="wallpaperStyle" on the content wrapper.
   */
  const wallpaperStyle = computed(() => {
    if (!isActive.value || !wallpaperUrl.value) return {}

    return {
      backgroundImage: `
        linear-gradient(
          rgba(var(--wallpaper-overlay-rgb, 0, 0, 0), ${overlayOpacity.value}),
          rgba(var(--wallpaper-overlay-rgb, 0, 0, 0), ${overlayOpacity.value})
        ),
        url('${wallpaperUrl.value}')
      `.trim().replace(/\s+/g, ' '),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat'
    }
  })

  /**
   * CSS class string for content panels (cards) in Standard mode.
   * Adds glassmorphism when wallpaper is active.
   */
  const panelClass = computed(() => {
    if (!isActive.value) return ''
    return 'glass'
  })

  return {
    /** Whether wallpaper is currently active */
    isActive,
    /** Resolved wallpaper URL */
    wallpaperUrl,
    /** Style object for the content container background */
    wallpaperStyle,
    /** Class to add to content panels for glassmorphism effect */
    panelClass,
    /** Available preset wallpapers */
    presets: WALLPAPER_PRESETS
  }
}
