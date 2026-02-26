/**
 * Mock data for CubeOS demo mode.
 *
 * Covers all API endpoints called by Pinia stores. Organized by domain.
 * Only activated when built with VITE_DEMO_MODE=true.
 */

import { casaosAppsSnapshot, casaosCategories } from './casaos-apps-snapshot.js'

// ── Helpers ─────────────────────────────────────────────────────────
const now = new Date().toISOString()
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString()

// ═══════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════

export const authMe = { username: 'admin', role: 'admin' }

export const authLogin = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh-token',
  user: { username: 'admin', role: 'admin' }
}

// ═══════════════════════════════════════════════════════════════════
// Setup
// ═══════════════════════════════════════════════════════════════════

export const setupStatus = { is_complete: true }

// ═══════════════════════════════════════════════════════════════════
// System
// ═══════════════════════════════════════════════════════════════════

export const systemInfo = {
  hostname: 'cubeos-demo',
  version: '0.2.0-beta.01',
  cubeos_version: '0.2.0-beta.01',
  platform: 'aarch64',
  arch: 'aarch64',
  os: 'Ubuntu 24.04.3 LTS',
  kernel: '6.8.0-1004-raspi',
  uptime: 432000,
  uptime_seconds: 432000,
  uptime_human: '5 days',
  tier: 'full',
  pi_model: 'Raspberry Pi 5 Model B Rev 1.0',
  pi_serial: 'DEMO00000000',
  pi_revision: 'c04170',
  default_credentials: false,
  ip_addresses: ['10.42.24.1', '192.168.1.42'],
  docker_version: '27.1.1',
  go_version: 'go1.24.0',
  build_date: '2026-02-20T08:00:00Z'
}

export const systemStats = {
  cpu_percent: 12.5,
  cpu_count: 4,
  memory_total: 8589934592,
  memory_used: 2147483648,
  memory_available: 6442450944,
  memory_percent: 25.0,
  disk_total: 64424509440,
  disk_used: 16106127360,
  disk_available: 48318382080,
  disk_percent: 25.0,
  load_1: 0.45,
  load_5: 0.38,
  load_15: 0.32,
  temperature_cpu: 48.5,
  swap_total: 536870912,
  swap_used: 67108864,
  swap_percent: 12.5,
  network_rx: 1048576,
  network_tx: 524288
}

export const systemTemperature = {
  cpu_temp: 48.5,
  gpu_temp: 47.0
}

export const systemHostname = { hostname: 'cubeos-demo' }

export const systemTimezone = { timezone: 'Europe/Amsterdam' }

export const systemTimezones = {
  timezones: [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
    'Pacific/Auckland', 'UTC'
  ]
}

// ═══════════════════════════════════════════════════════════════════
// Installed Apps (/apps)
// ═══════════════════════════════════════════════════════════════════

export const apps = [
  {
    name: 'cubeos-pihole',
    display_name: 'Pi-hole',
    description: 'Network-wide ad blocking via DNS',
    type: 'system',
    status: 'running',
    image: 'pihole/pihole:2024.07.0',
    version: '2024.07.0',
    port: 6001,
    ports: { '6001': '80', '53': '53' },
    created_at: daysAgo(90),
    updated_at: daysAgo(5),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: 'http://10.42.24.1:6001/admin',
    source: 'system'
  },
  {
    name: 'cubeos-npm',
    display_name: 'Nginx Proxy Manager',
    description: 'Reverse proxy with SSL management',
    type: 'system',
    status: 'running',
    image: 'jc21/nginx-proxy-manager:2.11.3',
    version: '2.11.3',
    port: 6000,
    ports: { '6000': '81', '80': '80', '443': '443' },
    created_at: daysAgo(90),
    updated_at: daysAgo(3),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: false,
    webui_url: 'http://10.42.24.1:6000',
    source: 'system'
  },
  {
    name: 'cubeos-registry',
    display_name: 'Docker Registry',
    description: 'Local container image registry',
    type: 'system',
    status: 'running',
    image: 'registry:2',
    version: '2.8.3',
    port: 5000,
    ports: { '5000': '5000' },
    created_at: daysAgo(90),
    updated_at: daysAgo(10),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: false,
    source: 'system'
  },
  {
    name: 'cubeos-dufs',
    display_name: 'File Server',
    description: 'Web-based file manager (Dufs)',
    type: 'platform',
    status: 'running',
    image: 'sigoden/dufs:latest',
    version: '0.41.0',
    port: 6013,
    ports: { '6013': '5000' },
    created_at: daysAgo(60),
    updated_at: daysAgo(7),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: 'http://10.42.24.1:6013',
    source: 'platform'
  },
  {
    name: 'ollama',
    display_name: 'Ollama',
    description: 'Run large language models locally',
    type: 'user',
    status: 'running',
    image: 'ollama/ollama:latest',
    version: '0.5.4',
    port: 6030,
    ports: { '6030': '11434' },
    created_at: daysAgo(30),
    updated_at: daysAgo(2),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: null,
    source: 'appstore'
  },
  {
    name: 'dozzle',
    display_name: 'Dozzle',
    description: 'Real-time Docker container log viewer',
    type: 'user',
    status: 'running',
    image: 'amir20/dozzle:latest',
    version: '8.8.2',
    port: 6100,
    ports: { '6100': '8080' },
    created_at: daysAgo(45),
    updated_at: daysAgo(1),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: 'http://10.42.24.1:6100',
    source: 'appstore'
  },
  {
    name: 'kiwix-serve',
    display_name: 'Kiwix',
    description: 'Offline Wikipedia and educational content',
    type: 'user',
    status: 'running',
    image: 'ghcr.io/kiwix/kiwix-serve:3.7.0',
    version: '3.7.0',
    port: 6101,
    ports: { '6101': '8080' },
    created_at: daysAgo(20),
    updated_at: daysAgo(3),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: 'http://10.42.24.1:6101',
    source: 'appstore'
  },
  {
    name: 'vaultwarden',
    display_name: 'Vaultwarden',
    description: 'Lightweight Bitwarden-compatible password manager',
    type: 'user',
    status: 'running',
    image: 'vaultwarden/server:latest',
    version: '1.32.5',
    port: 6102,
    ports: { '6102': '80' },
    created_at: daysAgo(15),
    updated_at: daysAgo(4),
    health: 'healthy',
    auto_start: true,
    enabled: true,
    homepage: true,
    webui_url: 'http://10.42.24.1:6102',
    source: 'appstore'
  }
]

