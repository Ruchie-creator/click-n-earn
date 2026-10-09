import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiUrl = env.VITE_API_URL?.trim()
  const isLoopback = /^(?:https?:\/\/)?(?:localhost|(?:[a-z0-9-]+\.)*localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i.test(apiUrl || '')

  if (mode === 'production' && isLoopback) {
    throw new Error('VITE_API_URL must not point to localhost or a loopback address in a production build. Set it to the production API URL or the same-origin /api route.')
  }

  const isSameOriginPath = Boolean(apiUrl?.startsWith('/') && !apiUrl.startsWith('//'))
  if (mode === 'production' && apiUrl && !isSameOriginPath) {
    const target = /^https:\/\/([^/:?#]+)(?::(\d+))?(?:[/?#]|$)/i.exec(apiUrl)
    if (!target || target[1].includes('@')) {
      throw new Error('VITE_API_URL must be a same-origin path such as /api or a complete HTTPS URL in a production build.')
    }

    const host = target[1].toLowerCase()
    const localHost = host.endsWith('.local')
      || host.endsWith('.test')
      || host.endsWith('.internal')
      || /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
    if (localHost || ['5173', '8000', '8001'].includes(target[2] || '')) {
      throw new Error('VITE_API_URL must use same-origin /api or a public HTTPS API URL without a local development host or port.')
    }
  }

  return {
    plugins: [react()],
  }
})
