import { ref, watch, onMounted } from 'vue'

/**
 * Composable for managing sidebar collapse state with localStorage persistence
 * @param {string} storageKey - localStorage key for persisting collapse state
 * @returns {Object} - { isCollapsed, toggle }
 */
export function useSidebarCollapse(storageKey = 'chatSidebarCollapsed') {
  const isCollapsed = ref(false)

  onMounted(() => {
    const savedState = localStorage.getItem(storageKey)
    if (savedState !== null) {
      isCollapsed.value = savedState === 'true'
    }
  })

  watch(isCollapsed, (newValue) => {
    localStorage.setItem(storageKey, String(newValue))
  })

  const toggle = () => {
    isCollapsed.value = !isCollapsed.value
  }

  return {
    isCollapsed,
    toggle
  }
}
