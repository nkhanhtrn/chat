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
  loadAllData
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
})