// ═══════════════════════════════════════════════════════════════════
// App Store
// ═══════════════════════════════════════════════════════════════════

export const appstoreStores = [
  {
    id: 'default',
    name: 'CubeOS Official',
    url: 'https://store.cubeos.app',
    enabled: true,
    last_sync: daysAgo(1),
    app_count: casaosAppsSnapshot.length
  }
]

export const appstoreCategories = casaosCategories

// Names of apps that should appear as "installed" in the demo browse tab.
// Must match entries in appstoreInstalled below that also exist in the snapshot.
const _installedNames = new Set(['ollama', 'dozzle', 'vaultwarden'])

export const appstoreCatalog = casaosAppsSnapshot.map(app => ({
  ...app,
  store_id: 'default',
  installed: _installedNames.has(app.name),
}))

export const appstoreInstalled = [
  {
    id: 'ollama',
    app_name: 'ollama',
    store_id: 'default',
    display_name: 'Ollama',
    status: 'running',
    version: '0.5.4',
    port: 6030,
    installed_at: daysAgo(30),
    config: {},
    webui_type: 'none'
  },
  {
    id: 'dozzle',
    app_name: 'dozzle',
    store_id: 'default',
    display_name: 'Dozzle',
    status: 'running',
    version: '8.8.2',
    port: 6100,
    installed_at: daysAgo(45),
    config: {},
    webui_type: 'iframe'
  },
  {
    id: 'kiwix-serve',
    app_name: 'kiwix-serve',
    store_id: 'default',
    display_name: 'Kiwix',
    status: 'running',
    version: '3.7.0',
    port: 6101,
    installed_at: daysAgo(20),
    config: {},
    webui_type: 'iframe'
  },
  {
    id: 'vaultwarden',
    app_name: 'vaultwarden',
    store_id: 'default',
    display_name: 'Vaultwarden',
    status: 'running',
    version: '1.32.5',
    port: 6102,
    installed_at: daysAgo(15),
    config: {},
    webui_type: 'redirect'
  }
]

export const coreApps = [
  {
    id: 'cubeos-pihole',
    name: 'cubeos-pihole',
    display_name: 'Pi-hole',
    status: 'running',
    version: '2024.07.0',
    port: 6001,
    configurable: true
  },
  {
    id: 'cubeos-npm',
    name: 'cubeos-npm',
    display_name: 'Nginx Proxy Manager',
    status: 'running',
    version: '2.11.3',
    port: 6000,
    configurable: true
  },
  {
    id: 'cubeos-registry',
    name: 'cubeos-registry',
    display_name: 'Docker Registry',
    status: 'running',
    version: '2.8.3',
    port: 5000,
    configurable: false
  }
]

export const proxyHosts = [
  { id: 1, domain: 'pihole.cubeos.cube', forward_host: '10.42.24.1', forward_port: 6001, ssl: false },
  { id: 2, domain: 'files.cubeos.cube', forward_host: '10.42.24.1', forward_port: 6013, ssl: false },
  { id: 3, domain: 'dozzle.cubeos.cube', forward_host: '10.42.24.1', forward_port: 6100, ssl: false }
]

// ═══════════════════════════════════════════════════════════════════
// Network
// ═══════════════════════════════════════════════════════════════════

export const networkStatus = {
  mode: 'online_eth',
  ap_interface: 'wlan0',
  uplink_interface: 'eth0',
  ap_ssid: 'CubeOS-A1B2',
  ip_address: '10.42.24.1',
  subnet: '10.42.24.0/24',
  gateway: '192.168.1.1',
  dns: '10.42.24.1',
  internet: true,
  ap_running: true
}

