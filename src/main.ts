import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme/colors-light.css'
import './theme/colors-dark.css'
import './theme/colors-sepia.css'
import { createPinia } from 'pinia'
import router from './router'
import { Settings, initializeTheme, applySettings, exposeGlobally, exposeEchartsGlobally } from './services/settings'
import { initializeFirebase, getFirebaseAuth } from './services/firebase'
import { useNotebookStore } from './stores/notebook'
import { useMessageTreeStore } from './stores/messageTree'
import { useVocabStore } from './stores/vocab'
import { useStreamingStore } from './stores/streaming'
import { useSyncStore } from './stores/sync'
import { useBooksStore } from './stores/books'
import { debugLog } from './utils/debug'

// Handle chunk loading failures
const handleChunkError = (message: string | undefined) => {
  if (message?.includes('dynamically imported module') ||
      message?.includes('Failed to fetch dynamically imported module')) {
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

// Initialize theme from localStorage cache
initializeTheme()
exposeGlobally()
exposeEchartsGlobally()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const initializeApp = async () => {
  // Initialize Firebase
  let auth: ReturnType<typeof getFirebaseAuth> | undefined
  try {
    ({ auth } = initializeFirebase())
    debugLog('[App] Firebase initialized')
  } catch (error) {
    console.warn('Firebase initialization failed:', error)
  }

  // Set up auth state listener
  const onAuthStateReady = () => {
    Settings.initialize().then(() => {
      const settings = Settings.getAll()
      applySettings(settings)
      debugLog('[App] Settings applied')
    }).catch((error: unknown) => {
      console.warn('Failed to load user settings:', error)
    })
  }

  const currentUser = auth?.currentUser
  if (currentUser) {
    onAuthStateReady()
  } else {
    const unsubscribe = auth?.onAuthStateChanged((user) => {
      if (user) {
        unsubscribe?.()
        onAuthStateReady()
      }
    })
  }

  // Wait for Firebase auth state to resolve before initializing stores
  await new Promise<void>((resolve) => {
    const currentUser = auth?.currentUser
    if (currentUser) {
      resolve()
    } else {
      const unsubscribe = auth?.onAuthStateChanged(() => {
        unsubscribe?.()
        resolve()
      })
      if (!auth) resolve()
    }
  })

  // Initialize stores before mounting
  const notebookStore = useNotebookStore(pinia)
  const treeStore = useMessageTreeStore(pinia)
  const vocabStore = useVocabStore(pinia)
  const streamingStore = useStreamingStore(pinia)
  const syncStore = useSyncStore(pinia)
  const booksStore = useBooksStore(pinia)

  if (import.meta.env.DEV) {
    ;(window as any).notebookStore = notebookStore
    ;(window as any).treeStore = treeStore
    ;(window as any).vocabStore = vocabStore
    ;(window as any).streamingStore = streamingStore
    ;(window as any).syncStore = syncStore
    ;(window as any).booksStore = booksStore
  }

  // Initialize notebook store (syncs chat list from IndexedDB/cloud)
  const initResult = await notebookStore.initializeStore()

  // Initialize books store
  await booksStore.initializeStore()

  // Subscribe to notebook store for persistence
  notebookStore.$subscribe(async () => {
    if (syncStore._isLoadingFromStorage) return
    try {
      await syncStore.persistChatList()
      syncStore.scheduleFirestoreSync()
    } catch (error) {
      console.error('[Main] Notebook persistence failed:', error)
    }
  })

  // Subscribe to message tree store for persistence
  treeStore.$subscribe(async () => {
    if (syncStore._isLoadingFromStorage) return
    try {
      await syncStore.persistChatMessages()
      syncStore.scheduleFirestoreSync()
    } catch (error) {
      console.error('[Main] Message persistence failed:', error)
    }
  })

  // Subscribe to vocab store for persistence
  vocabStore.$subscribe(async () => {
    if (syncStore._isLoadingFromStorage) return
    try {
      await syncStore.persistChatList()
      await syncStore.syncToFirestore({ events: {} }, {})
    } catch (error) {
      console.error('[Main] Vocab persistence failed:', error)
    }
  })

  // Initialize studio sync (load from cloud + auto-save)
  try {
    const { useProjectStore } = await import('./stores/project')
    const { useGlobalToolStore } = await import('./stores/globalTool')
    useProjectStore(pinia).initSync()
    useGlobalToolStore(pinia).initSync()
    debugLog('[App] Studio sync initialized')
  } catch (error) {
    console.warn('Studio sync initialization failed:', error)
  }

  // Mount app AFTER all initialization is complete
  app.mount('#app')

  const loadingEl = document.getElementById('app-loading')
  if (loadingEl) {
    loadingEl.style.opacity = '0'
    setTimeout(() => loadingEl.remove(), 300)
  }
}

initializeApp()
