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

// Set up automatic persistence for chat store
const chatStore = useChatStore(pinia)
chatStore.$subscribe(() => {
  chatStore._persistState()
})

app.mount('#app')
