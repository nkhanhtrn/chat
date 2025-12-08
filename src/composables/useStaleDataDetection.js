import { ref, onMounted, onUnmounted } from 'vue'
import { setReadOnlyMode as setStorageReadOnlyMode } from '../services/storage.js'
import { loadChatStateFromFirestore } from '../services/firestore.js'

// Inactivity timeout: 5 minutes
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000

// Storage key for chat state
const STORAGE_KEY_CHAT_STATE = 'chat-state'

/**
 * Composable to detect when user has been inactive and cloud data differs from local
 * @returns {{ showStaleDataBanner: Ref<boolean>, isReadOnlyMode: Ref<boolean>, refresh: Function, dismissBanner: Function }}
 */
export function useStaleDataDetection() {
  const showStaleDataBanner = ref(false)
  const isReadOnlyMode = ref(false)

  let inactivityTimer = null
  let lastActivityTime = Date.now()

  /**
   * Check if cloud data differs from local storage
   */
  const hasCloudDifference = async () => {
    try {
      const cloudState = await loadChatStateFromFirestore()
      if (!cloudState) {
        // No cloud data, no difference
        return false
      }

      const localData = localStorage.getItem(STORAGE_KEY_CHAT_STATE)
      if (!localData) {
        // No local data but cloud has data = difference
        return true
      }

      const localState = JSON.parse(localData)

      // Compare meaningful data differences
      return hasDataDifference(localState, cloudState)
    } catch (error) {
      console.error('Failed to check cloud difference:', error)
      return false
    }
  }

  /**
   * Check if two states have meaningful data differences
   */
  const hasDataDifference = (state1, state2) => {
    if (!state1 || !state2) return false

    // Compare number of chats
    const chats1 = state1.chats?.length || 0
    const chats2 = state2.chats?.length || 0
    if (chats1 !== chats2) return true

    // Compare number of messages
    const messages1 = Object.keys(state1.messagesById || {}).length
    const messages2 = Object.keys(state2.messagesById || {}).length
    if (messages1 !== messages2) return true

    // Compare message IDs
    const ids1 = Object.keys(state1.messagesById || {}).sort().join(',')
    const ids2 = Object.keys(state2.messagesById || {}).sort().join(',')
    if (ids1 !== ids2) return true

    // Compare lastUpdated timestamps if available (cloud has newer data)
    if (state2.lastUpdated && state1.lastUpdated) {
      // Cloud timestamp is a Firestore timestamp object or number
      const cloudTime = state2.lastUpdated?.seconds
        ? state2.lastUpdated.seconds * 1000
        : state2.lastUpdated
      const localTime = state1.lastUpdated

      // If cloud is significantly newer (more than 5 seconds), consider it different
      if (cloudTime > localTime + 5000) {
        return true
      }
    }

    return false
  }

  /**
   * Handle inactivity timeout
   */
  const onInactivityTimeout = async () => {
    const hasDifference = await hasCloudDifference()

    if (hasDifference) {
      showStaleDataBanner.value = true
      // Immediately enable read-only mode while waiting for user to refresh
      enableReadOnlyMode()
    }
  }

  /**
   * Enable read-only mode (syncs with storage service)
   */
  const enableReadOnlyMode = () => {
    isReadOnlyMode.value = true
    setStorageReadOnlyMode(true)
  }

  /**
   * Reset the inactivity timer
   */
  const resetInactivityTimer = () => {
    lastActivityTime = Date.now()

    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_TIMEOUT_MS)
  }

  /**
   * Handle user activity events
   */
  const onUserActivity = () => {
    // Only reset if we're not already showing the banner
    if (!showStaleDataBanner.value) {
      resetInactivityTimer()
    }
  }

  /**
   * Handle visibility change (tab becoming visible again)
   */
  const onVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      // Check how long the page was inactive
      const inactiveTime = Date.now() - lastActivityTime

      if (inactiveTime >= INACTIVITY_TIMEOUT_MS) {
        await onInactivityTimeout()
      } else {
        // Reset timer with remaining time
        resetInactivityTimer()
      }
    } else {
      // Page became hidden, stop the timer (we'll check on return)
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
    }
  }

  /**
   * Refresh the page
   */
  const refresh = () => {
    window.location.reload()
  }

  /**
   * Dismiss the banner (but stay in read-only mode)
   */
  const dismissBanner = () => {
    showStaleDataBanner.value = false
    // Immediately enable read-only mode when dismissing without refresh
    enableReadOnlyMode()
  }

  // Activity events to track
  const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']

  onMounted(() => {
    // Start inactivity timer
    resetInactivityTimer()

    // Listen for user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, onUserActivity, { passive: true })
    })

    // Listen for visibility changes
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    // Cleanup timer
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    // Remove event listeners
    activityEvents.forEach(event => {
      document.removeEventListener(event, onUserActivity)
    })
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  /**
   * Manually trigger the stale data banner (for dev/testing)
   */
  const triggerBanner = () => {
    showStaleDataBanner.value = true
    // Immediately enable read-only mode
    enableReadOnlyMode()
  }

  return {
    showStaleDataBanner,
    isReadOnlyMode,
    refresh,
    dismissBanner,
    triggerBanner
  }
}
