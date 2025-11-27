// LocalStorage service for persisting chat data

const STORAGE_KEY_CHATS = 'chat-chats'
const STORAGE_KEY_ACTIVE = 'chat-active'
const STORAGE_KEY_MODEL = 'chat-model'
const STORAGE_KEY_COUNTER = 'chat-counter'
const STORAGE_KEY_API_CONFIG = 'chat-api-config'
const STORAGE_KEY_WEBSITE_CONTEXT = 'chat-website-context'
const STORAGE_KEY_SIDEBAR = 'chat-sidebar-collapsed'

/**
 * Save chat data to localStorage
 */
export const saveChats = (chats) => {
  try {
    localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats))
  } catch (error) {
    console.error('Failed to save chats to localStorage:', error)
    throw error
  }
}

/**
 * Load chat data from localStorage
 */
export const loadChats = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CHATS)
    if (saved) {
      const parsedChats = JSON.parse(saved)
      // Clean up and ensure all messages have required properties
      return parsedChats.map(chat => ({
        ...chat,
        messages: chat.messages
          .filter(msg => !msg.loading) // Remove any stale loading messages
          .map(msg => ({
            ...msg,
            displayContent: msg.displayContent || msg.content,
            thinking: msg.thinking || null,
            showThinking: msg.showThinking || false
          }))
      }))
    }
    return null
  } catch (error) {
    console.error('Failed to load chats from localStorage:', error)
    return null
  }
}

/**
 * Save active chat ID to localStorage
 */
export const saveActiveChat = (chatId) => {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE, chatId)
  } catch (error) {
    console.error('Failed to save active chat to localStorage:', error)
    throw error
  }
}

/**
 * Load active chat ID from localStorage
 */
export const loadActiveChat = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE)
    return saved ? parseInt(saved) : null
  } catch (error) {
    console.error('Failed to load active chat from localStorage:', error)
    return null
  }
}

/**
 * Save selected model to localStorage
 */
export const saveSelectedModel = (model) => {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model)
  } catch (error) {
    console.error('Failed to save selected model to localStorage:', error)
    throw error
  }
}

/**
 * Load selected model from localStorage
 */
export const loadSelectedModel = () => {
  try {
    return localStorage.getItem(STORAGE_KEY_MODEL)
  } catch (error) {
    console.error('Failed to load selected model from localStorage:', error)
    return null
  }
}

/**
 * Save chat counter to localStorage
 */
export const saveChatCounter = (counter) => {
  try {
    localStorage.setItem(STORAGE_KEY_COUNTER, counter)
  } catch (error) {
    console.error('Failed to save chat counter to localStorage:', error)
    throw error
  }
}

/**
 * Load chat counter from localStorage
 */
export const loadChatCounter = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COUNTER)
    return saved ? parseInt(saved) : 1
  } catch (error) {
    console.error('Failed to load chat counter from localStorage:', error)
    return 1
  }
}

/**
 * Save API configuration to localStorage
 */
export const saveApiConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY_API_CONFIG, JSON.stringify(config))
  } catch (error) {
    console.error('Failed to save API config to localStorage:', error)
    throw error
  }
}

/**
 * Load API configuration from localStorage
 */
export const loadApiConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_API_CONFIG)
    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.error('Failed to load API config from localStorage:', error)
    return null
  }
}

/**
 * Save all data at once (for batch operations)
 */
export const saveAllData = (data) => {
  try {
    if (data.chats !== undefined) saveChats(data.chats)
    if (data.activeChat !== undefined) saveActiveChat(data.activeChat)
    if (data.selectedModel !== undefined) saveSelectedModel(data.selectedModel)
    if (data.chatCounter !== undefined) saveChatCounter(data.chatCounter)
  } catch (error) {
    console.error('Failed to save data to localStorage:', error)
    throw error
  }
}

/**
 * Save website context to localStorage
 */
export const saveWebsiteContext = (chatId, websiteData) => {
  try {
    const allContexts = loadAllWebsiteContexts() || {}
    allContexts[chatId] = websiteData
    localStorage.setItem(STORAGE_KEY_WEBSITE_CONTEXT, JSON.stringify(allContexts))
  } catch (error) {
    console.error('Failed to save website context to localStorage:', error)
  }
}

/**
 * Load website context for a specific chat from localStorage
 */
export const loadWebsiteContext = (chatId) => {
  try {
    const allContexts = loadAllWebsiteContexts()
    return allContexts?.[chatId] || null
  } catch (error) {
    console.error('Failed to load website context from localStorage:', error)
    return null
  }
}

/**
 * Load all website contexts from localStorage
 */
export const loadAllWebsiteContexts = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEBSITE_CONTEXT)
    return saved ? JSON.parse(saved) : {}
  } catch (error) {
    console.error('Failed to load website contexts from localStorage:', error)
    return {}
  }
}

/**
 * Delete website context for a specific chat
 */
export const deleteWebsiteContext = (chatId) => {
  try {
    const allContexts = loadAllWebsiteContexts()
    delete allContexts[chatId]
    localStorage.setItem(STORAGE_KEY_WEBSITE_CONTEXT, JSON.stringify(allContexts))
  } catch (error) {
    console.error('Failed to delete website context from localStorage:', error)
  }
}

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
 * Load all data at once
 */
export const loadAllData = () => {
  return {
    chats: loadChats(),
    activeChat: loadActiveChat(),
    selectedModel: loadSelectedModel(),
    chatCounter: loadChatCounter(),
    apiConfig: loadApiConfig(),
    sidebarCollapsed: loadSidebarState()
  }
}
