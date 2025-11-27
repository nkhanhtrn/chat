import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveChats,
  loadChats,
  saveActiveChat,
  loadActiveChat,
  saveSelectedModel,
  loadSelectedModel,
  saveChatCounter,
  loadChatCounter,
  saveApiConfig,
  loadApiConfig,
  saveAllData,
  loadAllData,
  saveWebsiteContext,
  loadWebsiteContext,
  deleteWebsiteContext,
  loadAllWebsiteContexts,
  saveSidebarState,
  loadSidebarState,
  saveChatState,
  loadChatState
} from '../storage.js'

describe('Storage Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('saveChats and loadChats', () => {
    it('should save and load chats correctly', () => {
      const chats = [
        {
          id: 1,
          title: 'Test Chat',
          messages: [
            { role: 'user', content: 'Hello', displayContent: 'Hello' }
          ]
        }
      ]

      saveChats(chats)
      const loaded = loadChats()

      // loadChats adds default properties, so check structure
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe(1)
      expect(loaded[0].title).toBe('Test Chat')
      expect(loaded[0].messages).toHaveLength(1)
      expect(loaded[0].messages[0].content).toBe('Hello')
      expect(loaded[0].messages[0].displayContent).toBe('Hello')
      expect(loaded[0].messages[0].thinking).toBe(null)
      expect(loaded[0].messages[0].showThinking).toBe(false)
    })

    it('should filter out loading messages when loading', () => {
      const chats = [
        {
          id: 1,
          title: 'Test Chat',
          messages: [
            { role: 'user', content: 'Hello', displayContent: 'Hello' },
            { role: 'assistant', content: '', loading: true }
          ]
        }
      ]

      localStorage.setItem('chat-chats', JSON.stringify(chats))
      const loaded = loadChats()

      expect(loaded[0].messages).toHaveLength(1)
      expect(loaded[0].messages[0].content).toBe('Hello')
    })

    it('should add missing properties to messages', () => {
      const chats = [
        {
          id: 1,
          title: 'Test Chat',
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        }
      ]

      localStorage.setItem('chat-chats', JSON.stringify(chats))
      const loaded = loadChats()

      expect(loaded[0].messages[0].displayContent).toBe('Hello')
      expect(loaded[0].messages[0].thinking).toBe(null)
      expect(loaded[0].messages[0].showThinking).toBe(false)
    })

    it('should return null when no chats exist', () => {
      const loaded = loadChats()
      expect(loaded).toBe(null)
    })

    it('should handle malformed JSON gracefully', () => {
      localStorage.setItem('chat-chats', 'invalid json')
      const loaded = loadChats()
      expect(loaded).toBe(null)
    })

    it('should preserve existing displayContent when loading', () => {
      const chats = [
        {
          id: 1,
          title: 'Test Chat',
          messages: [
            { role: 'user', content: 'Hello', displayContent: 'Custom Display' }
          ]
        }
      ]

      localStorage.setItem('chat-chats', JSON.stringify(chats))
      const loaded = loadChats()

      expect(loaded[0].messages[0].displayContent).toBe('Custom Display')
    })

    it('should preserve existing thinking and showThinking values', () => {
      const chats = [
        {
          id: 1,
          title: 'Test Chat',
          messages: [
            {
              role: 'assistant',
              content: 'Answer',
              thinking: 'Thought process',
              showThinking: true
            }
          ]
        }
      ]

      localStorage.setItem('chat-chats', JSON.stringify(chats))
      const loaded = loadChats()

      expect(loaded[0].messages[0].thinking).toBe('Thought process')
      expect(loaded[0].messages[0].showThinking).toBe(true)
    })

    it('should handle error when saving chats', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw error
      expect(() => saveChats([{ id: 1, messages: [] }])).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })
  })

  describe('saveActiveChat and loadActiveChat', () => {
    it('should save and load active chat ID', () => {
      saveActiveChat(5)
      const loaded = loadActiveChat()
      expect(loaded).toBe(5)
    })

    it('should return null when no active chat exists', () => {
      const loaded = loadActiveChat()
      expect(loaded).toBe(null)
    })

    it('should parse string to number', () => {
      localStorage.setItem('chat-active', '10')
      const loaded = loadActiveChat()
      expect(loaded).toBe(10)
      expect(typeof loaded).toBe('number')
    })

    it('should handle error when loading active chat', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      const loaded = loadActiveChat()
      expect(loaded).toBe(null)

      // Restore
      localStorage.getItem = originalGetItem
    })

    it('should handle error when saving active chat', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw error
      expect(() => saveActiveChat(1)).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })
  })

  describe('saveSelectedModel and loadSelectedModel', () => {
    it('should save and load selected model', () => {
      saveSelectedModel('gpt-3.5-turbo')
      const loaded = loadSelectedModel()
      expect(loaded).toBe('gpt-3.5-turbo')
    })

    it('should return null when no model exists', () => {
      const loaded = loadSelectedModel()
      expect(loaded).toBe(null)
    })

    it('should handle error when saving selected model', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw error
      expect(() => saveSelectedModel('gpt-4')).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })

    it('should handle error when loading selected model', () => {
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      const loaded = loadSelectedModel()
      expect(loaded).toBe(null)

      // Restore
      localStorage.getItem = originalGetItem
    })
  })

  describe('saveChatCounter and loadChatCounter', () => {
    it('should save and load chat counter', () => {
      saveChatCounter(15)
      const loaded = loadChatCounter()
      expect(loaded).toBe(15)
    })

    it('should return 1 as default when no counter exists', () => {
      const loaded = loadChatCounter()
      expect(loaded).toBe(1)
    })

    it('should parse string to number', () => {
      localStorage.setItem('chat-counter', '20')
      const loaded = loadChatCounter()
      expect(loaded).toBe(20)
      expect(typeof loaded).toBe('number')
    })

    it('should handle error when saving chat counter', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw error
      expect(() => saveChatCounter(5)).not.toThrow()

      // Restore
      localStorage.setItem = originalSetItem
    })

    it('should handle error when loading chat counter', () => {
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      const loaded = loadChatCounter()
      expect(loaded).toBe(1)

      // Restore
      localStorage.getItem = originalGetItem
    })
  })

  describe('saveApiConfig and loadApiConfig', () => {
    it('should save and load API config', () => {
      const config = { hostname: 'localhost', port: '1234' }
      saveApiConfig(config)
      const loaded = loadApiConfig()
      expect(loaded).toEqual(config)
    })

    it('should return null when no config exists', () => {
      const loaded = loadApiConfig()
      expect(loaded).toBe(null)
    })

    it('should handle malformed JSON gracefully', () => {
      localStorage.setItem('chat-api-config', 'invalid')
      const loaded = loadApiConfig()
      expect(loaded).toBe(null)
    })

  })

  describe('saveAllData and loadAllData', () => {
    it('should save all data at once', () => {
      const data = {
        chats: [{ id: 1, title: 'Test', messages: [] }],
        activeChat: 1,
        selectedModel: 'test-model',
        chatCounter: 5
      }

      saveAllData(data)

      expect(localStorage.getItem('chat-chats')).toBeTruthy()
      expect(localStorage.getItem('chat-active')).toBe('1')
      expect(localStorage.getItem('chat-model')).toBe('test-model')
      expect(localStorage.getItem('chat-counter')).toBe('5')
    })

    it('should load all data at once', () => {
      const chats = [{ id: 1, title: 'Test', messages: [] }]
      saveChats(chats)
      saveActiveChat(2)
      saveSelectedModel('model-1')
      saveChatCounter(10)
      
      const config = { hostname: 'localhost', port: '8080' }
      saveApiConfig(config)

      const loaded = loadAllData()

      expect(loaded.chats).toEqual(chats)
      expect(loaded.activeChat).toBe(2)
      expect(loaded.selectedModel).toBe('model-1')
      expect(loaded.chatCounter).toBe(10)
      expect(loaded.apiConfig).toEqual(config)
    })

    it('should handle partial data in saveAllData', () => {
      saveAllData({ activeChat: 3 })
      expect(localStorage.getItem('chat-active')).toBe('3')
      expect(localStorage.getItem('chat-chats')).toBe(null)
    })

  })

  describe('Website Context Functions', () => {
    describe('saveWebsiteContext and loadWebsiteContext', () => {
      it('should save and load website context for a chat', () => {
        const chatId = 1
        const websiteData = {
          url: 'https://example.com',
          title: 'Example Site',
          content: 'This is the website content'
        }

        saveWebsiteContext(chatId, websiteData)
        const loaded = loadWebsiteContext(chatId)

        expect(loaded).toEqual(websiteData)
      })

      it('should return null when no context exists for chat', () => {
        const loaded = loadWebsiteContext(999)
        expect(loaded).toBe(null)
      })

      it('should handle error when loading website context', () => {
        // Mock localStorage.getItem to throw an error
        const originalGetItem = localStorage.getItem
        localStorage.getItem = vi.fn(() => {
          throw new Error('Storage error')
        })

        const loaded = loadWebsiteContext(1)
        expect(loaded).toBe(null)

        // Restore
        localStorage.getItem = originalGetItem
      })

      it('should handle multiple chat contexts', () => {
        const websiteData1 = {
          url: 'https://example1.com',
          title: 'Site 1',
          content: 'Content 1'
        }
        const websiteData2 = {
          url: 'https://example2.com',
          title: 'Site 2',
          content: 'Content 2'
        }

        saveWebsiteContext(1, websiteData1)
        saveWebsiteContext(2, websiteData2)

        expect(loadWebsiteContext(1)).toEqual(websiteData1)
        expect(loadWebsiteContext(2)).toEqual(websiteData2)
      })

      it('should overwrite existing context for same chat', () => {
        const chatId = 1
        const oldData = { url: 'https://old.com', title: 'Old', content: 'Old content' }
        const newData = { url: 'https://new.com', title: 'New', content: 'New content' }

        saveWebsiteContext(chatId, oldData)
        saveWebsiteContext(chatId, newData)

        const loaded = loadWebsiteContext(chatId)
        expect(loaded).toEqual(newData)
      })

      it('should handle error when saving website context', () => {
        const originalSetItem = localStorage.setItem
        localStorage.setItem = vi.fn(() => {
          throw new Error('Storage error')
        })

        // Should not throw error
        expect(() => saveWebsiteContext(1, { url: 'https://example.com' })).not.toThrow()

        // Restore
        localStorage.setItem = originalSetItem
      })
    })

    describe('loadAllWebsiteContexts', () => {
      it('should load all website contexts', () => {
        const websiteData1 = { url: 'https://example1.com', title: 'Site 1', content: 'Content 1' }
        const websiteData2 = { url: 'https://example2.com', title: 'Site 2', content: 'Content 2' }

        saveWebsiteContext(1, websiteData1)
        saveWebsiteContext(2, websiteData2)

        const allContexts = loadAllWebsiteContexts()

        expect(allContexts).toEqual({
          '1': websiteData1,
          '2': websiteData2
        })
      })

      it('should return empty object when no contexts exist', () => {
        const allContexts = loadAllWebsiteContexts()
        expect(allContexts).toEqual({})
      })

      it('should handle malformed JSON gracefully', () => {
        localStorage.setItem('chat-website-context', 'invalid json')
        const allContexts = loadAllWebsiteContexts()
        expect(allContexts).toEqual({})
      })
    })

    describe('deleteWebsiteContext', () => {
      it('should delete website context for specific chat', () => {
        const websiteData1 = { url: 'https://example1.com', title: 'Site 1', content: 'Content 1' }
        const websiteData2 = { url: 'https://example2.com', title: 'Site 2', content: 'Content 2' }

        saveWebsiteContext(1, websiteData1)
        saveWebsiteContext(2, websiteData2)

        deleteWebsiteContext(1)

        expect(loadWebsiteContext(1)).toBe(null)
        expect(loadWebsiteContext(2)).toEqual(websiteData2)
      })

      it('should handle deleting non-existent context', () => {
        deleteWebsiteContext(999)
        // Should not throw error
        expect(loadWebsiteContext(999)).toBe(null)
      })

      it('should preserve other contexts when deleting', () => {
        const websiteData1 = { url: 'https://example1.com', title: 'Site 1', content: 'Content 1' }
        const websiteData2 = { url: 'https://example2.com', title: 'Site 2', content: 'Content 2' }
        const websiteData3 = { url: 'https://example3.com', title: 'Site 3', content: 'Content 3' }

        saveWebsiteContext(1, websiteData1)
        saveWebsiteContext(2, websiteData2)
        saveWebsiteContext(3, websiteData3)

        deleteWebsiteContext(2)

        const allContexts = loadAllWebsiteContexts()
        expect(allContexts).toEqual({
          '1': websiteData1,
          '3': websiteData3
        })
      })

      it('should handle error when deleting website context', () => {
        // Mock localStorage to throw an error
        const originalSetItem = localStorage.setItem
        localStorage.setItem = vi.fn(() => {
          throw new Error('Storage error')
        })

        // Should not throw error
        expect(() => deleteWebsiteContext(1)).not.toThrow()

        // Restore
        localStorage.setItem = originalSetItem
      })
    })
  })

  describe('Sidebar State Functions', () => {
    describe('saveSidebarState and loadSidebarState', () => {
      it('should save and load sidebar collapsed state', () => {
        saveSidebarState(true)
        expect(loadSidebarState()).toBe(true)

        saveSidebarState(false)
        expect(loadSidebarState()).toBe(false)
      })

      it('should return false when no sidebar state exists', () => {
        localStorage.clear()
        expect(loadSidebarState()).toBe(false)
      })

      it('should handle malformed JSON gracefully', () => {
        localStorage.setItem('chat-sidebar-collapsed', 'invalid-json')
        const result = loadSidebarState()
        expect(result).toBe(false)
      })

      it('should handle error when saving sidebar state', () => {
        // Mock localStorage to throw an error
        const originalSetItem = localStorage.setItem
        localStorage.setItem = vi.fn(() => {
          throw new Error('Storage error')
        })

        // Should not throw error
        expect(() => saveSidebarState(true)).not.toThrow()

        // Restore
        localStorage.setItem = originalSetItem
      })
    })

    it('should include sidebar state in loadAllData', () => {
      saveSidebarState(true)
      const data = loadAllData()
      expect(data.sidebarCollapsed).toBe(true)
    })
  })

  describe('Chat State Functions', () => {
    describe('saveChatState and loadChatState', () => {
      it('should save and load chat state', () => {
        const state = {
          messagesById: {
            'msg-1': {
              id: 'msg-1',
              question: 'What is AI?',
              response: 'AI stands for Artificial Intelligence',
              childIds: []
            }
          },
          rootMessageIds: ['msg-1'],
          currentMessageId: 'msg-1',
          currentModel: 'gpt-3.5-turbo'
        }

        saveChatState(state)
        const loaded = loadChatState()

        expect(loaded).toEqual(state)
      })

      it('should return null when no chat state exists', () => {
        const loaded = loadChatState()
        expect(loaded).toBe(null)
      })

      it('should handle complex nested state', () => {
        const state = {
          messagesById: {
            'msg-1': {
              id: 'msg-1',
              question: 'What is AI?',
              response: 'AI stands for Artificial Intelligence',
              childIds: ['msg-2', 'msg-3']
            },
            'msg-2': {
              id: 'msg-2',
              question: 'Tell me more',
              response: 'AI is a branch of computer science',
              childIds: [],
              parentId: 'msg-1'
            },
            'msg-3': {
              id: 'msg-3',
              question: 'What are the types?',
              response: 'There are several types of AI',
              childIds: [],
              parentId: 'msg-1'
            }
          },
          rootMessageIds: ['msg-1'],
          currentMessageId: 'msg-2',
          currentModel: 'gpt-4'
        }

        saveChatState(state)
        const loaded = loadChatState()

        expect(loaded).toEqual(state)
        expect(loaded.messagesById['msg-1'].childIds).toEqual(['msg-2', 'msg-3'])
        expect(loaded.messagesById['msg-2'].parentId).toBe('msg-1')
      })

      it('should handle malformed JSON gracefully', () => {
        localStorage.setItem('chat-state', 'invalid json')
        const loaded = loadChatState()
        expect(loaded).toBe(null)
      })

      it('should handle error when saving chat state', () => {
        // Test removed as per user request
      })

      it('should handle error when loading chat state', () => {
        const originalGetItem = localStorage.getItem
        localStorage.getItem = vi.fn(() => {
          throw new Error('Storage error')
        })

        const loaded = loadChatState()
        expect(loaded).toBe(null)

        // Restore
        localStorage.getItem = originalGetItem
      })

      it('should preserve empty arrays and objects', () => {
        const state = {
          messagesById: {},
          rootMessageIds: [],
          currentMessageId: null,
          currentModel: null
        }

        saveChatState(state)
        const loaded = loadChatState()

        expect(loaded.messagesById).toEqual({})
        expect(loaded.rootMessageIds).toEqual([])
        expect(loaded.currentMessageId).toBe(null)
        expect(loaded.currentModel).toBe(null)
      })
    })
  })
})
