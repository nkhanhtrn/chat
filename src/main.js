import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { createPinia } from 'pinia'
import { useChatStore } from './stores/chat.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Set up automatic persistence for chat store
const chatStore = useChatStore(pinia)
chatStore.$subscribe(() => {
  chatStore._persistState()
})

app.mount('#app')
