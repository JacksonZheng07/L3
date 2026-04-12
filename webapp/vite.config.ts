import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// CORS proxy and wallet API are now handled by Express (server/index.ts).
// In dev, Express loads Vite as middleware — no proxy plugin needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
