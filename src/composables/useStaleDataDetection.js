import { ref, onMounted, onUnmounted } from 'vue'
import { ChatStorage } from '../services/ChatStorage.js'

// Inactivity timeout: 5 minutes
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Composable to detect when user has been inactive (cloud detection disabled)
 * @returns {{ showStaleDataBanner: Ref<boolean>, isReadOnlyMode: Ref<boolean>, refresh: Function, dismissBanner: Function }}
 */
export function useStaleDataDetection() {
  const showStaleDataBanner = ref(false)
  const isReadOnlyMode = ref(false)

  let inactivityTimer = null
  let lastActivityTime = Date.now()

  /**
   * Check if cloud data differs from local storage (disabled in local-only mode)
   */
  const hasCloudDifference = async () => {
    // Cloud sync disabled - no difference to check
    return false
  }

  /**
   * Start the inactivity timer
   */
  function startInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    inactivityTimer = setTimeout(async () => {
      // Check for cloud difference (will always return false in local-only mode)
      const hasDifference = await hasCloudDifference()

      if (hasDifference) {
        showStaleDataBanner.value = true
        ChatStorage.setReadOnlyMode(true)
        isReadOnlyMode.value = true
      }
    }, INACTIVITY_TIMEOUT_MS)
  }

  /**
   * Reset the inactivity timer on user activity
   */
  function resetInactivityTimer() {
    lastActivityTime = Date.now()
    startInactivityTimer()
  }

  /**
   * Refresh the data (dismiss banner and reload)
   */
  function refresh() {
    showStaleDataBanner.value = false
    ChatStorage.setReadOnlyMode(false)
    isReadOnlyMode.value = false
    window.location.reload()
  }

  /**
   * Dismiss the banner without refreshing
   */
  function dismissBanner() {
    showStaleDataBanner.value = false
    // Keep read-only mode enabled
  }

  /**
   * Handle user activity
   */
  function handleActivity() {
    if (!showStaleDataBanner.value) {
      resetInactivityTimer()
    }
  }

  onMounted(() => {
    // Set up activity listeners
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)

    // Start the inactivity timer
    startInactivityTimer()
  })

  onUnmounted(() => {
    // Clean up activity listeners
    window.removeEventListener('mousemove', handleActivity)
    window.removeEventListener('keydown', handleActivity)
    window.removeEventListener('click', handleActivity)
    window.removeEventListener('scroll', handleActivity)

    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }
  })

  return {
    showStaleDataBanner,
    isReadOnlyMode,
    refresh,
    dismissBanner
  }
}
