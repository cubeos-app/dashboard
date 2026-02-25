import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
  missing(locale, key) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key: "${key}" for locale "${locale}"`)
    }
  }
})

export default i18n
