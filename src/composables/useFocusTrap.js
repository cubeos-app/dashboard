/**
 * useFocusTrap.js
 *
 * Composable that returns a @keydown handler to trap Tab focus
 * within the element it's bound to. Attach to the modal container:
 *
 *   <div @keydown="trapFocus"> ... </div>
 *
 * Cycles focus between the first and last focusable elements.
 */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function useFocusTrap() {
  function trapFocus(e) {
    if (e.key !== 'Tab') return

    const focusable = [...e.currentTarget.querySelectorAll(FOCUSABLE)]
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return { trapFocus }
}
