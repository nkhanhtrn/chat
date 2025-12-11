import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDevToolbarEnabled, setDevToolbarEnabled } from '../useEnvironment.js'

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

  describe('getDevToolbarEnabled', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    describe('in production mode', () => {
      beforeEach(() => {
        import.meta.env.DEV = false
      })

      it('should return false regardless of localStorage', () => {
        localStorage.setItem('devToolbarEnabled', 'true')
        expect(getDevToolbarEnabled()).toBe(false)
      })

      it('should return false when localStorage is not set', () => {
        expect(getDevToolbarEnabled()).toBe(false)
      })
    })

    describe('in development mode', () => {
      beforeEach(() => {
        import.meta.env.DEV = true
      })

      it('should default to true when localStorage is not set', () => {
        expect(getDevToolbarEnabled()).toBe(true)
      })

      it('should return true when localStorage is set to "true"', () => {
        localStorage.setItem('devToolbarEnabled', 'true')
        expect(getDevToolbarEnabled()).toBe(true)
      })

      it('should return false when localStorage is set to "false"', () => {
        localStorage.setItem('devToolbarEnabled', 'false')
        expect(getDevToolbarEnabled()).toBe(false)
      })

      it('should return false for any non-"true" string value', () => {
        localStorage.setItem('devToolbarEnabled', 'yes')
        expect(getDevToolbarEnabled()).toBe(false)
      })
    })
  })

  describe('setDevToolbarEnabled', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should store "true" in localStorage when enabled is true', () => {
      setDevToolbarEnabled(true)
      expect(localStorage.getItem('devToolbarEnabled')).toBe('true')
    })

    it('should store "false" in localStorage when enabled is false', () => {
      setDevToolbarEnabled(false)
      expect(localStorage.getItem('devToolbarEnabled')).toBe('false')
    })

    it('should overwrite existing value', () => {
      setDevToolbarEnabled(true)
      expect(localStorage.getItem('devToolbarEnabled')).toBe('true')

      setDevToolbarEnabled(false)
      expect(localStorage.getItem('devToolbarEnabled')).toBe('false')
    })

    it('should persist value that getDevToolbarEnabled can read', () => {
      import.meta.env.DEV = true

      setDevToolbarEnabled(false)
      expect(getDevToolbarEnabled()).toBe(false)

      setDevToolbarEnabled(true)
      expect(getDevToolbarEnabled()).toBe(true)
    })
  })
})
