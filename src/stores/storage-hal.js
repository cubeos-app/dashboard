/**
 * CubeOS Storage HAL Store
 *
 * Sprint 3: Hardware Abstraction Layer for storage devices, USB management,
 * SMART monitoring, and network mount operations via HAL service.
 *
 * All endpoints go through /hal/storage/* which communicates with the
 * privileged HAL container that has direct hardware access.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export const useStorageHalStore = defineStore('storage-hal', () => {
  // ==========================================
  // State
  // ==========================================

  const loading = ref(false)
  const error = ref(null)

  // Storage overview
  const usage = ref(null)

  // Block devices
  const devices = ref([])
  const selectedDevice = ref(null)
  const smartData = ref(null)

  // USB
  const usbStorage = ref([])
  const usbDevices = ref([])
  const usbTree = ref(null)
  const usbDeviceLoading = ref({}) // per-device loading state: { '/dev/sda': true }

  // Network mounts
  const networkMounts = ref([])
  const mountCheckResult = ref(null)
  const mountTestResult = ref(null)

  // ==========================================
  // Computed
  // ==========================================

  const totalSpace = computed(() => usage.value?.total || 0)
  const usedSpace = computed(() => usage.value?.used || 0)
  const freeSpace = computed(() => usage.value?.free || 0)
  const usagePercent = computed(() => {
    if (!totalSpace.value) return 0
    return Math.round((usedSpace.value / totalSpace.value) * 100)
  })

  const deviceCount = computed(() => devices.value.length)
  const usbDeviceCount = computed(() => usbDevices.value.length)
  const usbStorageCount = computed(() => usbStorage.value.length)
  const networkMountCount = computed(() => networkMounts.value.length)

  const mountedNetworkMounts = computed(() =>
    networkMounts.value.filter(m => m.mounted || m.status === 'mounted')
  )

  // ==========================================
  // Storage Usage & Devices
  // ==========================================

  /**
   * Fetch overall storage usage
   * GET /hal/storage/usage
   */
  async function fetchUsage(options = {}) {
    try {
      const data = await api.get('/hal/storage/usage', {}, options)
      if (data === null) return
      usage.value = data
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }

  /**
   * Fetch all storage devices
   * GET /hal/storage/devices
   */
  async function fetchDevices(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/hal/storage/devices')
      devices.value = response.devices || response || []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch single device details
   * GET /hal/storage/devices/{device}
   */
  async function fetchDevice(device) {
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      selectedDevice.value = await api.get(`/hal/storage/devices/${encoded}`)
      return selectedDevice.value
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Fetch SMART data for a device
   * GET /hal/storage/devices/{device}/smart
   */
  async function fetchDeviceSMART(device) {
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      smartData.value = await api.get(`/hal/storage/devices/${encoded}/smart`)
      return smartData.value
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  // ==========================================
  // USB Management
  // ==========================================

  /**
   * Fetch USB storage devices only
   * GET /hal/storage/usb
   */
  async function fetchUSBStorage() {
    try {
      const response = await api.get('/hal/storage/usb')
      usbStorage.value = response.devices || response || []
    } catch (e) {
    }
  }

  /**
   * Fetch all USB devices (storage + peripherals)
   * GET /hal/storage/usb/devices
   */
  async function fetchUSBDevices(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/hal/storage/usb/devices')
      usbDevices.value = response.devices || response || []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch USB devices filtered by class
   * GET /hal/storage/usb/class/{class}
   */
  async function fetchUSBByClass(cls, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const encoded = encodeURIComponent(cls)
      const response = await api.get(`/hal/storage/usb/class/${encoded}`)
      usbDevices.value = response.devices || response || []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Fetch USB device tree hierarchy
   * GET /hal/storage/usb/tree
   */
  async function fetchUSBTree() {
    error.value = null
    try {
      usbTree.value = await api.get('/hal/storage/usb/tree')
      return usbTree.value
    } catch (e) {
      error.value = e.message
      return null
    }
  }

  /**
   * Rescan USB bus for new devices
   * POST /hal/storage/usb/rescan
   */
  async function rescanUSB(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      await api.post('/hal/storage/usb/rescan')
      // Refresh device lists after rescan
      await Promise.all([fetchUSBDevices(true), fetchUSBStorage()])
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Reset a USB device by bus and device number
   * POST /hal/storage/usb/reset/{bus}/{device}
   */
  async function resetUSBDevice(bus, device) {
    const key = `${bus}:${device}`
    usbDeviceLoading.value = { ...usbDeviceLoading.value, [key]: true }
    error.value = null
    try {
      await api.post(`/hal/storage/usb/reset/${bus}/${device}`)
      await fetchUSBDevices()
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      usbDeviceLoading.value = { ...usbDeviceLoading.value, [key]: false }
    }
  }

  /**
   * Mount a USB storage device
   * POST /hal/storage/usb/{device}/mount
   */
  async function mountUSB(device) {
    usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: true }
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      const result = await api.post(`/hal/storage/usb/${encoded}/mount`)
      await fetchUSBStorage()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: false }
    }
  }

  /**
   * Unmount a USB storage device
   * POST /hal/storage/usb/{device}/unmount
   */
  async function unmountUSB(device) {
    usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: true }
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      await api.post(`/hal/storage/usb/${encoded}/unmount`)
      await fetchUSBStorage()
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: false }
    }
  }

  /**
   * Safely eject a USB storage device
   * POST /hal/storage/usb/{device}/eject
   */
  async function ejectUSB(device) {
    usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: true }
    error.value = null
    try {
      const encoded = encodeURIComponent(device)
      await api.post(`/hal/storage/usb/${encoded}/eject`)
      // Refresh both lists — device should disappear from storage
      await Promise.all([fetchUSBDevices(), fetchUSBStorage()])
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      usbDeviceLoading.value = { ...usbDeviceLoading.value, [device]: false }
    }
  }

  // ==========================================
  // Network Mounts (HAL-level)
  // ==========================================

  /**
   * Fetch all network mounts managed by HAL
   * GET /hal/storage/network-mounts
   */
  async function fetchNetworkMounts(skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const response = await api.get('/hal/storage/network-mounts')
      networkMounts.value = response.mounts || response || []
    } catch (e) {
      error.value = e.message
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Mount an SMB share via HAL
   * POST /hal/storage/network-mounts/smb
   */
  async function mountSMBViaHAL(config, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const result = await api.post('/hal/storage/network-mounts/smb', config)
      await fetchNetworkMounts(true)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Mount an NFS share via HAL
   * POST /hal/storage/network-mounts/nfs
   */
  async function mountNFSViaHAL(config, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      const result = await api.post('/hal/storage/network-mounts/nfs', config)
      await fetchNetworkMounts(true)
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Unmount a network share via HAL
   * DELETE /hal/storage/network-mounts
   */
  async function unmountNetworkShare(config, skipLoading = false) {
    if (!skipLoading) loading.value = true
    error.value = null
    try {
      await api.delete('/hal/storage/network-mounts', { data: config })
      await fetchNetworkMounts(true)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      if (!skipLoading) loading.value = false
    }
  }

  /**
   * Check if a network mount is active
   * GET /hal/storage/network-mounts/check
   */
  async function checkNetworkMount(params) {
    try {
      mountCheckResult.value = await api.get('/hal/storage/network-mounts/check', { params })
      return mountCheckResult.value
    } catch (e) {
      return null
    }
  }

  /**
   * Test a network mount connection before saving
   * POST /hal/storage/network-mounts/test
   */
  async function testNetworkMount(config) {
    mountTestResult.value = null
    try {
      mountTestResult.value = await api.post('/hal/storage/network-mounts/test', config)
      return mountTestResult.value
    } catch (e) {
      mountTestResult.value = { success: false, error: e.message }
      return mountTestResult.value
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * Check if a specific USB device is loading
   */
  function isUSBDeviceLoading(device) {
    return !!usbDeviceLoading.value[device]
  }

  /**
   * Format bytes to human-readable string
   */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let value = bytes
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024
      i++
    }
    return `${value.toFixed(1)} ${units[i]}`
  }

  /**
   * Reset all state
   */
  function $reset() {
    loading.value = false
    error.value = null
    usage.value = null
    devices.value = []
    selectedDevice.value = null
    smartData.value = null
    usbStorage.value = []
    usbDevices.value = []
    usbTree.value = null
    usbDeviceLoading.value = {}
    networkMounts.value = []
    mountCheckResult.value = null
    mountTestResult.value = null
  }

  return {
    // State
    loading,
    error,
    usage,
    devices,
    selectedDevice,
    smartData,
    usbStorage,
    usbDevices,
    usbTree,
    usbDeviceLoading,
    networkMounts,
    mountCheckResult,
    mountTestResult,

    // Computed
    totalSpace,
    usedSpace,
    freeSpace,
    usagePercent,
    deviceCount,
    usbDeviceCount,
    usbStorageCount,
    networkMountCount,
    mountedNetworkMounts,

    // Storage & Devices
    fetchUsage,
    fetchDevices,
    fetchDevice,
    fetchDeviceSMART,

    // USB
    fetchUSBStorage,
    fetchUSBDevices,
    fetchUSBByClass,
    fetchUSBTree,
    rescanUSB,
    resetUSBDevice,
    mountUSB,
    unmountUSB,
    ejectUSB,

    // Network Mounts
    fetchNetworkMounts,
    mountSMBViaHAL,
    mountNFSViaHAL,
    unmountNetworkShare,
    checkNetworkMount,
    testNetworkMount,

    // Helpers
    isUSBDeviceLoading,
    formatBytes,
    $reset
  }
})
