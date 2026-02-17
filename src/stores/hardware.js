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
 *   GET    /hardware/power/monitor         - Power monitor status (running, ups_model)
 *   POST   /hardware/power/monitor/start   - Start power monitoring (NUT/UPS)
 *   POST   /hardware/power/monitor/stop    - Stop power monitoring
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
  const powerMonitor = ref(null)
  const halServices = ref({})
  const temperatureZones = ref(null)
  // UPS user-confirmed selection (Batch 3)
  const upsConfig = ref(null)       // { configured, configured_model, monitor_running }
  const upsDetection = ref(null)    // { suggested_model, suggested_name, pi_model, ... }
  const upsConfiguring = ref(false) // true while POST /hardware/ups/config in flight

  const loading = ref(false)
  const error = ref(null)

  // B40: Helper — 501 (not supported) and 503 (HAL unavailable) are expected
  // for absent hardware and should not show error banners.
  function isExpectedHardwareError(e) {
    return e?.status === 501 || e?.status === 503
  }

  // B47: Absent-device TTL cache — skip re-polling endpoints that returned
  // 501 (hardware not available) for 60 seconds. Prevents unnecessary network
  // round-trips on every tab switch / auto-refresh cycle.
  const ABSENT_TTL_MS = 60_000
  const _absentCache = new Map() // key (endpoint) → timestamp

  function isAbsent(key) {
    const ts = _absentCache.get(key)
    if (!ts) return false
    if (Date.now() - ts < ABSENT_TTL_MS) return true
    _absentCache.delete(key) // expired
    return false
  }

  function markAbsent(key) {
    _absentCache.set(key, Date.now())
  }

  function clearAbsent(key) {
    _absentCache.delete(key)
  }

  // ==========================================
  // Overview / Power / Boot
  // ==========================================

  /**
   * Fetch hardware overview summary
   * GET /hardware/overview
   */
  async function fetchOverview(options = {}) {
    const { skipLoading, ...opts } = options
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/overview', {}, opts)
      if (data === null) return
      overview.value = data
    } catch (e) {
      if (e.name === 'AbortError' || isExpectedHardwareError(e)) return
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch power supply status
   * GET /hardware/power
   */
  async function fetchPower(options = {}) {
    if (isAbsent('hw:power')) return
    try {
      const data = await api.get('/hardware/power', {}, options)
      if (data === null) return
      power.value = data
      clearAbsent('hw:power')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:power'); return }
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
      if (e.name === 'AbortError' || isExpectedHardwareError(e)) return
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
      if (e.name === 'AbortError' || isExpectedHardwareError(e)) return
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
      if (e.name === 'AbortError' || isExpectedHardwareError(e)) return
      bootConfig.value = null
    }
  }

  /**
   * Fetch UPS module status
   * GET /hardware/ups
   */
  async function fetchUPS(options = {}) {
    if (isAbsent('hw:ups')) return
    try {
      const data = await api.get('/hardware/ups', {}, options)
      if (data === null) return
      ups.value = data
      clearAbsent('hw:ups')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:ups'); return }
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
    if (isAbsent('hw:power-status')) return
    try {
      const data = await api.get('/power/status', {}, options)
      if (data === null) return
      powerStatus.value = data
      clearAbsent('hw:power-status')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:power-status'); return }
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
    const { skipLoading, ...opts } = options
    if (isAbsent('hw:gpio')) return
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/gpio', {}, opts)
      if (data === null) return
      gpioPins.value = data
      clearAbsent('hw:gpio')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:gpio'); return }
      // B11: Log but don't block — GPIO may not be available on all hardware
      console.warn('GPIO fetch failed:', e.message)
      gpioPins.value = { pins: [], error: e.message }
    } finally {
      if (!skipLoading) loading.value = false
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
  async function setGPIOPin(pin, value, options = {}) {
    error.value = null
    try {
      const data = await api.post(`/hardware/gpio/${encodeURIComponent(pin)}`, { value }, options)
      if (data === null) return null
      await fetchGPIO()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
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
    const { skipLoading, ...opts } = options
    if (isAbsent('hw:i2c')) return
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/i2c', {}, opts)
      if (data === null) return
      i2cBuses.value = data
      clearAbsent('hw:i2c')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:i2c'); return }
      error.value = e.message
      i2cBuses.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Scan I2C bus for connected devices
   * GET /hardware/i2c/{bus}/scan
   * @param {number|string} bus - I2C bus number (e.g. 1)
   */
  async function scanI2CBus(bus, options = {}) {
    error.value = null
    try {
      const data = await api.get(`/hardware/i2c/${encodeURIComponent(bus)}/scan`, {}, options)
      if (data === null) return null
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
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
      throw e
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
    const { skipLoading, ...opts } = options
    if (isAbsent('hw:sensors')) return
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/sensors', {}, opts)
      if (data === null) return
      sensors.value = data
      clearAbsent('hw:sensors')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:sensors'); return }
      error.value = e.message
      sensors.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch BME280 temperature/humidity/pressure
   * GET /hardware/sensors/bme280
   */
  async function fetchBME280(options = {}) {
    if (isAbsent('hw:bme280')) return
    try {
      const data = await api.get('/hardware/sensors/bme280', {}, options)
      if (data === null) return
      bme280.value = data
      clearAbsent('hw:bme280')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:bme280'); return }
      bme280.value = null
    }
  }

  /**
   * Fetch 1-Wire device list
   * GET /hardware/sensors/1wire
   */
  async function fetch1Wire(options = {}) {
    if (isAbsent('hw:1wire')) return
    try {
      const data = await api.get('/hardware/sensors/1wire', {}, options)
      if (data === null) return
      oneWireDevices.value = data
      clearAbsent('hw:1wire')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:1wire'); return }
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
      throw e
    }
  }

  // ==========================================
  // Temperature Zones
  // ==========================================

  /**
   * Fetch per-zone CPU/GPU temperature breakdown
   * GET /hardware/temperature
   * Returns: { zones: [{ name, type, temp_c, critical_c }] }
   */
  async function fetchTemperatureZones(options = {}) {
    const { skipLoading, ...opts } = options
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/temperature', {}, opts)
      if (data === null) return
      temperatureZones.value = data.zones || data
    } catch (e) {
      if (e.name === 'AbortError' || isExpectedHardwareError(e)) return
      // B11: Don't set global error — temperature zones is supplementary data.
      // Failing here shouldn't block the overview tab from rendering.
      console.warn('Temperature zones fetch failed:', e.message)
      temperatureZones.value = null
    } finally {
      if (!skipLoading) loading.value = false
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
    const { skipLoading, ...opts } = options
    if (isAbsent('hw:rtc')) return
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/rtc', {}, opts)
      if (data === null) return
      rtc.value = data
      clearAbsent('hw:rtc')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:rtc'); return }
      error.value = e.message
      rtc.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Sync RTC to system time
   * POST /hardware/rtc/sync
   */
  async function syncRTC(options = {}) {
    error.value = null
    try {
      const data = await api.post('/hardware/rtc/sync', {}, options)
      if (data === null) return null
      await fetchRTC()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
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
    const { skipLoading, ...opts } = options
    if (isAbsent('hw:watchdog')) return
    if (!skipLoading) { loading.value = true; error.value = null }
    try {
      const data = await api.get('/hardware/watchdog', {}, opts)
      if (data === null) return
      watchdog.value = data
      clearAbsent('hw:watchdog')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:watchdog'); return }
      error.value = e.message
      watchdog.value = null
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Enable/configure watchdog
   * POST /hardware/watchdog/enable
   * @param {object} config - { enabled: boolean, timeout: number (seconds, max 15 on Pi) }
   */
  async function enableWatchdog(config, options = {}) {
    error.value = null
    try {
      const data = await api.post('/hardware/watchdog/enable', config, options)
      if (data === null) return null
      await fetchWatchdog()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
    }
  }

  /**
   * Pet the watchdog (debug/manual)
   * POST /hardware/watchdog/pet
   */
  async function petWatchdog(options = {}) {
    error.value = null
    try {
      const data = await api.post('/hardware/watchdog/pet', {}, options)
      if (data === null) return null
      await fetchWatchdog()
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // Power Monitor
  // ==========================================

  /**
   * Fetch power monitor status
   * GET /hardware/power/monitor
   * Returns: { running, ups_model, battery_percent?, charging?, ac_power? }
   */
  async function fetchPowerMonitorStatus(options = {}) {
    if (isAbsent('hw:power-monitor')) return
    try {
      const data = await api.get('/hardware/power/monitor', {}, options)
      if (data === null) return
      powerMonitor.value = data
      clearAbsent('hw:power-monitor')
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) { markAbsent('hw:power-monitor'); return }
      powerMonitor.value = null
    }
  }

  /**
   * Start power monitoring (NUT / UPS daemon)
   * POST /hardware/power/monitor/start
   */
  async function startPowerMonitor() {
    error.value = null
    try {
      const data = await api.post('/hardware/power/monitor/start')
      await fetchPowerMonitorStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  /**
   * Stop power monitoring
   * POST /hardware/power/monitor/stop
   */
  async function stopPowerMonitor() {
    error.value = null
    try {
      const data = await api.post('/hardware/power/monitor/stop')
      await fetchPowerMonitorStatus()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  // ==========================================
  // UPS Configuration (Batch 3)
  // ==========================================

  /**
   * Detect UPS HAT via I2C probe (read-only, no side effects)
   * GET /hardware/ups/detect
   * Returns: { suggested_model, suggested_name, pi_model, gpio_chip,
   *            i2c_devices_found, confidence, warning, details }
   */
  async function detectUPSHAT(options = {}) {
    error.value = null
    try {
      const data = await api.get('/hardware/ups/detect', {}, options)
      if (data === null) return null
      upsDetection.value = data
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
      if (isExpectedHardwareError(e)) {
        upsDetection.value = null
        return null
      }
      error.value = e.message
      throw e
    }
  }

  /**
   * Fetch current UPS configuration from DB + HAL status
   * GET /hardware/ups/config
   * Returns: { configured, configured_model, monitor_running }
   */
  async function fetchUPSConfig(options = {}) {
    try {
      const data = await api.get('/hardware/ups/config', {}, options)
      if (data === null) return
      upsConfig.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
      if (isExpectedHardwareError(e)) return
      // Non-fatal: UPS config endpoint may not exist on older API
      console.warn('UPS config fetch failed:', e.message)
      upsConfig.value = null
    }
  }

  /**
   * Save UPS model selection and activate driver via HAL
   * POST /hardware/ups/config
   * @param {string} model - 'x1202', 'x728', 'pisugar3', or 'none'
   * Returns: { status, model, driver }
   */
  async function setUPSConfig(model) {
    error.value = null
    upsConfiguring.value = true
    try {
      const data = await api.post('/hardware/ups/config', { model })
      if (data === null) return null
      // Refresh config state after successful save
      await fetchUPSConfig()
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      upsConfiguring.value = false
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
  async function fetchHALService(name, options = {}) {
    error.value = null
    try {
      const data = await api.get(`/hardware/services/${encodeURIComponent(name)}`, {}, options)
      if (data === null) return null
      halServices.value = { ...halServices.value, [name]: data }
      return data
    } catch (e) {
      if (e.name === 'AbortError') return null
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
    powerMonitor,
    halServices,
    temperatureZones,
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
    fetchTemperatureZones,

    // RTC
    fetchRTC,
    syncRTC,
    setWakeAlarm,
    clearWakeAlarm,

    // Watchdog
    fetchWatchdog,
    enableWatchdog,
    petWatchdog,

    // Power Monitor
    fetchPowerMonitorStatus,
    startPowerMonitor,
    stopPowerMonitor,

    // UPS Configuration
    upsConfig,
    upsDetection,
    upsConfiguring,
    detectUPSHAT,
    fetchUPSConfig,
    setUPSConfig,

    // HAL Services
    fetchHALService,
    startHALService,
    stopHALService,
    restartHALService
  }
})
