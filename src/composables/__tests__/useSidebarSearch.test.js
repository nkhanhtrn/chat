import { describe, it, expect } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import { useSidebarSearch } from '../useSidebarSearch.js'

describe('useSidebarSearch', () => {
  // Helper to create mock message structure
  const createMockMessages = () => ({
    q1: { id: 'q1', question: 'JavaScript basics', questionSummarized: 'JS Basics', parentId: null, childIds: ['child1'] },
    child1: { id: 'child1', question: 'Array methods in JavaScript', parentId: 'q1', childIds: ['grandchild1'] },
    grandchild1: { id: 'grandchild1', question: 'Map and filter', parentId: 'child1', childIds: [] },
    q2: { id: 'q2', question: 'Python programming', questionSummarized: 'Python', parentId: null, childIds: [] },
    q3: { id: 'q3', question: 'React hooks tutorial', parentId: null, childIds: [] }
  })

  const createComposable = (messages = createMockMessages(), questions = null) => {
    const chatQuestions = computed(() => questions || [
      { id: 'q1', text: 'JS Basics' },
      { id: 'q2', text: 'Python' },
      { id: 'q3', text: 'React hooks tutorial' }
    ])

    return {
      ...useSidebarSearch({
        getMessageById: (id) => messages[id],
        chatQuestions
      }),
      messages
    }
  }

  describe('initial state', () => {
    it('starts with empty query', () => {
      const { query } = createComposable()
      expect(query.value).toBe('')
    })

    it('starts with empty results', () => {
      const { results } = createComposable()
      expect(results.value).toEqual([])
    })

    it('isSearchActive is false initially', () => {
      const { isSearchActive } = createComposable()
      expect(isSearchActive.value).toBe(false)
    })
  })

  describe('isSearchActive', () => {
    it('returns true when query has text', async () => {
      const { query, isSearchActive } = createComposable()

      query.value = 'test'
      await nextTick()

      expect(isSearchActive.value).toBe(true)
    })

    it('returns false when query is only whitespace', async () => {
      const { query, isSearchActive } = createComposable()

      query.value = '   '
      await nextTick()

      expect(isSearchActive.value).toBe(false)
    })
  })

  describe('search results', () => {
    it('finds matching root messages', async () => {
      const { query, results } = createComposable()

      query.value = 'JS Basics'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('q1')
    })

    it('finds matching child messages', async () => {
      const { query, results } = createComposable()

      query.value = 'Array'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('child1')
    })

    it('finds matching grandchild messages', async () => {
      const { query, results } = createComposable()

      query.value = 'Map'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('grandchild1')
    })

    it('searches case-insensitively', async () => {
      const { query, results } = createComposable()

      query.value = 'javascript'
      await nextTick()

      expect(results.value.length).toBeGreaterThan(0)
    })

    it('uses questionSummarized when available', async () => {
      const { query, results } = createComposable()

      query.value = 'JS Basics'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('q1')
    })

    it('returns empty for no matches', async () => {
      const { query, results } = createComposable()

      query.value = 'nonexistent'
      await nextTick()

      expect(results.value).toEqual([])
    })

    it('returns empty for whitespace-only query', async () => {
      const { query, results } = createComposable()

      query.value = '   '
      await nextTick()

      expect(results.value).toEqual([])
    })
  })

  describe('multi-word search', () => {
    it('matches when all words are found', async () => {
      const { query, results } = createComposable()

      query.value = 'Array JavaScript'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('child1')
    })

    it('matches words in any order', async () => {
      const { query, results } = createComposable()

      query.value = 'methods Array'
      await nextTick()

      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('child1')
    })

    it('does not match when any word is missing', async () => {
      const { query, results } = createComposable()

      query.value = 'JavaScript Python'
      await nextTick()

      expect(results.value).toEqual([])
    })

    it('handles multiple spaces between words', async () => {
      const { query, results } = createComposable()

      query.value = 'Array    methods'
      await nextTick()

      expect(results.value.length).toBe(1)
    })

    it('matches partial words', async () => {
      const { query, results } = createComposable()

      query.value = 'Arr meth'
      await nextTick()

      // Should match "Array methods in JavaScript" which contains both "Arr" and "meth"
      expect(results.value.length).toBe(1)
      expect(results.value[0].id).toBe('child1')
    })
  })

  describe('ancestor path', () => {
    it('includes empty ancestors for root messages', async () => {
      const { query, results } = createComposable()

      query.value = 'Python'
      await nextTick()

      const pythonResult = results.value.find(r => r.id === 'q2')
      expect(pythonResult.ancestors).toEqual([])
    })

    it('includes parent in ancestors for child messages', async () => {
      const { query, results } = createComposable()

      query.value = 'Array'
      await nextTick()

      const childResult = results.value.find(r => r.id === 'child1')
      expect(childResult.ancestors.length).toBe(1)
      expect(childResult.ancestors[0].id).toBe('q1')
      expect(childResult.ancestors[0].text).toBe('JS Basics')
    })

    it('includes full path for grandchild messages', async () => {
      const { query, results } = createComposable()

      query.value = 'Map filter'
      await nextTick()

      const grandchildResult = results.value.find(r => r.id === 'grandchild1')
      expect(grandchildResult.ancestors.length).toBe(2)
      expect(grandchildResult.ancestors[0].id).toBe('q1')
      expect(grandchildResult.ancestors[1].id).toBe('child1')
    })
  })

  describe('result structure', () => {
    it('includes id, text, rootIndex, and ancestors', async () => {
      const { query, results } = createComposable()

      query.value = 'Python'
      await nextTick()

      const result = results.value[0]
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('rootIndex')
      expect(result).toHaveProperty('ancestors')
    })

    it('sets correct rootIndex', async () => {
      const { query, results } = createComposable()

      query.value = 'React'
      await nextTick()

      const result = results.value.find(r => r.id === 'q3')
      expect(result.rootIndex).toBe(2) // Third question
    })
  })

  describe('clear', () => {
    it('clears the search query', async () => {
      const { query, clear } = createComposable()

      query.value = 'JavaScript'
      await nextTick()

      clear()

      expect(query.value).toBe('')
    })

    it('clears results when called', async () => {
      const { query, results, clear } = createComposable()

      query.value = 'JavaScript'
      await nextTick()
      expect(results.value.length).toBeGreaterThan(0)

      clear()
      await nextTick()

      expect(results.value).toEqual([])
    })
  })

  describe('getAncestorPath', () => {
    it('returns empty array for root message', () => {
      const { getAncestorPath } = createComposable()
      const path = getAncestorPath('q1')
      expect(path).toEqual([])
    })

    it('returns parent for child message', () => {
      const { getAncestorPath } = createComposable()
      const path = getAncestorPath('child1')
      expect(path.length).toBe(1)
      expect(path[0].id).toBe('q1')
    })

    it('returns full path for grandchild', () => {
      const { getAncestorPath } = createComposable()
      const path = getAncestorPath('grandchild1')
      expect(path.length).toBe(2)
      expect(path[0].id).toBe('q1')
      expect(path[1].id).toBe('child1')
    })

    it('uses questionSummarized for text when available', () => {
      const { getAncestorPath } = createComposable()
      const path = getAncestorPath('child1')
      expect(path[0].text).toBe('JS Basics')
    })

    it('falls back to question when no summarized version', () => {
      const { getAncestorPath } = createComposable()
      const path = getAncestorPath('grandchild1')
      expect(path[1].text).toBe('Array methods in JavaScript')
    })
  })

  describe('edge cases', () => {
    it('handles empty questions array', async () => {
      const { query, results } = createComposable(createMockMessages(), [])

      query.value = 'JavaScript'
      await nextTick()

      expect(results.value).toEqual([])
    })

    it('handles non-existent message in questions', async () => {
      const { query, results } = createComposable(createMockMessages(), [
        { id: 'nonexistent', text: 'Does not exist' }
      ])

      query.value = 'test'
      await nextTick()

      expect(results.value).toEqual([])
    })

    it('handles message with no question text', async () => {
      const messages = {
        q1: { id: 'q1', question: '', questionSummarized: '', parentId: null, childIds: [] }
      }
      const { query, results } = createComposable(messages, [{ id: 'q1', text: '' }])

      query.value = 'test'
      await nextTick()

      expect(results.value).toEqual([])
    })
  })
})
