import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Service categories with Lucide icon names
const SERVICE_CATEGORIES = {
  ai: {
    title: 'AI Services',
    icon: 'Bot',
    services: ['libretranslate', 'open-webui', 'ollama']
  },
  knowledge: {
    title: 'Knowledge',
    icon: 'BookOpen',
    services: ['kiwix', 'tileserver', 'calibre-web', 'signalk-server', 'emergency-ref', 'radioreference']
  },
  productivity: {
    title: 'Productivity',
    icon: 'PenTool',
    services: ['cryptpad', 'excalidraw', 'bentopdf', 'vaultwarden']
  },
  files: {
    title: 'Files & Sync',
    icon: 'FolderSync',
    services: ['filebrowser', 'syncthing', 'linkwarden', 'open-archiver']
  },
  communication: {
    title: 'Communication',
    icon: 'MessageCircle',
    services: ['element', 'meshtastic-web', 'meshtastic', 'conduit']
  },
  tools: {
    title: 'Tools',
    icon: 'Wrench',
    services: ['it-tools', 'apkrepo-nginx', 'networking-toolbox', 'network-tools', 'tika', 'meilisearch', 'great_galois']
  },
  admin: {
    title: 'Admin',
    icon: 'Settings',
    services: ['dockge', 'dozzle', 'terminal']
  },
  core: {
    title: 'CubeOS Core Apps',
    icon: 'Box',
    services: [
      'cubeos-api', 'cubeos-dashboard', 'cubeos-pihole', 'cubeos-npm',
      'cubeos-watchdog', 'cubeos-backup', 'cubeos-diagnostics', 'cubeos-reset',
      'cubeos-gpio', 'cubeos-nettools', 'cubeos-usb-monitor'
    ]
  }
}

// Services that have a web UI with their FQDN hostnames
// ALL services must use FQDN via NPM - no direct port access
// Format: { fqdn: 'hostname', path: '/optional/path' } or just 'hostname' for simple cases
const SERVICE_FQDNS = {
  // Core CubeOS services
  'cubeos-dashboard': { fqdn: 'cubeos.cube' },
  'cubeos-pihole': { fqdn: 'pihole.cubeos.cube', path: '/admin' },
  'cubeos-npm': { fqdn: 'npm.cubeos.cube' },
  'cubeos-dockge': { fqdn: 'dockge.cubeos.cube' },
  'dockge': { fqdn: 'dockge.cubeos.cube' },
  'cubeos-logs': { fqdn: 'dozzle.cubeos.cube' },
  'dozzle': { fqdn: 'dozzle.cubeos.cube' },
  'cubeos-terminal': { fqdn: 'terminal.cubeos.cube' },
  'terminal': { fqdn: 'terminal.cubeos.cube' },
  // Shorthand aliases
  'pihole': { fqdn: 'pihole.cubeos.cube', path: '/admin' },
  'npm': { fqdn: 'npm.cubeos.cube' },
  'registry': { fqdn: 'registry.cubeos.cube' },
  'ollama': { fqdn: 'ollama.cubeos.cube' },
  'chromadb': { fqdn: 'chromadb.cubeos.cube' },
  // User apps - all use FQDN via NPM
  'kiwix': { fqdn: 'kiwix.cubeos.cube' },
  'kiwix-server': { fqdn: 'kiwix.cubeos.cube' },
  'tileserver': { fqdn: 'maps.cubeos.cube' },
  'tileserver-gl': { fqdn: 'maps.cubeos.cube' },
  'open-webui': { fqdn: 'ai.cubeos.cube' },
  'filebrowser': { fqdn: 'files.cubeos.cube' },
  'calibre-web': { fqdn: 'books.cubeos.cube' },
  'syncthing': { fqdn: 'sync.cubeos.cube' },
  'uptime-kuma': { fqdn: 'uptime.cubeos.cube' },
  'it-tools': { fqdn: 'tools.cubeos.cube' },
  'element': { fqdn: 'chat.cubeos.cube' },
  'element-web': { fqdn: 'chat.cubeos.cube' },
  'jellyfin': { fqdn: 'media.cubeos.cube' },
  'vaultwarden': { fqdn: 'vault.cubeos.cube' },
  'cryptpad': { fqdn: 'docs.cubeos.cube' },
  'excalidraw': { fqdn: 'draw.cubeos.cube' },
  'libretranslate': { fqdn: 'translate.cubeos.cube' },
  'linkwarden': { fqdn: 'links.cubeos.cube' },
  'portainer': { fqdn: 'portainer.cubeos.cube' }
}

