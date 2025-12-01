import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import './theme/colors-sepia.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'
import router from './router'

// Theme switching via data attribute
const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

// Load saved theme or default to light
const savedTheme = localStorage.getItem('theme') || 'light'
setTheme(savedTheme)

// Load saved font size or use default
const savedFontSize = localStorage.getItem('messageFontSize')
if (savedFontSize) {
  document.documentElement.style.setProperty('--message-font-size', `${savedFontSize}px`)
}

// Load saved font family or use default
const savedFontFamily = localStorage.getItem('messageFontFamily')
if (savedFontFamily) {
  document.documentElement.style.setProperty('--message-font-family', savedFontFamily)
}

// Expose theme functions globally for components to use
window.__setTheme = setTheme
window.__getTheme = () => localStorage.getItem('theme') || 'light'

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
