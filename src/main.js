import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Global error handler - prevents unhandled component errors from crashing the app
app.config.errorHandler = (err, instance, info) => {
  if (import.meta.env.DEV) console.error(`[CubeOS] Component error in ${info}:`, err)
}

app.mount('#app')

// Umami analytics — only in demo mode (demo.cubeos.app)
if (__CUBEOS_DEMO__) {
  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://analytics.cubeos.app/script.js'
  s.dataset.websiteId = '1f6e3823-418c-420d-9c7a-9ded87130215'
  document.head.appendChild(s)
}
