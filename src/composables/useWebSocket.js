import { ref, onMounted, onUnmounted, computed } from 'vue'

/**
 * WebSocket composable for real-time system stats.
 *
 * Designed to be used once in App.vue so a single connection serves all views.
 * The onStats callback feeds data into the system store; individual views
 * simply read from the store as they already do.
 *
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Server push interval in seconds (1-60, default 2)
 * @param {boolean} options.autoConnect - Auto connect on mount (default true)
 * @param {Function} options.onStats - Callback receiving parsed stats on each message
 */
export function useWebSocket(options = {}) {
  const { interval = 2, autoConnect = true, onStats = null } = options

  const ws = ref(null)
  const connected = ref(false)
  const error = ref(null)
  const lastMessage = ref(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 2000

  // Parsed stats from last message
  const stats = ref({
    cpu: { percent: 0 },
    memory: { percent: 0, used: 0, total: 0 },
    disk: { percent: 0, used: 0, total: 0 },
    temperature: { cpu_temp_c: null, throttled: false, under_voltage: false },
    network: { clients_connected: 0, interfaces: {} },
    docker: { running: 0, total: 0, containers: [] }
  })

  // Computed values for easy access
  const cpuPercent = computed(() => Math.round(stats.value.cpu?.percent || 0))
  const memoryPercent = computed(() => Math.round(stats.value.memory?.percent || 0))
  const diskPercent = computed(() => Math.round(stats.value.disk?.percent || 0))
  const temperature = computed(() => stats.value.temperature?.cpu_temp_c)
  const wifiClients = computed(() => stats.value.network?.clients_connected || 0)
  const runningContainers = computed(() => stats.value.docker?.running || 0)
  const totalContainers = computed(() => stats.value.docker?.total || 0)

  let reconnectTimeout = null
  let visibilityHandler = null
  let onlineHandler = null

  function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/api/v1/ws/stats?interval=${interval}`
  }

  /**
   * Exponential backoff with jitter for reconnect delay.
   * Starts at baseReconnectDelay, doubles each attempt, capped at 30s.
   */
  function getReconnectDelay() {
    const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts.value), 30000)
    // Add 0-25% jitter to avoid thundering herd
    return delay + Math.random() * delay * 0.25
  }

  /**
   * Force reconnect — resets attempt counter and reconnects immediately.
   * Useful after network mode changes or manual recovery.
   */
  function reconnect() {
    disconnect()
    reconnectAttempts.value = 0
    connect()
  }

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return
    }

    error.value = null

    try {
      ws.value = new WebSocket(getWebSocketUrl())

      ws.value.onopen = () => {
        connected.value = true
        reconnectAttempts.value = 0
        error.value = null
      }

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          lastMessage.value = data

          if (data.type === 'stats') {
            // Update internal stats
            if (data.system) {
              stats.value.cpu = data.system.cpu || stats.value.cpu
              stats.value.memory = data.system.memory || stats.value.memory
              stats.value.disk = data.system.disk || stats.value.disk
              stats.value.temperature = data.system.temperature || stats.value.temperature
            }
            if (data.network) {
              stats.value.network = data.network
            }
            if (data.docker) {
              stats.value.docker = data.docker
            }

            // Notify callback so App.vue can pipe data into the system store
            if (onStats) {
              onStats(data)
            }
          }
        } catch (e) {
          // Parse error — ignore malformed messages
        }
      }

      ws.value.onerror = () => {
        error.value = 'WebSocket error'
      }

      ws.value.onclose = (e) => {
        connected.value = false

        // Attempt reconnect with exponential backoff if not intentionally closed
        if (e.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          const delay = getReconnectDelay()
          reconnectTimeout = setTimeout(connect, delay)
        }
      }
    } catch (e) {
      error.value = e.message
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (ws.value) {
      ws.value.close(1000, 'User disconnect')
      ws.value = null
    }

    connected.value = false
    reconnectAttempts.value = 0
  }

  function send(data) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    }
  }

  onMounted(() => {
    if (autoConnect) {
      connect()
    }

    // Reconnect when tab becomes visible again
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !connected.value) {
        reconnectAttempts.value = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    // Reconnect when browser comes back online (e.g. after network mode change)
    onlineHandler = () => {
      if (!connected.value) {
        reconnectAttempts.value = 0
        // Small delay to let network stabilize after mode change
        setTimeout(connect, 1000)
      }
    }
    window.addEventListener('online', onlineHandler)
  })

  onUnmounted(() => {
    disconnect()
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler)
    }
  })

  return {
    // State
    connected,
    error,
    lastMessage,
    stats,
    reconnectAttempts,

    // Computed
    cpuPercent,
    memoryPercent,
    diskPercent,
    temperature,
    wifiClients,
    runningContainers,
    totalContainers,

    // Methods
    connect,
    disconnect,
    reconnect,
    send
  }
}
