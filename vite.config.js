import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js'
    }
  },
  plugins: [
    vue(),
    VitePWA({
      devOptions: {
        enabled: true
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'studyGPT',
        short_name: 'studyGPT',
        description: 'AI-powered study assistant',
        theme_color: '#4a90a4',
        background_color: '#fafafa',
        display: 'standalone',
        scope: '/chat/',
        start_url: '/chat/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: '/chat/',
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vue core and ecosystem
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // Math rendering library
          'katex': ['katex'],
          // Markdown parsing
          'markdown': ['markdown-it', 'marked'],
          // Firebase (large bundle)
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    },
    chunkSizeWarningLimit: 1500
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        'src/**/__tests__/**',
        '**/*.test.js',
        '**/*.config.js',
        '**/dist/**'
      ],
      include: [
        'src/**/*.{js,vue}'
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
})
