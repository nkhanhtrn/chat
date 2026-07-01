import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  root: 'reader',
  // In dev the app runs at /reader/; in production it ships under the main
  // app's gh-pages base (/chat/), so assets must resolve under /chat/reader/.
  base: mode === 'production' ? '/chat/reader/' : '/reader/',
  envDir: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      vue: 'vue/dist/vue.esm-bundler.js',
      // The reader is EPUB-only; pdfjs is pulled in transitively via the
      // shared books store's PDF preload path but is never used here.
      'pdfjs-dist': resolve(__dirname, 'reader/stubs/pdfjs.ts'),
    },
  },
  plugins: [vue()],
  server: {
    port: 3001,
    proxy: {
      // Same-origin proxy so the reader can download books from Firebase Storage
      // in dev without CORS issues (its port isn't in the bucket's CORS allowlist).
      '/fs-proxy': {
        target: 'https://firebasestorage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/fs-proxy/, ''),
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-reader'),
    emptyOutDir: true,
    target: 'es2015',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
}))