// Legacy string-only format for backwards compatibility (deprecated)
const SERVICE_URLS = {
  // Core CubeOS services
  'cubeos-dashboard': 'cubeos.cube',
  'cubeos-pihole': 'pihole.cubeos.cube',
  'cubeos-npm': 'npm.cubeos.cube',
  'cubeos-dockge': 'dockge.cubeos.cube',
  'dockge': 'dockge.cubeos.cube',
  'cubeos-logs': 'dozzle.cubeos.cube',
  'dozzle': 'dozzle.cubeos.cube',
  'cubeos-terminal': 'terminal.cubeos.cube',
  'terminal': 'terminal.cubeos.cube',
  // Shorthand aliases
  'pihole': 'pihole.cubeos.cube',
  'npm': 'npm.cubeos.cube',
  'registry': 'registry.cubeos.cube',
  'ollama': 'ollama.cubeos.cube',
  'chromadb': 'chromadb.cubeos.cube',
  // User apps - all use FQDN via NPM
  'kiwix': 'kiwix.cubeos.cube',
  'kiwix-server': 'kiwix.cubeos.cube',
  'tileserver': 'maps.cubeos.cube',
  'tileserver-gl': 'maps.cubeos.cube',
  'open-webui': 'ai.cubeos.cube',
  'filebrowser': 'files.cubeos.cube',
  'calibre-web': 'books.cubeos.cube',
  'syncthing': 'sync.cubeos.cube',
  'uptime-kuma': 'uptime.cubeos.cube',
  'it-tools': 'tools.cubeos.cube',
  'element': 'chat.cubeos.cube',
  'element-web': 'chat.cubeos.cube',
  'jellyfin': 'media.cubeos.cube',
  'vaultwarden': 'vault.cubeos.cube',
  'cryptpad': 'docs.cubeos.cube',
  'excalidraw': 'draw.cubeos.cube',
  'libretranslate': 'translate.cubeos.cube',
  'linkwarden': 'links.cubeos.cube',
  'portainer': 'portainer.cubeos.cube'
}

// Services with no UI (backend only) - show health/logs modal when clicked
const NO_UI_SERVICES = [
  'cubeos-watchdog', 'cubeos-backup', 'cubeos-diagnostics', 'cubeos-reset',
  'cubeos-gpio', 'cubeos-nettools', 'cubeos-usb-monitor', 'ollama', 'conduit',
  'tika', 'meilisearch', 'chromadb', 'registry', 'cubeos-api', 'cubeos-hal'
]

