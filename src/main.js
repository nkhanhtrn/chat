import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import './theme/colors-sepia.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'
import router from './router'
import { initializeTheme, applySettings, exposeGlobally, exposeEchartsGlobally } from './services/settings.js'
import { Settings } from './services/Settings.js'
// Firebase disabled - using local storage only
// import { initializeFirebase } from './services/firebase.js'

// Handle chunk loading failures (e.g., after deployment with new hashes)
// This catches dynamic import failures and forces a page reload
window.addEventListener('error', (event) => {
  if (event.message?.includes('dynamically imported module') ||
      event.message?.includes('Failed to fetch dynamically imported module')) {
    console.warn('Chunk loading failed, reloading page to get new assets...')
    // Prevent infinite reload loop by checking if we just reloaded
    const lastReload = sessionStorage.getItem('chunk-reload-time')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('chunk-reload-time', now.toString())
      window.location.reload()
    }
  }
})

// Also handle unhandled promise rejections (dynamic imports return promises)
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('dynamically imported module') ||
      event.reason?.message?.includes('Failed to fetch dynamically imported module')) {
    console.warn('Chunk loading failed (promise), reloading page to get new assets...')
    const lastReload = sessionStorage.getItem('chunk-reload-time')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('chunk-reload-time', now.toString())
      window.location.reload()
    }
  }
})

// Initialize theme from localStorage cache (or default to light)
initializeTheme()

// Expose theme functions globally for components to use
exposeGlobally()

// Make echarts available globally for tool components
exposeEchartsGlobally()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialize Firebase and load chat state asynchronously
const initializeApp = async () => {
  // Firebase disabled - using local storage only
  // try {
  //   initializeFirebase()
  //   console.log('Firebase initialized')
  // } catch (error) {
  //   console.warn('Firebase initialization failed (this is ok if not configured yet):', error)
  // }

  // Load user settings from localStorage
  try {
    const settings = Settings.getAll()
    applySettings(settings)
  } catch (error) {
    console.warn('Failed to load user settings:', error)
  }

  // Set up chat store and load saved state
  const chatStore = useChatStore(pinia)

  // Initialize store with saved state (from localStorage/IndexedDB)
  const result = await chatStore.initializeStore()

  // Expose conflict info globally for App.vue to handle (should not happen in local-only mode)
  if (result.hasConflict) {
    window.__syncConflict = {
      localData: result.localData,
      cloudData: result.cloudData
    }
  }

  // Set up automatic persistence for chat store
  chatStore.$subscribe(() => {
    chatStore._persistState()
  })

  // Mount the app
  app.mount('#app')

  // Fade out and remove loading screen
  const loadingEl = document.getElementById('app-loading')
  if (loadingEl) {
    loadingEl.style.opacity = '0'
    setTimeout(() => loadingEl.remove(), 300)
  }
}

// Start the app
initializeApp()