export const networkMode = { mode: 'online_eth' }

export const networkModes = {
  modes: [
    { id: 'offline', name: 'Offline (AP Only)', description: 'Access point only, no internet' },
    { id: 'online_eth', name: 'Online (Ethernet)', description: 'Internet via Ethernet + AP' },
    { id: 'online_wifi', name: 'Online (WiFi)', description: 'Internet via WiFi + AP on secondary adapter' }
  ]
}

export const networkInterfaces = [
  { name: 'eth0', type: 'ethernet', state: 'up', ip: '192.168.1.42', mac: 'DC:A6:32:AA:BB:CC', speed: '1000Mbps' },
  { name: 'wlan0', type: 'wifi', state: 'up', ip: '10.42.24.1', mac: 'DC:A6:32:AA:BB:DD', ssid: 'CubeOS-A1B2' },
  { name: 'docker0', type: 'bridge', state: 'up', ip: '172.17.0.1', mac: '02:42:AA:BB:CC:DD' }
]

export const networkSettings = {
  ap_ssid: 'CubeOS-A1B2',
  ap_channel: 6,
  ap_band: '2.4GHz',
  domain: 'cubeos.cube',
  gateway_ip: '10.42.24.1'
}

export const networkApConfig = {
  ssid: 'CubeOS-A1B2',
  channel: 6,
  band: '2.4GHz',
  hidden: false,
  max_clients: 20
}

export const networkApStatus = {
  running: true,
  ssid: 'CubeOS-A1B2',
  channel: 6,
  clients: 3
}

export const networkDns = {
  primary: '10.42.24.1',
  secondary: '1.1.1.1',
  domain: 'cubeos.cube',
  hosts: [
    { hostname: 'pihole.cubeos.cube', ip: '10.42.24.1' },
    { hostname: 'files.cubeos.cube', ip: '10.42.24.1' },
    { hostname: 'dozzle.cubeos.cube', ip: '10.42.24.1' }
  ]
}

export const networkConnectivity = { connected: true, latency_ms: 12 }

export const networkTraffic = {
  interfaces: {
    eth0: { rx_bytes: 1073741824, tx_bytes: 536870912, rx_rate: 125000, tx_rate: 62500 },
    wlan0: { rx_bytes: 268435456, tx_bytes: 134217728, rx_rate: 31250, tx_rate: 15625 }
  }
}

export const networkVpnMode = { mode: 'disabled' }

export const wifiScan = []
export const wifiSaved = []
export const wifiStatus = { connected: false }
export const imagerWifi = { ssid: '', configured: false }

// ═══════════════════════════════════════════════════════════════════
// Clients
// ═══════════════════════════════════════════════════════════════════

export const clients = [
  { hostname: 'iphone-demo', ip: '10.42.24.11', mac: 'AA:BB:CC:DD:EE:01', vendor: 'Apple', connected: true, first_seen: daysAgo(14), last_seen: hoursAgo(1), blocked: false },
  { hostname: 'laptop-demo', ip: '10.42.24.12', mac: 'AA:BB:CC:DD:EE:02', vendor: 'Dell', connected: true, first_seen: daysAgo(30), last_seen: hoursAgo(0), blocked: false },
  { hostname: 'android-demo', ip: '10.42.24.13', mac: 'AA:BB:CC:DD:EE:03', vendor: 'Samsung', connected: true, first_seen: daysAgo(7), last_seen: hoursAgo(2), blocked: false }
]

export const clientsCount = { total: 3, connected: 3, blocked: 0 }

export const apClients = {
  clients: [
    { mac: 'AA:BB:CC:DD:EE:01', ip: '10.42.24.11', hostname: 'iphone-demo' },
    { mac: 'AA:BB:CC:DD:EE:02', ip: '10.42.24.12', hostname: 'laptop-demo' },
    { mac: 'AA:BB:CC:DD:EE:03', ip: '10.42.24.13', hostname: 'android-demo' }
  ]
}

// ═══════════════════════════════════════════════════════════════════
// Firewall
// ═══════════════════════════════════════════════════════════════════

export const firewallStatus = { enabled: true, default_policy: 'deny', active_rules: 8 }

export const firewallRules = [
  { id: 1, action: 'ACCEPT', protocol: 'tcp', port: 22, source: 'any', description: 'SSH' },
  { id: 2, action: 'ACCEPT', protocol: 'tcp', port: 80, source: 'any', description: 'HTTP' },
  { id: 3, action: 'ACCEPT', protocol: 'tcp', port: 443, source: 'any', description: 'HTTPS' },
  { id: 4, action: 'ACCEPT', protocol: 'udp', port: 53, source: '10.42.24.0/24', description: 'DNS' },
  { id: 5, action: 'ACCEPT', protocol: 'udp', port: 67, source: 'any', description: 'DHCP' },
  { id: 6, action: 'ACCEPT', protocol: 'tcp', port: '6000:6999', source: '10.42.24.0/24', description: 'CubeOS Services' }
]

