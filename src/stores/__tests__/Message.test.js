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
  })
})
