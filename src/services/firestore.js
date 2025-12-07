// Firestore service for syncing chat data
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseDb, getFirebaseAuth } from './firebase.js'

/**
 * Wait for Firebase Auth to be ready and return the current user
 * @returns {Promise<User|null>}
 */
const waitForAuth = () => {
  return new Promise((resolve) => {
    const auth = getFirebaseAuth()
    // If already authenticated, return immediately
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }
    // Otherwise wait for auth state to be determined
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

/**
 * Save chat state to Firestore
 * @param {Object} state - The chat state to save
 * @returns {Promise<void>}
 */
export const syncChatStateToFirestore = async (state) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping Firestore sync')
      return
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    await setDoc(userDocRef, {
      ...state,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log('Chat state synced to Firestore')
  } catch (error) {
    console.error('Failed to sync chat state to Firestore:', error)
    throw error
  }
}

/**
 * Load chat state from Firestore
 * @returns {Promise<Object|null>}
 */
export const loadChatStateFromFirestore = async () => {
  try {
    // Wait for Firebase Auth to restore session before checking user
    const user = await waitForAuth()

    if (!user) {
      console.warn('No authenticated user, cannot load from Firestore')
      return null
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')
    const docSnap = await getDoc(userDocRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      // Remove Firestore metadata
      delete data.lastUpdated
      console.log('Chat state loaded from Firestore')
      return data
    }

    return null
  } catch (error) {
    console.error('Failed to load chat state from Firestore:', error)
    return null
  }
}

/**
 * Subscribe to real-time chat state updates from Firestore
 * @param {Function} callback - Function to call when state updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToChatState = (callback) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot subscribe to Firestore')
      return () => {}
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        delete data.lastUpdated
        callback(data)
      }
    }, (error) => {
      console.error('Error in Firestore subscription:', error)
    })

    console.log('Subscribed to Firestore chat state updates')
    return unsubscribe
  } catch (error) {
    console.error('Failed to subscribe to Firestore:', error)
    return () => {}
  }
}

/**
 * Delete chat state from Firestore
 * @returns {Promise<void>}
 */
export const deleteChatStateFromFirestore = async () => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot delete from Firestore')
      return
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    await setDoc(userDocRef, {})
    console.log('Chat state deleted from Firestore')
  } catch (error) {
    console.error('Failed to delete chat state from Firestore:', error)
    throw error
  }
}

// ============================================
// User Settings (Theme & LLM Provider)
// ============================================

const SETTINGS_STORAGE_KEY = 'user-settings'

/**
 * Save settings to localStorage (fallback when not authenticated)
 * @param {Object} settings - The settings to save
 */
const saveSettingsToLocalStorage = (settings) => {
  try {
    const existing = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')
    const merged = { ...existing, ...settings }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error)
  }
}

/**
 * Load settings from localStorage (fallback when not authenticated)
 * @returns {Object|null}
 */
const loadSettingsFromLocalStorage = () => {
  try {
    const data = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error)
    return null
  }
}

/**
 * Save user settings to Firestore (or localStorage if not authenticated)
 * @param {Object} settings - The settings to save
 * @returns {Promise<void>}
 */
export const saveUserSettings = async (settings) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      // Fall back to localStorage when not authenticated
      saveSettingsToLocalStorage(settings)
      console.log('User settings saved to localStorage (not authenticated)')
      return
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')

    await setDoc(settingsDocRef, {
      ...settings,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log('User settings synced to Firestore')
  } catch (error) {
    // Fall back to localStorage on Firestore error
    saveSettingsToLocalStorage(settings)
    console.warn('Failed to sync to Firestore, saved to localStorage:', error)
  }
}

/**
 * Load user settings from Firestore (or localStorage if not authenticated)
 * @returns {Promise<Object|null>}
 */
export const loadUserSettings = async () => {
  try {
    const user = await waitForAuth()

    if (!user) {
      // Fall back to localStorage when not authenticated
      const localSettings = loadSettingsFromLocalStorage()
      if (localSettings) {
        console.log('User settings loaded from localStorage (not authenticated)')
      }
      return localSettings
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')
    const docSnap = await getDoc(settingsDocRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      delete data.lastUpdated
      console.log('User settings loaded from Firestore')
      return data
    }

    // If no Firestore settings, check localStorage (might have settings from before login)
    const localSettings = loadSettingsFromLocalStorage()
    if (localSettings) {
      console.log('User settings loaded from localStorage (no Firestore data)')
    }
    return localSettings
  } catch (error) {
    console.error('Failed to load settings from Firestore:', error)
    // Fall back to localStorage on error
    return loadSettingsFromLocalStorage()
  }
}

/**
 * Subscribe to real-time user settings updates from Firestore
 * @param {Function} callback - Function to call when settings update
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserSettings = (callback) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot subscribe to settings')
      return () => {}
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')

    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        delete data.lastUpdated
        callback(data)
      }
    }, (error) => {
      console.error('Error in settings subscription:', error)
    })

    console.log('Subscribed to Firestore user settings updates')
    return unsubscribe
  } catch (error) {
    console.error('Failed to subscribe to user settings:', error)
    return () => {}
  }
}

/**
 * Migrate settings from localStorage to Firestore after user logs in
 * @returns {Promise<void>}
 */
export const migrateSettingsToFirestore = async () => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const localSettings = loadSettingsFromLocalStorage()
    if (!localSettings) return

    // Check if user already has Firestore settings
    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')
    const docSnap = await getDoc(settingsDocRef)

    if (!docSnap.exists()) {
      // Migrate localStorage settings to Firestore
      await setDoc(settingsDocRef, {
        ...localSettings,
        lastUpdated: serverTimestamp()
      })
      console.log('Migrated settings from localStorage to Firestore')
    }
  } catch (error) {
    console.error('Failed to migrate settings to Firestore:', error)
  }
}