export const firewallNat = { enabled: true }
export const firewallForwarding = { enabled: true }
export const firewallIpForward = { enabled: true, value: 1 }
export const firewallHalStatus = { available: true, running: true }

// ═══════════════════════════════════════════════════════════════════
// VPN
// ═══════════════════════════════════════════════════════════════════

export const vpnStatus = { connected: false, active_config: null }

export const vpnConfigs = [
  {
    name: 'home-vpn',
    type: 'wireguard',
    status: 'disconnected',
    auto_connect: false,
    created_at: daysAgo(20)
  }
]

export const vpnPublicIp = { ip: '203.0.113.42', country: 'Netherlands', city: 'Amsterdam' }

// ═══════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════

export const storageOverview = {
  root: {
    device: '/dev/mmcblk0p2',
    mount_point: '/',
    filesystem: 'ext4',
    total: 64424509440,
    used: 16106127360,
    available: 48318382080,
    percent: 25
  },
  devices: [
    { name: '/dev/mmcblk0', type: 'sd', size: 64424509440, model: 'Samsung EVO Plus 64GB' }
  ]
}

export const storageHealth = {
  overall: 'good',
  devices: [
    { device: '/dev/mmcblk0', health: 'good', temperature: null, hours: 4320 }
  ]
}

export const halStorageUsage = {
  total: 64424509440,
  used: 16106127360,
  available: 48318382080,
  percent: 25,
  mount_point: '/'
}

export const halStorageDevices = [
  {
    name: 'mmcblk0',
    path: '/dev/mmcblk0',
    type: 'sd',
    size: 64424509440,
    model: 'Samsung EVO Plus 64GB',
    serial: 'DEMO0001',
    partitions: [
      { name: 'mmcblk0p1', mount_point: '/boot/firmware', filesystem: 'vfat', size: 536870912 },
      { name: 'mmcblk0p2', mount_point: '/', filesystem: 'ext4', size: 63887638528 }
    ]
  }
]

export const halStorageUsb = {
  devices: [
    {
      name: 'sda',
      path: '/dev/sda',
      vendor: 'SanDisk',
      model: 'Ultra Fit 128GB',
      serial: 'DEMO0002',
      size: 128849018880,
      bus: 2,
      device_num: 1,
      mounted: true,
      mount_point: '/mnt/usb-sda',
      filesystem: 'ext4'
    }
  ]
}

export const halStorageUsbDevices = halStorageUsb.devices
export const halStorageUsbTree = { buses: [{ bus: 1, devices: [] }, { bus: 2, devices: [{ vendor: 'SanDisk', product: 'Ultra Fit', bus: 2, device: 1 }] }] }

export const halNetworkMounts = []

export const mounts = [
  {
    name: 'usb-backup',
    type: 'local',
    source: '/dev/sda1',
    mount_point: '/mnt/usb-sda',
    filesystem: 'ext4',
    status: 'mounted',
    size: 128849018880,
    used: 21474836480,
    available: 107374182400,
    percent: 17,
    created_at: daysAgo(10)
  }
]

// ═══════════════════════════════════════════════════════════════════
// SMB
// ═══════════════════════════════════════════════════════════════════

export const smbStatus = { running: true, version: '4.19.5' }

export const smbShares = [
  {
    name: 'shared',
    path: '/cubeos/data/shared',
    comment: 'Shared files',
    browseable: true,
    read_only: false,
    guest_ok: false
  }
]

// ═══════════════════════════════════════════════════════════════════
// Backups
// ═══════════════════════════════════════════════════════════════════

export const backupsList = [
  {
    id: 'backup-001',
    type: 'full',
    status: 'completed',
    description: 'Weekly full backup',
    size: 524288000,
    created_at: daysAgo(7),
    completed_at: daysAgo(7),
    duration: 45
  },
  {
    id: 'backup-002',
    type: 'config',
    status: 'completed',
    description: 'Pre-update config snapshot',
    size: 10485760,
    created_at: daysAgo(3),
    completed_at: daysAgo(3),
    duration: 5
  },
  {
    id: 'backup-003',
    type: 'full',
    status: 'completed',
    description: 'Scheduled weekly backup',
    size: 536870912,
    created_at: hoursAgo(12),
    completed_at: hoursAgo(12),
    duration: 48
  }
]

export const backupsStats = {
  total: 3,
  total_size: 1071644672,
  last_backup: hoursAgo(12),
  next_scheduled: null
}

export const backupsDestinations = [
  { id: 'local', name: 'Local Storage', type: 'local', path: '/cubeos/backups', available: true }
]

export const backupsSchedules = [
  {
    id: 'sched-001',
    name: 'Weekly Full Backup',
    type: 'full',
    cron: '0 3 * * 0',
    enabled: true,
    destination: 'local',
    last_run: daysAgo(7),
    next_run: daysAgo(-2)
  }
]

export const backupsRestoreStatus = { in_progress: false }

// ═══════════════════════════════════════════════════════════════════
// Hardware
// ═══════════════════════════════════════════════════════════════════

