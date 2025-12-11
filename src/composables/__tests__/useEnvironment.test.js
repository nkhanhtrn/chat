import { describe, it, expect, beforeEach } from 'vitest'
import { getDevToolbarEnabled, setDevToolbarEnabled } from '../useEnvironment.js'

describe('useEnvironment', () => {
  describe('getDevToolbarEnabled', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should return false when localStorage is not set', () => {
      expect(getDevToolbarEnabled()).toBe(false)
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
      setDevToolbarEnabled(false)
      expect(getDevToolbarEnabled()).toBe(false)

      setDevToolbarEnabled(true)
      expect(getDevToolbarEnabled()).toBe(true)
    })
  })
})
