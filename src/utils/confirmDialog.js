/**
 * confirmDialog.js
 *
 * Global confirm dialog service.
 * Provides a promise-based confirm() that replaces native window.confirm()
 * with the themed ConfirmDialog.vue component.
 *
 * Usage (any file — components, stores, modules):
 *
 *   import { confirm } from '@/utils/confirmDialog'
 *
 *   async function handleDelete() {
 *     if (!await confirm({ title: 'Delete?', message: 'This cannot be undone.' })) return
 *     // proceed with deletion
 *   }
 *
 * The ConfirmDialog instance is mounted once in App.vue and reads from
 * the exported reactive `confirmState`.
 */
import { reactive } from 'vue'

export const confirmState = reactive({
  show: false,
  title: 'Are you sure?',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
  loading: false,
  checkboxLabel: '',
  checkboxChecked: false,
  _resolve: null
})

/**
 * Show a themed confirmation dialog.
 * @param {Object} options
 * @param {string} [options.title='Are you sure?']
 * @param {string} [options.message='']
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {string} [options.variant='danger'] - 'danger' | 'warning' | 'info'
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function confirm({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  checkboxLabel = '',
  checkboxDefault = false
} = {}) {
  return new Promise((resolve) => {
    // If a previous dialog is still pending, resolve it as cancelled
    if (confirmState._resolve) {
      confirmState._resolve(false)
    }
    confirmState.title = title
    confirmState.message = message
    confirmState.confirmText = confirmText
    confirmState.cancelText = cancelText
    confirmState.variant = variant
    confirmState.checkboxLabel = checkboxLabel
    confirmState.checkboxChecked = checkboxDefault
    confirmState.loading = false
    confirmState._resolve = resolve
    confirmState.show = true
  })
}

export function handleConfirm() {
  confirmState.show = false
  confirmState._resolve?.(true)
  confirmState._resolve = null
}

export function handleCancel() {
  confirmState.show = false
  confirmState._resolve?.(false)
  confirmState._resolve = null
}
