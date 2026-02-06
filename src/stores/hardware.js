/**
 * CubeOS Hardware Store
 *
 * Sprint 7: Complete hardware HAL data layer.
 * Provides access to all hardware endpoints — GPIO, I2C, sensors, RTC,
 * watchdog, power/UPS, boot config, throttle, and HAL service management.
 *
 * Existing battery/eeprom/temperature data remains in systemStore to avoid
 * breaking AppHeader and DashboardView. HardwareView imports both stores.
 *
 * API Endpoints (all proxied through CubeOS API → HAL at port 6005):
 *   GET    /hardware/overview              - Hardware overview summary
 *   GET    /hardware/power                 - Power supply status
 *   GET    /hardware/throttle              - CPU throttle flags
 *   GET    /hardware/uptime                - System uptime detail
 *   GET    /hardware/bootconfig            - Boot configuration (config.txt)
 *   GET    /hardware/ups                   - UPS/battery module status
 *   POST   /hardware/battery/quickstart    - Battery quick start
 *   POST   /hardware/charging              - Set charging state
 *   GET    /power/status                   - Power status (power endpoint)
 *   PUT    /power/charging                 - Set charging (power endpoint)
 *   GET    /hardware/gpio                  - List all GPIO pins
 *   GET    /hardware/gpio/{pin}            - Read single GPIO pin
 *   POST   /hardware/gpio/{pin}            - Set GPIO pin value
 *   POST   /hardware/gpio/{pin}/mode       - Set GPIO pin mode
 *   GET    /hardware/i2c                   - List I2C buses
 *   GET    /hardware/i2c/{bus}/scan        - Scan I2C bus for devices
 *   GET    /hardware/i2c/{bus}/{addr}      - Read I2C device
 *   GET    /hardware/sensors               - List all sensors
 *   GET    /hardware/sensors/bme280        - BME280 temp/humidity/pressure
 *   GET    /hardware/sensors/1wire         - List 1-Wire devices
 *   GET    /hardware/sensors/1wire/{id}    - Read 1-Wire device
 *   GET    /hardware/rtc                   - RTC status and time
 *   POST   /hardware/rtc/sync             - Sync RTC to system time
 *   POST   /hardware/rtc/wake             - Set RTC wake alarm
 *   DELETE /hardware/rtc/wake             - Clear RTC wake alarm
 *   GET    /hardware/watchdog              - Watchdog status
 *   POST   /hardware/watchdog/enable       - Enable/configure watchdog
 *   POST   /hardware/watchdog/pet          - Pet the watchdog (debug)
 *   GET    /hardware/services/{name}       - HAL service status
 *   POST   /hardware/services/{name}/start - Start HAL service
 *   POST   /hardware/services/{name}/stop  - Stop HAL service
 *   POST   /hardware/services/{name}/restart - Restart HAL service
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'

export const useHardwareStore = defineStore('hardware', () => {
  // ==========================================
  // State
  // ==========================================

  const overview = ref(null)
  const power = ref(null)
  const throttle = ref(null)
  const uptime = ref(null)
  const bootConfig = ref(null)
  const ups = ref(null)
  const powerStatus = ref(null)
  const gpioPins = ref(null)
  const i2cBuses = ref(null)
  const sensors = ref(null)
  const bme280 = ref(null)
  const oneWireDevices = ref(null)
  const rtc = ref(null)
  const watchdog = ref(null)
  const halServices = ref({})
  const loading = ref(false)
  const error = ref(null)

  // ==========================================
  // Overview / Power / Boot
  // ==========================================

  /**
   * Fetch hardware overview summary
   * GET /hardware/overview
   */
  async function fetchOverview(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/overview', {}, options)
      if (data === null) return
      overview.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch power supply status
   * GET /hardware/power
   */
  async function fetchPower(options = {}) {
    try {
      const data = await api.get('/hardware/power', {}, options)
      if (data === null) return
      power.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      power.value = null
    }
  }

  /**
   * Fetch CPU throttle flags
   * GET /hardware/throttle
   */
  async function fetchThrottle(options = {}) {
    try {
      const data = await api.get('/hardware/throttle', {}, options)
      if (data === null) return
      throttle.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      throttle.value = null
    }
  }

  /**
   * Fetch detailed uptime info
   * GET /hardware/uptime
   */
  async function fetchUptime(options = {}) {
    try {
      const data = await api.get('/hardware/uptime', {}, options)
      if (data === null) return
      uptime.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      uptime.value = null
    }
  }

  /**
   * Fetch boot configuration (config.txt)
   * GET /hardware/bootconfig
   */
  async function fetchBootConfig(options = {}) {
    try {
      const data = await api.get('/hardware/bootconfig', {}, options)
      if (data === null) return
      bootConfig.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      bootConfig.value = null
    }
  }

  /**
   * Fetch UPS module status
   * GET /hardware/ups
   */
  async function fetchUPS(options = {}) {
    try {
      const data = await api.get('/hardware/ups', {}, options)
      if (data === null) return
      ups.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      ups.value = null
    }
  }

  /**
   * Battery quick start
   * POST /hardware/battery/quickstart
   */
  async function batteryQuickStart() {
    error.value = null
    try {
      return await api.post('/hardware/battery/quickstart')
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Set charging state via HAL
   * POST /hardware/charging
   * @param {boolean} state - true to enable, false to disable
   */
  async function setCharging(state) {
    error.value = null
    try {
      const data = await api.post('/hardware/charging', { enabled: state })
      await fetchPower()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch power status (power endpoint)
   * GET /power/status
   */
  async function fetchPowerStatus(options = {}) {
    try {
      const data = await api.get('/power/status', {}, options)
      if (data === null) return
      powerStatus.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      powerStatus.value = null
    }
  }

  /**
   * Set charging state (power endpoint)
   * PUT /power/charging
   * @param {boolean} state - true to enable, false to disable
   */
  async function setChargingState(state) {
    error.value = null
    try {
      const data = await api.put('/power/charging', { enabled: state })
      await fetchPowerStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // GPIO
  // ==========================================

  /**
   * Fetch all GPIO pins
   * GET /hardware/gpio
   */
  async function fetchGPIO(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/gpio', {}, options)
      if (data === null) return
      gpioPins.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      gpioPins.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single GPIO pin state
   * GET /hardware/gpio/{pin}
   * @param {number|string} pin - GPIO pin number
   */
  async function fetchGPIOPin(pin) {
    try {
      return await api.get(`/hardware/gpio/${encodeURIComponent(pin)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Set GPIO pin value
   * POST /hardware/gpio/{pin}
   * @param {number|string} pin - GPIO pin number
   * @param {number} value - 0 or 1
   */
  async function setGPIOPin(pin, value) {
    error.value = null
    try {
      const data = await api.post(`/hardware/gpio/${encodeURIComponent(pin)}`, { value })
      await fetchGPIO()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Set GPIO pin mode
   * POST /hardware/gpio/{pin}/mode
   * @param {number|string} pin - GPIO pin number
   * @param {string} mode - 'input', 'output', 'alt0', etc.
   */
  async function setGPIOMode(pin, mode) {
    error.value = null
    try {
      const data = await api.post(`/hardware/gpio/${encodeURIComponent(pin)}/mode`, { mode })
      await fetchGPIO()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // I2C
  // ==========================================

  /**
   * Fetch available I2C buses
   * GET /hardware/i2c
   */
  async function fetchI2CBuses(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/i2c', {}, options)
      if (data === null) return
      i2cBuses.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      i2cBuses.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Scan I2C bus for connected devices
   * GET /hardware/i2c/{bus}/scan
   * @param {number|string} bus - I2C bus number (e.g. 1)
   */
  async function scanI2CBus(bus) {
    error.value = null
    try {
      return await api.get(`/hardware/i2c/${encodeURIComponent(bus)}/scan`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Read I2C device data
   * GET /hardware/i2c/{bus}/{addr}
   * @param {number|string} bus - I2C bus number
   * @param {string} addr - Device address (hex, e.g. '0x76')
   */
  async function readI2CDevice(bus, addr) {
    error.value = null
    try {
      return await api.get(`/hardware/i2c/${encodeURIComponent(bus)}/${encodeURIComponent(addr)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // Sensors
  // ==========================================

  /**
   * Fetch all sensor data
   * GET /hardware/sensors
   */
  async function fetchSensors(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/sensors', {}, options)
      if (data === null) return
      sensors.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      sensors.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch BME280 temperature/humidity/pressure
   * GET /hardware/sensors/bme280
   */
  async function fetchBME280(options = {}) {
    try {
      const data = await api.get('/hardware/sensors/bme280', {}, options)
      if (data === null) return
      bme280.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      bme280.value = null
    }
  }

  /**
   * Fetch 1-Wire device list
   * GET /hardware/sensors/1wire
   */
  async function fetch1Wire(options = {}) {
    try {
      const data = await api.get('/hardware/sensors/1wire', {}, options)
      if (data === null) return
      oneWireDevices.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      oneWireDevices.value = null
    }
  }

  /**
   * Read single 1-Wire device
   * GET /hardware/sensors/1wire/{id}
   * @param {string} id - 1-Wire device ID
   */
  async function read1Wire(id) {
    try {
      return await api.get(`/hardware/sensors/1wire/${encodeURIComponent(id)}`)
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // RTC
  // ==========================================

  /**
   * Fetch RTC status and current time
   * GET /hardware/rtc
   */
  async function fetchRTC(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/rtc', {}, options)
      if (data === null) return
      rtc.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      rtc.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Sync RTC to system time
   * POST /hardware/rtc/sync
   */
  async function syncRTC() {
    error.value = null
    try {
      const data = await api.post('/hardware/rtc/sync')
      await fetchRTC()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Set RTC wake alarm
   * POST /hardware/rtc/wake
   * @param {string} time - ISO 8601 datetime or seconds from now
   */
  async function setWakeAlarm(time) {
    error.value = null
    try {
      const data = await api.post('/hardware/rtc/wake', { time })
      await fetchRTC()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Clear RTC wake alarm
   * DELETE /hardware/rtc/wake
   */
  async function clearWakeAlarm() {
    error.value = null
    try {
      const data = await api.delete('/hardware/rtc/wake')
      await fetchRTC()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Watchdog
  // ==========================================

  /**
   * Fetch watchdog status
   * GET /hardware/watchdog
   */
  async function fetchWatchdog(options = {}) {
    loading.value = true
    error.value = null
    try {
      const data = await api.get('/hardware/watchdog', {}, options)
      if (data === null) return
      watchdog.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      error.value = e.message
      watchdog.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Enable/configure watchdog
   * POST /hardware/watchdog/enable
   * @param {object} config - { enabled: boolean, timeout: number (seconds, max 15 on Pi) }
   */
  async function enableWatchdog(config) {
    error.value = null
    try {
      const data = await api.post('/hardware/watchdog/enable', config)
      await fetchWatchdog()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Pet the watchdog (debug/manual)
   * POST /hardware/watchdog/pet
   */
  async function petWatchdog() {
    error.value = null
    try {
      const data = await api.post('/hardware/watchdog/pet')
      await fetchWatchdog()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // HAL Services
  // ==========================================

  /**
   * Fetch HAL service status
   * GET /hardware/services/{name}
   * @param {string} name - HAL service name
   */
  async function fetchHALService(name) {
    error.value = null
    try {
      const data = await api.get(`/hardware/services/${encodeURIComponent(name)}`)
      halServices.value = { ...halServices.value, [name]: data }
      return data
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Start HAL service
   * POST /hardware/services/{name}/start
   * @param {string} name - HAL service name
   */
  async function startHALService(name) {
    error.value = null
    try {
      const data = await api.post(`/hardware/services/${encodeURIComponent(name)}/start`)
      await fetchHALService(name)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Stop HAL service
   * POST /hardware/services/{name}/stop
   * @param {string} name - HAL service name
   */
  async function stopHALService(name) {
    error.value = null
    try {
      const data = await api.post(`/hardware/services/${encodeURIComponent(name)}/stop`)
      await fetchHALService(name)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Restart HAL service
   * POST /hardware/services/{name}/restart
   * @param {string} name - HAL service name
   */
  async function restartHALService(name) {
    error.value = null
    try {
      const data = await api.post(`/hardware/services/${encodeURIComponent(name)}/restart`)
      await fetchHALService(name)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Export
  // ==========================================

  return {
    // State
    overview,
    power,
    throttle,
    uptime,
    bootConfig,
    ups,
    powerStatus,
    gpioPins,
    i2cBuses,
    sensors,
    bme280,
    oneWireDevices,
    rtc,
    watchdog,
    halServices,
    loading,
    error,

    // Overview / Power / Boot
    fetchOverview,
    fetchPower,
    fetchThrottle,
    fetchUptime,
    fetchBootConfig,
    fetchUPS,
    batteryQuickStart,
    setCharging,
    fetchPowerStatus,
    setChargingState,

    // GPIO
    fetchGPIO,
    fetchGPIOPin,
    setGPIOPin,
    setGPIOMode,

    // I2C
    fetchI2CBuses,
    scanI2CBus,
    readI2CDevice,

    // Sensors
    fetchSensors,
    fetchBME280,
    fetch1Wire,
    read1Wire,

    // RTC
    fetchRTC,
    syncRTC,
    setWakeAlarm,
    clearWakeAlarm,

    // Watchdog
    fetchWatchdog,
    enableWatchdog,
    petWatchdog,

    // HAL Services
    fetchHALService,
    startHALService,
    stopHALService,
    restartHALService
  }
})
