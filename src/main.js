import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import './theme/colors-sepia.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'
import router from './router'

// Current theme state (will be updated from Firestore)
let currentTheme = 'light'

// Theme switching via data attribute
const setTheme = (theme) => {
  currentTheme = theme
  document.documentElement.setAttribute('data-theme', theme)
}

// Start with light theme, will be updated after Firestore loads
setTheme('light')

// Expose theme functions globally for components to use
window.__setTheme = setTheme
window.__getTheme = () => currentTheme

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialize Firebase and load chat state asynchronously
const initializeApp = async () => {
  try {
    // Initialize Firebase (optional - will use default config)
    const { initializeFirebase } = await import('./services/firebase.js')
    initializeFirebase()
    console.log('Firebase initialized')
  } catch (error) {
    console.warn('Firebase initialization failed (this is ok if not configured yet):', error)
  }

  // Load user settings from Firestore
  try {
    const { loadUserSettings } = await import('./services/firestore.js')
    const settings = await loadUserSettings()

    if (settings) {
      // Apply theme
      if (settings.theme) {
        setTheme(settings.theme)
      }

      // Apply font size
      if (settings.fontSize) {
        document.documentElement.style.setProperty('--message-font-size', `${settings.fontSize}px`)
      }

      // Apply font family
      if (settings.fontFamily) {
        document.documentElement.style.setProperty('--message-font-family', settings.fontFamily)
      }

      // Apply line height
      if (settings.lineHeight) {
        document.documentElement.style.setProperty('--message-line-height', settings.lineHeight.toString())
      }

      // Apply content width
      if (settings.contentWidth) {
        const widthMap = { narrow: '600px', medium: '800px', wide: '1000px' }
        document.documentElement.style.setProperty('--content-max-width', widthMap[settings.contentWidth] || '800px')
      }

      console.log('User settings loaded from Firestore')
    }

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

  // Mount the app after initialization
  app.mount('#app')
}

// Start the app
initializeApp()
