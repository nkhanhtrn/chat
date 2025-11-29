import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'

// Theme switching via data attribute
const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

// Load saved theme or default to light
const savedTheme = localStorage.getItem('theme') || 'light'
setTheme(savedTheme)

// Expose theme functions globally for components to use
window.__setTheme = setTheme
window.__getTheme = () => localStorage.getItem('theme') || 'light'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Set up automatic persistence for chat store
const chatStore = useChatStore(pinia)
chatStore.$subscribe(() => {
  chatStore._persistState()
})

app.mount('#app')
