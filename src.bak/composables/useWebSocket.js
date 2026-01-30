import { ref, onMounted, onUnmounted, computed } from 'vue'

/**
 * WebSocket composable for real-time system stats
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Update interval in seconds (1-60, default 2)
 * @param {boolean} options.autoConnect - Auto connect on mount (default true)
 */
export function useWebSocket(options = {}) {
  const { interval = 2, autoConnect = true } = options
  
  const ws = ref(null)
  const connected = ref(false)
  const error = ref(null)
  const lastMessage = ref(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000
  
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
  
  function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/api/v1/ws/stats?interval=${interval}`
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
        console.log('[WebSocket] Connected')
      }
      
      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          lastMessage.value = data
          
          if (data.type === 'stats') {
            // Update stats
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
          }
        } catch (e) {
          console.error('[WebSocket] Parse error:', e)
        }
      }
      
      ws.value.onerror = (e) => {
        error.value = 'WebSocket error'
        console.error('[WebSocket] Error:', e)
      }
      
      ws.value.onclose = (e) => {
        connected.value = false
        console.log('[WebSocket] Disconnected:', e.code, e.reason)
        
        // Attempt reconnect if not intentionally closed
        if (e.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          console.log(`[WebSocket] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})`)
          reconnectTimeout = setTimeout(connect, reconnectDelay)
        }
      }
    } catch (e) {
      error.value = e.message
      console.error('[WebSocket] Connection error:', e)
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
  })
  
  onUnmounted(() => {
    disconnect()
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
    send
  }
}
