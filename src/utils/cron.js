/**
 * Cron expression utilities for backup schedule display.
 *
 * Converts standard 5-field cron expressions (minute hour dom month dow)
 * to human-readable strings. Handles common presets; falls back to raw
 * expression for unrecognised patterns.
 */

/**
 * Predefined schedule options for the UI picker.
 */
export const CRON_PRESETS = [
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 2:00 AM', value: '0 2 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly (Sunday 2 AM)', value: '0 2 * * 0' },
  { label: 'Monthly (1st at 2 AM)', value: '0 2 1 * *' },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format a 24-hour value to 12-hour AM/PM string.
 */
function formatTime(hour, minute) {
  const h = Number(hour)
  const m = Number(minute)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}:00 ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Convert a 5-field cron expression to a human-readable string.
 *
 * @param {string} expr — Standard cron: "minute hour dom month dow"
 * @returns {string} Human-readable description or the raw expression
 */
export function cronToHuman(expr) {
  if (!expr || typeof expr !== 'string') return expr || ''

  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [minute, hour, dom, month, dow] = parts

  // "*/N * * * *" → Every N minutes
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = Number(minute.slice(2))
    if (n === 1) return 'Every minute'
    return `Every ${n} minutes`
  }

  // "0 */N * * *" → Every N hours
  if (minute === '0' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    const n = Number(hour.slice(2))
    if (n === 1) return 'Every hour'
    return `Every ${n} hours`
  }

  // "M H * * *" → Daily at H:M
  if (!minute.includes('*') && !minute.includes('/') &&
      !hour.includes('*') && !hour.includes('/') &&
      dom === '*' && month === '*' && dow === '*') {
    return `Daily at ${formatTime(hour, minute)}`
  }

  // "M H * * D" → Weekly on DayName at H:M
  if (!minute.includes('*') && !minute.includes('/') &&
      !hour.includes('*') && !hour.includes('/') &&
      dom === '*' && month === '*' &&
      !dow.includes('*') && !dow.includes('/')) {
    const dayNum = Number(dow)
    const dayName = DAY_NAMES[dayNum] || dow
    return `Weekly on ${dayName} at ${formatTime(hour, minute)}`
  }

  // "M H D * *" → Monthly on Dth at H:M
  if (!minute.includes('*') && !minute.includes('/') &&
      !hour.includes('*') && !hour.includes('/') &&
      !dom.includes('*') && !dom.includes('/') &&
      month === '*' && dow === '*') {
    const d = Number(dom)
    const suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'
    return `Monthly on the ${d}${suffix} at ${formatTime(hour, minute)}`
  }

  // Fallback: return raw expression
  return expr
}
