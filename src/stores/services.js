import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// Service categories and metadata
const SERVICE_CATEGORIES = {
  ai: {
    title: 'AI Services',
    icon: '🤖',
    services: ['libretranslate', 'open-webui', 'ollama']
  },
  knowledge: {
    title: 'Knowledge',
    icon: '📚',
    services: ['kiwix', 'tileserver', 'calibre-web', 'signalk-server', 'emergency-ref']
  },
  productivity: {
    title: 'Productivity',
    icon: '✏️',
    services: ['cryptpad', 'excalidraw', 'bentopdf', 'vaultwarden']
  },
  files: {
    title: 'Files & Sync',
    icon: '📁',
    services: ['filebrowser', 'syncthing', 'linkwarden', 'open-archiver']
  },
  communication: {
    title: 'Communication',
    icon: '💬',
    services: ['element', 'meshtastic-web', 'conduit']
  },
  tools: {
    title: 'Tools',
    icon: '🛠️',
    services: ['it-tools', 'apkrepo-nginx', 'networking-toolbox']
  },
  infrastructure: {
    title: 'Infrastructure',
    icon: '📊',
    services: ['uptime-kuma', 'pihole', 'beszel', 'nginx-proxy']
  },
  admin: {
    title: 'Admin',
    icon: '⚙️',
    services: ['mulecube-dockge', 'mulecube-logs', 'mulecube-terminal']
  }
}

// Friendly names for services
const SERVICE_NAMES = {
  'open-webui': 'Open WebUI',
  'kiwix': 'Wikipedia (Kiwix)',
  'tileserver': 'Maps',
  'calibre-web': 'Calibre-Web',
  'signalk-server': 'Signal K',
  'emergency-ref': 'RadioReference',
  'cryptpad': 'CryptPad',
  'excalidraw': 'Excalidraw',
  'bentopdf': 'BentoPDF',
  'vaultwarden': 'Vaultwarden',
  'filebrowser': 'File Browser',
  'syncthing': 'Syncthing',
  'linkwarden': 'Linkwarden',
  'open-archiver': 'Open Archiver',
  'element': 'Element',
  'meshtastic-web': 'Meshtastic',
  'conduit': 'Conduit',
  'it-tools': 'IT-Tools',
  'apkrepo-nginx': 'F-Droid',
  'networking-toolbox': 'Network Tools',
  'uptime-kuma': 'Uptime Kuma',
  'pihole': 'Pi-hole',
  'beszel': 'Beszel',
  'nginx-proxy': 'Nginx Proxy',
  'mulecube-dockge': 'Dockge',
  'mulecube-logs': 'Dozzle',
  'mulecube-terminal': 'Terminal',
  'libretranslate': 'LibreTranslate',
  'ollama': 'Ollama'
}

export const useServicesStore = defineStore('services', () => {
  // State
  const services = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const searchQuery = ref('')

  // Getters
  const serviceCount = computed(() => services.value.length)
  
  const runningCount = computed(() => 
    services.value.filter(s => s.state === 'running').length
  )

  const filteredServices = computed(() => {
    if (!searchQuery.value) return services.value
    const query = searchQuery.value.toLowerCase()
    return services.value.filter(s => 
      s.name.toLowerCase().includes(query) ||
      (SERVICE_NAMES[s.name] || s.name).toLowerCase().includes(query)
    )
  })

  const categorizedServices = computed(() => {
    const result = {}
    for (const [key, category] of Object.entries(SERVICE_CATEGORIES)) {
      const categoryServices = filteredServices.value.filter(s => 
        category.services.includes(s.name)
      )
      if (categoryServices.length > 0) {
        result[key] = {
          ...category,
          items: categoryServices
        }
      }
    }
    return result
  })

  const uncategorizedServices = computed(() => {
    const allCategorized = Object.values(SERVICE_CATEGORIES)
      .flatMap(c => c.services)
    return filteredServices.value.filter(s => 
      !allCategorized.includes(s.name) && !s.is_core
    )
  })

  const coreServices = computed(() => 
    filteredServices.value.filter(s => s.is_core)
  )

  // Actions
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
    return SERVICE_NAMES[containerName] || containerName
  }

  function getServiceUrl(service) {
    // Generate URL from service name
    const name = service.name.replace('mulecube-', '').replace('-', '')
    return `http://${name}.mulecube.net`
  }

  function setSearchQuery(query) {
    searchQuery.value = query
  }

  return {
    services,
    loading,
    error,
    lastUpdated,
    searchQuery,
    serviceCount,
    runningCount,
    filteredServices,
    categorizedServices,
    uncategorizedServices,
    coreServices,
    fetchServices,
    startService,
    stopService,
    restartService,
    getServiceName,
    getServiceUrl,
    setSearchQuery
  }
})
