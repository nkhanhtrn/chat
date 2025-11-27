import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveSidebarState,
  loadSidebarState,
  saveChatState,
  loadChatState,
  clearAllStorage
} from '../storage.js'

describe('Storage Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
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

  describe('clearAllStorage', () => {
    it('should clear all localStorage data', () => {
      // Set up data
      saveSidebarState(true)
      saveChatState({ messagesById: {}, rootMessageIds: [], currentMessageId: null, currentModel: null })

      // Verify data exists
      expect(localStorage.getItem('chat-sidebar-collapsed')).toBeTruthy()
      expect(localStorage.getItem('chat-state')).toBeTruthy()

      // Clear all
      clearAllStorage()

      // Verify all data is cleared
      expect(localStorage.getItem('chat-sidebar-collapsed')).toBe(null)
      expect(localStorage.getItem('chat-state')).toBe(null)
    })

    it('should handle errors gracefully when clearing', () => {
      const originalRemoveItem = localStorage.removeItem
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw error
      expect(() => clearAllStorage()).not.toThrow()

      // Restore
      localStorage.removeItem = originalRemoveItem
    })
  })
})
