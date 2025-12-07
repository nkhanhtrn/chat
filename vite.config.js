import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
    chunkSizeWarningLimit: 600
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
