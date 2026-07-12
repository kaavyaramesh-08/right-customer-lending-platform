import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/predict': 'http://localhost:8000',
      '/customers': 'http://localhost:8000',
      '/chatbot': 'http://localhost:8000',
      '/api': 'http://localhost:8000'
    }
  }
})
