/**
 * CubeOS Communication Store
 *
 * Sprint 8: Complete communication data layer for MuleCube exotic hardware.
 * Provides access to Bluetooth, Cellular, GPS, Meshtastic, and Iridium endpoints.
 * All endpoints proxy through CubeOS API → HAL service.
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
 *   GET    /communication/meshtastic/{port}/status        - Meshtastic status
 *   GET    /communication/meshtastic/{port}/nodes         - Meshtastic node list
 *   POST   /communication/meshtastic/{port}/message       - Send Meshtastic message
 *   POST   /communication/meshtastic/{port}/channel       - Set Meshtastic channel
 *   GET    /communication/iridium/{port}/status           - Iridium modem status
 *   GET    /communication/iridium/{port}/signal           - Iridium signal strength
 *   GET    /communication/iridium/{port}/messages         - Iridium SBD messages
 *   POST   /communication/iridium/{port}/send             - Send Iridium SBD
 *   POST   /communication/iridium/{port}/mailbox          - Check Iridium mailbox
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

  // Meshtastic
  const meshtasticStatuses = ref({})
  const meshtasticNodes = ref({})

  // Iridium
  const iridiumStatuses = ref({})
  const iridiumSignals = ref({})
  const iridiumMessages = ref({})

  // Common
  const loading = ref(false)
  const error = ref(null)

  // ==========================================
  // Bluetooth
  // ==========================================

  /**
   * Fetch Bluetooth adapter status
   * GET /communication/bluetooth
   */
  async function fetchBluetooth(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/bluetooth', {}, options)
      if (data === null) return
      bluetooth.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
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
    try {
      const data = await api.get('/communication/bluetooth/devices', {}, options)
      if (data === null) return
      bluetoothDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
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
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/cellular', {}, options)
      if (data === null) return
      cellularModems.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
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
    try {
      const data = await api.get('/communication/cellular/status', {}, options)
      if (data === null) return
      cellularStatus.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
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
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/communication/gps', {}, options)
      if (data === null) return
      gpsDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
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
  // Meshtastic
  // ==========================================

  /**
   * Fetch Meshtastic device status
   * GET /communication/meshtastic/{port}/status
   * @param {string} port - Meshtastic device port
   */
  async function fetchMeshtasticStatus(port, options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get(`/communication/meshtastic/${encodeURIComponent(port)}/status`, {}, options)
      if (data === null) return null
      meshtasticStatuses.value = { ...meshtasticStatuses.value, [port]: data }
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
   * GET /communication/meshtastic/{port}/nodes
   * @param {string} port - Meshtastic device port
   */
  async function fetchMeshtasticNodes(port, options = {}) {
    try {
      const data = await api.get(`/communication/meshtastic/${encodeURIComponent(port)}/nodes`, {}, options)
      if (data === null) return null
      meshtasticNodes.value = { ...meshtasticNodes.value, [port]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Send a Meshtastic message
   * POST /communication/meshtastic/{port}/message
   * @param {string} port - Meshtastic device port
   * @param {object} data - { text, [to] }
   */
  async function sendMeshtasticMessage(port, messageData) {
    error.value = null
    try {
      return await api.post(`/communication/meshtastic/${encodeURIComponent(port)}/message`, messageData)
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Set Meshtastic channel configuration
   * POST /communication/meshtastic/{port}/channel
   * @param {string} port - Meshtastic device port
   * @param {object} data - { name, psk }
   */
  async function setMeshtasticChannel(port, channelData) {
    error.value = null
    try {
      const data = await api.post(`/communication/meshtastic/${encodeURIComponent(port)}/channel`, channelData)
      await fetchMeshtasticStatus(port)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Iridium
  // ==========================================

  /**
   * Fetch Iridium modem status
   * GET /communication/iridium/{port}/status
   * @param {string} port - Iridium modem port
   */
  async function fetchIridiumStatus(port, options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get(`/communication/iridium/${encodeURIComponent(port)}/status`, {}, options)
      if (data === null) return null
      iridiumStatuses.value = { ...iridiumStatuses.value, [port]: data }
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
   * GET /communication/iridium/{port}/signal
   * @param {string} port - Iridium modem port
   */
  async function fetchIridiumSignal(port, options = {}) {
    try {
      const data = await api.get(`/communication/iridium/${encodeURIComponent(port)}/signal`, {}, options)
      if (data === null) return null
      iridiumSignals.value = { ...iridiumSignals.value, [port]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch Iridium SBD messages
   * GET /communication/iridium/{port}/messages
   * @param {string} port - Iridium modem port
   */
  async function fetchIridiumMessages(port, options = {}) {
    try {
      const data = await api.get(`/communication/iridium/${encodeURIComponent(port)}/messages`, {}, options)
      if (data === null) return null
      iridiumMessages.value = { ...iridiumMessages.value, [port]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      return null
    }
  }

  /**
   * Send Iridium SBD message
   * POST /communication/iridium/{port}/send
   * @param {string} port - Iridium modem port
   * @param {object} data - { message }
   */
  async function sendIridiumSBD(port, messageData) {
    error.value = null
    try {
      const data = await api.post(`/communication/iridium/${encodeURIComponent(port)}/send`, messageData)
      await fetchIridiumMessages(port)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Check Iridium mailbox for new messages
   * POST /communication/iridium/{port}/mailbox
   * @param {string} port - Iridium modem port
   */
  async function checkIridiumMailbox(port, options = {}) {
    error.value = null
    try {
      const data = await api.post(`/communication/iridium/${encodeURIComponent(port)}/mailbox`, {}, options)
      if (data === null) return null
      await fetchIridiumMessages(port)
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
    }
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
    meshtasticStatuses,
    meshtasticNodes,

    // State — Iridium
    iridiumStatuses,
    iridiumSignals,
    iridiumMessages,

    // State — Common
    loading,
    error,

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
    fetchMeshtasticStatus,
    fetchMeshtasticNodes,
    sendMeshtasticMessage,
    setMeshtasticChannel,

    // Iridium
    fetchIridiumStatus,
    fetchIridiumSignal,
    fetchIridiumMessages,
    sendIridiumSBD,
    checkIridiumMailbox
  }
})