export const hardwareOverview = {
  model: 'Raspberry Pi 5 Model B Rev 1.0',
  serial: 'DEMO00000000',
  revision: 'c04170',
  memory: 8589934592,
  cpu: 'Cortex-A76',
  cpu_cores: 4,
  cpu_max_freq: 2400,
  bluetooth: true,
  wifi: true,
  ethernet: true,
  usb3: true,
  pcie: true,
  gpio_pins: 40
}

export const hardwarePower = {
  source: 'usb-c',
  voltage: 5.1,
  current: 2.5,
  throttled: false,
  under_voltage: false
}

export const hardwareThrottle = {
  throttled: false,
  under_voltage: false,
  arm_freq_capped: false,
  soft_temp_limit: false,
  raw: '0x0'
}

export const hardwareUptime = { uptime_seconds: 432000, uptime_human: '5 days' }
export const hardwareBootConfig = { config: 'arm_64bit=1\ndtoverlay=vc4-kms-v3d\nmax_framebuffers=2' }

export const hardwareBattery = { available: false }
export const hardwareEeprom = {
  model: 'Raspberry Pi 5 Model B Rev 1.0',
  serial: 'DEMO00000000',
  revision: 'c04170',
  bootloader_version: '2024-09-23',
  bootloader_update_available: false
}

export const hardwareTemperature = { cpu_temp: 48.5, gpu_temp: 47.0 }
export const hardwareUps = { available: false }
export const hardwarePowerStatus = { source: 'usb-c', battery: null }

export const hardwareGpio = {
  pins: Array.from({ length: 40 }, (_, i) => ({
    pin: i + 1,
    gpio: i < 28 ? i : null,
    mode: 'IN',
    value: 0,
    pull: 'none',
    function: i === 0 ? '3V3' : i === 1 ? '5V' : `GPIO${i}`
  }))
}

export const hardwareI2c = {
  buses: [
    { bus: 1, devices: [{ address: '0x76', name: 'BME280 (Temperature/Humidity/Pressure)' }] }
  ]
}

export const hardwareSensors = {
  bme280: { available: true, temperature: 23.4, humidity: 45.2, pressure: 1013.25 },
  '1wire': { available: false, devices: [] }
}

export const hardwareWatchdog = {
  enabled: true,
  timeout: 15,
  identity: 'bcm2835-wdt',
  status: 'active'
}

export const hardwareRtc = { available: false }

export const hardwarePowerMonitor = { available: false, running: false }

export const hardwareUpsConfig = { available: false }

export const hardwareServices = {
  hostapd: { name: 'hostapd', status: 'running', enabled: true },
  dnsmasq: { name: 'dnsmasq', status: 'running', enabled: true }
}

// ═══════════════════════════════════════════════════════════════════
// Communication
// ═══════════════════════════════════════════════════════════════════

export const bluetooth = {
  available: true,
  powered: true,
  discovering: false,
  devices: [
    { address: 'AA:BB:CC:DD:EE:10', name: 'JBL Speaker', paired: true, connected: false, type: 'audio' },
    { address: 'AA:BB:CC:DD:EE:11', name: 'Logitech Keyboard', paired: true, connected: true, type: 'input' }
  ]
}

export const cellular = { available: false, modems: [] }
export const cellularStatus = { available: false }
export const cellularAndroid = { available: false, enabled: false }

export const gps = { available: false, devices: [] }
export const gpsStatus = { available: false, fix: false }

export const meshtasticDevices = []
export const meshtasticStatus = { connected: false, available: false }
export const meshtasticNodes = []
export const meshtasticConfig = {}
export const meshtasticMessages = []

export const iridiumDevices = []
export const iridiumStatus = { connected: false, available: false }
export const iridiumSignal = { strength: 0 }
export const iridiumMessages = []

// ═══════════════════════════════════════════════════════════════════
// Media
// ═══════════════════════════════════════════════════════════════════

export const audioStatus = {
  available: true,
  devices: [{ id: 0, name: 'bcm2835 Headphones', type: 'playback', default: true }],
  volume: 75,
  muted: false
}

export const audioPlayback = { devices: [{ id: 0, name: 'bcm2835 Headphones', type: 'playback' }] }
export const audioCapture = { devices: [] }
export const audioVolume = { volume: 75, muted: false }

export const cameras = { available: false, devices: [] }
export const cameraInfo = { available: false }

// ═══════════════════════════════════════════════════════════════════
// Monitoring
// ═══════════════════════════════════════════════════════════════════

export const monitoringStats = {
  cpu_percent: 12.5,
  memory_percent: 25.0,
  disk_percent: 25.0,
  temperature: 48.5,
  load_1: 0.45,
  load_5: 0.38,
  load_15: 0.32,
  uptime: 432000,
  containers_running: 8,
  containers_total: 8,
  network_rx_rate: 125000,
  network_tx_rate: 62500
}

export const monitoringHistory = {
  timestamps: Array.from({ length: 60 }, (_, i) => new Date(Date.now() - (59 - i) * 60000).toISOString()),
  cpu: Array.from({ length: 60 }, () => 10 + Math.random() * 10),
  memory: Array.from({ length: 60 }, () => 23 + Math.random() * 4),
  disk: Array.from({ length: 60 }, () => 24.5 + Math.random() * 1),
  temperature: Array.from({ length: 60 }, () => 46 + Math.random() * 5)
}

