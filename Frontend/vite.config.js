import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig(({ mode }) => {
  // Backend visé (VITE_API_URL, ex. dans .env.local), localhost:8000 par défaut.
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_API_URL || 'http://localhost:8000'

  // En développement, le navigateur appelle /api sur le serveur Vite, qui
  // relaie vers le backend : aucune contrainte CORS, quel que soit le port.
  const proxy = {
    '/api': { target: backend, changeOrigin: true, secure: true },
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      host: true,
      port: 5173,
      proxy,
    },
    preview: {
      proxy,
    },
  }
})
