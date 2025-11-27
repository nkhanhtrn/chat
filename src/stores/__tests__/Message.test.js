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

})
