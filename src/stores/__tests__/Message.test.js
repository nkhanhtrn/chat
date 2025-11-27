import { describe, it, expect } from 'vitest'
import Message from '../Message.js'

describe('Message', () => {
  it('creates a message with required fields', () => {
    const msg = new Message({ id: '1', question: 'Q', response: 'A' })
    expect(msg.id).toBe('1')
    expect(msg.question).toBe('Q')
    expect(msg.response).toBe('A')
    expect(msg.parentId).toBe(null)
    expect(Array.isArray(msg.children)).toBe(true)
    expect(msg.children.length).toBe(0)
  })

  it('creates a message with parentId and children', () => {
    const child = new Message({ id: '2', question: 'C', response: 'D' })
    const msg = new Message({ id: '1', question: 'Q', response: 'A', parentId: null, children: [child] })
    expect(msg.children[0]).toBe(child)
    expect(msg.children[0].question).toBe('C')
  })


  it('addChild accepts plain object', () => {
    const parent = new Message({ id: '1', question: 'Q', response: 'A' })
    parent.addChild({ id: '2', question: 'C', response: 'D' })
    expect(parent.children.length).toBe(1)
    expect(parent.children[0]).toBeInstanceOf(Message)
    expect(parent.children[0].question).toBe('C')
  })

  describe('Message.createChildMessage', () => {
    it('creates a child message with correct parent', () => {
      const parent = new Message({ id: 'parent', question: 'Q', response: 'R', children: [] })
      const question = 'child question'
      const child = Message.createChildMessage(parent, question)
      expect(child.parentId).toBe(parent.id)
      expect(child.question).toBe(question)
      expect(child.response).toBe('')
      expect(child.parent).toBe(parent)
      expect(child.children).toEqual([])
    })

    it('creates a child message with highlightedText', () => {
      const parent = new Message({ id: 'parent', question: 'Q', response: 'This is a test response', children: [] })
      const question = 'Tell me more about this'
      const highlightedText = 'test response'
      const child = Message.createChildMessage(parent, question, highlightedText)
      expect(child.parentId).toBe(parent.id)
      expect(child.question).toBe(question)
      expect(child.highlightedText).toBe(highlightedText)
      expect(child.response).toBe('')
      expect(child.parent).toBe(parent)
    })

    it('creates a child message without highlightedText when not provided', () => {
      const parent = new Message({ id: 'parent', question: 'Q', response: 'R', children: [] })
      const question = 'child question'
      const child = Message.createChildMessage(parent, question)
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
        children: []
      })
      expect(msg.hasChildren).toBe(false)
    })

    it('returns true when message has one child', () => {
      const child = new Message({ id: '2', question: 'C', response: 'D' })
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: [child]
      })
      expect(msg.hasChildren).toBe(true)
    })

    it('returns true when message has multiple children', () => {
      const child1 = new Message({ id: '2', question: 'C1', response: 'D1' })
      const child2 = new Message({ id: '3', question: 'C2', response: 'D2' })
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: [child1, child2]
      })
      expect(msg.hasChildren).toBe(true)
    })

    it('returns falsy when children is undefined', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A'
      })
      msg.children = undefined
      expect(msg.hasChildren).toBeFalsy()
    })
  })

  describe('lastAccessedChild getter', () => {
    it('returns null when message has no children', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: []
      })
      expect(msg.lastAccessedChild).toBe(null)
    })

    it('returns the only child when message has one child', () => {
      const child = new Message({ id: '2', question: 'C', response: 'D' })
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: [child]
      })
      expect(msg.lastAccessedChild).toBe(child)
    })

    it('returns the last child when message has multiple children', () => {
      const child1 = new Message({ id: '2', question: 'C1', response: 'D1' })
      const child2 = new Message({ id: '3', question: 'C2', response: 'D2' })
      const child3 = new Message({ id: '4', question: 'C3', response: 'D3' })
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: [child1, child2, child3]
      })
      expect(msg.lastAccessedChild).toBe(child3)
    })

    it('updates when a new child is added', () => {
      const child1 = new Message({ id: '2', question: 'C1', response: 'D1' })
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A',
        children: [child1]
      })
      expect(msg.lastAccessedChild).toBe(child1)

      const child2 = new Message({ id: '3', question: 'C2', response: 'D2' })
      msg.addChild(child2)
      expect(msg.lastAccessedChild).toBe(child2)
    })

    it('returns null when children is undefined', () => {
      const msg = new Message({
        id: '1',
        question: 'Q',
        response: 'A'
      })
      msg.children = undefined
      expect(msg.lastAccessedChild).toBe(null)
    })
  })

  describe('parent property', () => {
    it('stores parent reference when provided', () => {
      const parent = new Message({ id: 'parent', question: 'P', response: 'R' })
      const child = new Message({
        id: 'child',
        question: 'C',
        response: 'R',
        parent: parent
      })
      expect(child.parent).toBe(parent)
    })

    it('does not set parent property when not provided', () => {
      const msg = new Message({ id: '1', question: 'Q', response: 'A' })
      expect(msg.hasOwnProperty('parent')).toBe(false)
    })

    it('sets parent reference in createChildMessage', () => {
      const parent = new Message({ id: 'parent', question: 'Q', response: 'R', children: [] })
      const child = Message.createChildMessage(parent, 'child question')
      expect(child.parent).toBe(parent)
    })
  })
})
