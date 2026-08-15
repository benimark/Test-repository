import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const CLIENT_PORT = 5173
const SERVER_PORT = Number(process.env.PORT ?? 3001)

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: CLIENT_PORT,
    // The Express API stays on its own port in dev; the SPA reaches it through this proxy
    // so client code can always use same-origin `/api/*` URLs.
    proxy: {
      '/api': `http://localhost:${SERVER_PORT}`,
    },
  },
})
