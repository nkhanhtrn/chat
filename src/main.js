import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import './theme/colors-sepia.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'
import router from './router'
import { initializeTheme, applySettings, exposeGlobally } from './services/settings.js'
import { initializeFirebase } from './services/firebase.js'
import { loadUserSettings, subscribeToUserSettings, flushSettings } from './services/firestore.js'

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

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialize Firebase and load chat state asynchronously
const initializeApp = async () => {
  try {
    // Initialize Firebase (optional - will use default config)
    initializeFirebase()
    console.log('Firebase initialized')
  } catch (error) {
    console.warn('Firebase initialization failed (this is ok if not configured yet):', error)
  }

  // Load user settings from Firestore (initial load)
  try {
    const settings = await loadUserSettings()
    applySettings(settings)

    // Subscribe to real-time settings updates (replaces repeated reads)
    subscribeToUserSettings((updatedSettings) => {
      console.log('Settings updated from Firestore subscription')
      applySettings(updatedSettings)
    })

    // Flush pending settings on page unload
    window.addEventListener('beforeunload', () => {
      flushSettings()
    })

    // Initialize LLM provider
    const { initProvider } = await import('./services/llm/index.js')
    await initProvider()
  } catch (error) {
    console.warn('Failed to load user settings from Firestore:', error)
  }

  // Set up chat store and load saved state
  const chatStore = useChatStore(pinia)

  // Initialize store with saved state (from Firestore or localStorage)
  const result = await chatStore.initializeStore()

  // Expose conflict info globally for App.vue to handle
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
