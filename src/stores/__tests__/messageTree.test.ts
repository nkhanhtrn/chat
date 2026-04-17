import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessageTreeStore } from '../messageTree'

describe('useMessageTreeStore', () => {
  let store: ReturnType<typeof useMessageTreeStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useMessageTreeStore()
  })

  // Helper to create a root message
  function addRoot(id: string, question: string) {
    return store.addRootMessage({ id, question, response: '' }, 'chat-1')
  }

  function addChild(parentId: string, id: string, question: string) {
    return store.addChildMessage(parentId, { id, question, response: '' }, 'chat-1')
  }

  // ── Getters ──

  describe('rootMessages', () => {
    it('returns messages for root IDs in order', () => {
      addRoot('r1', 'Question 1')
      addRoot('r2', 'Question 2')
      expect(store.rootMessages.map(m => m.id)).toEqual(['r1', 'r2'])
    })

    it('filters out missing messages', () => {
      addRoot('r1', 'Question 1')
      store.rootMessageIds.push('missing') // manually add a bad ID
      expect(store.rootMessages).toHaveLength(1)
    })
  })

  describe('currentRootMessage', () => {
    it('returns message at currentRootIndex', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      store.currentRootIndex = 1
      expect(store.currentRootMessage?.id).toBe('r2')
    })

    it('returns null when index out of bounds', () => {
      expect(store.currentRootMessage).toBeNull()
    })
  })

  describe('currentMessage', () => {
    it('returns message at currentMessageId', () => {
      addRoot('r1', 'Q1')
      expect(store.currentMessage?.id).toBe('r1')
    })

    it('returns null when no currentMessageId', () => {
      store.currentMessageId = null
      expect(store.currentMessage).toBeNull()
    })
  })

  describe('getMessageById', () => {
    it('returns message by ID', () => {
      addRoot('r1', 'Q1')
      expect(store.getMessageById('r1')?.question).toBe('Q1')
    })

    it('returns null for missing ID', () => {
      expect(store.getMessageById('missing')).toBeNull()
    })
  })

  describe('getChildren', () => {
    it('returns child messages', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child 1')
      addChild('r1', 'c2', 'Child 2')
      const children = store.getChildren('r1')
      expect(children.map(c => c.id)).toEqual(['c1', 'c2'])
    })

    it('returns empty array for leaf message', () => {
      addRoot('r1', 'Q1')
      expect(store.getChildren('r1')).toEqual([])
    })
  })

  describe('getParent', () => {
    it('returns parent message', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child 1')
      expect(store.getParent('c1')?.id).toBe('r1')
    })

    it('returns null for root message', () => {
      addRoot('r1', 'Q1')
      expect(store.getParent('r1')).toBeNull()
    })
  })

  describe('countMessagesWithChildren', () => {
    it('counts self only for leaf', () => {
      addRoot('r1', 'Q1')
      expect(store.countMessagesWithChildren('r1')).toBe(1)
    })

    it('counts self + all descendants', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      addChild('c1', 'gc1', 'Grandchild')
      expect(store.countMessagesWithChildren('r1')).toBe(3)
      expect(store.countMessagesWithChildren('c1')).toBe(2)
    })
  })

  // ── CRUD ──

  describe('addRootMessage', () => {
    it('adds to messagesById and rootMessageIds', () => {
      const msg = addRoot('r1', 'Q1')
      expect(msg.id).toBe('r1')
      expect(store.rootMessageIds).toContain('r1')
      expect(store.messagesById['r1']).toBeDefined()
    })

    it('sets currentMessageId and currentRootIndex', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      expect(store.currentMessageId).toBe('r2')
      expect(store.currentRootIndex).toBe(1)
    })
  })

  describe('addChildMessage', () => {
    it('adds child and updates parent childIds', () => {
      addRoot('r1', 'Q1')
      const child = addChild('r1', 'c1', 'Child')
      expect(child.parentId).toBe('r1')
      expect(store.getMessageById('r1')?.childIds).toContain('c1')
      expect(store.currentMessageId).toBe('c1')
    })

    it('throws for missing parent', () => {
      expect(() => addChild('missing', 'c1', 'Child')).toThrow()
    })
  })

  describe('appendToResponse', () => {
    it('appends chunk to response', () => {
      addRoot('r1', 'Q1')
      store.appendToResponse('r1', 'Hello ')
      store.appendToResponse('r1', 'World')
      expect(store.getMessageById('r1')?.response).toBe('Hello World')
    })

    it('is a no-op for missing message', () => {
      expect(() => store.appendToResponse('missing', 'text')).not.toThrow()
    })
  })

  describe('setQuestionSummarized', () => {
    it('updates the question summary', () => {
      addRoot('r1', 'What is TypeScript?')
      store.setQuestionSummarized('r1', 'TypeScript basics')
      expect(store.getMessageById('r1')?.questionSummarized).toBe('TypeScript basics')
    })
  })

  // ── Navigation ──

  describe('navigateToMessage', () => {
    it('sets currentMessageId and returns scroll position', () => {
      addRoot('r1', 'Q1')
      store.currentMessageId = 'r1'
      store.saveScrollPosition('r1', 42)
      addRoot('r2', 'Q2')

      const scroll = store.navigateToMessage('r1', 100)
      expect(store.currentMessageId).toBe('r1')
      expect(scroll).toBe(42)
    })

    it('records previousLocation', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      store.currentMessageId = 'r1'
      store.navigateToMessage('r2')
      expect(store.previousLocation?.messageId).toBe('r1')
    })

    it('returns 0 for missing message', () => {
      expect(store.navigateToMessage('missing')).toBe(0)
    })
  })

  describe('navigateBack', () => {
    it('returns previous location and clears it', () => {
      store.previousLocation = { messageId: 'r1', chatId: 'c1' }
      const loc = store.navigateBack()
      expect(loc).toEqual({ messageId: 'r1', chatId: 'c1' })
      expect(store.previousLocation).toBeNull()
    })

    it('returns null when no previous location', () => {
      expect(store.navigateBack()).toBeNull()
    })
  })

  describe('navigateToParent', () => {
    it('navigates from child to parent', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      store.currentMessageId = 'c1'
      const scroll = store.navigateToParent()
      expect(store.currentMessageId).toBe('r1')
      expect(scroll).toBe(0)
    })

    it('returns 0 for root message', () => {
      addRoot('r1', 'Q1')
      store.currentMessageId = 'r1'
      expect(store.navigateToParent()).toBe(0)
    })
  })

  describe('navigateToChild', () => {
    it('navigates to child at index', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child 1')
      addChild('r1', 'c2', 'Child 2')
      store.currentMessageId = 'r1'
      store.navigateToChild(1)
      expect(store.currentMessageId).toBe('c2')
    })

    it('sets lastVisitedChild on parent', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child 1')
      store.currentMessageId = 'r1'
      store.navigateToChild(0)
      expect(store.getMessageById('r1')?.lastVisitedChild).toBe('c1')
    })
  })

  // ── Delete ──

  describe('removeRootMessage', () => {
    it('removes root and all descendants from messagesById', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      store.removeRootMessage('r1')
      expect(store.rootMessageIds).not.toContain('r1')
      expect(store.getMessageById('r1')).toBeNull()
      expect(store.getMessageById('c1')).toBeNull()
    })

    it('adjusts currentRootIndex', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      addRoot('r3', 'Q3')
      store.currentRootIndex = 2
      store.removeRootMessage('r3')
      expect(store.currentRootIndex).toBe(1)
    })

    it('clears currentMessageId if it was the deleted message', () => {
      addRoot('r1', 'Q1')
      store.currentMessageId = 'r1'
      store.removeRootMessage('r1')
      expect(store.currentMessageId).toBeNull()
    })
  })

  describe('deleteChildMessage', () => {
    it('removes child from parent and messagesById', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      const result = store.deleteChildMessage('c1')
      expect(store.getMessageById('c1')).toBeNull()
      expect(store.getMessageById('r1')?.childIds).not.toContain('c1')
      expect(result.navigateTo).toBe('r1')
    })

    it('returns null navigateTo when not viewing deleted message', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      addChild('r1', 'c2', 'Child 2')
      store.currentMessageId = 'c2'
      const result = store.deleteChildMessage('c1')
      expect(result.navigateTo).toBeNull()
    })
  })

  // ── Move / Reorder ──

  describe('reorderRootMessages', () => {
    it('sets new order', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      addRoot('r3', 'Q3')
      store.reorderRootMessages(['r3', 'r1', 'r2'])
      expect(store.rootMessageIds).toEqual(['r3', 'r1', 'r2'])
    })
  })

  describe('reorderChildren', () => {
    it('sets new child order on parent', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child 1')
      addChild('r1', 'c2', 'Child 2')
      store.reorderChildren('r1', ['c2', 'c1'])
      expect(store.getMessageById('r1')?.childIds).toEqual(['c2', 'c1'])
    })
  })

  describe('moveMessage', () => {
    it('reorders root messages', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      addRoot('r3', 'Q3')
      const rootIds = [...store.rootMessageIds]
      store.moveMessage('r3', null, 0, rootIds)
      expect(store.rootMessageIds[0]).toBe('r3')
    })

    it('reparents root as child', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      const rootIds = [...store.rootMessageIds]
      store.moveMessage('r2', 'r1', 0, rootIds)
      expect(store.getMessageById('r2')?.parentId).toBe('r1')
      expect(store.getMessageById('r1')?.childIds).toContain('r2')
      expect(store.rootMessageIds).not.toContain('r2')
    })

    it('moves child back to root', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      const rootIds = [...store.rootMessageIds]
      store.moveMessage('c1', null, 1, rootIds)
      expect(store.getMessageById('c1')?.parentId).toBeNull()
      expect(store.getMessageById('r1')?.childIds).not.toContain('c1')
      expect(store.rootMessageIds).toContain('c1')
    })

    it('blocks circular reference', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      const rootIds = [...store.rootMessageIds]
      // Try to move parent under its own child
      store.moveMessage('r1', 'c1', 0, rootIds)
      // Should be blocked — r1 still a root
      expect(store.rootMessageIds).toContain('r1')
      expect(store.getMessageById('r1')?.parentId).toBeNull()
    })
  })

  // ── Bulk ──

  describe('loadMessages', () => {
    it('replaces messagesById with reconstructed Message objects', () => {
      store.loadMessages({
        'r1': { id: 'r1', question: 'Q1', response: 'A1' } as any,
      })
      expect(store.getMessageById('r1')?.question).toBe('Q1')
    })
  })

  describe('clearMessages', () => {
    it('resets all state', () => {
      addRoot('r1', 'Q1')
      store.clearMessages()
      expect(store.messagesById).toEqual({})
      expect(store.rootMessageIds).toEqual([])
      expect(store.currentMessageId).toBeNull()
      expect(store.currentRootIndex).toBe(0)
    })
  })

  describe('setRootMessageIds', () => {
    it('sets root IDs and resets navigation', () => {
      store.setRootMessageIds(['r1', 'r2'])
      expect(store.rootMessageIds).toEqual(['r1', 'r2'])
      expect(store.currentMessageId).toBeNull()
      expect(store.currentRootIndex).toBe(0)
    })
  })

  describe('_isDescendantOf', () => {
    it('returns true when id matches ancestor', () => {
      addRoot('r1', 'Q1')
      expect(store._isDescendantOf('r1', 'r1')).toBe(true)
    })

    it('returns true for direct child', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      expect(store._isDescendantOf('c1', 'r1')).toBe(true)
    })

    it('returns true for deep descendant', () => {
      addRoot('r1', 'Q1')
      addChild('r1', 'c1', 'Child')
      addChild('c1', 'gc1', 'Grandchild')
      expect(store._isDescendantOf('gc1', 'r1')).toBe(true)
    })

    it('returns false for non-descendant', () => {
      addRoot('r1', 'Q1')
      addRoot('r2', 'Q2')
      expect(store._isDescendantOf('r2', 'r1')).toBe(false)
    })
  })
})
