import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.API_URL || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  base: '/jarvis/',
  plugins: [react()],
  resolve: {
    alias: {
      '@jarvis/jads': path.resolve(__dirname, 'packages/jads/src'),
    },
  },
  server: {
    proxy: {
      '/jarvis/api': {
        target: API_TARGET,
        rewrite: (p) => p.replace(/^\/jarvis/, ''),
      },
      '/jarvis/docs': {
        target: API_TARGET,
        rewrite: (p) => p.replace(/^\/jarvis/, ''),
      },
      '/jarvis/openapi.json': {
        target: API_TARGET,
        rewrite: (p) => p.replace(/^\/jarvis/, ''),
      },
    },
  },
})
