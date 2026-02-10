/**
 * CubeOS Domain Utility
 *
 * S01 — Centralizes all domain/FQDN construction.
 * Reads from VITE_CUBEOS_DOMAIN env var, defaults to 'cubeos.cube'.
 * Every component that needs an FQDN imports from here instead of hardcoding.
 *
 * Usage:
 *   import { getCubeDomain, makeFqdn } from '@/utils/domain'
 *   getCubeDomain()       // → 'cubeos.cube'
 *   makeFqdn('pihole')    // → 'pihole.cubeos.cube'
 *   makeFqdn('app', '/admin') // → 'app.cubeos.cube/admin'
 */

/**
 * Return the base CubeOS domain (no subdomain prefix).
 * @returns {string} e.g. 'cubeos.cube'
 */
export function getCubeDomain() {
  return import.meta.env.VITE_CUBEOS_DOMAIN || 'cubeos.cube'
}

/**
 * Build a fully-qualified domain name for a CubeOS subdomain.
 * @param {string} subdomain - e.g. 'pihole', 'npm', 'dozzle'
 * @param {string} [path=''] - optional path suffix e.g. '/admin'
 * @returns {string} e.g. 'pihole.cubeos.cube/admin'
 */
export function makeFqdn(subdomain, path = '') {
  const domain = getCubeDomain()
  return `${subdomain}.${domain}${path}`
}

/**
 * Build a full HTTP URL for a CubeOS subdomain.
 * @param {string} subdomain
 * @param {string} [path='']
 * @returns {string} e.g. 'http://pihole.cubeos.cube/admin'
 */
export function makeUrl(subdomain, path = '') {
  return `http://${makeFqdn(subdomain, path)}`
}

/**
 * Return the domain suffix for display (e.g. '.cubeos.cube').
 * Useful in input field suffixes.
 * @returns {string}
 */
export function getDomainSuffix() {
  return `.${getCubeDomain()}`
}

/**
 * Build a placeholder string for FQDN inputs.
 * @param {string} [example='app'] - Example subdomain
 * @returns {string} e.g. 'app.cubeos.cube'
 */
export function makePlaceholder(example = 'app') {
  return makeFqdn(example)
}