export const monitoringAlerts = []

export const monitoringThresholds = {
  cpu_warning: 80,
  cpu_critical: 95,
  memory_warning: 80,
  memory_critical: 95,
  disk_warning: 80,
  disk_critical: 95,
  temperature_warning: 70,
  temperature_critical: 80
}

// ═══════════════════════════════════════════════════════════════════
// Processes
// ═══════════════════════════════════════════════════════════════════

export const processList = [
  { pid: 1, name: 'systemd', user: 'root', cpu: 0.1, memory: 0.4, status: 'sleeping', threads: 1 },
  { pid: 234, name: 'dockerd', user: 'root', cpu: 1.5, memory: 3.2, status: 'sleeping', threads: 14 },
  { pid: 267, name: 'containerd', user: 'root', cpu: 0.8, memory: 2.1, status: 'sleeping', threads: 12 },
  { pid: 312, name: 'cubeos-api', user: 'cubeos', cpu: 2.1, memory: 1.8, status: 'sleeping', threads: 8 },
  { pid: 456, name: 'pihole-FTL', user: 'pihole', cpu: 0.4, memory: 1.2, status: 'sleeping', threads: 4 },
  { pid: 489, name: 'nginx', user: 'root', cpu: 0.2, memory: 0.8, status: 'sleeping', threads: 2 },
  { pid: 512, name: 'sshd', user: 'root', cpu: 0.0, memory: 0.3, status: 'sleeping', threads: 1 },
  { pid: 543, name: 'hostapd', user: 'root', cpu: 0.1, memory: 0.2, status: 'sleeping', threads: 1 },
  { pid: 567, name: 'dnsmasq', user: 'dnsmasq', cpu: 0.1, memory: 0.1, status: 'sleeping', threads: 1 },
  { pid: 601, name: 'ollama', user: 'root', cpu: 0.5, memory: 4.8, status: 'sleeping', threads: 6 },
  { pid: 623, name: 'registry', user: 'root', cpu: 0.1, memory: 0.6, status: 'sleeping', threads: 4 },
  { pid: 645, name: 'vaultwarden', user: 'root', cpu: 0.2, memory: 0.9, status: 'sleeping', threads: 3 },
  { pid: 678, name: 'kiwix-serve', user: 'root', cpu: 0.1, memory: 0.5, status: 'sleeping', threads: 2 },
  { pid: 702, name: 'dozzle', user: 'root', cpu: 0.1, memory: 0.3, status: 'sleeping', threads: 3 },
  { pid: 734, name: 'dufs', user: 'root', cpu: 0.1, memory: 0.2, status: 'sleeping', threads: 2 }
]

export const processSummary = { total: 15, running: 1, sleeping: 14, stopped: 0, zombie: 0 }

export const processTopCpu = processList.slice().sort((a, b) => b.cpu - a.cpu).slice(0, 5)
export const processTopMemory = processList.slice().sort((a, b) => b.memory - a.memory).slice(0, 5)

// ═══════════════════════════════════════════════════════════════════
// Logs
// ═══════════════════════════════════════════════════════════════════

const logTimestamps = Array.from({ length: 20 }, (_, i) => new Date(Date.now() - i * 120000).toISOString()).reverse()

export const logUnits = [
  'cubeos-api', 'cubeos-dashboard', 'docker', 'hostapd', 'dnsmasq', 'sshd', 'kernel'
]

export const logJournal = logTimestamps.map((ts, i) => {
  const messages = [
    { unit: 'cubeos-api', level: 'info', message: 'Health check OK: all 8 containers running' },
    { unit: 'docker', level: 'info', message: 'Container cubeos-pihole healthy' },
    { unit: 'cubeos-api', level: 'info', message: 'WebSocket client connected from 10.42.24.12' },
    { unit: 'hostapd', level: 'info', message: 'AP-STA-CONNECTED AA:BB:CC:DD:EE:03' },
    { unit: 'dnsmasq', level: 'info', message: 'DHCP lease 10.42.24.13 to AA:BB:CC:DD:EE:03' },
    { unit: 'cubeos-api', level: 'info', message: 'GET /api/v1/system/stats 200 4ms' },
    { unit: 'cubeos-api', level: 'info', message: 'Stats broadcast to 2 WebSocket clients' },
    { unit: 'docker', level: 'info', message: 'Container ollama healthy' },
    { unit: 'kernel', level: 'info', message: 'eth0: Link is Up - 1Gbps/Full' },
    { unit: 'cubeos-api', level: 'info', message: 'GET /api/v1/apps 200 12ms' },
    { unit: 'dnsmasq', level: 'info', message: 'query[A] pihole.cubeos.cube from 10.42.24.11' },
    { unit: 'cubeos-api', level: 'info', message: 'Reconcile: all services in sync' },
    { unit: 'docker', level: 'info', message: 'Container kiwix-serve healthy' },
    { unit: 'hostapd', level: 'info', message: 'wlan0: STA AA:BB:CC:DD:EE:01 IEEE 802.11: associated' },
    { unit: 'cubeos-api', level: 'info', message: 'POST /api/v1/auth/login 200 52ms' },
    { unit: 'dnsmasq', level: 'info', message: 'DHCP lease 10.42.24.11 to AA:BB:CC:DD:EE:01' },
    { unit: 'docker', level: 'info', message: 'Container vaultwarden healthy' },
    { unit: 'cubeos-api', level: 'info', message: 'GET /api/v1/system/info 200 2ms' },
    { unit: 'kernel', level: 'info', message: 'Temperature: zone0: 48500 mC' },
    { unit: 'cubeos-api', level: 'info', message: 'Registry sync complete: 8 images cached' }
  ]
  const entry = messages[i % messages.length]
  return { timestamp: ts, priority: entry.level, ...entry }
})

