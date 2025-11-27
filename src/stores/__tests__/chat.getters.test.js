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
})
