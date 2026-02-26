/**
 * Demo API Client for CubeOS.
 *
 * Drop-in replacement for ApiClient that returns mock data.
 * Activated only when built with VITE_DEMO_MODE=true.
 *
 * - All reads return realistic mock data matched by endpoint
 * - All writes return { success: true } and dispatch a demo toast
 * - Stats fluctuate slightly on each request for a "live" feel
 * - Simulates 100-300ms network latency
 */

import * as data from './demo-data.js'

export class DemoApiClient {
  constructor() {
    this.accessToken = 'demo-token'
    this.refreshToken = 'demo-refresh-token'
    this._refreshPromise = null
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _delay() {
    return new Promise(r => setTimeout(r, 100 + Math.random() * 200))
  }

  _fluctuate(base, range, min = 0, max = Infinity) {
    const delta = (Math.random() - 0.5) * range * 2
    return Math.max(min, Math.min(max, +(base + delta).toFixed(2)))
  }

  _clone(obj) {
    if (obj === null || obj === undefined) return obj
    return JSON.parse(JSON.stringify(obj))
  }

  _demoToast(message) {
    window.dispatchEvent(new CustomEvent('cubeos:demo-toast', {
      detail: { message: message || 'This action is disabled in demo mode' }
    }))
  }

  _fluctuatedStats() {
    const f = this._fluctuate.bind(this)
    return {
      ...data.systemStats,
      cpu_percent: f(12.5, 8, 0, 100),
      memory_percent: f(25.0, 3, 0, 100),
      memory_used: Math.round(f(2147483648, 200000000, 0, 8589934592)),
      temperature_cpu: f(48.5, 3, 30, 85),
      load_1: f(0.45, 0.2, 0, 4),
      load_5: f(0.38, 0.15, 0, 4),
      load_15: f(0.32, 0.1, 0, 4),
      swap_used: Math.round(f(67108864, 10000000, 0, 536870912)),
      swap_percent: f(12.5, 3, 0, 100)
    }
  }

  // ── Auth methods ─────────────────────────────────────────────────

  async login() {
    await this._delay()
    return this._clone(data.authLogin)
  }

  async logout() { }

  async getMe() {
    await this._delay()
    return this._clone(data.authMe)
  }

  async refreshAccessToken() { return true }

  isAuthenticated() { return true }

  getHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer demo-token' }
  }

  setTokens() { }
  clearTokens() { }

  async changePassword() {
    this._demoToast('Password change is disabled in demo mode')
    throw new Error('Password change is disabled in demo mode')
  }

  // ── System methods ───────────────────────────────────────────────

  async getSystemInfo() {
    await this._delay()
    return this._clone(data.systemInfo)
  }

  async getSystemStats() {
    await this._delay()
    return this._fluctuatedStats()
  }

  async getSystemTemperature() {
    await this._delay()
    return { cpu_temp: this._fluctuate(48.5, 3, 30, 85), gpu_temp: this._fluctuate(47.0, 3, 30, 85) }
  }

  async reboot() {
    this._demoToast('Reboot is disabled in demo mode')
    throw new Error('Reboot is disabled in demo mode')
  }

  async shutdown() {
    this._demoToast('Shutdown is disabled in demo mode')
    throw new Error('Shutdown is disabled in demo mode')
  }

  // ── Internal error helper (mirrors ApiClient) ────────────────────

  _createApiError(message, status) {
    const err = new Error(message)
    err.status = status
    return err
  }

  // ── Request methods (unused in demo but required for interface) ──

  async request() { return new Response('{}', { status: 200 }) }
  async requestWithRetry() { return new Response('{}', { status: 200 }) }

  // ══════════════════════════════════════════════════════════════════
  // Generic REST: GET
  // ══════════════════════════════════════════════════════════════════

