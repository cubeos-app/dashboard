import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  // Demo builds use top-level await for conditional API client import
  define: {
    'import.meta.env.VITE_DEMO_MODE': JSON.stringify(process.env.VITE_DEMO_MODE || '')
  },
  build: process.env.VITE_DEMO_MODE === 'true' ? { target: 'esnext' } : {},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://10.42.24.1:6010',
        changeOrigin: true
      }
    }
  }
})
