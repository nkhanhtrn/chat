
// LocalStorage service for persisting chat data

const STORAGE_KEY_CHAT_STATE = 'chat-state'

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
    localStorage.removeItem(STORAGE_KEY_CHAT_STATE)
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}
