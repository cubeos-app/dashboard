<script setup>
/**
 * MeshtasticMap.vue
 *
 * Leaflet map sub-tab showing node positions and GPS tracks.
 * Lazy-loads Leaflet only when this tab is active.
 * Circle markers colored by signal quality, polyline tracks per node.
 * Falls back to a coordinate table if tiles are unavailable.
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useCommunicationStore } from '@/stores/communication'
import { useAbortOnUnmount } from '@/composables/useAbortOnUnmount'
import Icon from '@/components/ui/Icon.vue'

const props = defineProps({
  meshsatAvailable: { type: Boolean, default: false }
})

const communicationStore = useCommunicationStore()
const { signal } = useAbortOnUnmount()

const mapContainer = ref(null)
const mapReady = ref(false)
const mapError = ref(false)
const refreshing = ref(false)

let L = null
let map = null
let markerLayer = null
let trackLayer = null

// ==========================================
// Computed
// ==========================================

const nodePositions = computed(() => {
  if (props.meshsatAvailable) {
    const nodes = communicationStore.meshsatNodes
    if (!nodes) return []
    const list = Array.isArray(nodes) ? nodes : (nodes.nodes || nodes.items || [])
    return list
      .filter(n => n.latitude && n.longitude && n.latitude !== 0 && n.longitude !== 0)
      .map(n => ({
        id: n.id ?? n.node_id ?? n.num,
        name: n.name ?? n.long_name ?? n.short_name ?? String(n.id),
        lat: Number(n.latitude),
        lng: Number(n.longitude),
        battery: n.battery ?? n.battery_level ?? null,
        snr: n.snr ?? null,
        signalQuality: n.signal_quality ?? null,
        lastHeard: n.last_heard ?? n.last_seen ?? null
      }))
  }

  // Fallback: HAL position for local node
  const p = communicationStore.meshtasticPosition
  if (!p) return []
  const lat = Number(p.latitude ?? p.lat ?? 0)
  const lng = Number(p.longitude ?? p.lon ?? p.lng ?? 0)
  if (!lat && !lng) return []
  return [{
    id: 'local',
    name: 'Local Node',
    lat, lng,
    battery: null, snr: null, signalQuality: null, lastHeard: null
  }]
})

const positionHistory = computed(() => {
  if (!props.meshsatAvailable) return []
  const raw = communicationStore.meshsatPositions
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.positions || raw.items || [])
})

// Group position history by node for track lines
const tracksByNode = computed(() => {
  const groups = {}
  for (const p of positionHistory.value) {
    const nodeId = p.node_id ?? p.from ?? p.id
    if (!nodeId) continue
    const lat = Number(p.latitude ?? p.lat ?? 0)
    const lng = Number(p.longitude ?? p.lon ?? p.lng ?? 0)
    if (!lat && !lng) continue
    if (!groups[nodeId]) groups[nodeId] = []
    groups[nodeId].push([lat, lng])
  }
  return groups
})

// ==========================================
// Map initialization
// ==========================================

async function initMap() {
  try {
    const leaflet = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    L = leaflet.default || leaflet

    await nextTick()
    if (!mapContainer.value) return

    map = L.map(mapContainer.value, {
      zoomControl: true,
      attributionControl: true
    }).setView([0, 0], 2)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map)

    markerLayer = L.layerGroup().addTo(map)
    trackLayer = L.layerGroup().addTo(map)

    mapReady.value = true
    updateMapMarkers()
  } catch (err) {
    console.warn('Leaflet init failed:', err)
    mapError.value = true
  }
}

function signalColor(quality) {
  if (!quality) return '#6b7280'
  const q = quality.toUpperCase()
  if (q === 'GOOD') return '#10b981'
  if (q === 'FAIR') return '#f59e0b'
  return '#ef4444'
}

function updateMapMarkers() {
  if (!map || !markerLayer || !L) return

  markerLayer.clearLayers()
  trackLayer.clearLayers()

  const positions = nodePositions.value
  if (!positions.length) return

  // Add circle markers
  for (const node of positions) {
    const color = signalColor(node.signalQuality)
    const marker = L.circleMarker([node.lat, node.lng], {
      radius: 8,
      fillColor: color,
      fillOpacity: 0.8,
      color: color,
      weight: 2,
      opacity: 1
    })

    let popupHtml = `<strong>${node.name}</strong>`
    if (node.battery !== null) popupHtml += `<br>Battery: ${Math.round(node.battery)}%`
    if (node.snr !== null) popupHtml += `<br>SNR: ${Number(node.snr).toFixed(1)} dB`
    if (node.signalQuality) popupHtml += `<br>Signal: ${node.signalQuality}`
    if (node.lastHeard) {
      const ts = typeof node.lastHeard === 'number' && node.lastHeard < 1e12 ? node.lastHeard * 1000 : node.lastHeard
      popupHtml += `<br>Last: ${new Date(ts).toLocaleString()}`
    }

    marker.bindPopup(popupHtml)
    markerLayer.addLayer(marker)
  }

  // Add track polylines
  const tracks = tracksByNode.value
  const trackColors = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#22c55e']
  let colorIdx = 0
  for (const nodeId in tracks) {
    const points = tracks[nodeId]
    if (points.length < 2) continue
    L.polyline(points, {
      color: trackColors[colorIdx % trackColors.length],
      weight: 2,
      opacity: 0.6,
      dashArray: '4 4'
    }).addTo(trackLayer)
    colorIdx++
  }

  // Auto-fit bounds
  const bounds = L.latLngBounds(positions.map(n => [n.lat, n.lng]))
  map.fitBounds(bounds.pad(0.2), { maxZoom: 15 })
}

// ==========================================
// Actions
// ==========================================

async function handleRefresh() {
  refreshing.value = true
  try {
    const s = signal()
    if (props.meshsatAvailable) {
      await Promise.all([
        communicationStore.fetchMeshsatNodes({ signal: s }),
        communicationStore.fetchMeshsatPositions({ since: sinceISO(24), limit: 500 }, { signal: s })
      ])
    } else {
      await communicationStore.fetchMeshtasticPosition({ signal: s })
    }
    updateMapMarkers()
  } finally {
    refreshing.value = false
  }
}

function sinceISO(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function formatCoord(val) {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(6)
}

// ==========================================
// Watchers
// ==========================================

watch(nodePositions, () => {
  if (mapReady.value) updateMapMarkers()
})

watch(positionHistory, () => {
  if (mapReady.value) updateMapMarkers()
})

// ==========================================
// Lifecycle
// ==========================================

onMounted(async () => {
  const s = signal()
  if (props.meshsatAvailable) {
    await Promise.all([
      communicationStore.fetchMeshsatNodes({ signal: s }),
      communicationStore.fetchMeshsatPositions({ since: sinceISO(24), limit: 500 }, { signal: s })
    ])
  } else {
    await communicationStore.fetchMeshtasticPosition({ signal: s })
  }
  await initMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="bg-theme-card border border-theme-primary rounded-xl overflow-hidden">
      <div class="px-5 py-4 border-b border-theme-primary">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="Map" :size="18" class="text-accent" />
            <h2 class="text-lg font-semibold text-theme-primary">Node Map</h2>
            <span
              v-if="nodePositions.length"
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-muted text-accent"
            >
              {{ nodePositions.length }} nodes
            </span>
          </div>
          <button
            @click="handleRefresh"
            :disabled="refreshing"
            class="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
            title="Refresh positions"
          >
            <Icon
              name="RefreshCw" :size="14"
              :class="{ 'animate-spin': refreshing }"
            />
          </button>
        </div>
      </div>

      <!-- Map container -->
      <div
        v-if="!mapError"
        ref="mapContainer"
        class="w-full h-80 sm:h-96 bg-theme-secondary"
      />

      <!-- No positions -->
      <div
        v-if="!nodePositions.length && !mapError"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
        style="position: relative;"
      >
        <div class="text-center p-8">
          <Icon name="MapPin" :size="32" class="text-theme-muted mx-auto mb-2" />
          <p class="text-sm text-theme-secondary">No Position Data</p>
          <p class="text-xs text-theme-muted mt-1">
            Nodes with GPS will show their positions here
          </p>
        </div>
      </div>

      <!-- Fallback: coordinate table when map fails -->
      <div v-if="mapError && nodePositions.length" class="p-5">
        <p class="text-sm text-theme-muted mb-3">Map tiles unavailable — showing coordinates:</p>
        <div class="space-y-2">
          <div
            v-for="node in nodePositions"
            :key="node.id"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-theme-primary font-medium">{{ node.name }}</span>
            <span class="font-mono text-theme-muted">
              {{ formatCoord(node.lat) }}, {{ formatCoord(node.lng) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="mapError && !nodePositions.length" class="p-8 text-center">
        <Icon name="AlertTriangle" :size="32" class="text-theme-muted mx-auto mb-2" />
        <p class="text-sm text-theme-secondary">Map Unavailable</p>
        <p class="text-xs text-theme-muted mt-1">
          Could not load map tiles. Position data will appear when available.
        </p>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="nodePositions.length" class="flex items-center gap-4 text-xs text-theme-muted px-1">
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
        <span>Good signal</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-amber-500"></span>
        <span>Fair signal</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-red-500"></span>
        <span>Bad signal</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-gray-500"></span>
        <span>Unknown</span>
      </div>
    </div>
  </div>
</template>
