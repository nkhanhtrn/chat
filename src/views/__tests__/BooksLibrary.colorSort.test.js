import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateColorFromText } from '../../services/colorExtractor.js'

describe('BooksLibrary color sorting', () => {
  describe('sort mode toggle', () => {
    it('should toggle between name and color sort modes', () => {
      let sortMode = 'name'

      const toggleSortMode = () => {
        sortMode = sortMode === 'color' ? 'name' : 'color'
      }

      expect(sortMode).toBe('name')

      toggleSortMode()
      expect(sortMode).toBe('color')

      toggleSortMode()
      expect(sortMode).toBe('name')
    })
  })

  describe('book sorting by name', () => {
    it('should sort books alphabetically by title', () => {
      const books = [
        { id: '3', title: 'Charlie', lastReadAt: 100 },
        { id: '1', title: 'Alpha', lastReadAt: 300 },
        { id: '2', title: 'Bravo', lastReadAt: 200 }
      ]

      const sorted = [...books].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '')
      )

      expect(sorted[0].title).toBe('Alpha')
      expect(sorted[1].title).toBe('Bravo')
      expect(sorted[2].title).toBe('Charlie')
    })

    it('should handle empty titles gracefully', () => {
      const books = [
        { id: '1', title: 'Book' },
        { id: '2', title: '' },
        { id: '3', title: 'Another' }
      ]

      const sorted = [...books].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '')
      )

      expect(sorted[0].title).toBe('')
      expect(sorted[1].title).toBe('Another')
      expect(sorted[2].title).toBe('Book')
    })

    it('should be case-insensitive when sorting by title', () => {
      const books = [
        { id: '1', title: 'zebra' },
        { id: '2', title: 'Apple' },
        { id: '3', title: 'banana' }
      ]

      const sorted = [...books].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '')
      )

      expect(sorted[0].title).toBe('Apple')
      expect(sorted[1].title).toBe('banana')
      expect(sorted[2].title).toBe('zebra')
    })
  })

  describe('book sorting by color', () => {
    it('should sort books by hue primarily', () => {
      const books = [
        { id: '1', title: 'Book A' },
        { id: '2', title: 'Book B' },
        { id: '3', title: 'Book C' }
      ]

      const bookColors = {
        '1': { h: 240, s: 50, l: 50 }, // Blue
        '2': { h: 0, s: 50, l: 50 },   // Red
        '3': { h: 120, s: 50, l: 50 }  // Green
      }

      const sorted = [...books].sort((a, b) => {
        const colorA = bookColors[a.id] || { h: 0, s: 0, l: 100 }
        const colorB = bookColors[b.id] || { h: 0, s: 0, l: 100 }
        if (colorA.h !== colorB.h) return colorA.h - colorB.h
        if (colorA.s !== colorB.s) return colorA.s - colorB.s
        return colorA.l - colorB.l
      })

      expect(sorted[0].id).toBe('2') // Red (h=0)
      expect(sorted[1].id).toBe('3') // Green (h=120)
      expect(sorted[2].id).toBe('1') // Blue (h=240)
    })

    it('should sort by saturation when hue is equal', () => {
      const books = [
        { id: '1', title: 'Book A' },
        { id: '2', title: 'Book B' },
        { id: '3', title: 'Book C' }
      ]

      const bookColors = {
        '1': { h: 100, s: 70, l: 50 },
        '2': { h: 100, s: 30, l: 50 },
        '3': { h: 100, s: 50, l: 50 }
      }

      const sorted = [...books].sort((a, b) => {
        const colorA = bookColors[a.id] || { h: 0, s: 0, l: 100 }
        const colorB = bookColors[b.id] || { h: 0, s: 0, l: 100 }
        if (colorA.h !== colorB.h) return colorA.h - colorB.h
        if (colorA.s !== colorB.s) return colorA.s - colorB.s
        return colorA.l - colorB.l
      })

      expect(sorted[0].id).toBe('2') // s=30
      expect(sorted[1].id).toBe('3') // s=50
      expect(sorted[2].id).toBe('1') // s=70
    })

    it('should use default color for books without calculated color', () => {
      const books = [
        { id: '1', title: 'Book A' },
        { id: '2', title: 'Book B' }
      ]

      const bookColors = {
        '1': { h: 100, s: 50, l: 50 }
        // '2' has no color
      }

      const sorted = [...books].sort((a, b) => {
        const colorA = bookColors[a.id] || { h: 0, s: 0, l: 100 }
        const colorB = bookColors[b.id] || { h: 0, s: 0, l: 100 }
        if (colorA.h !== colorB.h) return colorA.h - colorB.h
        if (colorA.s !== colorB.s) return colorA.s - colorB.s
        return colorA.l - colorB.l
      })

      // Book 2 should come first (default: h=0, s=0, l=100)
      expect(sorted[0].id).toBe('2')
      expect(sorted[1].id).toBe('1')
    })
  })

  describe('color calculation flow', () => {
    it('should track calculation progress', () => {
      let isCalculating = false

      const startCalculation = () => {
        if (isCalculating) return
        isCalculating = true
        // Simulate async work
        setTimeout(() => {
          isCalculating = false
        }, 100)
      }

      expect(isCalculating).toBe(false)

      startCalculation()
      expect(isCalculating).toBe(true)
    })

    it('should generate colors for books without covers', () => {
      const books = [
        { id: '1', title: 'The Great Gatsby', coverUrl: null },
        { id: '2', title: 'To Kill a Mockingbird', coverUrl: null },
        { id: '3', title: '1984', coverUrl: null }
      ]

      const colors = {}
      for (const book of books) {
        if (!book.coverUrl) {
          colors[book.id] = generateColorFromText(book.title || book.id)
        }
      }

      expect(Object.keys(colors).length).toBe(3)
      expect(colors['1']).toHaveProperty('h')
      expect(colors['1']).toHaveProperty('s')
      expect(colors['1']).toHaveProperty('l')
    })
  })

  describe('combined search and sort', () => {
    it('should filter by search then sort by name', () => {
      const books = [
        { id: '1', title: 'Red Book', author: 'Author A' },
        { id: '2', title: 'Blue Book', author: 'Author B' },
        { id: '3', title: 'Green Book', author: 'Author C' },
        { id: '4', title: 'Red Planet', author: 'Author D' }
      ]

      const searchQuery = 'red'

      // Filter by search
      let filtered = books.filter(book => {
        const title = (book.title || '').toLowerCase()
        const author = (book.author || '').toLowerCase()
        return title.includes(searchQuery) || author.includes(searchQuery)
      })

      // Sort by title
      filtered = [...filtered].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '')
      )

      expect(filtered.length).toBe(2)
      expect(filtered[0].title).toBe('Red Book')
      expect(filtered[1].title).toBe('Red Planet')
    })

    it('should filter by search then sort by color', () => {
      const books = [
        { id: '1', title: 'Red Book' },
        { id: '2', title: 'Red Planet' }
      ]

      const bookColors = {
        '1': { h: 240, s: 50, l: 50 }, // Blue
        '2': { h: 0, s: 50, l: 50 }    // Red
      }

      const searchQuery = 'red'

      // Filter by search
      let filtered = books.filter(book => {
        const title = (book.title || '').toLowerCase()
        return title.includes(searchQuery)
      })

      // Sort by color
      filtered = [...filtered].sort((a, b) => {
        const colorA = bookColors[a.id] || { h: 0, s: 0, l: 100 }
        const colorB = bookColors[b.id] || { h: 0, s: 0, l: 100 }
        if (colorA.h !== colorB.h) return colorA.h - colorB.h
        if (colorA.s !== colorB.s) return colorA.s - colorB.s
        return colorA.l - colorB.l
      })

      expect(filtered.length).toBe(2)
      expect(filtered[0].id).toBe('2') // Red (h=0)
      expect(filtered[1].id).toBe('1') // Blue (h=240)
    })
  })
})
