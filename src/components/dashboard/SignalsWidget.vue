<script setup>
/**
 * SignalsWidget.vue — Session 4
 *
 * Expedition communications status panel for MuleCube deployments.
 * 2×2 grid showing: Cellular, Meshtastic, GPS, Iridium.
 * Shows "No signals hardware detected" when all endpoints return 404.
 *
 * Uses the lightweight signals store for dashboard-grade data.
 * Clicking navigates to /communication.
 * Matches SystemVitals / NetworkWidget glassmorphism pattern.
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSignalsStore } from '@/stores/signals'
import { useWallpaper } from '@/composables/useWallpaper'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const router = useRouter()
const signalsStore = useSignalsStore()
const { isActive: wallpaperActive } = useWallpaper()
const { signal: abortSignal } = useAbortOnUnmount()

onMounted(() => {
  signalsStore.fetchAll({ signal: abortSignal })
})

// ─── Signal bar visualization ─────────────────────────────────

function signalBarClasses(bars, maxBars, activeColor) {
  const result = []
  for (let i = 0; i < maxBars; i++) {
    result.push({
      active: i < bars,
      color: i < bars ? activeColor : 'bg-theme-tertiary',
    })
  }
  return result
}

// ─── Signal tiles ─────────────────────────────────────────────

const tiles = computed(() => {
  const c = signalsStore.cellular
  const m = signalsStore.meshtastic
  const g = signalsStore.gps
  const ir = signalsStore.iridium

  return [
    {
      key: 'cellular',
      icon: 'Signal',
      label: 'Cellular',
      available: c.status !== 'unavailable',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/15',
      bars: c.signalBars,
      maxBars: 5,
      barColor: 'bg-sky-400',
      primary: c.carrier || '—',
      secondary: c.type || null,
    },
    {
      key: 'meshtastic',
      icon: 'Radio',
      label: 'Meshtastic',
      available: m.status !== 'unavailable',
      color: 'text-lime-400',
      bgColor: 'bg-lime-500/15',
      bars: null,
      primary: m.status !== 'unavailable' ? `${m.nodeCount} nodes` : '—',
      secondary: m.lastHeard ? timeAgo(m.lastHeard) : null,
    },
    {
      key: 'gps',
      icon: 'MapPin',
      label: 'GPS',
      available: g.status !== 'unavailable',
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/15',
      bars: null,
      primary: g.fix && g.fix !== 'none' ? g.fix.toUpperCase() : (g.status !== 'unavailable' ? 'No Fix' : '—'),
      secondary: g.lat !== null && g.lon !== null
        ? `${g.lat.toFixed(4)}, ${g.lon.toFixed(4)}`
        : g.satellites > 0 ? `${g.satellites} sats` : null,
    },
    {
      key: 'iridium',
      icon: 'Satellite',
      label: 'Iridium',
      available: ir.status !== 'unavailable',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/15',
      bars: ir.signalBars,
      maxBars: 5,
      barColor: 'bg-orange-400',
      primary: ir.registration || (ir.status !== 'unavailable' ? 'Connected' : '—'),
      secondary: null,
    },
  ]
})

const hasAny = computed(() => signalsStore.hasAnySignal)

// ─── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function cardClass() {
  return wallpaperActive.value
    ? 'glass'
    : 'bg-theme-card border border-theme-primary'
}
</script>

<template>
  <button
    :class="cardClass()"
    class="w-full rounded-2xl p-5 text-left transition-all hover:shadow-lg group cursor-pointer h-full"
    @click="router.push('/communication')"
  >
    <!-- Header row -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
          <Icon name="Radio" :size="14" class="text-rose-400" />
        </div>
        <span class="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Signals</span>
      </div>

      <!-- Status badge -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
        :class="hasAny
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-theme-tertiary border-theme-primary'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="hasAny ? 'bg-success' : 'bg-neutral'" />
        <span class="text-[11px] font-medium" :class="hasAny ? 'text-emerald-400' : 'text-theme-muted'">
          {{ hasAny ? 'Active' : 'None' }}
        </span>
      </div>
    </div>

    <!-- 2×2 grid when signals available -->
    <div v-if="hasAny" class="grid grid-cols-2 gap-3">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="rounded-xl p-2.5 transition-colors"
        :class="tile.available ? 'bg-theme-tertiary/50' : 'opacity-40'"
      >
        <!-- Tile header: icon + label -->
        <div class="flex items-center gap-1.5 mb-2">
          <Icon :name="tile.icon" :size="12" :class="tile.available ? tile.color : 'text-theme-muted'" />
          <span class="text-[10px] font-medium uppercase tracking-wider"
                :class="tile.available ? 'text-theme-secondary' : 'text-theme-muted'">
            {{ tile.label }}
          </span>
        </div>

        <!-- Signal bars (cellular, iridium) -->
        <div v-if="tile.bars !== null && tile.bars !== undefined && tile.available" class="flex items-end gap-0.5 mb-1.5 h-3">
          <div
            v-for="(bar, i) in signalBarClasses(tile.bars, tile.maxBars, tile.barColor)"
            :key="i"
            class="w-1 rounded-sm transition-colors"
            :class="bar.color"
            :style="{ height: `${((i + 1) / tile.maxBars) * 100}%` }"
          />
        </div>

        <!-- Primary value -->
        <div class="text-xs font-semibold truncate"
             :class="tile.available ? 'text-theme-primary' : 'text-theme-muted'">
          {{ tile.primary }}
        </div>

        <!-- Secondary value -->
        <div v-if="tile.secondary" class="text-[10px] text-theme-muted truncate mt-0.5">
          {{ tile.secondary }}
        </div>
      </div>
    </div>

    <!-- No hardware detected -->
    <div v-else class="flex flex-col items-center justify-center py-4 gap-2">
      <Icon name="RadioTower" :size="24" class="text-theme-muted opacity-40" />
      <span class="text-xs text-theme-muted text-center">No signals hardware detected</span>
    </div>
  </button>
</template>
