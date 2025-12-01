import { describe, it, expect } from 'vitest'
import { getMainPrompts, getShortenContentPrompts, getQuickExplainPrompts } from '../extraPrompt.js'

describe('extraPrompt', () => {
  describe('getMainPrompts', () => {
    it('should return an array of messages', () => {
      const messages = getMainPrompts('test question')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should include system prompt as first message', () => {
      const messages = getMainPrompts('test question')
      expect(messages[0].role).toBe('system')
      expect(typeof messages[0].content).toBe('string')
      expect(messages[0].content.length).toBeGreaterThan(0)
    })

    it('should include user message after system prompt', () => {
      const userMessage = 'What is JavaScript?'
      const messages = getMainPrompts(userMessage)
      expect(messages[1]).toEqual({
        role: 'user',
        content: userMessage
      })
    })

    it('should return exactly 2 messages', () => {
      const messages = getMainPrompts('test')
      expect(messages.length).toBe(2)
    })

    it('should preserve the exact user message content', () => {
      const userMessage = 'Hello\nWorld\nWith special chars: @#$%'
      const messages = getMainPrompts(userMessage)
      expect(messages[1].content).toBe(userMessage)
    })

    it('should include [NEWTOPIC] tag when passed for first root message', () => {
      const question = 'What is JavaScript?'
      const messages = getMainPrompts(`[NEWTOPIC] ${question}`)
      expect(messages[1].content).toBe(`[NEWTOPIC] ${question}`)
      expect(messages[1].content).toMatch(/^\[NEWTOPIC\]/)
    })

    it('should include [DEEPDIVE] tag when passed for follow-up questions', () => {
      const question = 'Tell me more about closures'
      const previousMessages = [{ question: 'What is JavaScript?' }]
      const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages)
      // With previous messages, user message is at index 2 (after system prompt and conversation history)
      const userMessage = messages[messages.length - 1]
      expect(userMessage.content).toBe(`[DEEPDIVE] ${question}`)
      expect(userMessage.content).toMatch(/^\[DEEPDIVE\]/)
    })

    it('should include conversation history for deep dive questions', () => {
      const question = 'Explain more about prototypes'
      const previousMessages = [
        { question: 'What is JavaScript?' },
        { question: 'How do objects work?' }
      ]
      const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages)
      // Should have system prompt, conversation history, and user message
      expect(messages.length).toBe(3)
      expect(messages[1].role).toBe('system')
      expect(messages[1].content).toContain('Previous questions')
      expect(messages[1].content).toContain('What is JavaScript?')
      expect(messages[1].content).toContain('How do objects work?')
      expect(messages[2].content).toBe(`[DEEPDIVE] ${question}`)
    })

    it('should not include conversation history for new topic (no previous messages)', () => {
      const question = 'What is Python?'
      const messages = getMainPrompts(`[NEWTOPIC] ${question}`)
      expect(messages.length).toBe(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
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

  describe('getQuickExplainPrompts', () => {
    it('should return an array of messages', () => {
      const messages = getQuickExplainPrompts('some concept')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should return exactly 1 message', () => {
      const messages = getQuickExplainPrompts('some concept')
      expect(messages.length).toBe(1)
    })

    it('should have user role', () => {
      const messages = getQuickExplainPrompts('test concept')
      expect(messages[0].role).toBe('user')
    })

    it('should include the text to explain in the message', () => {
      const textToExplain = 'This is a concept to explain'
      const messages = getQuickExplainPrompts(textToExplain)
      expect(messages[0].content).toContain(textToExplain)
    })

    it('should prepend a quick explain request prefix', () => {
      const textToExplain = 'Concept to explain'
      const messages = getQuickExplainPrompts(textToExplain)
      // The content should be longer than just the text (due to prefix)
      expect(messages[0].content.length).toBeGreaterThan(textToExplain.length)
    })

    it('should request a short paragraph explanation', () => {
      const messages = getQuickExplainPrompts('any text')
      // The prompt should mention short/concise/paragraph
      const content = messages[0].content.toLowerCase()
      expect(content).toMatch(/short|concise|paragraph|sentence/)
    })
  })

  describe('getMainPrompts with context questions', () => {
    const mockContextQuestions = [
      {
        id: 'ctx1',
        question: 'What is JavaScript?',
        questionSummarized: 'JavaScript basics',
        response: 'JavaScript is a programming language used for web development...'
      },
      {
        id: 'ctx2',
        question: 'What are closures?',
        questionSummarized: 'Closures explained',
        response: 'Closures are functions that have access to variables from outer scope...'
      }
    ]

    it('should accept context questions as third parameter', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should include context questions as system message', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      // Should have: system prompt, context message, user message
      expect(messages.length).toBe(3)
      expect(messages[1].role).toBe('system')
    })

    it('should include question content in context message', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      const contextMessage = messages[1]
      expect(contextMessage.content).toContain('JavaScript basics')
      expect(contextMessage.content).toContain('Closures explained')
    })

    it('should include response content in context message', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      const contextMessage = messages[1]
      expect(contextMessage.content).toContain('JavaScript is a programming language')
      expect(contextMessage.content).toContain('Closures are functions')
    })

    it('should use question text when questionSummarized is not available', () => {
      const contextWithoutSummary = [{
        id: 'ctx1',
        question: 'What is JavaScript?',
        questionSummarized: null,
        response: 'JavaScript is...'
      }]
      const messages = getMainPrompts('New question', [], contextWithoutSummary)
      const contextMessage = messages[1]
      expect(contextMessage.content).toContain('What is JavaScript?')
    })

    it('should number multiple context references', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      const contextMessage = messages[1]
      expect(contextMessage.content).toContain('Reference 1')
      expect(contextMessage.content).toContain('Reference 2')
    })

    it('should not include context message when contextQuestions is empty', () => {
      const messages = getMainPrompts('New question', [], [])
      expect(messages.length).toBe(2)
    })

    it('should not include context message when contextQuestions is undefined', () => {
      const messages = getMainPrompts('New question', [])
      expect(messages.length).toBe(2)
    })

    it('should include both context and conversation history when both provided', () => {
      const previousMessages = [{ question: 'Previous question' }]
      const messages = getMainPrompts('New question', previousMessages, mockContextQuestions)
      // Should have: system prompt, context message, conversation history, user message
      expect(messages.length).toBe(4)
      expect(messages[1].content).toContain('Reference 1')
      expect(messages[2].content).toContain('Previous questions')
    })

    it('should preserve user message as last message with context', () => {
      const messages = getMainPrompts('My new question', [], mockContextQuestions)
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.role).toBe('user')
      expect(lastMessage.content).toBe('My new question')
    })

    it('should include instruction to consider context', () => {
      const messages = getMainPrompts('New question', [], mockContextQuestions)
      const contextMessage = messages[1]
      expect(contextMessage.content.toLowerCase()).toContain('context')
    })

    it('should handle single context question', () => {
      const singleContext = [mockContextQuestions[0]]
      const messages = getMainPrompts('New question', [], singleContext)
      expect(messages.length).toBe(3)
      expect(messages[1].content).toContain('Reference 1')
      expect(messages[1].content).not.toContain('Reference 2')
    })
  })
})