export const logErrors = []
export const logKernel = logJournal.filter(l => l.unit === 'kernel')
export const logBoot = [
  { timestamp: daysAgo(5), level: 'info', unit: 'kernel', message: 'Linux version 6.8.0-1004-raspi' },
  { timestamp: daysAgo(5), level: 'info', unit: 'systemd', message: 'Started CubeOS API Service' },
  { timestamp: daysAgo(5), level: 'info', unit: 'docker', message: 'Docker daemon started' }
]

export const halLogs = {
  hardware: logTimestamps.slice(-5).map(ts => ({ timestamp: ts, level: 'info', category: 'gpio', message: 'GPIO state stable' })),
  journal: [],
  kernel: []
}

// ═══════════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════════

export const registryStatus = {
  running: true,
  url: 'http://10.42.24.1:5000',
  version: '2.8.3',
  storage_used: 2147483648,
  image_count: 8
}

export const registryImages = [
  { name: 'pihole/pihole', tags: ['2024.07.0'], size: 268435456, pulled_at: daysAgo(5) },
  { name: 'jc21/nginx-proxy-manager', tags: ['2.11.3'], size: 314572800, pulled_at: daysAgo(3) },
  { name: 'ollama/ollama', tags: ['latest'], size: 536870912, pulled_at: daysAgo(2) },
  { name: 'amir20/dozzle', tags: ['latest'], size: 41943040, pulled_at: daysAgo(1) },
  { name: 'sigoden/dufs', tags: ['latest'], size: 20971520, pulled_at: daysAgo(7) },
  { name: 'ghcr.io/kiwix/kiwix-serve', tags: ['3.7.0'], size: 83886080, pulled_at: daysAgo(3) },
  { name: 'vaultwarden/server', tags: ['latest'], size: 125829120, pulled_at: daysAgo(4) },
  { name: 'registry', tags: ['2'], size: 25165824, pulled_at: daysAgo(10) }
]

export const registryDiskUsage = { total: 2147483648, used: 1417674752, available: 729808896 }
export const registryCheck = { reachable: true, healthy: true }
export const registryCachedApps = registryImages.map(i => ({ name: i.name, tags: i.tags }))
export const registrySettings = { mirror_enabled: false, cleanup_policy: 'weekly', max_size_gb: 10 }
export const registrySyncStatus = { in_progress: false, last_sync: daysAgo(1) }
export const systemImages = registryImages

// ═══════════════════════════════════════════════════════════════════
// Ports
// ═══════════════════════════════════════════════════════════════════

export const ports = [
  { port: 5000, service: 'cubeos-registry', protocol: 'tcp', type: 'system' },
  { port: 6000, service: 'cubeos-npm', protocol: 'tcp', type: 'system' },
  { port: 6001, service: 'cubeos-pihole', protocol: 'tcp', type: 'system' },
  { port: 6005, service: 'cubeos-hal', protocol: 'tcp', type: 'system' },
  { port: 6010, service: 'cubeos-api', protocol: 'tcp', type: 'platform' },
  { port: 6011, service: 'cubeos-dashboard', protocol: 'tcp', type: 'platform' },
  { port: 6013, service: 'cubeos-dufs', protocol: 'tcp', type: 'platform' },
  { port: 6030, service: 'ollama', protocol: 'tcp', type: 'ai' },
  { port: 6100, service: 'dozzle', protocol: 'tcp', type: 'user' },
  { port: 6101, service: 'kiwix-serve', protocol: 'tcp', type: 'user' },
  { port: 6102, service: 'vaultwarden', protocol: 'tcp', type: 'user' }
]

export const portStats = { total: 11, system: 5, platform: 3, user: 3, available: 889 }
export const portsReserved = [22, 53, 67, 80, 443, 5000]
export const portsAvailable = { port: 6103 }

// ═══════════════════════════════════════════════════════════════════
// FQDNs
// ═══════════════════════════════════════════════════════════════════

