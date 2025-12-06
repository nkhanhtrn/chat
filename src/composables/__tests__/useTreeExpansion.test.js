import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTreeExpansion } from '../useTreeExpansion.js'

describe('useTreeExpansion', () => {
  // Helper to create mock message structure
  const createMockMessages = () => ({
    root1: { id: 'root1', parentId: null, childIds: ['child1', 'child2'] },
    child1: { id: 'child1', parentId: 'root1', childIds: ['grandchild1'] },
    child2: { id: 'child2', parentId: 'root1', childIds: [] },
    grandchild1: { id: 'grandchild1', parentId: 'child1', childIds: [] },
    root2: { id: 'root2', parentId: null, childIds: [] }
  })

  const createComposable = (messages = createMockMessages(), currentMsgId = null) => {
    const currentMessageId = ref(currentMsgId)
    return {
      ...useTreeExpansion({
        getMessageById: (id) => messages[id],
        currentMessageId
      }),
      currentMessageId,
      messages
    }
  }

  describe('initial state', () => {
    it('starts with no expanded root', () => {
      const { expandedRootId } = createComposable()
      expect(expandedRootId.value).toBe(null)
    })

    it('starts with empty expanded path', () => {
      const { expandedPath } = createComposable()
      expect(expandedPath.value.size).toBe(0)
    })

    it('auto-expands to current message on init', () => {
      const { expandedRootId, expandedPath } = createComposable(createMockMessages(), 'grandchild1')
      expect(expandedRootId.value).toBe('root1')
      expect(expandedPath.value.has('root1')).toBe(true)
      expect(expandedPath.value.has('child1')).toBe(true)
    })
  })

  describe('findRootId', () => {
    it('returns message id when it is a root', () => {
      const { findRootId } = createComposable()
      expect(findRootId('root1')).toBe('root1')
    })

    it('finds root for child message', () => {
      const { findRootId } = createComposable()
      expect(findRootId('child1')).toBe('root1')
    })

    it('finds root for grandchild message', () => {
      const { findRootId } = createComposable()
      expect(findRootId('grandchild1')).toBe('root1')
    })

    it('returns null for non-existent message', () => {
      const { findRootId } = createComposable()
      expect(findRootId('nonexistent')).toBe(null)
    })
  })

  describe('buildPathToChild', () => {
    it('builds path from root to child', () => {
      const { buildPathToChild, expandedPath } = createComposable()

      buildPathToChild('child1')

      expect(expandedPath.value.has('root1')).toBe(true)
      expect(expandedPath.value.size).toBe(1)
    })

    it('builds path from root to grandchild', () => {
      const { buildPathToChild, expandedPath } = createComposable()

      buildPathToChild('grandchild1')

      expect(expandedPath.value.has('root1')).toBe(true)
      expect(expandedPath.value.has('child1')).toBe(true)
      expect(expandedPath.value.size).toBe(2)
    })

    it('creates empty path for root message', () => {
      const { buildPathToChild, expandedPath } = createComposable()

      buildPathToChild('root1')

      expect(expandedPath.value.size).toBe(0)
    })
  })

  describe('isInActivePath', () => {
    it('returns true for current message', () => {
      const { isInActivePath } = createComposable()
      expect(isInActivePath('child1', 'child1')).toBe(true)
    })

    it('returns true for current root', () => {
      const { isInActivePath, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'
      expect(isInActivePath('root1', 'child1')).toBe(true)
    })

    it('returns true for message in expanded path', () => {
      const { isInActivePath, expandedPath } = createComposable()
      expandedPath.value = new Set(['child1'])
      expect(isInActivePath('child1', 'grandchild1')).toBe(true)
    })

    it('returns false for message not in path', () => {
      const { isInActivePath } = createComposable()
      expect(isInActivePath('child2', 'grandchild1')).toBe(false)
    })
  })

  describe('isRootExpanded', () => {
    it('returns true when root is expanded', () => {
      const { isRootExpanded, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'
      expect(isRootExpanded('root1')).toBe(true)
    })

    it('returns false when root is not expanded', () => {
      const { isRootExpanded, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'
      expect(isRootExpanded('root2')).toBe(false)
    })

    it('returns false when no root is expanded', () => {
      const { isRootExpanded } = createComposable()
      expect(isRootExpanded('root1')).toBe(false)
    })
  })

  describe('toggleExpand', () => {
    it('expands a collapsed node', () => {
      const { toggleExpand, expandedPath } = createComposable()

      toggleExpand('child1')

      expect(expandedPath.value.has('child1')).toBe(true)
    })

    it('collapses an expanded node', () => {
      const { toggleExpand, expandedPath } = createComposable()
      expandedPath.value = new Set(['child1'])

      toggleExpand('child1')

      expect(expandedPath.value.has('child1')).toBe(false)
    })

    it('removes descendants when collapsing', () => {
      const { toggleExpand, expandedPath } = createComposable()
      expandedPath.value = new Set(['child1', 'grandchild1'])

      toggleExpand('child1')

      expect(expandedPath.value.has('child1')).toBe(false)
      expect(expandedPath.value.has('grandchild1')).toBe(false)
    })

    it('preserves other nodes when collapsing', () => {
      const { toggleExpand, expandedPath } = createComposable()
      expandedPath.value = new Set(['child1', 'child2'])

      toggleExpand('child1')

      expect(expandedPath.value.has('child1')).toBe(false)
      expect(expandedPath.value.has('child2')).toBe(true)
    })
  })

  describe('toggleRoot', () => {
    it('expands a collapsed root', () => {
      const { toggleRoot, expandedRootId } = createComposable()

      toggleRoot('root1')

      expect(expandedRootId.value).toBe('root1')
    })

    it('collapses an expanded root', () => {
      const { toggleRoot, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'

      toggleRoot('root1')

      expect(expandedRootId.value).toBe(null)
    })

    it('clears expanded path when collapsing root', () => {
      const { toggleRoot, expandedPath, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'
      expandedPath.value = new Set(['child1', 'grandchild1'])

      toggleRoot('root1')

      expect(expandedPath.value.size).toBe(0)
    })

    it('clears expanded path when switching roots', () => {
      const { toggleRoot, expandedPath, expandedRootId } = createComposable()
      expandedRootId.value = 'root1'
      expandedPath.value = new Set(['child1'])

      toggleRoot('root2')

      expect(expandedRootId.value).toBe('root2')
      expect(expandedPath.value.size).toBe(0)
    })
  })

  describe('expandToMessage', () => {
    it('expands root and builds path to message', () => {
      const { expandToMessage, expandedRootId, expandedPath } = createComposable()

      expandToMessage('grandchild1')

      expect(expandedRootId.value).toBe('root1')
      expect(expandedPath.value.has('root1')).toBe(true)
      expect(expandedPath.value.has('child1')).toBe(true)
    })

    it('handles root message', () => {
      const { expandToMessage, expandedRootId, expandedPath } = createComposable()

      expandToMessage('root1')

      expect(expandedRootId.value).toBe('root1')
      expect(expandedPath.value.size).toBe(0)
    })
  })

  describe('watch currentMessageId', () => {
    it('auto-expands when currentMessageId changes', async () => {
      const { currentMessageId, expandedRootId, expandedPath } = createComposable()

      currentMessageId.value = 'grandchild1'
      await nextTick()

      expect(expandedRootId.value).toBe('root1')
      expect(expandedPath.value.has('child1')).toBe(true)
    })

    it('does nothing when currentMessageId is set to null', async () => {
      const { currentMessageId, expandedRootId, expandedPath } = createComposable(createMockMessages(), 'grandchild1')

      // Clear expansion
      expandedRootId.value = null
      expandedPath.value = new Set()

      currentMessageId.value = null
      await nextTick()

      expect(expandedRootId.value).toBe(null)
    })
  })
})
