/**
 * Safe localStorage wrapper with comprehensive error handling.
 *
 * Handles:
 * - Safari Private Browsing (localStorage throws on setItem)
 * - QuotaExceededError (storage full)
 * - SSR / environments where localStorage is undefined
 * - JSON serialization failures
 *
 * Sprint 1 — S1-05
 */

/** Cached availability flag — checked once on load */
let _available = null

/**
 * Test whether localStorage is usable in this environment.
 * Caches the result after the first call.
 */
export function isStorageAvailable() {
  if (_available !== null) return _available

  try {
    const testKey = '__cubeos_storage_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
    _available = true
  } catch {
    _available = false
  }

  return _available
}

/**
 * Retrieve and JSON-parse a value from localStorage.
 * Returns `fallback` on any error (missing key, parse failure, unavailable storage).
 *
 * @param {string} key
 * @param {*} fallback - Default value if key is missing or unparseable
 * @returns {*}
 */
export function safeGetItem(key, fallback = null) {
  if (!isStorageAvailable()) return fallback

  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * Retrieve a raw string from localStorage (no JSON parsing).
 * Useful for tokens, theme IDs, and other plain string values.
 *
 * @param {string} key
 * @param {string|null} fallback
 * @returns {string|null}
 */
export function safeGetRaw(key, fallback = null) {
  if (!isStorageAvailable()) return fallback

  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? raw : fallback
  } catch {
    return fallback
  }
}

/**
 * JSON-stringify and store a value in localStorage.
 * Returns true on success, false on any failure.
 *
 * On QuotaExceededError, attempts to free space by clearing non-critical
 * keys before giving up.
 *
 * @param {string} key
 * @param {*} value - Must be JSON-serializable
 * @returns {boolean}
 */
export function safeSetItem(key, value) {
  if (!isStorageAvailable()) return false

  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      try {
        localStorage.removeItem('cubeos-recent')
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

/**
 * Store a raw string in localStorage (no JSON wrapping).
 * Useful for tokens and simple string flags.
 *
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
export function safeSetRaw(key, value) {
  if (!isStorageAvailable()) return false

  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Remove a key from localStorage.
 *
 * @param {string} key
 */
export function safeRemoveItem(key) {
  if (!isStorageAvailable()) return

  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}
