import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no filter) from .env files + process.env
  const env = loadEnv(mode, process.cwd(), '')
  // Check both loadEnv result and process.env directly (belt + suspenders)
  const isDemoMode = env.VITE_DEMO_MODE === 'true' || process.env.VITE_DEMO_MODE === 'true'

  console.log('[CubeOS] mode:', mode, '| demo:', isDemoMode,
    '| loadEnv:', env.VITE_DEMO_MODE, '| process.env:', process.env.VITE_DEMO_MODE)

  return {
    plugins: [vue()],
    define: {
      '__CUBEOS_DEMO__': isDemoMode
    },
    build: isDemoMode ? { target: 'esnext' } : {},
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || process.env.VITE_API_URL || 'http://10.42.24.1:6010',
          changeOrigin: true
        }
      }
    }
  }
})
