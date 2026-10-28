import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:8000'
  const basePath = env.VITE_BASE_PATH || '/chat/'

  return {
    // Publicação no subdiretório público (ex: /chat/).
    // Em dev roda em '/', no build e preview utiliza o basePath configurado.
    base: command === 'build' || isPreview ? basePath : '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/chat/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/chat\/api/, ''),
        },
        '/chat-dev/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/chat-dev\/api/, ''),
        },
      },
    },
  }
})
