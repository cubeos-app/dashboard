import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

// SVG icon paths (monochrome, Apple-style)
export const ICONS = {
  // Categories
  ai: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
  knowledge: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />`,
  productivity: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />`,
  files: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />`,
  communication: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />`,
  tools: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`,
  infrastructure: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />`,
  admin: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  
  // Services
  server: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />`,
  globe: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />`,
  translate: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />`,
  lightbulb: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />`,
  book: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />`,
  map: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />`,
  radio: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />`,
  document: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />`,
  pencil: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />`,
  pdf: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />`,
  lock: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />`,
  folder: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />`,
  sync: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />`,
  link: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />`,
  archive: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />`,
  chat: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />`,
  wifi: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />`,
  download: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />`,
  chart: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />`,
  shield: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />`,
  cube: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />`,
  terminal: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />`,
  list: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" />`,
  default: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />`
}

// Service categories
const SERVICE_CATEGORIES = {
  ai: {
    title: 'AI Services',
    icon: ICONS.ai,
    services: ['libretranslate', 'open-webui', 'ollama']
  },
  knowledge: {
    title: 'Knowledge',
    icon: ICONS.knowledge,
    services: ['kiwix', 'tileserver', 'calibre-web', 'signalk-server', 'emergency-ref']
  },
  productivity: {
    title: 'Productivity',
    icon: ICONS.productivity,
    services: ['cryptpad', 'excalidraw', 'bentopdf', 'vaultwarden']
  },
  files: {
    title: 'Files & Sync',
    icon: ICONS.files,
    services: ['filebrowser', 'syncthing', 'linkwarden', 'open-archiver']
  },
  communication: {
    title: 'Communication',
    icon: ICONS.communication,
    services: ['element', 'meshtastic-web', 'conduit']
  },
  tools: {
    title: 'Tools',
    icon: ICONS.tools,
    services: ['it-tools', 'apkrepo-nginx', 'networking-toolbox']
  },
  infrastructure: {
    title: 'Infrastructure',
    icon: ICONS.infrastructure,
    services: ['uptime-kuma', 'pihole', 'beszel', 'nginx-proxy']
  },
  admin: {
    title: 'Admin',
    icon: ICONS.admin,
    services: ['mulecube-dockge', 'mulecube-logs', 'mulecube-terminal']
  }
}

// Service icon mapping
const SERVICE_ICON_MAP = {
  'open-webui': 'ai',
  'libretranslate': 'translate',
  'ollama': 'lightbulb',
  'kiwix': 'book',
  'tileserver': 'map',
  'calibre-web': 'book',
  'signalk-server': 'globe',
  'emergency-ref': 'radio',
  'cryptpad': 'document',
  'excalidraw': 'pencil',
  'bentopdf': 'pdf',
  'vaultwarden': 'lock',
  'filebrowser': 'folder',
  'syncthing': 'sync',
  'linkwarden': 'link',
  'open-archiver': 'archive',
  'element': 'chat',
  'meshtastic-web': 'wifi',
  'conduit': 'server',
  'it-tools': 'tools',
  'apkrepo-nginx': 'download',
  'networking-toolbox': 'globe',
  'uptime-kuma': 'chart',
  'pihole': 'shield',
  'beszel': 'server',
  'nginx-proxy': 'globe',
  'mulecube-dockge': 'cube',
  'mulecube-logs': 'list',
  'mulecube-terminal': 'terminal'
}

// Friendly names
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
  const services = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const searchQuery = ref('')

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

  function getServiceIcon(containerName) {
    const iconKey = SERVICE_ICON_MAP[containerName] || 'default'
    return ICONS[iconKey] || ICONS.default
  }

  function getServiceUrl(service) {
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
    getServiceIcon,
    getServiceUrl,
    setSearchQuery,
    ICONS
  }
})