// Friendly display names for services
const SERVICE_NAMES = {
  // CubeOS Core
  'cubeos-api': 'CubeOS API',
  'cubeos-dashboard': 'CubeOS Dashboard',
  'cubeos-pihole': 'Pi-hole DNS & DHCP',
  'cubeos-npm': 'Nginx Proxy Manager',
  'cubeos-dockge': 'Dockge',
  'cubeos-logs': 'Dozzle Logs',
  'cubeos-terminal': 'Terminal',
  'cubeos-watchdog': 'Watchdog',
  'cubeos-backup': 'Backup Service',
  'cubeos-diagnostics': 'Diagnostics',
  'cubeos-reset': 'Reset Service',
  'cubeos-gpio': 'GPIO Service',
  'cubeos-nettools': 'Network Tools',
  'cubeos-usb-monitor': 'USB Monitor',
  // User apps
  'open-webui': 'Open WebUI',
  'kiwix': 'Wikipedia (Kiwix)',
  'kiwix-server': 'Wikipedia (Kiwix)',
  'tileserver': 'Maps',
  'tileserver-gl': 'Maps',
  'calibre-web': 'Calibre-Web',
  'signalk-server': 'Signal K',
  'emergency-ref': 'Emergency Reference',
  'radioreference': 'RadioReference',
  'cryptpad': 'CryptPad',
  'excalidraw': 'Excalidraw',
  'bentopdf': 'BentoPDF',
  'vaultwarden': 'Vaultwarden',
  'filebrowser': 'File Browser',
  'syncthing': 'Syncthing',
  'linkwarden': 'Linkwarden',
  'open-archiver': 'Open Archiver',
  'element': 'Element',
  'element-web': 'Element',
  'meshtastic-web': 'Meshtastic',
  'meshtastic': 'Meshtastic',
  'conduit': 'Conduit',
  'matrix-conduit': 'Conduit',
  'it-tools': 'IT-Tools',
  'apkrepo-nginx': 'F-Droid',
  'networking-toolbox': 'Network Tools',
  'network-tools': 'Network Tools',
  'uptime-kuma': 'Uptime Kuma',
  'pihole': 'Pi-hole',
  'dockge': 'Dockge',
  'dozzle': 'Dozzle',
  'terminal': 'Terminal',
  'libretranslate': 'LibreTranslate',
  'ollama': 'Ollama',
  'great_galois': 'Great Galois',
  'tika': 'Tika',
  'meilisearch': 'Meilisearch',
  'jellyfin': 'Jellyfin'
}

// Service icons - Lucide icon component names
const SERVICE_ICONS = {
  // CubeOS Core
  'cubeos-api': 'Server',
  'cubeos-dashboard': 'LayoutDashboard',
  'cubeos-pihole': 'Shield',
  'cubeos-npm': 'Globe',
  'cubeos-dockge': 'Container',
  'cubeos-logs': 'ScrollText',
  'cubeos-terminal': 'Terminal',
  'cubeos-watchdog': 'Eye',
  'cubeos-backup': 'HardDrive',
  'cubeos-diagnostics': 'Stethoscope',
  'cubeos-reset': 'RotateCcw',
  'cubeos-gpio': 'Cpu',
  'cubeos-nettools': 'Network',
  'cubeos-usb-monitor': 'Usb',
  // User apps
  'kiwix': 'BookOpen',
  'kiwix-server': 'BookOpen',
  'open-webui': 'Bot',
  'filebrowser': 'Folder',
  'vaultwarden': 'Lock',
  'calibre-web': 'Book',
  'syncthing': 'RefreshCw',
  'pihole': 'Shield',
  'uptime-kuma': 'Activity',
  'ollama': 'Brain',
  'cryptpad': 'FileText',
  'excalidraw': 'Pencil',
  'element': 'MessageSquare',
  'element-web': 'MessageSquare',
  'tileserver': 'Map',
  'tileserver-gl': 'Map',
  'libretranslate': 'Languages',
  'linkwarden': 'Link',
  'nginx-proxy': 'Globe',
  'conduit': 'MessageCircle',
  'matrix-conduit': 'MessageCircle',
  'meshtastic': 'Radio',
  'meshtastic-web': 'Radio',
  'it-tools': 'Wrench',
  'dockge': 'Container',
  'dozzle': 'ScrollText',
  'terminal': 'Terminal',
  'signalk-server': 'Anchor',
  'bentopdf': 'FileOutput',
  'radioreference': 'Radio',
  'emergency-ref': 'Radio',
  'open-archiver': 'Archive',
  'tika': 'Search',
  'meilisearch': 'Search',
  'great_galois': 'Calculator',
  'networking-toolbox': 'Network',
  'network-tools': 'Network',
  'apkrepo-nginx': 'Smartphone',
  'beszel': 'Monitor',
  'jellyfin': 'Film',
  'default': 'Box'
}

