import { describe, it, expect } from 'vitest'
import {
  createEmptyUsage,
  parseOpenAIUsage,
  parseGeminiUsage,
  mergeUsage,
  formatTokenCount,
  formatUsage,
  estimateTokens,
  createEstimatedUsage
} from '../tokenUsage.js'

describe('tokenUsage utilities', () => {
  describe('createEmptyUsage', () => {
    it('should create an empty usage object with all zeros', () => {
      const usage = createEmptyUsage()
      expect(usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      })
    })
  })

  describe('parseOpenAIUsage', () => {
    it('should parse OpenAI-compatible usage data', () => {
      const response = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }
      const usage = parseOpenAIUsage(response)
      expect(usage).toEqual({
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300
      })
    })

    it('should calculate total if not provided', () => {
      const response = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200
        }
      }
      const usage = parseOpenAIUsage(response)
      expect(usage.totalTokens).toBe(300)
    })

    it('should return null if no usage data', () => {
      expect(parseOpenAIUsage({})).toBeNull()
      expect(parseOpenAIUsage(null)).toBeNull()
      expect(parseOpenAIUsage({ other: 'data' })).toBeNull()
    })

    it('should handle missing fields gracefully', () => {
      const response = { usage: {} }
      const usage = parseOpenAIUsage(response)
      expect(usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      })
    })
  })

  describe('parseGeminiUsage', () => {
    it('should parse Gemini usage metadata', () => {
      const response = {
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 250,
          totalTokenCount: 400
        }
      }
      const usage = parseGeminiUsage(response)
      expect(usage).toEqual({
        promptTokens: 150,
        completionTokens: 250,
        totalTokens: 400
      })
    })

    it('should calculate total if not provided', () => {
      const response = {
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 200
        }
      }
      const usage = parseGeminiUsage(response)
      expect(usage.totalTokens).toBe(300)
    })

    it('should return null if no usage metadata', () => {
      expect(parseGeminiUsage({})).toBeNull()
      expect(parseGeminiUsage(null)).toBeNull()
    })
  })

  describe('mergeUsage', () => {
    it('should merge multiple usage objects', () => {
      const usage1 = { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
      const usage2 = { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
      const merged = mergeUsage(usage1, usage2)
      expect(merged).toEqual({
        promptTokens: 150,
        completionTokens: 300,
        totalTokens: 450
      })
    })

    it('should handle null values', () => {
      const usage1 = { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
      const merged = mergeUsage(usage1, null, undefined)
      expect(merged).toEqual(usage1)
    })

    it('should return empty usage when no arguments', () => {
      const merged = mergeUsage()
      expect(merged).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      })
    })

    it('should merge three or more usage objects', () => {
      const usage1 = { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      const usage2 = { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      const usage3 = { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      const merged = mergeUsage(usage1, usage2, usage3)
      expect(merged).toEqual({
        promptTokens: 30,
        completionTokens: 60,
        totalTokens: 90
      })
    })
  })

  describe('formatTokenCount', () => {
    it('should format small numbers as-is', () => {
      expect(formatTokenCount(0)).toBe('0')
      expect(formatTokenCount(100)).toBe('100')
      expect(formatTokenCount(999)).toBe('999')
    })

    it('should format thousands with k suffix', () => {
      expect(formatTokenCount(1000)).toBe('1.0k')
      expect(formatTokenCount(1500)).toBe('1.5k')
      expect(formatTokenCount(10000)).toBe('10.0k')
      expect(formatTokenCount(12345)).toBe('12.3k')
    })

    it('should handle large numbers', () => {
      expect(formatTokenCount(100000)).toBe('100.0k')
      expect(formatTokenCount(1000000)).toBe('1000.0k')
    })
  })

  describe('formatUsage', () => {
    it('should return empty string for null or zero usage', () => {
      expect(formatUsage(null)).toBe('')
      expect(formatUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })).toBe('')
    })

    it('should format total by default', () => {
      const usage = { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
      expect(formatUsage(usage)).toBe('300')
    })

    it('should format with breakdown when requested', () => {
      const usage = { promptTokens: 1000, completionTokens: 2000, totalTokens: 3000 }
      expect(formatUsage(usage, { showBreakdown: true })).toBe('1.0k in / 2.0k out')
    })
  })

  describe('estimateTokens', () => {
    it('should estimate tokens as ~4 chars per token', () => {
      expect(estimateTokens('1234')).toBe(1)
      expect(estimateTokens('12345678')).toBe(2)
      expect(estimateTokens('123456789012')).toBe(3)
    })

    it('should handle empty or null input', () => {
      expect(estimateTokens('')).toBe(0)
      expect(estimateTokens(null)).toBe(0)
      expect(estimateTokens(undefined)).toBe(0)
    })

    it('should round up', () => {
      expect(estimateTokens('12345')).toBe(2) // 5/4 = 1.25 -> 2
    })
  })

  describe('createEstimatedUsage', () => {
    it('should create usage from text estimates', () => {
      const usage = createEstimatedUsage('1234567890', '12345678901234567890') // 10 chars, 20 chars
      expect(usage.promptTokens).toBe(3) // 10/4 = 2.5 -> 3
      expect(usage.completionTokens).toBe(5) // 20/4 = 5
      expect(usage.totalTokens).toBe(8)
    })

    it('should handle empty input', () => {
      const usage = createEstimatedUsage('', '')
      expect(usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      })
    })
  })
})
