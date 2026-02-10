<script setup>
/**
 * AppIcon.vue — S13 Visual Upgrade
 *
 * Renders a brand-accurate SVG icon for known self-hosted apps.
 * Falls back to Lucide icon via the Icon component for unknown apps.
 *
 * Usage:
 *   <AppIcon name="pihole" :size="24" />
 *   <AppIcon name="unknown-app" fallback="Box" :size="24" />
 *
 * All SVGs are simplified single-path brand marks designed to be
 * rendered at 20-28px, monochrome, inheriting currentColor.
 */
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  /** App name (lowercase, e.g. 'pihole', 'jellyfin') */
  name: { type: String, required: true },
  /** Icon size in px */
  size: { type: Number, default: 24 },
  /** Lucide icon name fallback if no brand icon exists */
  fallback: { type: String, default: 'Box' }
})

const normalizedName = computed(() => {
  return (props.name || '').toLowerCase().replace(/^cubeos-/, '')
})

const hasBrandIcon = computed(() => {
  return BRAND_ICONS.hasOwnProperty(normalizedName.value) ||
    Object.keys(BRAND_ICONS).some(k => normalizedName.value.includes(k))
})

const matchedKey = computed(() => {
  if (BRAND_ICONS[normalizedName.value]) return normalizedName.value
  return Object.keys(BRAND_ICONS).find(k => normalizedName.value.includes(k)) || null
})

/**
 * Brand icon SVG paths.
 * Each entry is a { viewBox, paths } object.
 * paths is an array of { d, fill?, stroke?, strokeWidth? }
 * All designed to render cleanly at 20-28px in currentColor.
 */
