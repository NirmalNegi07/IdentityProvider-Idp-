import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// The UI and the .NET backend must share one origin: the login pages rely on the IDP session
// cookie, and OIDC redirects such as /login and /consent are relative. Locally this server
// proxies the backend paths below; in production the reverse proxy (nginx/IIS) does the same.
const BACKEND_PATHS = ['/api', '/connect', '/.well-known']

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')
  const backend = env.IDP_BACKEND_URL || 'http://localhost:5000'

  const proxy: Record<string, ProxyOptions> = Object.fromEntries(
    // xfwd adds X-Forwarded-* headers so the backend sees the public host (localhost:5173).
    BACKEND_PATHS.map((path) => [path, { target: backend, xfwd: true }]),
  )

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 5173, strictPort: true, proxy },
  }
})
