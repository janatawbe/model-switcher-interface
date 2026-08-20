import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // The frontend only ever calls our own /api/*; this forwards those
    // dev-server requests to the Express backend so the app never needs
    // to hardcode a backend origin (and never talks to OpenRouter itself).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})