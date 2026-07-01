import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  root: 'reader',
  base: mode === 'production' ? '/chat/reader/' : '/reader/',
  envDir: resolve(__dirname),
  server: {
    port: 3001,
    proxy: {
      '/fs-proxy': {
        target: 'https://firebasestorage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/fs-proxy/, ''),
      },
    },
  },
}))
