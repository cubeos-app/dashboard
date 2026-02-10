/**
 * appColors.js — S13 Visual Upgrade
 *
 * Per-app color mapping for the Standard dashboard.
 * Gives each app visual identity via colored icon backgrounds,
 * border accents, and hover glows.
 *
 * Colors are chosen to match real brand palettes where possible,
 * or to differentiate by category (network=blue, AI=purple, etc).
 *
 * Returns Tailwind-compatible class strings for:
 *   - bg   : icon background
 *   - text  : icon foreground
 *   - ring  : hover ring accent
 *   - glow  : CSS box-shadow glow color (rgba)
 */

// ─── Brand colors for well-known apps ──────────────────────────
const BRAND_COLORS = {
  'pihole':     { bg: 'bg-red-500/15',     text: 'text-red-400',     ring: 'ring-red-500/30',     glow: 'rgba(239,68,68,0.15)'   },
  'npm':        { bg: 'bg-emerald-500/15',  text: 'text-emerald-400', ring: 'ring-emerald-500/30', glow: 'rgba(16,185,129,0.15)'  },
  'wireguard':  { bg: 'bg-rose-500/15',     text: 'text-rose-400',    ring: 'ring-rose-500/30',    glow: 'rgba(244,63,94,0.15)'   },
  'openvpn':    { bg: 'bg-orange-500/15',   text: 'text-orange-400',  ring: 'ring-orange-500/30',  glow: 'rgba(249,115,22,0.15)'  },
  'tor':        { bg: 'bg-purple-500/15',   text: 'text-purple-400',  ring: 'ring-purple-500/30',  glow: 'rgba(168,85,247,0.15)'  },
  'ollama':     { bg: 'bg-violet-500/15',   text: 'text-violet-400',  ring: 'ring-violet-500/30',  glow: 'rgba(139,92,246,0.15)'  },
  'chromadb':   { bg: 'bg-amber-500/15',    text: 'text-amber-400',   ring: 'ring-amber-500/30',   glow: 'rgba(245,158,11,0.15)'  },
  'dozzle':     { bg: 'bg-sky-500/15',      text: 'text-sky-400',     ring: 'ring-sky-500/30',     glow: 'rgba(14,165,233,0.15)'  },
  'registry':   { bg: 'bg-teal-500/15',     text: 'text-teal-400',    ring: 'ring-teal-500/30',    glow: 'rgba(20,184,166,0.15)'  },
  'nextcloud':  { bg: 'bg-blue-500/15',     text: 'text-blue-400',    ring: 'ring-blue-500/30',    glow: 'rgba(59,130,246,0.15)'  },
  'jellyfin':   { bg: 'bg-fuchsia-500/15',  text: 'text-fuchsia-400', ring: 'ring-fuchsia-500/30', glow: 'rgba(217,70,239,0.15)'  },
  'homeassistant': { bg: 'bg-sky-500/15',   text: 'text-sky-400',     ring: 'ring-sky-500/30',     glow: 'rgba(14,165,233,0.15)'  },
  'gitea':      { bg: 'bg-green-500/15',    text: 'text-green-400',   ring: 'ring-green-500/30',   glow: 'rgba(34,197,94,0.15)'   },
  'vaultwarden': { bg: 'bg-blue-600/15',    text: 'text-blue-400',    ring: 'ring-blue-500/30',    glow: 'rgba(37,99,235,0.15)'   },
  'syncthing':  { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',    ring: 'ring-cyan-500/30',    glow: 'rgba(6,182,212,0.15)'   },
  'portainer':  { bg: 'bg-blue-500/15',     text: 'text-blue-400',    ring: 'ring-blue-500/30',    glow: 'rgba(59,130,246,0.15)'  },
  'grafana':    { bg: 'bg-orange-500/15',   text: 'text-orange-400',  ring: 'ring-orange-500/30',  glow: 'rgba(249,115,22,0.15)'  },
  'prometheus': { bg: 'bg-red-600/15',      text: 'text-red-400',     ring: 'ring-red-500/30',     glow: 'rgba(220,38,38,0.15)'   },
  'myspeed':    { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',    ring: 'ring-cyan-500/30',    glow: 'rgba(6,182,212,0.15)'   },
}

// ─── Category fallback colors ──────────────────────────────────
const CATEGORY_COLORS = {
  system:    { bg: 'bg-zinc-500/15',     text: 'text-zinc-400',    ring: 'ring-zinc-500/30',    glow: 'rgba(113,113,122,0.12)' },
  platform:  { bg: 'bg-sky-500/15',      text: 'text-sky-400',     ring: 'ring-sky-500/30',     glow: 'rgba(14,165,233,0.15)'  },
  network:   { bg: 'bg-indigo-500/15',   text: 'text-indigo-400',  ring: 'ring-indigo-500/30',  glow: 'rgba(99,102,241,0.15)'  },
  ai:        { bg: 'bg-violet-500/15',   text: 'text-violet-400',  ring: 'ring-violet-500/30',  glow: 'rgba(139,92,246,0.15)'  },
  media:     { bg: 'bg-pink-500/15',     text: 'text-pink-400',    ring: 'ring-pink-500/30',    glow: 'rgba(236,72,153,0.15)'  },
  storage:   { bg: 'bg-amber-500/15',    text: 'text-amber-400',   ring: 'ring-amber-500/30',   glow: 'rgba(245,158,11,0.15)'  },
  user:      { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',    ring: 'ring-cyan-500/30',    glow: 'rgba(6,182,212,0.15)'   },
}

const DEFAULT_COLOR = { bg: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-500/30', glow: 'rgba(6,182,212,0.15)' }

/**
 * Get color scheme for an app.
 * Checks brand mapping first, then falls back to category, then default.
 *
 * @param {Object} app - App object from the apps store
 * @returns {{ bg: string, text: string, ring: string, glow: string }}
 */
export function getAppColor(app) {
  if (!app) return DEFAULT_COLOR

  // 1. Try exact name match (strip cubeos- prefix)
  const name = (app.name || '').toLowerCase().replace(/^cubeos-/, '')
  if (BRAND_COLORS[name]) return BRAND_COLORS[name]

  // 2. Try partial match (e.g. "my-pihole-dns" matches "pihole")
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (name.includes(key)) return color
  }

  // 3. Fall back to category
  const type = (app.type || '').toLowerCase()
  if (CATEGORY_COLORS[type]) return CATEGORY_COLORS[type]

  return DEFAULT_COLOR
}

/**
 * Get a CSS custom property glow string for use in inline styles.
 * @param {Object} app
 * @returns {string} box-shadow value
 */
export function getAppGlow(app) {
  const color = getAppColor(app)
  return `0 0 24px ${color.glow}, 0 0 48px ${color.glow}`
}
