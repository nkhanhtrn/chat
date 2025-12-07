import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import Message from '../Message.js'

// Helper to create a message
function makeMessage({ id, parentId = null, childIds = [], question = '' }) {
  return new Message({
    id,
    question: question || id, // Use id as question for uniqueness
    response: '',
    parentId,
    childIds,
  })
}

describe('chat store getters', () => {
  describe('getParent', () => {
    let store
    beforeEach(() => {
      setActivePinia(createPinia())
      store = useChatStore()
      // Setup a simple tree: root -> child -> grandchild
      const root = makeMessage({ id: 'root' })
      const child = makeMessage({ id: 'child', parentId: 'root' })
      const grandchild = makeMessage({ id: 'grandchild', parentId: 'child' })
      root.childIds = ['child']
      child.childIds = ['grandchild']
      store.messagesById = {
        root,
        child,
        grandchild,
      }
      store.rootMessageIds = ['root']
    })

    it('returns null for root message', () => {
      expect(store.getParent('root')).toBeNull()
    })

    it('returns parent for child message', () => {
      const parent = store.getParent('child')
      expect(parent).toBe(store.messagesById['root'])
      expect(parent.id).toBe('root')
    })

    it('returns parent for grandchild message', () => {
      const parent = store.getParent('grandchild')
      expect(parent).toBe(store.messagesById['child'])
      expect(parent.id).toBe('child')
    })

    it('returns null for unknown id', () => {
      expect(store.getParent('notfound')).toBeNull()
    })
  })

  describe('getMessageById', () => {
    let chatStore
    beforeEach(() => {
      setActivePinia(createPinia())
      chatStore = useChatStore()
      chatStore.messagesById = {}
      chatStore.rootMessageIds = []
      chatStore.currentMessageId = null
    })

    it('should return message by ID', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Question 1',
        response: 'Response 1'
      })

      const message = chatStore.getMessageById('msg1')

      expect(message).toBeDefined()
      expect(message.id).toBe('msg1')
      expect(message.question).toBe('Question 1')
    })

    it('should return undefined for non-existent ID', () => {
      const message = chatStore.getMessageById('nonexistent')

      expect(message).toBeUndefined()
    })
  })

  describe('chatList', () => {
    let chatStore

    beforeEach(() => {
      setActivePinia(createPinia())
      chatStore = useChatStore()
      // Reset store state to ensure clean state
      chatStore.chats = []
      chatStore.rootMessageIds = []
      chatStore.messagesById = {}
      chatStore.currentChatId = null
      chatStore.currentMessageId = null
      chatStore.currentRootIndex = 0
    })

    it('should return empty array when no chats exist', () => {
      expect(chatStore.chatList).toEqual([])
    })

    it('should return chat with questions including chatId and rootIndex', () => {
      // Create a chat with messages
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'msg1',
        question: 'First question',
        response: 'First response'
      })

      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Second question',
        response: 'Second response'
      })

      const chatList = chatStore.chatList
      expect(chatList).toHaveLength(1)

      const chat = chatList[0]
      expect(chat.id).toBe(chatId)
      expect(chat.questions).toHaveLength(2)

      // Verify first question has correct chatId and rootIndex
      expect(chat.questions[0]).toEqual({
        id: 'msg1',
        text: 'First question',
        chatId: chatId,
        rootIndex: 0
      })

      // Verify second question has correct chatId and rootIndex
      expect(chat.questions[1]).toEqual({
        id: 'msg2',
        text: 'Second question',
        chatId: chatId,
        rootIndex: 1
      })
    })

    it('should include chatId and rootIndex for questions across multiple chats', () => {
      // Create first chat
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'chat1-msg1',
        question: 'Chat 1 Question 1',
        response: ''
      })

      // Create second chat
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'chat2-msg1',
        question: 'Chat 2 Question 1',
        response: ''
      })

      chatStore.addRootMessage({
        id: 'chat2-msg2',
        question: 'Chat 2 Question 2',
        response: ''
      })

      const chatList = chatStore.chatList
      expect(chatList).toHaveLength(2)

      // First chat questions
      const chat1 = chatList.find(c => c.id === chat1Id)
      expect(chat1.questions[0].chatId).toBe(chat1Id)
      expect(chat1.questions[0].rootIndex).toBe(0)

      // Second chat questions
      const chat2 = chatList.find(c => c.id === chat2Id)
      expect(chat2.questions[0].chatId).toBe(chat2Id)
      expect(chat2.questions[0].rootIndex).toBe(0)
      expect(chat2.questions[1].chatId).toBe(chat2Id)
      expect(chat2.questions[1].rootIndex).toBe(1)
    })

    it('should use "Untitled" for questions with empty text', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'msg1',
        question: '',
        response: ''
      })

      const chatList = chatStore.chatList
      expect(chatList[0].questions[0].text).toBe('Untitled')
      expect(chatList[0].questions[0].chatId).toBe(chatId)
      expect(chatList[0].questions[0].rootIndex).toBe(0)
    })
  })

  describe('getMessageTreeStats', () => {
    let chatStore
    beforeEach(() => {
      setActivePinia(createPinia())
      chatStore = useChatStore()
      chatStore.messagesById = {}
      chatStore.rootMessageIds = []
    })

    it('should return zero counts for message without children or custom content', () => {
      chatStore.messagesById['msg1'] = makeMessage({ id: 'msg1' })

      const stats = chatStore.getMessageTreeStats('msg1')

      expect(stats.descendantCount).toBe(0)
      expect(stats.customContentCount).toBe(0)
    })

    it('should return zero counts for non-existent message', () => {
      const stats = chatStore.getMessageTreeStats('nonexistent')

      expect(stats.descendantCount).toBe(0)
      expect(stats.customContentCount).toBe(0)
    })

    it('should count direct children', () => {
      chatStore.messagesById['parent'] = makeMessage({ id: 'parent', childIds: ['child1', 'child2'] })
      chatStore.messagesById['child1'] = makeMessage({ id: 'child1', parentId: 'parent' })
      chatStore.messagesById['child2'] = makeMessage({ id: 'child2', parentId: 'parent' })

      const stats = chatStore.getMessageTreeStats('parent')

      expect(stats.descendantCount).toBe(2)
    })

    it('should count nested descendants', () => {
      chatStore.messagesById['root'] = makeMessage({ id: 'root', childIds: ['child'] })
      chatStore.messagesById['child'] = makeMessage({ id: 'child', parentId: 'root', childIds: ['grandchild'] })
      chatStore.messagesById['grandchild'] = makeMessage({ id: 'grandchild', parentId: 'child' })

      const stats = chatStore.getMessageTreeStats('root')

      expect(stats.descendantCount).toBe(2)
    })

    it('should count custom content on root message', () => {
      const msg = makeMessage({ id: 'msg1' })
      msg.customContent = [
        { id: 'note1', type: 'note' },
        { id: 'highlight1', type: 'highlight' }
      ]
      chatStore.messagesById['msg1'] = msg

      const stats = chatStore.getMessageTreeStats('msg1')

      expect(stats.customContentCount).toBe(2)
    })

    it('should count custom content across all descendants', () => {
      const parent = makeMessage({ id: 'parent', childIds: ['child'] })
      parent.customContent = [{ id: 'note1', type: 'note' }]

      const child = makeMessage({ id: 'child', parentId: 'parent' })
      child.customContent = [
        { id: 'note2', type: 'note' },
        { id: 'highlight1', type: 'highlight' }
      ]

      chatStore.messagesById['parent'] = parent
      chatStore.messagesById['child'] = child

      const stats = chatStore.getMessageTreeStats('parent')

      expect(stats.descendantCount).toBe(1)
      expect(stats.customContentCount).toBe(3)
    })
  })
})
