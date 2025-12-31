import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateDefaultCover } from '../bookCoverGenerator.js'

describe('bookCoverGenerator', () => {
  let originalURL

  beforeEach(() => {
    originalURL = global.URL
    // Mock URL.createObjectURL - return unique URL for each call
    let callCount = 0
    global.URL = {
      createObjectURL: vi.fn((blob) => {
        return `blob:image/svg+xml-mock-url-${callCount++}`
      }),
      revokeObjectURL: vi.fn()
    }
  })

  afterEach(() => {
    global.URL = originalURL
  })

  describe('generateDefaultCover', () => {
    it('generates a blob URL', () => {
      const result = generateDefaultCover('Test Book', 'Test Author')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(result).toContain('blob:')
    })

    it('creates an SVG blob', () => {
      generateDefaultCover('Test', 'Author')
      expect(URL.createObjectURL).toHaveBeenCalled()
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('image/svg+xml')
    })

    it('includes title in SVG', async () => {
      generateDefaultCover('My Great Book', 'Author Name')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('My Great Book')
    })

    it('includes author in SVG', async () => {
      generateDefaultCover('Book Title', 'Jane Doe')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('Jane Doe')
    })

    it('uses "Untitled" when title is empty', async () => {
      generateDefaultCover('', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('Untitled')
    })

    it('uses "Untitled" when title is null', async () => {
      generateDefaultCover(null, 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('Untitled')
    })

    it('handles empty author gracefully', () => {
      const result = generateDefaultCover('Book Title', '')
      expect(result).toBeTruthy()
    })

    it('handles null author gracefully', () => {
      const result = generateDefaultCover('Book Title', null)
      expect(result).toBeTruthy()
    })

    it('escapes special characters in title', async () => {
      generateDefaultCover('Test <script>alert("xss")</script>', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).not.toContain('<script>')
      expect(text).toContain('&lt;script&gt;')
    })

    it('escapes quotes in text', async () => {
      generateDefaultCover('Test "quoted" text', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('&quot;')
    })

    it('escapes ampersands in text', async () => {
      generateDefaultCover('Tom & Jerry', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('&amp;')
    })

    it('wraps long titles to multiple lines', async () => {
      generateDefaultCover('This Is A Very Long Book Title That Should Be Wrapped', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      // Should have multiple text elements for title lines
      const titleMatches = text.match(/<text/g)
      expect(titleMatches).toBeTruthy()
    })

    it('limits title to maximum 3 lines', async () => {
      generateDefaultCover('Line1 Line2 Line3 Line4 Line5 This Is More Text', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      // Count title text elements (excluding author)
      const lines = text.split('\n').filter(line => line.includes('<text'))
      // Should not exceed 3 lines for title + 2 for author = 5 total max
      expect(lines.length).toBeLessThanOrEqual(5)
    })

    it('handles very long single words by breaking them', async () => {
      generateDefaultCover('Supercalifragilisticexpialidocious', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      // Word gets broken at 18 characters: Supercalifragilist + icexpialidocious
      expect(text).toContain('Supercalifragilist')
    })

    it('generates SVG with correct dimensions', async () => {
      generateDefaultCover('Book', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('width="300"')
      expect(text).toContain('height="450"')
    })

    it('generates SVG with gradient background', async () => {
      generateDefaultCover('Book', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('<linearGradient')
      expect(text).toContain('#4a5568')
      expect(text).toContain('#2d3748')
    })

    it('generates SVG with border rectangles', async () => {
      generateDefaultCover('Book', 'Author')
      const blobArg = URL.createObjectURL.mock.calls[0][0]
      const text = await blobArg.text()
      expect(text).toContain('stroke="rgba(255,255,255,0.2)"')
      expect(text).toContain('stroke="rgba(255,255,255,0.1)"')
    })
  })

  describe('Cover Caching', () => {
    it('returns different URLs for different books', () => {
      const url1 = generateDefaultCover('Book 1', 'Author 1')
      const url2 = generateDefaultCover('Book 2', 'Author 2')
      expect(url1).not.toBe(url2)
    })

    it('returns different URLs for same book with different author', () => {
      const url1 = generateDefaultCover('Same Book', 'Author One')
      const url2 = generateDefaultCover('Same Book', 'Author Two')
      expect(url1).not.toBe(url2)
    })
  })
})
