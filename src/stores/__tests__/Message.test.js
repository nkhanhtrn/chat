import { describe, it, expect } from 'vitest'
import Message from '../Message.js'

describe('Message', () => {
  it('creates a message with required fields', () => {
    const msg = new Message({ id: '1', question: 'Q', response: 'A' })
    expect(msg.id).toBe('1')
    expect(msg.question).toBe('Q')
    expect(msg.response).toBe('A')
    expect(msg.parentId).toBe(null)
    expect(Array.isArray(msg.childIds)).toBe(true)
    expect(msg.childIds.length).toBe(0)
  })

  it('creates a message with parentId and childIds', () => {
    const msg = new Message({ id: '1', question: 'Q', response: 'A', parentId: null, childIds: ['2', '3'] })
    expect(msg.childIds[0]).toBe('2')
    expect(msg.childIds[1]).toBe('3')
  })

  it('creates a message with empty childIds by default', () => {
    const msg = new Message({ id: '1', question: 'Q', response: 'A' })
    expect(Array.isArray(msg.childIds)).toBe(true)
    expect(msg.childIds.length).toBe(0)
  })

  describe('Message.createChildMessage', () => {
    it('creates a child message with correct parent', () => {
      const parentId = 'parent'
      const question = 'child question'
      const child = Message.createChildMessage(parentId, question)
      expect(child.parentId).toBe(parentId)
      expect(child.question).toBe(question)
      expect(child.response).toBe('')
      expect(child.childIds).toEqual([])
    })

    it('creates a child message with highlightedText', () => {
      const parentId = 'parent'
      const question = 'Tell me more about this'
      const highlightedText = 'test response'
      const child = Message.createChildMessage(parentId, question, highlightedText)
      expect(child.parentId).toBe(parentId)
      expect(child.question).toBe(question)
      expect(child.highlightedText).toBe(highlightedText)
      expect(child.response).toBe('')
    })

    it('creates a child message without highlightedText when not provided', () => {
      const parentId = 'parent'
      const question = 'child question'
      const child = Message.createChildMessage(parentId, question)
      expect(child.highlightedText).toBe(null)
    })
  })

  describe('highlightedText', () => {
    it('stores highlightedText in constructor', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        highlightedText: 'highlighted'
      })
      expect(msg.highlightedText).toBe('highlighted')
    })

    it('defaults highlightedText to null if not provided', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'A' })
      expect(msg.highlightedText).toBe(null)
    })
  })

  describe('hasChildren getter', () => {
    it('returns false when message has no children', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        childIds: []
      })
      expect(msg.hasChildren).toBe(false)
    })

    it('returns true when message has one child', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        childIds: ['2']
      })
      expect(msg.hasChildren).toBe(true)
    })

    it('returns true when message has multiple children', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        childIds: ['2', '3']
      })
      expect(msg.hasChildren).toBe(true)
    })

    it('returns falsy when childIds is undefined', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A'
      })
      msg.childIds = undefined
      expect(msg.hasChildren).toBeFalsy()
    })
  })

  describe('addNewChild setter', () => {
    it('adds a new childId and updates lastVisitedChild', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'A', childIds: [] })
      msg.addNewChild = 'child-1'
      expect(msg.childIds).toContain('child-1')
      expect(msg.lastVisitedChild).toBe('child-1')
    })

    it('initializes childIds if undefined and adds child', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'A' })
      msg.childIds = undefined
      msg.addNewChild = 'child-2'
      expect(msg.childIds).toEqual(['child-2'])
      expect(msg.lastVisitedChild).toBe('child-2')
    })
  })

  describe('updateQuestionSummarized', () => {
    it('sets questionSummarized to summary if provided', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'A' })
      msg.updateQuestionSummarized('summary')
      expect(msg.questionSummarized).toBe('summary')
    })

    it('sets questionSummarized to first line of response and removes it from response if summary not provided', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'First line\nSecond line\nThird line' })
      msg.updateQuestionSummarized()
      expect(msg.questionSummarized).toBe('First line')
      expect(msg.response).toBe('Second line\nThird line')
    })

    it('does nothing if response is not a string', () => {
      const msg = new Message({ id: '1', question: 'Q', response: null })
      msg.updateQuestionSummarized()
      expect(msg.questionSummarized).toBe('Q')
      expect(msg.response).toBe(null)
    })
  })

  describe('Persistence of all Message properties', () => {
    it('preserves questionSummarized when reconstructing from persisted data', () => {
      // Create a message with a long question
      const msg = new Message({
        id: '1',
        question: 'This is a very long question that exceeds one hundred characters and should be automatically truncated by the constructor',
        response: 'A'
      })

      // Update the questionSummarized to a custom value
      msg.updateQuestionSummarized('Custom Summary')

      // Simulate serialization and deserialization (like localStorage does)
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      // The custom summary should be preserved
      expect(restored.questionSummarized).toBe('Custom Summary')
    })

    it('preserves lastVisitedChild when reconstructing from persisted data', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        childIds: ['child-1', 'child-2']
      })

      // Set lastVisitedChild
      msg.lastVisitedChild = 'child-2'

      // Simulate serialization and deserialization
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      // lastVisitedChild should be preserved
      expect(restored.lastVisitedChild).toBe('child-2')
    })

    it('preserves all properties when reconstructing a complete Message', () => {
      const originalData = {
        id: 'msg-123',
        question: 'What is the meaning of life?',
        questionSummarized: 'Life meaning?',
        response: 'The answer is 42',
        parentId: 'parent-456',
        childIds: ['child-1', 'child-2', 'child-3'],
        highlightedText: 'some highlighted text',
        lastVisitedChild: 'child-2'
      }

      const msg = new Message(originalData)

      // Verify all properties are set correctly
      expect(msg.id).toBe(originalData.id)
      expect(msg.question).toBe(originalData.question)
      expect(msg.questionSummarized).toBe(originalData.questionSummarized)
      expect(msg.response).toBe(originalData.response)
      expect(msg.parentId).toBe(originalData.parentId)
      expect(msg.childIds).toEqual(originalData.childIds)
      expect(msg.highlightedText).toBe(originalData.highlightedText)
      expect(msg.lastVisitedChild).toBe(originalData.lastVisitedChild)

      // Simulate persistence (JSON serialization/deserialization)
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      // Verify all properties are preserved after restoration
      expect(restored.id).toBe(originalData.id)
      expect(restored.question).toBe(originalData.question)
      expect(restored.questionSummarized).toBe(originalData.questionSummarized)
      expect(restored.response).toBe(originalData.response)
      expect(restored.parentId).toBe(originalData.parentId)
      expect(restored.childIds).toEqual(originalData.childIds)
      expect(restored.highlightedText).toBe(originalData.highlightedText)
      expect(restored.lastVisitedChild).toBe(originalData.lastVisitedChild)
    })

    it('correctly defaults questionSummarized when not provided in persisted data', () => {
      const shortQuestion = 'Short Q'
      const msg = new Message({
        id: '1',
        question: shortQuestion,
        response: 'A'
      })

      // Simulate serialization and deserialization
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      // questionSummarized should default to the question since it's short
      expect(restored.questionSummarized).toBe(shortQuestion)
    })

    it('correctly defaults questionSummarized to truncated question when question is long and no custom summary provided', () => {
      const longQuestion = 'This is a very long question that definitely exceeds one hundred characters in length and therefore should be truncated automatically'
      const msg = new Message({
        id: '1',
        question: longQuestion,
        response: 'A'
      })

      // Simulate serialization and deserialization
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      // questionSummarized should be truncated to 100 chars + '...'
      expect(restored.questionSummarized).toBe(longQuestion.slice(0, 100) + '...')
      expect(restored.questionSummarized.length).toBe(103)
    })

    it('preserves null values for optional properties', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        parentId: null,
        highlightedText: null,
        lastVisitedChild: null
      })

      // Simulate serialization and deserialization
      const serialized = JSON.parse(JSON.stringify(msg))
      const restored = new Message(serialized)

      expect(restored.parentId).toBe(null)
      expect(restored.highlightedText).toBe(null)
      expect(restored.lastVisitedChild).toBe(null)
    })
  })

})
