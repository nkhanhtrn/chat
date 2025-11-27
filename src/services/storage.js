
// LocalStorage service for persisting chat data

const STORAGE_KEY_SIDEBAR = 'chat-sidebar-collapsed'
const STORAGE_KEY_CHAT_STATE = 'chat-state'

/**
 * Save sidebar collapsed state to localStorage
 */
export const saveSidebarState = (collapsed) => {
  try {
    localStorage.setItem(STORAGE_KEY_SIDEBAR, JSON.stringify(collapsed))
  } catch (error) {
    console.error('Failed to save sidebar state to localStorage:', error)
  }
}

/**
 * Load sidebar collapsed state from localStorage
 */
export const loadSidebarState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR)
    return saved ? JSON.parse(saved) : false
  } catch (error) {
    console.error('Failed to load sidebar state from localStorage:', error)
    return false
  }
}

/**
 * Save chat state (Pinia store) to localStorage
 */
export const saveChatState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY_CHAT_STATE, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save chat state to localStorage:', error)
  }
}

/**
 * Load chat state from localStorage
 */
export const loadChatState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CHAT_STATE)
    if (saved) {
      return JSON.parse(saved)
    }
    return null
  } catch (error) {
    console.error('Failed to load chat state from localStorage:', error)
    return null
  }
}

/**
 * Clear all localStorage data
 */
export const clearAllStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_SIDEBAR)
    localStorage.removeItem(STORAGE_KEY_CHAT_STATE)
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}
