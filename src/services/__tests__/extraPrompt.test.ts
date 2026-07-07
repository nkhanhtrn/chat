import { describe, it, expect } from 'vitest'
import { getMainPrompts, getQuickExplainPrompts, getSummaryPrompts } from '../extraPrompt'

describe('extraPrompt', () => {
  describe('getSummaryPrompts', () => {
    it('returns a system and user message', () => {
      const messages = getSummaryPrompts('some text here')
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })

    it('includes the text in the user message', () => {
      const messages = getSummaryPrompts('important passage')
      expect((messages[1] as { content: string }).content).toContain('important passage')
    })

    it('instructs the assistant to summarize', () => {
      const messages = getSummaryPrompts('text')
      const systemContent = (messages[0] as { content: string }).content
      expect(systemContent.toLowerCase()).toContain('summar')
    })
  })

  describe('getQuickExplainPrompts', () => {
    it('returns system and user messages', () => {
      const messages = getQuickExplainPrompts('explain this')
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })
  })

  describe('getMainPrompts', () => {
    it('returns system, optional history, and user messages', () => {
      const messages = getMainPrompts('what is X?', [{ question: 'what is Y?' }])
      expect(messages.length).toBeGreaterThanOrEqual(2)
      expect(messages[messages.length - 1].role).toBe('user')
    })
  })
})
