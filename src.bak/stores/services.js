import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Service categories with Lucide icon names (monochrome SVG)
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
  infrastructure: {
    title: 'Infrastructure',
    icon: 'Server',
    services: ['uptime-kuma', 'pihole', 'beszel', 'nginx-proxy']
  },
  admin: {
    title: 'Admin',
    icon: 'Settings',
    services: ['mulecube-dockge', 'dockge', 'mulecube-logs', 'dozzle', 'mulecube-terminal', 'homarr', 'mulecube-homarr']
  }
}

// Friendly display names for services
const SERVICE_NAMES = {
  'open-webui': 'Open WebUI',
  'kiwix': 'Wikipedia (Kiwix)',
  'kiwix-server': 'Wikipedia (Kiwix)',
  'tileserver': 'Maps',
  'tileserver-gl': 'Maps',
  'calibre-web': 'Calibre-Web',
  'signalk-server': 'Signal K',
  'emergency-ref': 'RadioReference',
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
  'beszel': 'Beszel',
  'nginx-proxy': 'Nginx Proxy',
  'mulecube-dockge': 'Dockge',
  'dockge': 'Dockge',
  'mulecube-logs': 'Dozzle',
  'dozzle': 'Dozzle',
  'mulecube-terminal': 'Terminal',
  'libretranslate': 'LibreTranslate',
  'ollama': 'Ollama',
  'great_galois': 'Great Galois',
  'tika': 'Tika',
  'meilisearch': 'Meilisearch',
  'homarr': 'Homarr',
  'mulecube-homarr': 'Homarr'
}

// Service icons - Lucide icon component names (monochrome SVG)
const SERVICE_ICONS = {
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
  'mulecube-dockge': 'Container',
  'dozzle': 'ScrollText',
  'mulecube-logs': 'ScrollText',
  'mulecube-terminal': 'Terminal',
  'homarr': 'LayoutDashboard',
  'mulecube-homarr': 'LayoutDashboard',
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
  'default': 'Box'
}

export const useServicesStore = defineStore('services', () => {
  const services = ref([])
  const favorites = ref([])
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
        const baseName = s.name.replace('mulecube-', '')
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
      const baseName = s.name.replace('mulecube-', '')
      const isCategorized = allCategorized.some(cs => 
        s.name === cs || baseName === cs || s.name.includes(cs) || baseName.includes(cs)
      )
      return !isCategorized && !s.is_core
    })
  })

  const coreServices = computed(() => 
    filteredServices.value.filter(s => s.is_core)
  )
  
  // Check if a service is favorited
  function isFavorite(serviceName) {
    return favorites.value.includes(serviceName)
  }

  async function fetchServices() {
    loading.value = true
    error.value = null
    try {
      const data = await api.getServices()
      services.value = data.services || []
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

  function getServiceName(containerName) {
    return SERVICE_NAMES[containerName] || SERVICE_NAMES[containerName.replace('mulecube-', '')] || formatName(containerName)
  }

  function getServiceIcon(containerName) {
    return SERVICE_ICONS[containerName] || SERVICE_ICONS[containerName.replace('mulecube-', '')] || SERVICE_ICONS.default
  }

  function getCategoryIcon(categoryKey) {
    return SERVICE_CATEGORIES[categoryKey]?.icon || 'Box'
  }

  function formatName(name) {
    return name
      .replace('mulecube-', '')
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
    loading,
    error,
    lastUpdated,
    searchQuery,
    serviceCount,
    runningCount,
    favoriteServices,
    filteredServices,
    categorizedServices,
    uncategorizedServices,
    coreServices,
    isFavorite,
    fetchServices,
    fetchFavorites,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    startService,
    stopService,
    restartService,
    getServiceName,
    getServiceIcon,
    getCategoryIcon,
    setSearchQuery
  }
})
