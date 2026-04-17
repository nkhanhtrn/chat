import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Settings, setTheme, getTheme, initializeTheme, applyFontSize, applyFontFamily, applyLineHeight, applyContentWidth, applySettings } from '../settings'

describe('SettingsManager', () => {
  beforeEach(() => {
    localStorage.clear()
    Settings.clear()
  })

  describe('set / get / getAll', () => {
    it('sets and gets a single key', () => {
      Settings.set({ theme: 'dark' })
      expect(Settings.get('theme')).toBe('dark')
    })

    it('sets multiple keys at once', () => {
      Settings.set({ theme: 'sepia', fontSize: 20 })
      expect(Settings.get('theme')).toBe('sepia')
      expect(Settings.get('fontSize')).toBe(20)
    })

    it('trims string values', () => {
      Settings.set({ fontFamily: '  Georgia, serif  ' })
      expect(Settings.get('fontFamily')).toBe('Georgia, serif')
    })

    it('does not trim non-string values', () => {
      Settings.set({ fontSize: 18 })
      expect(Settings.get('fontSize')).toBe(18)
    })

    it('returns undefined for unset keys', () => {
      expect(Settings.get('theme')).toBeUndefined()
    })

    it('getAll returns a copy of all settings', () => {
      Settings.set({ theme: 'dark', fontSize: 20 })
      const all = Settings.getAll()
      expect(all.theme).toBe('dark')
      expect(all.fontSize).toBe(20)
    })

    it('getAll returns a copy (mutations do not affect cache)', () => {
      Settings.set({ theme: 'light' })
      const all = Settings.getAll()
      all.theme = 'dark'
      expect(Settings.get('theme')).toBe('light')
    })
  })

  describe('getString', () => {
    it('returns trimmed string value', () => {
      Settings.set({ fontFamily: '  Inter  ' })
      expect(Settings.getString('fontFamily')).toBe('Inter')
    })

    it('returns empty string for non-string values', () => {
      Settings.set({ fontSize: 18 })
      expect(Settings.getString('fontSize')).toBe('')
    })

    it('returns empty string for missing keys', () => {
      expect(Settings.getString('missing')).toBe('')
    })
  })

  describe('delete', () => {
    it('deletes a single key', () => {
      Settings.set({ theme: 'dark' })
      Settings.delete('theme')
      expect(Settings.get('theme')).toBeUndefined()
    })

    it('deletes multiple keys', () => {
      Settings.set({ theme: 'dark', fontSize: 20 })
      Settings.delete(['theme', 'fontSize'])
      expect(Settings.get('theme')).toBeUndefined()
      expect(Settings.get('fontSize')).toBeUndefined()
    })

    it('is a no-op for nonexistent keys', () => {
      Settings.set({ theme: 'dark' })
      Settings.delete('missing')
      expect(Settings.get('theme')).toBe('dark')
    })
  })

  describe('clear', () => {
    it('clears all settings', () => {
      Settings.set({ theme: 'dark', fontSize: 20 })
      Settings.clear()
      expect(Settings.getAll()).toEqual({})
    })

    it('removes localStorage key', () => {
      Settings.set({ theme: 'dark' })
      Settings.clear()
      expect(localStorage.getItem('user-settings')).toBeNull()
    })
  })

  describe('persistence', () => {
    it('persists to localStorage on set', () => {
      Settings.set({ theme: 'dark' })
      const stored = JSON.parse(localStorage.getItem('user-settings')!)
      expect(stored.theme).toBe('dark')
    })

    it('persists to localStorage on delete', () => {
      Settings.set({ theme: 'dark', fontSize: 20 })
      Settings.delete('theme')
      const stored = JSON.parse(localStorage.getItem('user-settings')!)
      expect(stored.theme).toBeUndefined()
      expect(stored.fontSize).toBe(20)
    })

    it('merges new values with existing persisted data', () => {
      Settings.set({ theme: 'dark' })
      Settings.set({ fontSize: 20 })
      const stored = JSON.parse(localStorage.getItem('user-settings')!)
      expect(stored.theme).toBe('dark')
      expect(stored.fontSize).toBe(20)
    })
  })

  describe('initialize', () => {
    it('loads settings from localStorage', async () => {
      localStorage.setItem('user-settings', JSON.stringify({ theme: 'sepia', fontSize: 22 }))
      await Settings.initialize()
      expect(Settings.get('theme')).toBe('sepia')
      expect(Settings.get('fontSize')).toBe(22)
    })

    it('handles corrupt JSON gracefully', async () => {
      localStorage.setItem('user-settings', '{invalid json')
      await Settings.initialize()
      expect(Settings.getAll()).toEqual({})
    })
  })
})

describe('setTheme', () => {
  it('sets valid themes and returns true', () => {
    expect(setTheme('light')).toBe(true)
    expect(setTheme('dark')).toBe(true)
    expect(setTheme('sepia')).toBe(true)
  })

  it('sets data-theme attribute on document', () => {
    setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('caches theme in localStorage', () => {
    setTheme('sepia')
    expect(localStorage.getItem('theme')).toBe('sepia')
  })

  it('returns false for invalid theme', () => {
    expect(setTheme('neon' as any)).toBe(false)
  })
})

describe('getTheme', () => {
  it('returns cached theme from localStorage', () => {
    localStorage.setItem('theme', 'dark')
    expect(getTheme()).toBe('dark')
  })

  it('returns light as default when no theme cached', () => {
    expect(getTheme()).toBe('light')
  })

  it('returns light for invalid cached theme', () => {
    localStorage.setItem('theme', 'neon')
    expect(getTheme()).toBe('light')
  })
})

describe('initializeTheme', () => {
  it('applies cached valid theme to document', () => {
    localStorage.setItem('theme', 'sepia')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
  })

  it('does nothing when no valid cached theme', () => {
    document.documentElement.removeAttribute('data-theme')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})

describe('applyFontSize', () => {
  it('sets --message-font-size CSS variable', () => {
    applyFontSize(18)
    expect(document.documentElement.style.getPropertyValue('--message-font-size')).toBe('18px')
  })
})

describe('applyFontFamily', () => {
  it('sets --message-font-family CSS variable', () => {
    applyFontFamily('Georgia, serif')
    expect(document.documentElement.style.getPropertyValue('--message-font-family')).toBe('Georgia, serif')
  })
})

describe('applyLineHeight', () => {
  it('sets --message-line-height CSS variable', () => {
    applyLineHeight(1.7)
    expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('1.7')
  })
})

describe('applyContentWidth', () => {
  it.each([
    ['narrow', '600px'],
    ['medium', '800px'],
    ['wide', '1000px'],
    ['unknown', '800px'],
  ])('maps %s to %s', (width, expected) => {
    applyContentWidth(width)
    expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe(expected)
  })
})

describe('applySettings', () => {
  it('applies all present settings', () => {
    applySettings({ theme: 'dark', fontSize: 20, fontFamily: 'Inter', lineHeight: 1.8, contentWidth: 'wide' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--message-font-size')).toBe('20px')
    expect(document.documentElement.style.getPropertyValue('--message-font-family')).toBe('Inter')
    expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('1.8')
    expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('1000px')
  })

  it('is a no-op on null/empty object', () => {
    applySettings({})
    applySettings(null as any)
    // Should not throw
  })
})
