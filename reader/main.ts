import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/theme/colors-light.css'
import '@/theme/colors-dark.css'
import '@/theme/colors-sepia.css'
import './reader.css'
import { initializeFirebase, getFirebaseAuth } from '@/services/firebase'
import { useBooksStore } from '@/stores/books'
import App from './App.vue'
import router from './router'

const handleChunkError = (message: string | undefined) => {
  if (
    message?.includes('dynamically imported module') ||
    message?.includes('Failed to fetch dynamically imported module')
  ) {
    const lastReload = sessionStorage.getItem('chunk-reload-time')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('chunk-reload-time', now.toString())
      window.location.reload()
    }
  }
}

window.addEventListener('error', (event) => handleChunkError(event.message))
window.addEventListener('unhandledrejection', (event) => {
  const message = (event.reason as Error)?.message
  if (message) handleChunkError(message)
})

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

async function bootstrap(): Promise<void> {
  let auth: ReturnType<typeof getFirebaseAuth> | undefined
  try {
    ({ auth } = initializeFirebase())
  } catch (err) {
    console.warn('[Reader] Firebase init failed:', err)
  }

  await new Promise<void>((resolve) => {
    const current = auth?.currentUser
    if (current || !auth) {
      resolve()
      return
    }
    const unsubscribe = auth.onAuthStateChanged(() => {
      unsubscribe?.()
      resolve()
    })
  })

  try {
    await useBooksStore(pinia).initializeStore()
  } catch (err) {
    console.warn('[Reader] Books store init failed:', err)
  }

  app.mount('#app')

  const loadingEl = document.getElementById('app-loading')
  if (loadingEl) {
    loadingEl.style.opacity = '0'
    setTimeout(() => loadingEl.remove(), 300)
  }
}

bootstrap()
