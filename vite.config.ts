import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests during dev to avoid CORS and OPTIONS 404s
      '/mayar': {
        target: 'https://api.mayar.club',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/mayar/, ''),
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
