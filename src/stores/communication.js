/**
 * CubeOS Communication Store
 *
 * Sprint 8 + HAL API Integration: Complete communication data layer for MuleCube exotic hardware.
 * Provides access to Bluetooth, Cellular, GPS, Meshtastic, and Iridium endpoints.
 * All endpoints proxy through CubeOS API → HAL service.
 *
 * Meshtastic and Iridium use a lifecycle pattern: discover → connect → operate → disconnect.
 * GPS retains the per-port pattern (API kept {port} routes for GPS).
 *
 * API Endpoints:
 *   GET    /communication/bluetooth                       - BT adapter status
 *   POST   /communication/bluetooth/scan                  - Scan for nearby devices
 *   GET    /communication/bluetooth/devices               - List known devices
 *   POST   /communication/bluetooth/pair/{address}        - Pair with device
 *   POST   /communication/bluetooth/connect/{address}     - Connect to paired device
 *   POST   /communication/bluetooth/disconnect/{address}  - Disconnect device
 *   DELETE /communication/bluetooth/devices/{address}     - Remove paired device
 *   POST   /communication/bluetooth/power/on              - Power on adapter
 *   POST   /communication/bluetooth/power/off             - Power off adapter
 *   GET    /communication/cellular                        - List cellular modems
 *   GET    /communication/cellular/status                 - Cellular status
 *   POST   /communication/cellular/{modem}/connect        - Connect modem
 *   POST   /communication/cellular/{modem}/disconnect     - Disconnect modem
 *   GET    /communication/cellular/{modem}/signal         - Modem signal strength
 *   GET    /communication/cellular/android                - Android tethering status
 *   POST   /communication/cellular/android/enable         - Enable tethering
 *   POST   /communication/cellular/android/disable        - Disable tethering
 *   GET    /communication/gps                             - List GPS devices
 *   GET    /communication/gps/{port}/status               - GPS device status
 *   GET    /communication/gps/{port}/position             - GPS position data
 *   GET    /communication/meshtastic/devices              - List available Meshtastic radios
 *   POST   /communication/meshtastic/connect              - Connect to radio (auto/serial/ble)
 *   POST   /communication/meshtastic/disconnect           - Disconnect from radio
 *   GET    /communication/meshtastic/status               - Radio status (connected, device, nodes)
 *   GET    /communication/meshtastic/nodes                - Mesh node list
 *   GET    /communication/meshtastic/position             - Local node GPS position
 *   GET    /communication/meshtastic/messages             - Message history
 *   POST   /communication/meshtastic/messages/send        - Send text message {text, to?, channel?}
 *   POST   /communication/meshtastic/messages/send_raw    - Send raw protobuf {portnum, payload, to?, channel?, want_ack?}
 *   GET    /communication/meshtastic/config               - Radio configuration
 *   POST   /communication/meshtastic/channel              - Set channel {index, name, role, psk?, uplink_enabled?, downlink_enabled?}
 *   GET    /communication/meshtastic/events               - SSE event stream
 *   GET    /communication/iridium/devices                 - List available satellite modems
 *   POST   /communication/iridium/connect                 - Connect to modem (auto or explicit port)
 *   POST   /communication/iridium/disconnect              - Disconnect modem
 *   GET    /communication/iridium/status                  - Modem status (connected, signal, queues)
 *   GET    /communication/iridium/signal                  - Signal strength (0-5 bars)
 *   POST   /communication/iridium/send                    - Send SBD {text, format} or {data, format:"binary"}
 *   POST   /communication/iridium/mailbox_check           - Check mailbox for incoming MT messages
 *   GET    /communication/iridium/receive                 - Receive pending MT message
 *   GET    /communication/iridium/messages                - Message history
 *   POST   /communication/iridium/clear                   - Clear MO/MT/both buffers {buffer}
 *   GET    /communication/iridium/events                  - SSE event stream
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useCommunicationStore = defineStore('communication', () => {
  // ==========================================
  // State
  // ==========================================

  // Bluetooth
  const bluetooth = ref(null)
  const bluetoothDevices = ref(null)
  const bluetoothScanning = ref(false)

  // Cellular
  const cellularModems = ref(null)
  const cellularStatus = ref(null)
  const modemSignals = ref({})
  const androidTethering = ref(null)

  // GPS
  const gpsDevices = ref(null)
  const gpsStatuses = ref({})
  const gpsPositions = ref({})

  // Meshtastic — single active connection (lifecycle pattern, no port keys)
  const meshtasticDevices = ref(null)
  const meshtasticStatus = ref(null)
  const meshtasticNodes = ref(null)
  const meshtasticPosition = ref(null)
  const meshtasticMessages = ref(null)
  const meshtasticConfig = ref(null)
  const meshtasticConnecting = ref(false)
  const meshtasticEventSource = ref(null)

  // Iridium — single active connection (lifecycle pattern, no port keys)
  const iridiumDevices = ref(null)
  const iridiumStatus = ref(null)
  const iridiumSignal = ref(null)
  const iridiumMessages = ref(null)
  const iridiumConnecting = ref(false)
  const iridiumEventSource = ref(null)

  // Common
  const loading = ref(false)
  const error = ref(null)

  // Absent-hardware cache: stop polling endpoints returning 404/503
  const _unavailableCache = {}
  const UNAVAILABLE_TTL_MS = 60000

  function isUnavailable(key) {
    const cached = _unavailableCache[key]
    if (!cached) return false
    if (Date.now() - cached > UNAVAILABLE_TTL_MS) {
      delete _unavailableCache[key]
      return false
    }
    return true
  }

  function markUnavailable(key) {
    _unavailableCache[key] = Date.now()
  }

  function isAbsentHardwareError(e) {
    if (e && (e.status === 404 || e.status === 503)) return true
    const msg = (e && e.message) || ''
    return /\b(404|503)\b/.test(msg) || /not found/i.test(msg)
  }

  function clearUnavailableCache() {
    Object.keys(_unavailableCache).forEach(k => delete _unavailableCache[k])
  }

  // ==========================================
  // SSE Helpers
  // ==========================================

  /**
   * Close an SSE connection stored in a ref.
   * Aborts the underlying fetch and nulls the ref.
   *
   * NOTE: This must only be called with an actual Vue ref, not a Pinia-unwrapped value.
   * For external callers, use closeMeshtasticSSE() / closeIridiumSSE() instead.
   *
   * @param {import('vue').Ref} sourceRef - ref holding { controller: AbortController }
   */
  function closeSSE(sourceRef) {
    if (!sourceRef) return // guard against Pinia-unwrapped null
    if (sourceRef.value) {
      try {
        sourceRef.value.controller.abort()
      } catch {
        // ignore abort errors
      }
      sourceRef.value = null
    }
  }

  /**
   * Close Meshtastic SSE stream.
   * Safe to call from outside the store (avoids Pinia ref-unwrapping issues).
   */
  function closeMeshtasticSSE() {
    closeSSE(meshtasticEventSource)
  }

  /**
   * Close Iridium SSE stream.
   * Safe to call from outside the store (avoids Pinia ref-unwrapping issues).
   */
  function closeIridiumSSE() {
    closeSSE(iridiumEventSource)
  }

  /**
   * Open an SSE stream using fetch + ReadableStream (supports Bearer auth).
   * Returns an object with { controller } for cleanup.
   * @param {string} endpoint - API endpoint path
   * @param {function} onEvent - callback(eventData) for each parsed SSE event
   * @param {function} [onError] - callback(error) on stream failure
   * @returns {{ controller: AbortController }}
   */
  function openSSE(endpoint, onEvent, onError) {
    const controller = new AbortController()
    const url = `/api/v1${endpoint}`
    const headers = { ...api.getHeaders(), 'Accept': 'text/event-stream' }

    fetch(url, { headers, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const raw = line.slice(5).trim()
              if (raw) {
                try {
                  onEvent(JSON.parse(raw))
                } catch {
                  // Non-JSON data line, pass as string
                  onEvent(raw)
                }
              }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (onError) onError(err)
      })

    return { controller }
  }

  // ==========================================
  // Bluetooth
  // ==========================================

  /**
   * Fetch Bluetooth adapter status
   * GET /communication/bluetooth
   */
  async function fetchBluetooth(options = {}) {
    if (isUnavailable('bluetooth')) return
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/bluetooth', {}, options)
      if (data === null) return
      bluetooth.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isAbsentHardwareError(e)) { markUnavailable('bluetooth') }
      else { error.value = e.message }
      bluetooth.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Scan for nearby Bluetooth devices
   * POST /communication/bluetooth/scan
   */
  async function scanBluetooth(options = {}) {
    error.value = null
    bluetoothScanning.value = true
    try {
      const data = await api.post('/communication/bluetooth/scan', {}, options)
      if (data === null) return null
      await fetchBluetoothDevices()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
    } finally {
      bluetoothScanning.value = false
    }
  }

  /**
   * Fetch list of known Bluetooth devices
   * GET /communication/bluetooth/devices
   */
  async function fetchBluetoothDevices(options = {}) {
    if (isUnavailable('bluetooth')) return
    try {
      const data = await api.get('/communication/bluetooth/devices', {}, options)
      if (data === null) return
      bluetoothDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isAbsentHardwareError(e)) { markUnavailable('bluetooth') }
      bluetoothDevices.value = null
    }
  }

  /**
   * Pair with a Bluetooth device
   * POST /communication/bluetooth/pair/{address}
   * @param {string} address - Device MAC address
   */
  async function pairBluetooth(address) {
    error.value = null
    try {
      const data = await api.post(`/communication/bluetooth/pair/${encodeURIComponent(address)}`)
      await fetchBluetoothDevices()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Connect to a paired Bluetooth device
   * POST /communication/bluetooth/connect/{address}
   * @param {string} address - Device MAC address
   */
  async function connectBluetooth(address) {
    error.value = null
    try {
      const data = await api.post(`/communication/bluetooth/connect/${encodeURIComponent(address)}`)
      await fetchBluetoothDevices()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Disconnect a Bluetooth device
   * POST /communication/bluetooth/disconnect/{address}
   * @param {string} address - Device MAC address
   */
  async function disconnectBluetooth(address) {
    error.value = null
    try {
      const data = await api.post(`/communication/bluetooth/disconnect/${encodeURIComponent(address)}`)
      await fetchBluetoothDevices()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Remove a paired Bluetooth device
   * DELETE /communication/bluetooth/devices/{address}
   * @param {string} address - Device MAC address
   */
  async function removeBluetooth(address) {
    error.value = null
    try {
      const data = await api.delete(`/communication/bluetooth/devices/${encodeURIComponent(address)}`)
      await fetchBluetoothDevices()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Power on Bluetooth adapter
   * POST /communication/bluetooth/power/on
   */
  async function bluetoothPowerOn() {
    error.value = null
    try {
      const data = await api.post('/communication/bluetooth/power/on')
      await fetchBluetooth()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Power off Bluetooth adapter
   * POST /communication/bluetooth/power/off
   */
  async function bluetoothPowerOff() {
    error.value = null
    try {
      const data = await api.post('/communication/bluetooth/power/off')
      await fetchBluetooth()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Cellular
  // ==========================================

  /**
   * Fetch list of cellular modems
   * GET /communication/cellular
   */
  async function fetchCellularModems(options = {}) {
    if (isUnavailable('cellular')) return
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/cellular', {}, options)
      if (data === null) return
      cellularModems.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isAbsentHardwareError(e)) { markUnavailable('cellular') }
      else { error.value = e.message }
      cellularModems.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch cellular connection status
   * GET /communication/cellular/status
   */
  async function fetchCellularStatus(options = {}) {
    if (isUnavailable('cellular')) return
    try {
      const data = await api.get('/communication/cellular/status', {}, options)
      if (data === null) return
      cellularStatus.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isAbsentHardwareError(e)) { markUnavailable('cellular') }
      cellularStatus.value = null
    }
  }

  /**
   * Connect a cellular modem
   * POST /communication/cellular/{modem}/connect
   * @param {string} modem - Modem identifier
   * @param {object} [connectionData] - Connection params: { apn, username, password }
   */
  async function connectModem(modem, connectionData = {}) {
    error.value = null
    try {
      const data = await api.post(`/communication/cellular/${encodeURIComponent(modem)}/connect`, connectionData)
      await fetchCellularModems()
      await fetchCellularStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Disconnect a cellular modem
   * POST /communication/cellular/{modem}/disconnect
   * @param {string} modem - Modem identifier
   */
  async function disconnectModem(modem) {
    error.value = null
    try {
      const data = await api.post(`/communication/cellular/${encodeURIComponent(modem)}/disconnect`)
      await fetchCellularModems()
      await fetchCellularStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch signal strength for a modem
   * GET /communication/cellular/{modem}/signal
   * @param {string} modem - Modem identifier
   */
  async function fetchModemSignal(modem) {
    try {
      const data = await api.get(`/communication/cellular/${encodeURIComponent(modem)}/signal`)
      if (data === null) return null
      modemSignals.value = { ...modemSignals.value, [modem]: data }
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch Android tethering status
   * GET /communication/cellular/android
   */
  async function fetchAndroidTethering(options = {}) {
    try {
      const data = await api.get('/communication/cellular/android', {}, options)
      if (data === null) return
      androidTethering.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      androidTethering.value = null
    }
  }

  /**
   * Enable Android tethering
   * POST /communication/cellular/android/enable
   */
  async function enableAndroidTethering() {
    error.value = null
    try {
      const data = await api.post('/communication/cellular/android/enable')
      await fetchAndroidTethering()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Disable Android tethering
   * POST /communication/cellular/android/disable
   */
  async function disableAndroidTethering() {
    error.value = null
    try {
      const data = await api.post('/communication/cellular/android/disable')
      await fetchAndroidTethering()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // GPS
  // ==========================================

  /**
   * Fetch list of GPS devices
   * GET /communication/gps
   */
  async function fetchGPSDevices(options = {}) {
    if (isUnavailable('gps')) return
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/gps', {}, options)
      if (data === null) return
      gpsDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isAbsentHardwareError(e)) { markUnavailable('gps') }
      else { error.value = e.message }
      gpsDevices.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch GPS device status
   * GET /communication/gps/{port}/status
   * @param {string} port - GPS device port
   */
  async function fetchGPSStatus(port, options = {}) {
    try {
      const data = await api.get(`/communication/gps/${encodeURIComponent(port)}/status`, {}, options)
      if (data === null) return null
      gpsStatuses.value = { ...gpsStatuses.value, [port]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch GPS position data
   * GET /communication/gps/{port}/position
   * @param {string} port - GPS device port
   */
  async function fetchGPSPosition(port, options = {}) {
    try {
      const data = await api.get(`/communication/gps/${encodeURIComponent(port)}/position`, {}, options)
      if (data === null) return null
      gpsPositions.value = { ...gpsPositions.value, [port]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // Meshtastic — Lifecycle Pattern
  // ==========================================

  /**
   * Fetch available Meshtastic radio devices
   * GET /communication/meshtastic/devices
   */
  async function fetchMeshtasticDevices(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/meshtastic/devices', {}, options)
      if (data === null) return null
      meshtasticDevices.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      meshtasticDevices.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Connect to a Meshtastic radio
   * POST /communication/meshtastic/connect
   * @param {object} [payload] - Connection params:
   *   {} (auto-detect)
   *   {transport:"serial", port:"/dev/ttyACM0"}
   *   {transport:"ble", address:"AA:BB:CC:DD:EE:FF"}
   */
  async function connectMeshtastic(payload = {}) {
    error.value = null
    meshtasticConnecting.value = true
    try {
      const data = await api.post('/communication/meshtastic/connect', payload)
      await fetchMeshtasticStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      meshtasticConnecting.value = false
    }
  }

  /**
   * Disconnect from the active Meshtastic radio
   * POST /communication/meshtastic/disconnect
   */
  async function disconnectMeshtastic() {
    error.value = null
    try {
      closeSSE(meshtasticEventSource)
      const data = await api.post('/communication/meshtastic/disconnect')
      // Reset connected-state refs
      meshtasticStatus.value = null
      meshtasticNodes.value = null
      meshtasticPosition.value = null
      meshtasticMessages.value = null
      meshtasticConfig.value = null
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch Meshtastic radio status
   * GET /communication/meshtastic/status
   */
  async function fetchMeshtasticStatus(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/meshtastic/status', {}, options)
      if (data === null) return null
      meshtasticStatus.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch Meshtastic mesh node list
   * GET /communication/meshtastic/nodes
   */
  async function fetchMeshtasticNodes(options = {}) {
    try {
      const data = await api.get('/communication/meshtastic/nodes', {}, options)
      if (data === null) return null
      meshtasticNodes.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch GPS position from connected Meshtastic radio
   * GET /communication/meshtastic/position
   */
  async function fetchMeshtasticPosition(options = {}) {
    try {
      const data = await api.get('/communication/meshtastic/position', {}, options)
      if (data === null) return null
      meshtasticPosition.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch Meshtastic message history
   * GET /communication/meshtastic/messages
   */
  async function fetchMeshtasticMessages(options = {}) {
    try {
      const data = await api.get('/communication/meshtastic/messages', {}, options)
      if (data === null) return null
      meshtasticMessages.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch Meshtastic radio configuration
   * GET /communication/meshtastic/config
   */
  async function fetchMeshtasticConfig(options = {}) {
    try {
      const data = await api.get('/communication/meshtastic/config', {}, options)
      if (data === null) return null
      meshtasticConfig.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Send a Meshtastic text message
   * POST /communication/meshtastic/messages/send
   * @param {object} messageData - { text, to?, channel? }
   *   to: destination node ID (0 = broadcast, default)
   *   channel: channel index (0-7, default 0)
   */
  async function sendMeshtasticMessage(messageData) {
    error.value = null
    try {
      return await api.post('/communication/meshtastic/messages/send', messageData)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Send a raw Meshtastic protobuf packet
   * POST /communication/meshtastic/messages/send_raw
   * @param {object} rawData - { portnum, payload, to?, channel?, want_ack? }
   *   portnum: Meshtastic port number (required)
   *   payload: base64-encoded protobuf data (required)
   */
  async function sendMeshtasticRaw(rawData) {
    error.value = null
    try {
      return await api.post('/communication/meshtastic/messages/send_raw', rawData)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Set Meshtastic channel configuration
   * POST /communication/meshtastic/channel
   * @param {object} channelData - { index, name, role, psk?, uplink_enabled?, downlink_enabled? }
   *   index: 0-7
   *   role: "PRIMARY" | "SECONDARY" | "DISABLED"
   */
  async function setMeshtasticChannel(channelData) {
    error.value = null
    try {
      const data = await api.post('/communication/meshtastic/channel', channelData)
      await fetchMeshtasticStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Open Meshtastic SSE event stream for real-time updates.
   * Events include incoming messages, node updates, and position reports.
   * GET /communication/meshtastic/events
   * @param {function} onEvent - callback(eventData) for each SSE event
   * @param {function} [onError] - callback(error) on stream failure
   */
  function connectMeshtasticSSE(onEvent, onError) {
    // Close any existing stream first
    closeSSE(meshtasticEventSource)
    meshtasticEventSource.value = openSSE(
      '/communication/meshtastic/events',
      onEvent,
      onError
    )
  }

  // ==========================================
  // Iridium — Lifecycle Pattern
  // ==========================================

  /**
   * Fetch available Iridium satellite modem devices
   * GET /communication/iridium/devices
   */
  async function fetchIridiumDevices(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/iridium/devices', {}, options)
      if (data === null) return null
      iridiumDevices.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      iridiumDevices.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Connect to an Iridium satellite modem
   * POST /communication/iridium/connect
   * @param {object} [payload] - Connection params:
   *   {} (auto-detect)
   *   {port:"/dev/ttyUSB0"}
   */
  async function connectIridium(payload = {}) {
    error.value = null
    iridiumConnecting.value = true
    try {
      const data = await api.post('/communication/iridium/connect', payload)
      await fetchIridiumStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      iridiumConnecting.value = false
    }
  }

  /**
   * Disconnect from the active Iridium modem
   * POST /communication/iridium/disconnect
   */
  async function disconnectIridium() {
    error.value = null
    try {
      closeSSE(iridiumEventSource)
      const data = await api.post('/communication/iridium/disconnect')
      // Reset connected-state refs
      iridiumStatus.value = null
      iridiumSignal.value = null
      iridiumMessages.value = null
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch Iridium modem status
   * GET /communication/iridium/status
   */
  async function fetchIridiumStatus(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/iridium/status', {}, options)
      if (data === null) return null
      iridiumStatus.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch Iridium signal strength
   * GET /communication/iridium/signal
   */
  async function fetchIridiumSignal(options = {}) {
    try {
      const data = await api.get('/communication/iridium/signal', {}, options)
      if (data === null) return null
      iridiumSignal.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch Iridium message history
   * GET /communication/iridium/messages
   */
  async function fetchIridiumMessages(options = {}) {
    try {
      const data = await api.get('/communication/iridium/messages', {}, options)
      if (data === null) return null
      iridiumMessages.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Send Iridium SBD message
   * POST /communication/iridium/send
   * @param {object} messageData - { text, format } or { data, format:"binary" }
   *   format: "text" or "binary" (required)
   *   text: message text (max 340 bytes for text format)
   *   data: base64-encoded binary data (for binary format)
   */
  async function sendIridiumSBD(messageData) {
    error.value = null
    try {
      const data = await api.post('/communication/iridium/send', messageData)
      await fetchIridiumMessages()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Check Iridium mailbox for incoming MT messages
   * POST /communication/iridium/mailbox_check
   */
  async function checkIridiumMailbox(options = {}) {
    error.value = null
    try {
      const data = await api.post('/communication/iridium/mailbox_check', {}, options)
      if (data === null) return null
      await fetchIridiumMessages()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
    }
  }

  /**
   * Receive pending MT (Mobile-Terminated) message from Iridium modem buffer
   * GET /communication/iridium/receive
   */
  async function receiveIridiumMessage(options = {}) {
    error.value = null
    try {
      const data = await api.get('/communication/iridium/receive', {}, options)
      if (data === null) return null
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Clear Iridium modem buffers
   * POST /communication/iridium/clear
   * @param {object} payload - { buffer } where buffer is "mo", "mt", or "both"
   */
  async function clearIridiumBuffers(payload) {
    error.value = null
    try {
      const data = await api.post('/communication/iridium/clear', payload)
      await fetchIridiumMessages()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Open Iridium SSE event stream for real-time updates.
   * Events include signal changes, incoming messages, and connection state transitions.
   * GET /communication/iridium/events
   * @param {function} onEvent - callback(eventData) for each SSE event
   * @param {function} [onError] - callback(error) on stream failure
   */
  function connectIridiumSSE(onEvent, onError) {
    // Close any existing stream first
    closeSSE(iridiumEventSource)
    iridiumEventSource.value = openSSE(
      '/communication/iridium/events',
      onEvent,
      onError
    )
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State — Bluetooth
    bluetooth,
    bluetoothDevices,
    bluetoothScanning,

    // State — Cellular
    cellularModems,
    cellularStatus,
    modemSignals,
    androidTethering,

    // State — GPS
    gpsDevices,
    gpsStatuses,
    gpsPositions,

    // State — Meshtastic
    meshtasticDevices,
    meshtasticStatus,
    meshtasticNodes,
    meshtasticPosition,
    meshtasticMessages,
    meshtasticConfig,
    meshtasticConnecting,
    meshtasticEventSource,

    // State — Iridium
    iridiumDevices,
    iridiumStatus,
    iridiumSignal,
    iridiumMessages,
    iridiumConnecting,
    iridiumEventSource,

    // State — Common
    loading,
    error,

    // Cache management
    clearUnavailableCache,

    // SSE Helpers
    closeSSE,
    closeMeshtasticSSE,
    closeIridiumSSE,

    // Bluetooth
    fetchBluetooth,
    scanBluetooth,
    fetchBluetoothDevices,
    pairBluetooth,
    connectBluetooth,
    disconnectBluetooth,
    removeBluetooth,
    bluetoothPowerOn,
    bluetoothPowerOff,

    // Cellular
    fetchCellularModems,
    fetchCellularStatus,
    connectModem,
    disconnectModem,
    fetchModemSignal,
    fetchAndroidTethering,
    enableAndroidTethering,
    disableAndroidTethering,

    // GPS
    fetchGPSDevices,
    fetchGPSStatus,
    fetchGPSPosition,

    // Meshtastic
    fetchMeshtasticDevices,
    connectMeshtastic,
    disconnectMeshtastic,
    fetchMeshtasticStatus,
    fetchMeshtasticNodes,
    fetchMeshtasticPosition,
    fetchMeshtasticMessages,
    fetchMeshtasticConfig,
    sendMeshtasticMessage,
    sendMeshtasticRaw,
    setMeshtasticChannel,
    connectMeshtasticSSE,

    // Iridium
    fetchIridiumDevices,
    connectIridium,
    disconnectIridium,
    fetchIridiumStatus,
    fetchIridiumSignal,
    fetchIridiumMessages,
    sendIridiumSBD,
    checkIridiumMailbox,
    receiveIridiumMessage,
    clearIridiumBuffers,
    connectIridiumSSE
  }
})
