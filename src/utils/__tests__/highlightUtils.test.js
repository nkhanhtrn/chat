import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mergeOverlappingHighlights,
  buildConversationChain,
  isMessageInTree,
  createTempHighlight,
  createHighlight,
  createQuestionLink
} from '../highlightUtils.js'

describe('highlightUtils', () => {
  describe('mergeOverlappingHighlights', () => {
    it('returns base highlights when no temp highlight', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }]
      const result = mergeOverlappingHighlights(base, null)
      expect(result).toEqual(base)
    })

    it('appends temp highlight when no overlap', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 10, endOffset: 15, text: 'test' }

      const result = mergeOverlappingHighlights(base, temp)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(base[0])
      expect(result).toContainEqual(temp)
    })

    it('merges overlapping highlights extending after', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 5, endOffset: 10 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 8, endOffset: 15, text: 'overlap' }
      const response = 'Hello world this is test'

      const result = mergeOverlappingHighlights(base, temp, response)

      expect(result).toHaveLength(1)
      expect(result[0].startOffset).toBe(5)
      expect(result[0].endOffset).toBe(15)
    })

    it('merges overlapping highlights extending before', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 10, endOffset: 20 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 5, endOffset: 15, text: 'test' }
      const response = 'Hello world this is a test message'

      const result = mergeOverlappingHighlights(base, temp, response)

      expect(result).toHaveLength(1)
      expect(result[0].startOffset).toBe(5)
      expect(result[0].endOffset).toBe(20)
    })

    it('merges multiple overlapping highlights', () => {
      const base = [
        { id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 },
        { id: 'h2', type: 'highlight', startOffset: 10, endOffset: 15 }
      ]
      const temp = { id: 'temp', type: 'highlight', startOffset: 3, endOffset: 12, text: 'spans both' }
      const response = 'Hello world this is test'

      const result = mergeOverlappingHighlights(base, temp, response)

      expect(result).toHaveLength(1)
      expect(result[0].startOffset).toBe(0)
      expect(result[0].endOffset).toBe(15)
    })

    it('does not merge question-links with highlights', () => {
      const base = [{ id: 'ql1', type: 'question-link', startOffset: 5, endOffset: 10 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 5, endOffset: 10, text: 'same' }

      const result = mergeOverlappingHighlights(base, temp)

      expect(result).toHaveLength(2)
    })

    it('extracts merged text from response', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 3, endOffset: 11, text: 'lo wor' }
      const response = 'Hello world'

      const result = mergeOverlappingHighlights(base, temp, response)

      expect(result[0].text).toBe('Hello world')
    })

    it('uses temp text when no response provided', () => {
      const base = [{ id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }]
      const temp = { id: 'temp', type: 'highlight', startOffset: 3, endOffset: 11, text: 'original' }

      const result = mergeOverlappingHighlights(base, temp)

      expect(result[0].text).toBe('original')
    })
  })

  describe('buildConversationChain', () => {
    it('returns empty array for non-existent message', () => {
      const messagesById = {}
      const result = buildConversationChain(messagesById, 'nonexistent')
      expect(result).toEqual([])
    })

    it('returns single item for root message', () => {
      const messagesById = {
        'msg1': { id: 'msg1', question: 'Q1', parentId: null }
      }

      const result = buildConversationChain(messagesById, 'msg1')

      expect(result).toEqual([{ question: 'Q1' }])
    })

    it('builds chain from root to leaf', () => {
      const messagesById = {
        'root': { id: 'root', question: 'Root Q', parentId: null },
        'child1': { id: 'child1', question: 'Child Q', parentId: 'root' },
        'child2': { id: 'child2', question: 'Grandchild Q', parentId: 'child1' }
      }

      const result = buildConversationChain(messagesById, 'child2')

      expect(result).toEqual([
        { question: 'Root Q' },
        { question: 'Child Q' },
        { question: 'Grandchild Q' }
      ])
    })

    it('handles broken parent references gracefully', () => {
      const messagesById = {
        'orphan': { id: 'orphan', question: 'Orphan Q', parentId: 'nonexistent' }
      }

      const result = buildConversationChain(messagesById, 'orphan')

      expect(result).toEqual([{ question: 'Orphan Q' }])
    })
  })

  describe('isMessageInTree', () => {
    const messagesById = {
      'root': { id: 'root', parentId: null },
      'child1': { id: 'child1', parentId: 'root' },
      'child2': { id: 'child2', parentId: 'child1' },
      'other': { id: 'other', parentId: null }
    }

    it('returns true for root message itself', () => {
      expect(isMessageInTree(messagesById, 'root', 'root')).toBe(true)
    })

    it('returns true for direct child', () => {
      expect(isMessageInTree(messagesById, 'child1', 'root')).toBe(true)
    })

    it('returns true for nested descendant', () => {
      expect(isMessageInTree(messagesById, 'child2', 'root')).toBe(true)
    })

    it('returns false for unrelated message', () => {
      expect(isMessageInTree(messagesById, 'other', 'root')).toBe(false)
    })

    it('returns false for non-existent message', () => {
      expect(isMessageInTree(messagesById, 'nonexistent', 'root')).toBe(false)
    })

    it('returns false for non-existent root', () => {
      expect(isMessageInTree(messagesById, 'child1', 'nonexistent')).toBe(false)
    })
  })

  describe('createTempHighlight', () => {
    it('creates temp highlight with default id', () => {
      const result = createTempHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(result).toEqual({
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'test',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 4,
        hasNote: false,
        noteContent: ''
      })
    })

    it('creates temp highlight with note id when hasNote is true', () => {
      const result = createTempHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        hasNote: true,
        noteContent: 'my note'
      })

      expect(result.id).toBe('__temp_highlight_with_note__')
      expect(result.hasNote).toBe(true)
      expect(result.noteContent).toBe('my note')
    })

    it('uses provided colorIndex', () => {
      const result = createTempHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        colorIndex: 3
      })

      expect(result.colorIndex).toBe(3)
    })
  })

  describe('createHighlight', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', {
        randomUUID: () => 'test-uuid-123'
      })
    })

    it('creates highlight with generated id', () => {
      const result = createHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(result.id).toBe('test-uuid-123')
      expect(result.type).toBe('highlight')
      expect(result.text).toBe('test')
    })

    it('includes note when hasNote is true', () => {
      const result = createHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        hasNote: true,
        noteContent: 'my note'
      })

      expect(result.hasNote).toBe(true)
      expect(result.noteContent).toBe('my note')
    })

    it('omits note properties when hasNote is false', () => {
      const result = createHighlight({
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        hasNote: false
      })

      expect(result.hasNote).toBeUndefined()
      expect(result.noteContent).toBeUndefined()
    })
  })

  describe('createQuestionLink', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', {
        randomUUID: () => 'link-uuid-456'
      })
    })

    it('creates question link with generated id', () => {
      const result = createQuestionLink({
        text: 'link text',
        targetMessageId: 'target-123',
        startOffset: 10,
        endOffset: 20
      })

      expect(result.id).toBe('link-uuid-456')
      expect(result.type).toBe('question-link')
      expect(result.text).toBe('link text')
      expect(result.targetMessageId).toBe('target-123')
    })

    it('includes note when noteContent is provided', () => {
      const result = createQuestionLink({
        text: 'link text',
        targetMessageId: 'target-123',
        startOffset: 10,
        endOffset: 20,
        noteContent: 'preserved note'
      })

      expect(result.hasNote).toBe(true)
      expect(result.noteContent).toBe('preserved note')
    })

    it('omits note properties when noteContent is empty', () => {
      const result = createQuestionLink({
        text: 'link text',
        targetMessageId: 'target-123',
        startOffset: 10,
        endOffset: 20,
        noteContent: ''
      })

      expect(result.hasNote).toBeUndefined()
      expect(result.noteContent).toBeUndefined()
    })
  })
})
