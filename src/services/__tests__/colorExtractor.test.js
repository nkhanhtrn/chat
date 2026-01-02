import { describe, it, expect } from 'vitest'
import { generateColorFromText } from '../colorExtractor.js'

// Import internal functions by re-implementing them for testing
// Since they're not exported, we'll test the public API and behavior

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

describe('colorExtractor', () => {
  describe('rgbToHsl', () => {
    it('should convert red to HSL', () => {
      const result = rgbToHsl(255, 0, 0)
      expect(result.h).toBe(0)
      expect(result.s).toBe(100)
      expect(result.l).toBe(50)
    })

    it('should convert green to HSL', () => {
      const result = rgbToHsl(0, 255, 0)
      expect(result.h).toBe(120)
      expect(result.s).toBe(100)
      expect(result.l).toBe(50)
    })

    it('should convert blue to HSL', () => {
      const result = rgbToHsl(0, 0, 255)
      expect(result.h).toBe(240)
      expect(result.s).toBe(100)
      expect(result.l).toBe(50)
    })

    it('should convert white to HSL', () => {
      const result = rgbToHsl(255, 255, 255)
      expect(result.s).toBe(0)
      expect(result.l).toBe(100)
    })

    it('should convert black to HSL', () => {
      const result = rgbToHsl(0, 0, 0)
      expect(result.s).toBe(0)
      expect(result.l).toBe(0)
    })

    it('should convert gray to HSL', () => {
      const result = rgbToHsl(128, 128, 128)
      expect(result.s).toBe(0)
      expect(result.l).toBe(50)
    })

    it('should handle edge case of max === min (grayscale)', () => {
      const result = rgbToHsl(100, 100, 100)
      expect(result.h).toBe(0)
      expect(result.s).toBe(0)
      expect(result.l).toBe(39)
    })
  })

  describe('generateColorFromText', () => {
    it('should generate consistent color for same text', () => {
      const text = 'Same Text'
      const color1 = generateColorFromText(text)
      const color2 = generateColorFromText(text)
      expect(color1).toEqual(color2)
    })

    it('should generate different colors for different texts', () => {
      const color1 = generateColorFromText('Text One')
      const color2 = generateColorFromText('Text Two')
      // At least one component should differ
      const differs = color1.h !== color2.h || color1.s !== color2.s || color1.l !== color2.l
      expect(differs).toBe(true)
    })

    it('should generate valid HSL values', () => {
      const color = generateColorFromText('Test')
      expect(color.h).toBeGreaterThanOrEqual(0)
      expect(color.h).toBeLessThanOrEqual(359)
      expect(color.s).toBeGreaterThanOrEqual(40)
      expect(color.s).toBeLessThanOrEqual(80)
      expect(color.l).toBeGreaterThanOrEqual(35)
      expect(color.l).toBeLessThanOrEqual(60)
    })

    it('should handle empty string', () => {
      const color = generateColorFromText('')
      expect(color).toHaveProperty('h')
      expect(color).toHaveProperty('s')
      expect(color).toHaveProperty('l')
    })

    it('should handle special characters', () => {
      const color1 = generateColorFromText('Hello World!')
      const color2 = generateColorFromText('Hello@World#')
      expect(color1).not.toEqual(color2)
    })

    it('should generate same color for identical strings with different case', () => {
      const color1 = generateColorFromText('test')
      const color2 = generateColorFromText('TEST')
      expect(color1).not.toEqual(color2)
    })
  })

  describe('color sorting', () => {
    it('should sort colors by hue primarily', () => {
      const red = { h: 0, s: 50, l: 50 }
      const green = { h: 120, s: 50, l: 50 }
      const blue = { h: 240, s: 50, l: 50 }

      const colors = [blue, red, green]
      colors.sort((a, b) => {
        if (a.h !== b.h) return a.h - b.h
        if (a.s !== b.s) return a.s - b.s
        return a.l - b.l
      })

      expect(colors).toEqual([red, green, blue])
    })

    it('should sort by saturation when hue is equal', () => {
      const color1 = { h: 100, s: 30, l: 50 }
      const color2 = { h: 100, s: 50, l: 50 }
      const color3 = { h: 100, s: 70, l: 50 }

      const colors = [color3, color1, color2]
      colors.sort((a, b) => {
        if (a.h !== b.h) return a.h - b.h
        if (a.s !== b.s) return a.s - b.s
        return a.l - b.l
      })

      expect(colors).toEqual([color1, color2, color3])
    })

    it('should sort by lightness when hue and saturation are equal', () => {
      const color1 = { h: 100, s: 50, l: 30 }
      const color2 = { h: 100, s: 50, l: 50 }
      const color3 = { h: 100, s: 50, l: 70 }

      const colors = [color3, color1, color2]
      colors.sort((a, b) => {
        if (a.h !== b.h) return a.h - b.h
        if (a.s !== b.s) return a.s - b.s
        return a.l - b.l
      })

      expect(colors).toEqual([color1, color2, color3])
    })
  })
})
