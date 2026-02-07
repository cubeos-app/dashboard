import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Global error handler - prevents unhandled component errors from crashing the app
app.config.errorHandler = (err, instance, info) => {
  if (import.meta.env.DEV) console.error(`[CubeOS] Component error in ${info}:`, err)
}

app.mount('#app')
