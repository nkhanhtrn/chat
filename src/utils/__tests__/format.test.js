import { describe, it, expect } from 'vitest'
import { truncateUrl, truncateFileName, formatSize } from '../format.js'

describe('format utilities', () => {
  describe('truncateUrl', () => {
    it('should return short URLs unchanged', () => {
      const url = 'https://example.com/page'
      expect(truncateUrl(url)).toBe(url)
    })

    it('should truncate long URLs', () => {
      const url = 'https://example.com/this/is/a/very/long/path/that/exceeds/the/limit'
      const result = truncateUrl(url)
      expect(result.length).toBeLessThanOrEqual(50)
      expect(result).toContain('example.com')
    })

    it('should handle URLs with long paths', () => {
      const url = 'https://example.com/very-long-path-name-here'
      const result = truncateUrl(url, 30)
      expect(result).toContain('...')
    })

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url-but-very-long-string-that-needs-truncation'
      const result = truncateUrl(invalidUrl)
      expect(result.length).toBeLessThanOrEqual(50)
      expect(result).toContain('...')
    })

    it('should respect custom maxLength for long URLs', () => {
      const url = 'https://example.com/this/is/a/very/long/path/that/needs/truncation'
      const result = truncateUrl(url, 30)
      expect(result.length).toBeLessThanOrEqual(50) // Hostname may exceed maxLength
      expect(result).toContain('example.com')
    })
  })

  describe('truncateFileName', () => {
    it('should return short file names unchanged', () => {
      const name = 'file.txt'
      expect(truncateFileName(name)).toBe(name)
    })

    it('should truncate long file names while preserving extension', () => {
      const name = 'this-is-a-very-long-file-name-that-exceeds-the-limit.pdf'
      const result = truncateFileName(name)
      expect(result.length).toBeLessThanOrEqual(30)
      expect(result).toContain('...')
      expect(result.slice(-4)).toBe('.pdf')
    })

    it('should handle files without extension', () => {
      const name = 'thisisaverylongfilenamewithoutanyextension'
      const result = truncateFileName(name)
      expect(result.length).toBeLessThanOrEqual(30)
      expect(result).toContain('...')
    })

    it('should respect custom maxLength', () => {
      const name = 'long-filename.txt'
      const result = truncateFileName(name, 15)
      expect(result.length).toBeLessThanOrEqual(15)
    })

    it('should handle edge case of dot at start', () => {
      const name = '.gitignore-very-long-name'
      const result = truncateFileName(name, 15)
      expect(result.length).toBeLessThanOrEqual(15)
    })
  })

  describe('formatSize', () => {
    it('should format small sizes in chars', () => {
      expect(formatSize(100)).toBe('100 chars')
      expect(formatSize(999)).toBe('999 chars')
    })

    it('should format sizes >= 1000 in k chars', () => {
      expect(formatSize(1000)).toBe('1.0k chars')
      expect(formatSize(1500)).toBe('1.5k chars')
      expect(formatSize(10000)).toBe('10.0k chars')
    })

    it('should handle zero', () => {
      expect(formatSize(0)).toBe('0 chars')
    })

    it('should handle large numbers', () => {
      expect(formatSize(1000000)).toBe('1000.0k chars')
    })
  })
})
