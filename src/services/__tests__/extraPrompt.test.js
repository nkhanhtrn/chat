import { describe, it, expect } from 'vitest'
import { getInitialPrompts, getNextPrompts, getShortenContentPrompts } from '../extraPrompt.js'

describe('extraPrompt', () => {
  describe('getInitialPrompts', () => {
    it('should return an array of messages', () => {
      const messages = getInitialPrompts('test question')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should include system prompt as first message', () => {
      const messages = getInitialPrompts('test question')
      expect(messages[0].role).toBe('system')
      expect(typeof messages[0].content).toBe('string')
      expect(messages[0].content.length).toBeGreaterThan(0)
    })

    it('should include user message after system prompt', () => {
      const userMessage = 'What is JavaScript?'
      const messages = getInitialPrompts(userMessage)
      expect(messages[1]).toEqual({
        role: 'user',
        content: userMessage
      })
    })

    it('should return exactly 2 messages', () => {
      const messages = getInitialPrompts('test')
      expect(messages.length).toBe(2)
    })

    it('should preserve the exact user message content', () => {
      const userMessage = 'Hello\nWorld\nWith special chars: @#$%'
      const messages = getInitialPrompts(userMessage)
      expect(messages[1].content).toBe(userMessage)
    })
  })

  describe('getNextPrompts', () => {
    it('should return an array of messages', () => {
      const messages = getNextPrompts('follow up question')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should include system prompt as first message', () => {
      const messages = getNextPrompts('follow up question')
      expect(messages[0].role).toBe('system')
      expect(typeof messages[0].content).toBe('string')
      expect(messages[0].content.length).toBeGreaterThan(0)
    })

    it('should include user message after system prompt', () => {
      const userMessage = 'Tell me more about closures'
      const messages = getNextPrompts(userMessage)
      expect(messages[1]).toEqual({
        role: 'user',
        content: userMessage
      })
    })

    it('should return exactly 2 messages', () => {
      const messages = getNextPrompts('test')
      expect(messages.length).toBe(2)
    })

    it('should preserve the exact user message content', () => {
      const userMessage = 'Complex question\nwith multiple lines'
      const messages = getNextPrompts(userMessage)
      expect(messages[1].content).toBe(userMessage)
    })
  })

  describe('getShortenContentPrompts', () => {
    it('should return an array of messages', () => {
      const messages = getShortenContentPrompts('some long content')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should return exactly 1 message', () => {
      const messages = getShortenContentPrompts('some content')
      expect(messages.length).toBe(1)
    })

    it('should have user role', () => {
      const messages = getShortenContentPrompts('test content')
      expect(messages[0].role).toBe('user')
    })

    it('should include the user content in the message', () => {
      const userContent = 'This is a long piece of content to summarize'
      const messages = getShortenContentPrompts(userContent)
      expect(messages[0].content).toContain(userContent)
    })

    it('should prepend a summary request prefix', () => {
      const userContent = 'Content to summarize'
      const messages = getShortenContentPrompts(userContent)
      // The content should be longer than just the user content (due to prefix)
      expect(messages[0].content.length).toBeGreaterThan(userContent.length)
    })
  })
})
