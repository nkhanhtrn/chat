import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setTheme,
  getTheme,
  getValidThemes,
  loadCachedTheme,
  initializeTheme,
  applySettings,
  exposeGlobally,
  _resetForTesting
} from '../settings.js'

describe('settings service', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetForTesting()
    // Reset document attributes
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
    // Clean up global functions
    delete window.__setTheme
    delete window.__getTheme
  })

  afterEach(() => {
    localStorage.clear()
    _resetForTesting()
  })

  describe('setTheme', () => {
    it('sets a valid theme and returns true', () => {
      const result = setTheme('dark')
      expect(result).toBe(true)
      expect(getTheme()).toBe('dark')
    })

    it('applies theme to document element', () => {
      setTheme('sepia')
      expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    })

    it('caches theme to localStorage', () => {
      setTheme('dark')
      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('returns false for invalid theme', () => {
      const result = setTheme('invalid-theme')
      expect(result).toBe(false)
    })

    it('does not change theme for invalid input', () => {
      setTheme('dark')
      setTheme('invalid')
      expect(getTheme()).toBe('dark')
    })

    it('handles all valid themes', () => {
      for (const theme of ['light', 'dark', 'sepia']) {
        const result = setTheme(theme)
        expect(result).toBe(true)
        expect(getTheme()).toBe(theme)
        expect(document.documentElement.getAttribute('data-theme')).toBe(theme)
      }
    })
  })

  describe('getTheme', () => {
    it('returns default theme initially', () => {
      expect(getTheme()).toBe('light')
    })

    it('returns current theme after setTheme', () => {
      setTheme('dark')
      expect(getTheme()).toBe('dark')
    })
  })

  describe('getValidThemes', () => {
    it('returns array of valid themes', () => {
      const themes = getValidThemes()
      expect(themes).toEqual(['light', 'dark', 'sepia'])
    })

    it('returns a copy, not the original array', () => {
      const themes1 = getValidThemes()
      const themes2 = getValidThemes()
      expect(themes1).not.toBe(themes2)
      themes1.push('test')
      expect(getValidThemes()).toEqual(['light', 'dark', 'sepia'])
    })
  })

  describe('loadCachedTheme', () => {
    it('returns null when no cached theme', () => {
      expect(loadCachedTheme()).toBeNull()
    })

    it('returns cached theme when valid', () => {
      localStorage.setItem('theme', 'dark')
      expect(loadCachedTheme()).toBe('dark')
    })

    it('returns null for invalid cached theme', () => {
      localStorage.setItem('theme', 'invalid')
      expect(loadCachedTheme()).toBeNull()
    })

    it('handles all valid themes from cache', () => {
      for (const theme of ['light', 'dark', 'sepia']) {
        localStorage.setItem('theme', theme)
        expect(loadCachedTheme()).toBe(theme)
      }
    })
  })

  describe('initializeTheme', () => {
    it('uses cached theme when available', () => {
      localStorage.setItem('theme', 'sepia')
      const result = initializeTheme()
      expect(result).toBe('sepia')
      expect(getTheme()).toBe('sepia')
      expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    })

    it('uses default theme when no cache', () => {
      const result = initializeTheme()
      expect(result).toBe('light')
      expect(getTheme()).toBe('light')
    })

    it('uses provided default theme when no cache', () => {
      const result = initializeTheme('dark')
      expect(result).toBe('dark')
      expect(getTheme()).toBe('dark')
    })

    it('ignores invalid cached theme and uses default', () => {
      localStorage.setItem('theme', 'invalid')
      const result = initializeTheme('dark')
      expect(result).toBe('dark')
      expect(getTheme()).toBe('dark')
    })
  })

  describe('applySettings', () => {
    it('does nothing for null settings', () => {
      applySettings(null)
      expect(getTheme()).toBe('light')
    })

    it('does nothing for undefined settings', () => {
      applySettings(undefined)
      expect(getTheme()).toBe('light')
    })

    it('applies theme setting', () => {
      applySettings({ theme: 'dark' })
      expect(getTheme()).toBe('dark')
    })

    it('applies fontSize setting', () => {
      applySettings({ fontSize: 18 })
      expect(document.documentElement.style.getPropertyValue('--message-font-size')).toBe('18px')
    })

    it('applies fontFamily setting', () => {
      applySettings({ fontFamily: 'Georgia, serif' })
      expect(document.documentElement.style.getPropertyValue('--message-font-family')).toBe('Georgia, serif')
    })

    it('applies lineHeight setting', () => {
      applySettings({ lineHeight: 1.8 })
      expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('1.8')
    })

    it('applies contentWidth narrow setting', () => {
      applySettings({ contentWidth: 'narrow' })
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('600px')
    })

    it('applies contentWidth medium setting', () => {
      applySettings({ contentWidth: 'medium' })
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('800px')
    })

    it('applies contentWidth wide setting', () => {
      applySettings({ contentWidth: 'wide' })
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('1000px')
    })

    it('uses default for unknown contentWidth', () => {
      applySettings({ contentWidth: 'unknown' })
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('800px')
    })

    it('applies multiple settings at once', () => {
      applySettings({
        theme: 'sepia',
        fontSize: 20,
        lineHeight: 1.6,
        contentWidth: 'wide'
      })
      expect(getTheme()).toBe('sepia')
      expect(document.documentElement.style.getPropertyValue('--message-font-size')).toBe('20px')
      expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('1.6')
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('1000px')
    })

    it('only applies provided settings', () => {
      setTheme('dark')
      applySettings({ fontSize: 16 })
      expect(getTheme()).toBe('dark') // unchanged
      expect(document.documentElement.style.getPropertyValue('--message-font-size')).toBe('16px')
    })
  })

  describe('exposeGlobally', () => {
    it('exposes setTheme globally', () => {
      exposeGlobally()
      expect(typeof window.__setTheme).toBe('function')
    })

    it('exposes getTheme globally', () => {
      exposeGlobally()
      expect(typeof window.__getTheme).toBe('function')
    })

    it('global setTheme works correctly', () => {
      exposeGlobally()
      window.__setTheme('dark')
      expect(getTheme()).toBe('dark')
    })

    it('global getTheme works correctly', () => {
      exposeGlobally()
      setTheme('sepia')
      expect(window.__getTheme()).toBe('sepia')
    })
  })
})
