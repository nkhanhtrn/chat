import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import { ChatStorage } from '../../services/ChatStorage.js'

// Mock ChatStorage
vi.mock('../../services/ChatStorage.js', () => ({
  ChatStorage: {
    saveState: vi.fn(() => Promise.resolve())
  }
}))

describe('scroll position', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
    chatStore.currentRootIndex = 0
  })

  describe('Message scrollPosition property', () => {
    it('should default scrollPosition to 0 for new messages', () => {
      const msg = chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      expect(msg.scrollPosition).toBe(0)
    })

    it('should preserve scrollPosition when provided in constructor', () => {
      const msg = chatStore.addRootMessage({
        id: 'msg1',
        question: 'Q1',
        response: 'R1',
        scrollPosition: 500
      })
      expect(msg.scrollPosition).toBe(500)
    })
  })

  describe('saveScrollPosition action', () => {
    it('should save scroll position to a message', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.saveScrollPosition('msg1', 250)

      expect(chatStore.messagesById['msg1'].scrollPosition).toBe(250)
    })

    it('should not throw when message does not exist', () => {
      expect(() => {
        chatStore.saveScrollPosition('nonexistent', 100)
      }).not.toThrow()
    })
  })

  describe('navigateToMessage with scroll position', () => {
    it('should save current scroll position when navigating away', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg1'

      chatStore.navigateToMessage('msg2', 300)

      expect(chatStore.messagesById['msg1'].scrollPosition).toBe(300)
    })

    it('should return target message scroll position', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1', scrollPosition: 150 })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg2'

      const scrollPos = chatStore.navigateToMessage('msg1', 0)

      expect(scrollPos).toBe(150)
    })

    it('should return 0 if target has no scroll position', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.currentMessageId = null

      const scrollPos = chatStore.navigateToMessage('msg1')

      expect(scrollPos).toBe(0)
    })

    it('should not save scroll position if currentScrollPosition is null', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg1'
      chatStore.messagesById['msg1'].scrollPosition = 100

      chatStore.navigateToMessage('msg2', null)

      expect(chatStore.messagesById['msg1'].scrollPosition).toBe(100)
    })
  })

  describe('navigateToChild with scroll position', () => {
    beforeEach(() => {
      chatStore.addRootMessage({ id: 'root', question: 'Root', response: 'R' })
      chatStore.addChildMessage('root', { id: 'child1', question: 'C1', response: 'R1', parentId: 'root', scrollPosition: 200 })
      chatStore.navigateToMessage('root')
    })

    it('should save current scroll position when navigating to child', () => {
      chatStore.navigateToChild('root', 0, 400)

      expect(chatStore.messagesById['root'].scrollPosition).toBe(400)
    })

    it('should return child message scroll position', () => {
      const scrollPos = chatStore.navigateToChild('root', 0, 0)

      expect(scrollPos).toBe(200)
    })

    it('should return 0 for non-existent child', () => {
      const scrollPos = chatStore.navigateToChild('root', 99, 100)

      expect(scrollPos).toBe(0)
    })
  })

  describe('navigateToParent with scroll position', () => {
    beforeEach(() => {
      chatStore.addRootMessage({ id: 'root', question: 'Root', response: 'R', scrollPosition: 100 })
      chatStore.addChildMessage('root', { id: 'child1', question: 'C1', response: 'R1', parentId: 'root' })
      // currentMessageId is now 'child1' after addChildMessage
    })

    it('should save current scroll position when navigating to parent', () => {
      // Verify setup
      expect(chatStore.currentMessageId).toBe('child1')
      expect(chatStore.messagesById['child1'].parentId).toBe('root')

      chatStore.navigateToParent('child1', 350)

      expect(chatStore.messagesById['child1'].scrollPosition).toBe(350)
    })

    it('should return parent message scroll position', () => {
      // Verify setup
      expect(chatStore.messagesById['root'].scrollPosition).toBe(100)

      const scrollPos = chatStore.navigateToParent('child1', 0)

      expect(scrollPos).toBe(100)
    })

    it('should return 0 if no parent exists', () => {
      chatStore.currentMessageId = 'root'
      const scrollPos = chatStore.navigateToParent('root', 50)

      expect(scrollPos).toBe(0)
    })
  })

  describe('navigateToLastVisitedChild with scroll position', () => {
    beforeEach(() => {
      chatStore.addRootMessage({ id: 'root', question: 'Root', response: 'R' })
      chatStore.addChildMessage('root', { id: 'child1', question: 'C1', response: 'R1', parentId: 'root', scrollPosition: 250 })
      chatStore.navigateToMessage('root')
      chatStore.messagesById['root'].lastVisitedChild = 'child1'
    })

    it('should save current scroll position when navigating to last visited child', () => {
      chatStore.navigateToLastVisitedChild('root', 175)

      expect(chatStore.messagesById['root'].scrollPosition).toBe(175)
    })

    it('should return last visited child scroll position', () => {
      const scrollPos = chatStore.navigateToLastVisitedChild('root', 0)

      expect(scrollPos).toBe(250)
    })

    it('should return 0 if no last visited child', () => {
      chatStore.messagesById['root'].lastVisitedChild = null

      const scrollPos = chatStore.navigateToLastVisitedChild('root', 100)

      expect(scrollPos).toBe(0)
    })
  })

  describe('scroll position persistence', () => {
    let saveChatStateSpy

    beforeEach(() => {
      saveChatStateSpy = vi.spyOn(storage, 'saveChatState')
    })

    afterEach(() => {
      saveChatStateSpy.mockRestore()
    })

    it('should persist scroll position when saved', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.saveScrollPosition('msg1', 450)

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.messagesById.msg1.scrollPosition).toBe(450)
    })

    it('should persist scroll position when navigating', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg1'

      chatStore.navigateToMessage('msg2', 600)

      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.messagesById.msg1.scrollPosition).toBe(600)
    })
  })

  describe('scroll position restoration from storage', () => {
    it('should restore scroll position from persisted state', async () => {
      const savedState = {
        messagesById: {
          msg1: { id: 'msg1', question: 'Q1', response: 'R1', scrollPosition: 789 }
        },
        rootMessageIds: ['msg1'],
        currentMessageId: 'msg1'
      }

      const loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
      const store = useChatStore()
      await store.initializeStore()

      expect(store.messagesById.msg1.scrollPosition).toBe(789)

      loadChatStateSpy.mockRestore()
    })
  })

  describe('previousLocation tracking', () => {
    beforeEach(() => {
      chatStore.chats = [{ id: 'notebook1', rootMessageIds: ['msg1', 'msg2'] }]
      chatStore.currentChatId = 'notebook1'
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg1'
    })

    it('should track previousLocation when navigating to a different message', () => {
      chatStore.navigateToMessage('msg2')

      expect(chatStore.previousLocation).toEqual({
        messageId: 'msg1',
        chatId: 'notebook1'
      })
    })

    it('should not track previousLocation when navigating to same message', () => {
      chatStore.navigateToMessage('msg1')

      expect(chatStore.previousLocation).toBeNull()
    })

    it('should not track previousLocation when currentMessageId is null', () => {
      chatStore.currentMessageId = null
      chatStore.navigateToMessage('msg1')

      expect(chatStore.previousLocation).toBeNull()
    })

    it('should skip history tracking when skipHistory option is true', () => {
      chatStore.navigateToMessage('msg2', null, { skipHistory: true })

      expect(chatStore.previousLocation).toBeNull()
    })

    it('should update previousLocation on subsequent navigations', () => {
      chatStore.navigateToMessage('msg2')
      expect(chatStore.previousLocation).toEqual({ messageId: 'msg1', chatId: 'notebook1' })

      chatStore.navigateToMessage('msg1')
      expect(chatStore.previousLocation).toEqual({ messageId: 'msg2', chatId: 'notebook1' })
    })

    it('should track chatId at time of navigation', () => {
      chatStore.chats.push({ id: 'notebook2', rootMessageIds: ['msg3'] })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      // Navigate within notebook1
      chatStore.navigateToMessage('msg2')
      expect(chatStore.previousLocation.chatId).toBe('notebook1')

      // Switch to notebook2 and navigate
      // Note: previousLocation captures the chatId at the time of navigation,
      // so if we switch chatId before navigating, it uses the new chatId
      chatStore.currentChatId = 'notebook2'
      chatStore.navigateToMessage('msg3')

      // The previousLocation captures msg2 with the current chatId at time of call
      expect(chatStore.previousLocation).toEqual({
        messageId: 'msg2',
        chatId: 'notebook2'
      })
    })
  })

  describe('navigateBack action', () => {
    beforeEach(() => {
      chatStore.chats = [{ id: 'notebook1', rootMessageIds: ['msg1', 'msg2'] }]
      chatStore.currentChatId = 'notebook1'
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentMessageId = 'msg1'
    })

    it('should return null when there is no previousLocation', () => {
      const result = chatStore.navigateBack()

      expect(result).toBeNull()
    })

    it('should return previousLocation and clear it', () => {
      chatStore.navigateToMessage('msg2')
      expect(chatStore.previousLocation).not.toBeNull()

      const result = chatStore.navigateBack()

      expect(result).toEqual({ messageId: 'msg1', chatId: 'notebook1' })
      expect(chatStore.previousLocation).toBeNull()
    })

    it('should only allow one back navigation per navigation', () => {
      chatStore.navigateToMessage('msg2')

      const firstResult = chatStore.navigateBack()
      const secondResult = chatStore.navigateBack()

      expect(firstResult).toEqual({ messageId: 'msg1', chatId: 'notebook1' })
      expect(secondResult).toBeNull()
    })
  })
})
