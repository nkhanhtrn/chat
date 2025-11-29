import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getIsDev, getDefaultQuestions } from '../useEnvironment.js'

describe('useEnvironment', () => {
  // Store original import.meta.env
  let originalEnv

  beforeEach(() => {
    originalEnv = import.meta.env.DEV
  })

  afterEach(() => {
    // Restore original environment
    import.meta.env.DEV = originalEnv
  })

  describe('getIsDev', () => {
    it('should return true when in development mode', () => {
      import.meta.env.DEV = true
      expect(getIsDev()).toBe(true)
    })

    it('should return false when in production mode', () => {
      import.meta.env.DEV = false
      expect(getIsDev()).toBe(false)
    })
  })

  describe('getDefaultQuestions', () => {
    describe('in production mode', () => {
      beforeEach(() => {
        import.meta.env.DEV = false
      })

      it('should return production questions', () => {
        const questions = getDefaultQuestions()
        expect(questions).toEqual([
          'Explain quantum physics in simple terms',
          'How does photosynthesis work?',
          'Teach me about the French Revolution',
        ])
      })

      it('should return an array of 3 questions', () => {
        const questions = getDefaultQuestions()
        expect(questions).toHaveLength(3)
      })

      it('should return educational questions', () => {
        const questions = getDefaultQuestions()
        expect(questions.every(q => typeof q === 'string' && q.length > 0)).toBe(true)
      })
    })

    describe('environment-based behavior', () => {
      it('should return different questions based on environment', () => {
        import.meta.env.DEV = true
        const devQuestions = getDefaultQuestions()

        import.meta.env.DEV = false
        const prodQuestions = getDefaultQuestions()

        expect(devQuestions).not.toEqual(prodQuestions)
      })

      it('should consistently return the same questions for the same environment', () => {
        import.meta.env.DEV = true
        const questions1 = getDefaultQuestions()
        const questions2 = getDefaultQuestions()

        expect(questions1).toEqual(questions2)
      })
    })
  })
})
