/**
 * CubeOS Breakpoint Composable
 *
 * S01 — Reactive window size tracker using matchMedia (no polling).
 * Provides boolean flags for mobile/tablet/desktop breakpoints.
 *
 * Breakpoints (from master plan):
 *   mobile:  < 768px   — Bottom tab bar, card stacks
 *   tablet:  768-1023px — Icon rail sidebar, full-width content
 *   desktop: 1024-1279px — Collapsible sidebar
 *   wide:    ≥ 1280px  — Fixed sidebar 260px
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop, isWide, breakpoint } = useBreakpoint()
 */
import { ref, computed, readonly, onMounted, onUnmounted } from 'vue'

// Shared reactive state — all component instances reference the same refs
const _breakpoint = ref('wide')
const _isMobile = ref(false)
const _isTablet = ref(false)
const _isDesktop = ref(false)
const _isWide = ref(false)

let _listenerCount = 0
let _queries = null

function _update() {
  const w = window.innerWidth
  if (w < 768) {
    _breakpoint.value = 'mobile'
    _isMobile.value = true
    _isTablet.value = false
    _isDesktop.value = false
    _isWide.value = false
  } else if (w < 1024) {
    _breakpoint.value = 'tablet'
    _isMobile.value = false
    _isTablet.value = true
    _isDesktop.value = false
    _isWide.value = false
  } else if (w < 1280) {
    _breakpoint.value = 'desktop'
    _isMobile.value = false
    _isTablet.value = false
    _isDesktop.value = true
    _isWide.value = false
  } else {
    _breakpoint.value = 'wide'
    _isMobile.value = false
    _isTablet.value = false
    _isDesktop.value = false
    _isWide.value = true
  }
}

function _setupListeners() {
  if (_queries) return

  const breakpoints = [
    window.matchMedia('(max-width: 767px)'),
    window.matchMedia('(min-width: 768px) and (max-width: 1023px)'),
    window.matchMedia('(min-width: 1024px) and (max-width: 1279px)'),
    window.matchMedia('(min-width: 1280px)')
  ]

  breakpoints.forEach(mq => mq.addEventListener('change', _update))
  _queries = breakpoints
  _update()
}

function _teardownListeners() {
  if (!_queries) return
  _queries.forEach(mq => mq.removeEventListener('change', _update))
  _queries = null
}

/**
 * Reactive breakpoint composable.
 * Shares listeners across all component instances via module-level state.
 */
export function useBreakpoint() {
  onMounted(() => {
    _listenerCount++
    _setupListeners()
  })

  onUnmounted(() => {
    _listenerCount--
    if (_listenerCount <= 0) {
      _teardownListeners()
      _listenerCount = 0
    }
  })

  return {
    /** Current breakpoint name: 'mobile' | 'tablet' | 'desktop' | 'wide' */
    breakpoint: readonly(_breakpoint),
    /** < 768px — bottom tab bar, card stacks */
    isMobile: readonly(_isMobile),
    /** 768-1023px — icon rail, full-width content */
    isTablet: readonly(_isTablet),
    /** 1024-1279px — collapsible sidebar */
    isDesktop: readonly(_isDesktop),
    /** ≥ 1280px — fixed sidebar */
    isWide: readonly(_isWide),
    /** Convenience: anything above mobile */
    isAboveMobile: computed(() => !_isMobile.value)
  }
}
