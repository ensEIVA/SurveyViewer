import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // strictPort: fail loudly if 2008 is taken instead of silently moving to
  // 2009 — Nexus's CORS setup may only allow this exact origin.
  server: { port: 2008, strictPort: true },
})
