/**
 * Safe localStorage wrapper with quota error handling.
 * Falls back gracefully when storage is full or unavailable.
 */

export function safeGetItem(key, fallback = null) {
  try {
    const item = localStorage.getItem(key)
    return item !== null ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      // Quota exceeded — try to free space by removing non-critical items
      try {
        localStorage.removeItem('cubeos-recent')
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch {
        // Still no room — give up silently
        return false
      }
    }
    return false
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}