  async get(endpoint, params = {}, _options = {}) {
    await this._delay()
    const path = endpoint.split('?')[0]

    // ── System ────────────────────────────────────────────────────
    if (path === '/setup/status') return this._clone(data.setupStatus)
    if (path === '/system/info') return this._clone(data.systemInfo)
    if (path === '/system/stats') return this._fluctuatedStats()
    if (path === '/system/temperature') return this.getSystemTemperature()
    if (path === '/system/hostname') return this._clone(data.systemHostname)
    if (path === '/system/timezone') return this._clone(data.systemTimezone)
    if (path === '/system/timezones') return this._clone(data.systemTimezones)
    if (path === '/system/updates') return this._clone(data.updates)
    if (path === '/system/updates/history') return this._clone(data.updatesHistory)
    if (path === '/system/images') return this._clone(data.systemImages)
    if (path === '/system/browse') return this._clone(data.systemBrowse)

    // ── Auth ──────────────────────────────────────────────────────
    if (path === '/auth/me') return this._clone(data.authMe)

    // ── Apps ──────────────────────────────────────────────────────
    if (path === '/apps') {
      let list = this._clone(data.apps)
      if (params.type) list = list.filter(a => a.type === params.type)
      return list
    }
    if (path.match(/^\/apps\/([^/]+)\/logs$/)) {
      return { logs: this._clone(data.logJournal.slice(0, 10)) }
    }
    if (path.match(/^\/apps\/([^/]+)$/)) {
      const name = path.split('/')[2]
      return this._clone(data.apps.find(a => a.name === name)) || { error: 'Not found' }
    }

    // ── App Store ─────────────────────────────────────────────────
    if (path === '/appstore/stores') return this._clone(data.appstoreStores)
    if (path === '/appstore/apps') return this._clone(data.appstoreCatalog)
    if (path === '/appstore/categories') return this._clone(data.appstoreCategories)
    if (path === '/appstore/installed') return this._clone(data.appstoreInstalled)
    if (path === '/appstore/coreapps') return this._clone(data.coreApps)
    if (path === '/appstore/proxy-hosts') return this._clone(data.proxyHosts)
    if (path.match(/^\/appstore\/stores\/[^/]+$/)) return this._clone(data.appstoreStores[0])
    if (path.match(/^\/appstore\/stores\/[^/]+\/apps\/([^/]+)$/)) {
      const appName = path.split('/').pop()
      return this._clone(data.appstoreCatalog.find(a => a.name === appName)) || {}
    }
    if (path.match(/^\/appstore\/stores\/[^/]+\/apps\/[^/]+\/manifest$/)) return {}
    if (path.match(/^\/appstore\/stores\/[^/]+\/apps\/[^/]+\/volumes$/)) return []
    if (path.match(/^\/appstore\/installed\/([^/]+)$/)) {
      const appId = path.split('/').pop()
      return this._clone(data.appstoreInstalled.find(a => a.id === appId)) || {}
    }
    if (path.match(/^\/appstore\/installed\/[^/]+\/config$/)) return {}
    if (path.match(/^\/appstore\/installed\/[^/]+\/volumes$/)) return []
    if (path.match(/^\/appstore\/coreapps\/[^/]+\/config$/)) return {}

    // ── Ports ─────────────────────────────────────────────────────
    if (path === '/ports') return this._clone(data.ports)
    if (path === '/ports/stats') return this._clone(data.portStats)
    if (path === '/ports/reserved') return this._clone(data.portsReserved)
    if (path === '/ports/available') return this._clone(data.portsAvailable)

    // ── FQDNs ─────────────────────────────────────────────────────
    if (path === '/fqdns') return this._clone(data.fqdns)
    if (path.match(/^\/fqdns\/.+$/)) return this._clone(data.fqdns[0])

    // ── Profiles ──────────────────────────────────────────────────
    if (path === '/profiles') return this._clone(data.profiles)
    if (path.match(/^\/profiles\/.+$/)) return this._clone(data.profiles[0])

    // ── Network ───────────────────────────────────────────────────
    if (path === '/network/status') return this._clone(data.networkStatus)
    if (path === '/network/mode') return this._clone(data.networkMode)
    if (path === '/network/modes') return this._clone(data.networkModes)
    if (path === '/network/interfaces') return this._clone(data.networkInterfaces)
    if (path === '/network/interfaces/detailed') return this._clone(data.networkInterfaces)
    if (path === '/network/settings') return this._clone(data.networkSettings)
    if (path === '/network/dns') return this._clone(data.networkDns)
    if (path === '/network/connectivity') return this._clone(data.networkConnectivity)
    if (path === '/network/internet') return { connected: true }
    if (path === '/network/ap/config') return this._clone(data.networkApConfig)
    if (path === '/network/wifi/ap/status') return this._clone(data.networkApStatus)
    if (path === '/network/wifi/ap/clients') return this._clone(data.apClients)
    if (path === '/network/wifi/scan') return this._clone(data.wifiScan)
    if (path === '/network/wifi/saved') return this._clone(data.wifiSaved)
    if (path === '/network/wifi/status') return this._clone(data.wifiStatus)
    if (path === '/network/imager-wifi') return this._clone(data.imagerWifi)
    if (path === '/network/traffic') return this._clone(data.networkTraffic)
    if (path.match(/^\/network\/traffic\/.+\/history$/)) return { timestamps: [], values: [] }
    if (path === '/network/vpn/mode') return this._clone(data.networkVpnMode)

    // ── Clients ───────────────────────────────────────────────────
    if (path === '/clients') return this._clone(data.clients)
    if (path === '/clients/count') return this._clone(data.clientsCount)

    // ── Firewall ──────────────────────────────────────────────────
    if (path === '/firewall/status') return this._clone(data.firewallStatus)
    if (path === '/firewall/rules') return this._clone(data.firewallRules)
    if (path === '/firewall/nat') return this._clone(data.firewallNat)
    if (path === '/firewall/forwarding') return this._clone(data.firewallForwarding)
    if (path === '/firewall/ipforward') return this._clone(data.firewallIpForward)
    if (path === '/firewall/hal/status') return this._clone(data.firewallHalStatus)

    // ── VPN ───────────────────────────────────────────────────────
    if (path === '/vpn/status') return this._clone(data.vpnStatus)
    if (path === '/vpn/configs') return this._clone(data.vpnConfigs)
    if (path.match(/^\/vpn\/configs\/.+$/)) return this._clone(data.vpnConfigs[0])
    if (path === '/vpn/public-ip') return this._clone(data.vpnPublicIp)

    // ── Storage ───────────────────────────────────────────────────
    if (path === '/storage') return this._clone(data.storageOverview)
    if (path === '/storage/health') return this._clone(data.storageHealth)
    if (path.match(/^\/storage\/health\/.+$/)) return this._clone(data.storageHealth.devices[0])
    if (path === '/hal/storage/usage') return this._clone(data.halStorageUsage)
    if (path === '/hal/storage/devices') return this._clone(data.halStorageDevices)
    if (path.match(/^\/hal\/storage\/devices\/[^/]+$/)) return this._clone(data.halStorageDevices[0])
    if (path.match(/^\/hal\/storage\/devices\/[^/]+\/smart$/)) return { healthy: true }
    if (path === '/hal/storage/usb') return this._clone(data.halStorageUsb)
    if (path === '/hal/storage/usb/devices') return this._clone(data.halStorageUsbDevices)
    if (path === '/hal/storage/usb/tree') return this._clone(data.halStorageUsbTree)
    if (path.match(/^\/hal\/storage\/usb\/class\/.+$/)) return []
    if (path === '/hal/storage/network-mounts') return this._clone(data.halNetworkMounts)
    if (path === '/hal/storage/network-mounts/check') return { reachable: false }
    if (path === '/mounts') return this._clone(data.mounts)
    if (path.match(/^\/mounts\/[^/]+\/status$/)) return { status: 'mounted' }
    if (path.match(/^\/mounts\/[^/]+$/)) return this._clone(data.mounts[0])

    // ── SMB ───────────────────────────────────────────────────────
    if (path === '/smb/status') return this._clone(data.smbStatus)
    if (path === '/smb/shares') return this._clone(data.smbShares)
    if (path.match(/^\/smb\/shares\/.+$/)) return this._clone(data.smbShares[0])

    // ── Backups ───────────────────────────────────────────────────
    if (path === '/backups') return this._clone(data.backupsList)
    if (path === '/backups/stats') return this._clone(data.backupsStats)
    if (path === '/backups/destinations') return this._clone(data.backupsDestinations)
    if (path === '/backups/schedules') return this._clone(data.backupsSchedules)
    if (path === '/backups/restore-status') return this._clone(data.backupsRestoreStatus)
    if (path.match(/^\/backups\/[^/]+$/)) return this._clone(data.backupsList[0])
    if (path.match(/^\/backups\/[^/]+\/download$/)) return new Blob(['demo'])

    // ── Hardware ──────────────────────────────────────────────────
    if (path === '/hardware/overview') return this._clone(data.hardwareOverview)
    if (path === '/hardware/power') return this._clone(data.hardwarePower)
    if (path === '/hardware/throttle') return this._clone(data.hardwareThrottle)
    if (path === '/hardware/uptime') return this._clone(data.hardwareUptime)
    if (path === '/hardware/bootconfig') return this._clone(data.hardwareBootConfig)
    if (path === '/hardware/battery') return this._clone(data.hardwareBattery)
    if (path === '/hardware/eeprom') return this._clone(data.hardwareEeprom)
    if (path === '/hardware/temperature') return this._clone(data.hardwareTemperature)
    if (path === '/hardware/ups') return this._clone(data.hardwareUps)
    if (path === '/hardware/gpio') return this._clone(data.hardwareGpio)
    if (path.match(/^\/hardware\/gpio\/\d+$/)) return { pin: 1, mode: 'IN', value: 0 }
    if (path === '/hardware/i2c') return this._clone(data.hardwareI2c)
    if (path.match(/^\/hardware\/i2c\/\d+\/scan$/)) return { devices: [] }
    if (path.match(/^\/hardware\/i2c\/\d+\/.+$/)) return { data: [] }
    if (path === '/hardware/sensors') return this._clone(data.hardwareSensors)
    if (path === '/hardware/sensors/bme280') return this._clone(data.hardwareSensors.bme280)
    if (path === '/hardware/sensors/1wire') return this._clone(data.hardwareSensors['1wire'])
    if (path.match(/^\/hardware\/sensors\/1wire\/.+$/)) return {}
    if (path === '/hardware/rtc') return this._clone(data.hardwareRtc)
    if (path === '/hardware/watchdog') return this._clone(data.hardwareWatchdog)
    if (path === '/hardware/power/monitor') return this._clone(data.hardwarePowerMonitor)
    if (path === '/hardware/ups/detect') return { available: false }
    if (path === '/hardware/ups/config') return this._clone(data.hardwareUpsConfig)
    if (path === '/power/status') return this._clone(data.hardwarePowerStatus)
    if (path.match(/^\/hardware\/services\/.+$/)) {
      const svc = path.split('/').pop()
      return this._clone(data.hardwareServices[svc]) || { name: svc, status: 'unknown' }
    }

    // ── Communication ─────────────────────────────────────────────
    if (path === '/communication/bluetooth') return this._clone(data.bluetooth)
    if (path === '/communication/bluetooth/devices') return this._clone(data.bluetooth.devices)
    if (path === '/communication/cellular') return this._clone(data.cellular)
    if (path === '/communication/cellular/status') return this._clone(data.cellularStatus)
    if (path === '/communication/cellular/android') return this._clone(data.cellularAndroid)
    if (path.match(/^\/communication\/cellular\/[^/]+\/signal$/)) return { strength: 0 }
    if (path === '/communication/gps') return this._clone(data.gps)
    if (path.match(/^\/communication\/gps\/status/)) return this._clone(data.gpsStatus)
    if (path.match(/^\/communication\/gps\/.+\/position$/)) return {}
    if (path.match(/^\/communication\/gps\/position/)) return {}
    if (path === '/communication/meshtastic/devices') return this._clone(data.meshtasticDevices)
    if (path === '/communication/meshtastic/status') return this._clone(data.meshtasticStatus)
    if (path === '/communication/meshtastic/nodes') return this._clone(data.meshtasticNodes)
    if (path === '/communication/meshtastic/position') return {}
    if (path === '/communication/meshtastic/messages') return this._clone(data.meshtasticMessages)
    if (path === '/communication/meshtastic/config') return this._clone(data.meshtasticConfig)
    if (path === '/communication/meshtastic/events') return {}
    if (path === '/communication/iridium/devices') return this._clone(data.iridiumDevices)
    if (path === '/communication/iridium/status') return this._clone(data.iridiumStatus)
    if (path === '/communication/iridium/signal') return this._clone(data.iridiumSignal)
    if (path === '/communication/iridium/messages') return this._clone(data.iridiumMessages)
    if (path === '/communication/iridium/receive') return this._clone(data.iridiumMessages)
    if (path === '/communication/iridium/events') return {}

    // ── Media ─────────────────────────────────────────────────────
    if (path === '/media/audio') return this._clone(data.audioStatus)
    if (path === '/media/audio/playback') return this._clone(data.audioPlayback)
    if (path === '/media/audio/capture') return this._clone(data.audioCapture)
    if (path === '/media/audio/volume') return this._clone(data.audioVolume)
    if (path === '/media/cameras') return this._clone(data.cameras)
    if (path === '/media/cameras/info') return this._clone(data.cameraInfo)
    if (path === '/media/cameras/capture') return null
    if (path === '/media/cameras/stream') return null

    // ── Monitoring ────────────────────────────────────────────────
    if (path === '/monitoring/stats') return this._clone(data.monitoringStats)
    if (path === '/monitoring/history') return this._clone(data.monitoringHistory)
    if (path === '/monitoring/alerts') return this._clone(data.monitoringAlerts)
    if (path === '/monitoring/thresholds') return this._clone(data.monitoringThresholds)
    if (path === '/monitoring/websocket') return { url: '' }

    // ── Processes ─────────────────────────────────────────────────
    if (path === '/processes') return this._clone(data.processList)
    if (path === '/processes/stats/summary') return this._clone(data.processSummary)
    if (path === '/processes/top/cpu') return this._clone(data.processTopCpu)
    if (path === '/processes/top/memory') return this._clone(data.processTopMemory)
    if (path.match(/^\/processes\/search\/.+$/)) return []
    if (path.match(/^\/processes\/\d+$/)) return this._clone(data.processList[0])

    // ── Logs ──────────────────────────────────────────────────────
    if (path === '/logs/units') return this._clone(data.logUnits)
    if (path === '/logs/journal') return { entries: this._clone(data.logJournal) }
    if (path.match(/^\/logs\/service\/.+$/)) return this._clone(data.logJournal.slice(0, 10))
    if (path.match(/^\/logs\/container\/.+$/)) return this._clone(data.logJournal.slice(0, 10))
    if (path === '/logs/kernel') return this._clone(data.logKernel)
    if (path === '/logs/boot') return this._clone(data.logBoot)
    if (path === '/logs/errors') return this._clone(data.logErrors)
    if (path === '/logs/file') return []
    if (path === '/hal/logs/hardware') return this._clone(data.halLogs.hardware)
    if (path.match(/^\/hal\/logs\/hardware\/.+$/)) return this._clone(data.halLogs.hardware)
    if (path === '/hal/logs/journal') return this._clone(data.halLogs.journal)
    if (path === '/hal/logs/kernel') return this._clone(data.halLogs.kernel)

    // ── Registry ──────────────────────────────────────────────────
    if (path === '/registry/status') return this._clone(data.registryStatus)
    if (path === '/registry/images') return this._clone(data.registryImages)
    if (path === '/registry/disk-usage') return this._clone(data.registryDiskUsage)
    if (path === '/registry/check') return this._clone(data.registryCheck)
    if (path === '/registry/cached-apps') return this._clone(data.registryCachedApps)
    if (path === '/registry/settings') return this._clone(data.registrySettings)
    if (path === '/registry/sync/status') return this._clone(data.registrySyncStatus)
    if (path.match(/^\/registry\/images\/.+\/tags$/)) return { tags: ['latest'] }

    // ── NPM ───────────────────────────────────────────────────────
    if (path === '/npm/status') return this._clone(data.npmStatus)
    if (path === '/npm/hosts') return this._clone(data.npmHosts)

    // ── Favorites ─────────────────────────────────────────────────
    if (path === '/favorites') return this._clone(data.favorites)

    // ── Preferences ───────────────────────────────────────────────
    if (path === '/preferences') return this._clone(data.preferences)

    // ── Wizard ────────────────────────────────────────────────────
    if (path === '/wizard/profiles') return this._clone(data.wizardProfiles)
    if (path === '/wizard/services') return this._clone(data.wizardServices)
    if (path === '/wizard/recommendations') return this._clone(data.wizardRecommendations)

    // ── CasaOS ────────────────────────────────────────────────────
    if (path === '/casaos/stores') return this._clone(data.casaosStores)

    // ── Fallback ──────────────────────────────────────────────────
    return {}
  }