const BRAND_ICONS = {
  // ─── Infrastructure ──────────────────────────────────
  pihole: {
    viewBox: '0 0 24 24',
    paths: [
      // Pi symbol inside a shield
      { d: 'M12 2L3 7v6c0 5.25 3.75 10.08 9 11.25C17.25 23.08 21 18.25 21 13V7l-9-5z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M8 10h8M10 10v7M14 10v4.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }
    ]
  },

  npm: {
    viewBox: '0 0 24 24',
    paths: [
      // NPM-style layered bars (Nginx Proxy Manager)
      { d: 'M4 4h16v16H4V4z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M8 8v8h3v-6h2v6h3V8H8z', fill: 'currentColor' }
    ]
  },

  registry: {
    viewBox: '0 0 24 24',
    paths: [
      // Docker registry / container icon
      { d: 'M3 8h4v4H3V8zM9 8h4v4H9V8zM15 8h4v4h-4V8zM9 2h4v4H9V2zM3 14h4v4H3v-4zM9 14h4v4H9v-4z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' },
      { d: 'M21 11.5c-.8-.4-1.7-.3-2.3.1-.3-1.2-1.3-1.8-2.3-2', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }
    ]
  },

  // ─── Network / VPN ───────────────────────────────────
  wireguard: {
    viewBox: '0 0 24 24',
    paths: [
      // Stylized dragon/tunnel
      { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M12 6v4M8 12h8M12 14v4M9 10l3-4 3 4M9 14l3 4 3-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
    ]
  },

  openvpn: {
    viewBox: '0 0 24 24',
    paths: [
      // Key with lock shape
      { d: 'M12 2a5 5 0 0 0-4.9 6.06L4 16l2 2 2-1 2 1V16l-2.9-7.94A5 5 0 1 0 12 2z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M13 7a1 1 0 1 0-2 0 1 1 0 0 0 2 0z', fill: 'currentColor' }
    ]
  },

  tor: {
    viewBox: '0 0 24 24',
    paths: [
      // Onion layers
      { d: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 },
      { d: 'M12 18c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 },
      { d: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', fill: 'currentColor' }
    ]
  },

  // ─── AI / ML ─────────────────────────────────────────
  ollama: {
    viewBox: '0 0 24 24',
    paths: [
      // Llama head silhouette
      { d: 'M9 3c-1 0-2 .5-2.5 1.5L5 7c-.5 1-.5 2 0 3l1 2v6c0 1.5 1 3 3 3h6c2 0 3-1.5 3-3v-6l1-2c.5-1 .5-2 0-3l-1.5-2.5C17 3.5 16 3 15 3h-2l-1-1h-2L9 3z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M9.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM14.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', fill: 'currentColor' }
    ]
  },

  chromadb: {
    viewBox: '0 0 24 24',
    paths: [
      // Colorful database / spectrum
      { d: 'M6 4h3v16H6V4zM10.5 4h3v16h-3V4zM15 4h3v16h-3V4z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
      { d: 'M6 12h12', fill: 'none', stroke: 'currentColor', strokeWidth: 1, opacity: 0.5 }
    ]
  },

  // ─── Media ───────────────────────────────────────────
  jellyfin: {
    viewBox: '0 0 24 24',
    paths: [
      // Jellyfin-style flowing shape
      { d: 'M12 2C8 2 5 5 5 8c0 2 1 4 3 5l-1 7c0 1 .8 2 2 2h6c1.2 0 2-1 2-2l-1-7c2-1 3-3 3-5 0-3-3-6-7-6z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M10 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM14 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', fill: 'currentColor' }
    ]
  },

  // ─── Productivity ────────────────────────────────────
  nextcloud: {
    viewBox: '0 0 24 24',
    paths: [
      // Three overlapping circles (Nextcloud logo)
      { d: 'M8 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M16 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M12 18a4 4 0 1 1 0-8 4 4 0 0 1 0 8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }
    ]
  },

  gitea: {
    viewBox: '0 0 24 24',
    paths: [
      // Tea cup
      { d: 'M5 9h12v6c0 2.21-1.79 4-4 4H9c-2.21 0-4-1.79-4-4V9z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M17 10h1a3 3 0 0 1 0 6h-1', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M8 5c0-1 .5-2 1.5-2S11 4 11 5M12 5c0-1.5.7-3 2-3', fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', opacity: 0.6 }
    ]
  },

  vaultwarden: {
    viewBox: '0 0 24 24',
    paths: [
      // Shield with lock
      { d: 'M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M10 11V9a2 2 0 1 1 4 0v2', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M9 11h6v5H9v-5z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }
    ]
  },

  syncthing: {
    viewBox: '0 0 24 24',
    paths: [
      // Circular arrows (sync)
      { d: 'M12 2a10 10 0 0 1 8.66 5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M12 22a10 10 0 0 1-8.66-5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M22 12a10 10 0 0 1-5 8.66', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M2 12a10 10 0 0 1 5-8.66', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' },
      { d: 'M20 5l1 2.5L18.5 8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      { d: 'M4 19l-1-2.5L5.5 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    ]
  },

  portainer: {
    viewBox: '0 0 24 24',
    paths: [
      // Container stack
      { d: 'M4 6l8-4 8 4-8 4-8-4z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M4 10l8 4 8-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M4 14l8 4 8-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M4 6v12M20 6v12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }
    ]
  },

  grafana: {
    viewBox: '0 0 24 24',
    paths: [
      // Dashboard/flame shape
      { d: 'M12 2C8 2 4 6 4 10c0 3 2 5 4 6l1 4c0 1 1 2 3 2s3-1 3-2l1-4c2-1 4-3 4-6 0-4-4-8-8-8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M10 11h1v3h-1zM13 9h1v5h-1z', fill: 'currentColor', opacity: 0.7 }
    ]
  },

  homeassistant: {
    viewBox: '0 0 24 24',
    paths: [
      // House with dot
      { d: 'M3 12l9-9 9 9', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
      { d: 'M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', fill: 'currentColor' }
    ]
  },

  // ─── Platform ────────────────────────────────────────
  dozzle: {
    viewBox: '0 0 24 24',
    paths: [
      // Log/scroll with live indicator
      { d: 'M4 4h16v16H4V4z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, rx: 2 },
      { d: 'M7 8h6M7 11h10M7 14h8M7 17h4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', opacity: 0.7 },
      { d: 'M18 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', fill: 'currentColor' }
    ]
  },

  myspeed: {
    viewBox: '0 0 24 24',
    paths: [
      // Speedometer
      { d: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      { d: 'M12 12l4-6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' },
      { d: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', fill: 'currentColor' },
      { d: 'M6.3 17.7a8 8 0 0 1 0-11.4', fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', opacity: 0.4 }
    ]
  },

  // ─── Monitoring ──────────────────────────────────────
  prometheus: {
    viewBox: '0 0 24 24',
    paths: [
      // Flame/torch
      { d: 'M12 2s-4 4-4 8c0 2.5 1.5 4 3 5v3h2v-3c1.5-1 3-2.5 3-5 0-4-4-8-4-8z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' },
      { d: 'M9 20h6M10 22h4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }
    ]
  },

  uptime: {
    viewBox: '0 0 24 24',
    paths: [
      // Heart rate monitor
      { d: 'M3 12h4l3-6 4 12 3-6h4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
    ]
  }
}
</script>

<template>
  <!-- Brand SVG icon -->
  <svg
    v-if="hasBrandIcon && matchedKey"
    :width="size"
    :height="size"
    :viewBox="BRAND_ICONS[matchedKey].viewBox"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="shrink-0"
  >
    <template v-for="(path, i) in BRAND_ICONS[matchedKey].paths" :key="i">
      <path
        :d="path.d"
        :fill="path.fill || 'none'"
        :stroke="path.stroke || 'none'"
        :stroke-width="path.strokeWidth || 0"
        :stroke-linecap="path.strokeLinecap || 'butt'"
        :stroke-linejoin="path.strokeLinejoin || 'miter'"
        :opacity="path.opacity || 1"
      />
      <!-- Also support circle/rect if needed in future -->
    </template>
  </svg>

  <!-- Fallback to Lucide -->
  <Icon v-else :name="fallback" :size="size" />
</template>
