import { debugLog } from '../utils/debug.js'
import { ref, watch, onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = 768

/**
 * Composable for managing sidebar collapse state with localStorage persistence
 * @param {string} storageKey - localStorage key for persisting collapse state
 * @returns {Object} - { isCollapsed, toggle, collapse }
 */
export function useSidebarCollapse(storageKey = 'chatSidebarCollapsed') {
  const isCollapsed = ref(false)

  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT

  const handleResize = () => {
    // On mobile, always default to collapsed
    if (isMobile() && !isCollapsed.value) {
      isCollapsed.value = true
    }
  }

  onMounted(() => {
    // On mobile, always start collapsed regardless of saved state
    if (isMobile()) {
      isCollapsed.value = true
    } else {
      const savedState = localStorage.getItem(storageKey)
      debugLog('[useSidebarCollapse.onMounted] Reading from localStorage:', storageKey, savedState)
      if (savedState !== null) {
        isCollapsed.value = savedState === 'true'
      }
    }

    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  // Only persist state on desktop
  watch(isCollapsed, (newValue) => {
    if (!isMobile()) {
      debugLog('[useSidebarCollapse.isCollapsed] Writing to localStorage:', storageKey, String(newValue))
      localStorage.setItem(storageKey, String(newValue))
    }
  })

  const toggle = () => {
    isCollapsed.value = !isCollapsed.value
  }

  const collapse = () => {
    isCollapsed.value = true
  }

  return {
    isCollapsed,
    toggle,
    collapse
  }
}