  // ══════════════════════════════════════════════════════════════════
  // Generic REST: POST / PUT / DELETE
  // ══════════════════════════════════════════════════════════════════

  async post(endpoint, _data = {}, _options = {}) {
    await this._delay()
    const path = endpoint.split('?')[0]

    // Auth
    if (path === '/auth/login') return this._clone(data.authLogin)
    if (path === '/auth/logout') return { success: true }
    if (path === '/auth/refresh') return { access_token: 'demo-token', refresh_token: 'demo-refresh-token' }
    if (path === '/auth/password') {
      this._demoToast('Password change is disabled in demo mode')
      throw new Error('Password change is disabled in demo mode')
    }

    // Dangerous actions
    if (path === '/system/reboot') {
      this._demoToast('Reboot is disabled in demo mode')
      throw new Error('Reboot is disabled in demo mode')
    }
    if (path === '/system/shutdown') {
      this._demoToast('Shutdown is disabled in demo mode')
      throw new Error('Shutdown is disabled in demo mode')
    }

    // Wizard
    if (path === '/wizard/apply') return { success: true }
    if (path === '/wizard/estimate') return { cpu: 15, memory_mb: 2048, disk_mb: 4096 }

    // Setup
    if (path === '/setup/complete') return { success: true }
    if (path === '/setup/reset') {
      this._demoToast('Setup reset is disabled in demo mode')
      throw new Error('Setup reset is disabled in demo mode')
    }

    // All other writes: toast + success
    this._demoToast()
    return { success: true }
  }

  async put(endpoint, _data = {}, _options = {}) {
    await this._delay()
    this._demoToast()
    return { success: true }
  }

  async delete(endpoint, _data = null, _options = {}) {
    await this._delay()
    this._demoToast()
    return { success: true }
  }
}

// Singleton instance
export const api = new DemoApiClient()
export default api