export const useServicesStore = defineStore('services', () => {
  const services = ref([])
  const favorites = ref([])
  const recentlyUsed = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const searchQuery = ref('')

  const serviceCount = computed(() => services.value.length)
  
  const runningCount = computed(() => 
    services.value.filter(s => s.state === 'running').length
  )
  
  // Favorite services (running, sorted by name)
  const favoriteServices = computed(() => {
    return services.value
      .filter(s => favorites.value.includes(s.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  // Recently used services
  const recentServices = computed(() => {
    return recentlyUsed.value
      .map(name => services.value.find(s => s.name === name))
      .filter(Boolean)
      .slice(0, 6)
  })

  const filteredServices = computed(() => {
    if (!searchQuery.value) return services.value
    const query = searchQuery.value.toLowerCase()
    return services.value.filter(s => 
      s.name.toLowerCase().includes(query) ||
      getServiceName(s.name).toLowerCase().includes(query)
    )
  })

  const categorizedServices = computed(() => {
    const result = {}
    for (const [key, category] of Object.entries(SERVICE_CATEGORIES)) {
      const categoryServices = filteredServices.value.filter(s => {
        const baseName = s.name.replace('cubeos-', '')
        return category.services.some(cs => 
          s.name === cs || 
          baseName === cs ||
          s.name.includes(cs) ||
          baseName.includes(cs)
        )
      })
      if (categoryServices.length > 0) {
        result[key] = {
          title: category.title,
          icon: category.icon,
          items: categoryServices
        }
      }
    }
    return result
  })

  const uncategorizedServices = computed(() => {
    const allCategorized = Object.values(SERVICE_CATEGORIES)
      .flatMap(c => c.services)
    return filteredServices.value.filter(s => {
      const baseName = s.name.replace('cubeos-', '')
      const isCategorized = allCategorized.some(cs => 
        s.name === cs || baseName === cs || s.name.includes(cs) || baseName.includes(cs)
      )
      return !isCategorized && !s.is_core
    })
  })

  const coreServices = computed(() => 
    filteredServices.value.filter(s => s.is_core || s.name.startsWith('cubeos-'))
  )

  const userInstalledServices = computed(() =>
    filteredServices.value.filter(s => !s.is_core && !s.name.startsWith('cubeos-'))
  )
  
  // Check if a service is favorited
  function isFavorite(serviceName) {
    return favorites.value.includes(serviceName)
  }

  // Check if service has a web UI
  function hasWebUI(serviceName) {
    // Check if in NO_UI_SERVICES list
    if (NO_UI_SERVICES.includes(serviceName)) return false
    
    // Check if we have an FQDN mapping
    return !!SERVICE_URLS[serviceName]
  }

  // Get service URL (FQDN-only via NPM)
  // NO port-based fallback - all services must go through reverse proxy
  function getServiceUrl(service) {
    const name = service.name
    
    // Check for predefined FQDN config (new format with path support)
    if (SERVICE_FQDNS[name]) {
      const config = SERVICE_FQDNS[name]
      const path = config.path || ''
      return `http://${config.fqdn}${path}`
    }
    
    // Check without cubeos- prefix
    const baseName = name.replace('cubeos-', '')
    if (SERVICE_FQDNS[baseName]) {
      const config = SERVICE_FQDNS[baseName]
      const path = config.path || ''
      return `http://${config.fqdn}${path}`
    }
    
    // Fallback to legacy SERVICE_URLS (string-only, no path)
    if (SERVICE_URLS[name]) {
      return `http://${SERVICE_URLS[name]}`
    }
    if (SERVICE_URLS[baseName]) {
      return `http://${SERVICE_URLS[baseName]}`
    }
    
    // No FQDN configured - service needs NPM proxy setup
    // Do NOT fall back to port-based URLs
    return null
  }

  // Get just the port for a service (for display/info purposes only)
  function getServicePort(serviceName) {
    const service = services.value.find(s => s.name === serviceName)
    if (!service) return null
    const ports = service.ports || []
    const webPort = ports.find(p => p.public_port)
    return webPort?.public_port || null
  }

  // Track recently used
  function trackUsage(serviceName) {
    const recent = recentlyUsed.value.filter(n => n !== serviceName)
    recent.unshift(serviceName)
    recentlyUsed.value = recent.slice(0, 10)
    localStorage.setItem('cubeos-recent', JSON.stringify(recentlyUsed.value))
  }

  async function fetchServices() {
    loading.value = true
    error.value = null
    try {
      const data = await api.getServices()
      // Filter out exited/dead containers - only show running or stopped (paused)
      services.value = (data.services || []).filter(s => 
        s.state === 'running' || s.state === 'paused' || s.state === 'restarting'
      )
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }
  
  async function fetchFavorites() {
    try {
      const data = await api.get('/favorites')
      favorites.value = data.favorites || []
    } catch (e) {
      console.error('Failed to fetch favorites:', e)
    }
  }

  function loadRecentlyUsed() {
    try {
      const stored = localStorage.getItem('cubeos-recent')
      if (stored) {
        recentlyUsed.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load recently used:', e)
    }
  }
  
  async function toggleFavorite(serviceName) {
    try {
      const data = await api.put(`/favorites/${serviceName}/toggle`)
      favorites.value = data.favorites || []
      return data.is_favorite
    } catch (e) {
      error.value = e.message
      return null
    }
  }
  
  async function addFavorite(serviceName) {
    try {
      const data = await api.post(`/favorites/${serviceName}`)
      favorites.value = data.favorites || []
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }
  
  async function removeFavorite(serviceName) {
    try {
      const data = await api.delete(`/favorites/${serviceName}`)
      favorites.value = data.favorites || []
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function startService(name) {
    try {
      await api.startService(name)
      await fetchServices()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function stopService(name) {
    try {
      await api.stopService(name)
      await fetchServices()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function restartService(name) {
    try {
      await api.restartService(name)
      await fetchServices()
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  // Get service health and logs (for no-UI services)
  async function getServiceHealth(name) {
    try {
      const [health, logs] = await Promise.all([
        api.get(`/services/${name}`),
        api.get(`/services/${name}/logs?lines=20`)
      ])
      return {
        status: health.state,
        health: health.health,
        uptime: health.uptime,
        logs: logs.logs || []
      }
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  function getServiceName(containerName) {
    return SERVICE_NAMES[containerName] || SERVICE_NAMES[containerName.replace('cubeos-', '')] || formatName(containerName)
  }

  function getServiceIcon(containerName) {
    return SERVICE_ICONS[containerName] || SERVICE_ICONS[containerName.replace('cubeos-', '')] || SERVICE_ICONS.default
  }

  function getCategoryIcon(categoryKey) {
    return SERVICE_CATEGORIES[categoryKey]?.icon || 'Box'
  }

  function formatName(name) {
    return name
      .replace('cubeos-', '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function setSearchQuery(query) {
    searchQuery.value = query
  }

  return {
    services,
    favorites,
    recentlyUsed,
    loading,
    error,
    lastUpdated,
    searchQuery,
    serviceCount,
    runningCount,
    favoriteServices,
    recentServices,
    filteredServices,
    categorizedServices,
    uncategorizedServices,
    coreServices,
    userInstalledServices,
    isFavorite,
    hasWebUI,
    getServiceUrl,
    getServicePort,
    trackUsage,
    fetchServices,
    fetchFavorites,
    loadRecentlyUsed,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    startService,
    stopService,
    restartService,
    getServiceHealth,
    getServiceName,
    getServiceIcon,
    getCategoryIcon,
    setSearchQuery
  }
})