export const fqdns = [
  { fqdn: 'pihole.cubeos.cube', target: '10.42.24.1', port: 6001, type: 'A' },
  { fqdn: 'files.cubeos.cube', target: '10.42.24.1', port: 6013, type: 'A' },
  { fqdn: 'dozzle.cubeos.cube', target: '10.42.24.1', port: 6100, type: 'A' },
  { fqdn: 'wiki.cubeos.cube', target: '10.42.24.1', port: 6101, type: 'A' },
  { fqdn: 'vault.cubeos.cube', target: '10.42.24.1', port: 6102, type: 'A' }
]

// ═══════════════════════════════════════════════════════════════════
// Profiles
// ═══════════════════════════════════════════════════════════════════

export const profiles = [
  { name: 'minimal', display_name: 'Minimal', description: 'Core services only', apps: ['cubeos-pihole', 'cubeos-npm'] },
  { name: 'standard', display_name: 'Standard', description: 'Core + productivity apps', apps: ['cubeos-pihole', 'cubeos-npm', 'cubeos-dufs', 'vaultwarden'] },
  { name: 'full', display_name: 'Full', description: 'All recommended apps', apps: ['cubeos-pihole', 'cubeos-npm', 'cubeos-dufs', 'ollama', 'vaultwarden', 'kiwix-serve'] }
]

// ═══════════════════════════════════════════════════════════════════
// NPM
// ═══════════════════════════════════════════════════════════════════

export const npmStatus = { running: true, version: '2.11.3', proxy_hosts: 3 }
export const npmHosts = proxyHosts

// ═══════════════════════════════════════════════════════════════════
// Favorites
// ═══════════════════════════════════════════════════════════════════

export const favorites = ['cubeos-pihole', 'ollama', 'vaultwarden']

// ═══════════════════════════════════════════════════════════════════
// Preferences
// ═══════════════════════════════════════════════════════════════════

export const preferences = {
  theme: 'system',
  language: 'en',
  dashboard_layout: 'standard',
  show_system_apps: true,
  notifications: true,
  wallpaper: null
}

// ═══════════════════════════════════════════════════════════════════
// Updates
// ═══════════════════════════════════════════════════════════════════

export const updates = { available: false, current_version: '0.2.0-beta.01', latest_version: '0.2.0-beta.01' }
export const updatesHistory = [
  { version: '0.2.0-beta.01', applied_at: daysAgo(10), type: 'release', notes: 'FlowEngine + Docker Swarm migration' },
  { version: '0.1.0-alpha.26', applied_at: daysAgo(30), type: 'release', notes: 'Sprint 10 final alpha' }
]

// ═══════════════════════════════════════════════════════════════════
// Wizard
// ═══════════════════════════════════════════════════════════════════

export const wizardProfiles = { profiles }
export const wizardServices = { categories: appstoreCategories }
export const wizardRecommendations = { recommended: ['pihole', 'npm', 'dufs'], not_recommended: [] }

// ═══════════════════════════════════════════════════════════════════
// Signals (dashboard widget)
// ═══════════════════════════════════════════════════════════════════

export const signalsCellular = { available: false }
export const signalsMeshtastic = { connected: false, available: false }
export const signalsGps = { available: false }
export const signalsIridium = { connected: false, available: false }

// ═══════════════════════════════════════════════════════════════════
// System Browse
// ═══════════════════════════════════════════════════════════════════

export const systemBrowse = {
  path: '/cubeos/data',
  entries: [
    { name: 'cubeos.db', type: 'file', size: 1048576 },
    { name: 'shared', type: 'directory', size: 0 },
    { name: '.setup_complete', type: 'file', size: 0 }
  ]
}

// ═══════════════════════════════════════════════════════════════════
// CasaOS (import feature)
// ═══════════════════════════════════════════════════════════════════

export const casaosStores = []

// ═══════════════════════════════════════════════════════════════════
// WebSocket mock stats payload
// ═══════════════════════════════════════════════════════════════════

export function generateWsStats(fluctuate) {
  return {
    type: 'stats',
    system: {
      cpu: { percent: fluctuate(12.5, 8, 0, 100) },
      memory: {
        percent: fluctuate(25.0, 3, 0, 100),
        used: Math.round(fluctuate(2147483648, 200000000, 0, 8589934592)),
        total: 8589934592,
        swap_total: 536870912,
        swap_used: Math.round(fluctuate(67108864, 10000000, 0, 536870912)),
        swap_percent: fluctuate(12.5, 3, 0, 100)
      },
      disk: {
        percent: 25.0,
        used: 16106127360,
        total: 64424509440
      },
      temperature: {
        cpu_temp_c: fluctuate(48.5, 3, 30, 85),
        throttled: false,
        under_voltage: false
      }
    },
    network: {
      clients_connected: 3,
      interfaces: {
        eth0: { rx_rate: Math.round(fluctuate(125000, 50000, 0)), tx_rate: Math.round(fluctuate(62500, 25000, 0)) },
        wlan0: { rx_rate: Math.round(fluctuate(31250, 15000, 0)), tx_rate: Math.round(fluctuate(15625, 8000, 0)) }
      }
    },
    docker: {
      running: 8,
      total: 8,
      containers: apps.map(a => ({ name: a.name, status: 'running', image: a.image }))
    }
  }
}
