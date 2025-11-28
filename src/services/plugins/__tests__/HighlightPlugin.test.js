
import { HighlightPlugin } from '../HighlightPlugin.js'

describe('HighlightPlugin', () => {

  const mockEscapeHtml = (str) => `[escaped]${str}`

  describe('extract', () => {
    it('extracts and replaces highlight text with placeholder', () => {
      const text = 'Hello world!'
      const item = { startOffset: 6, endOffset: 11, id: 'abc', color: '#123456' }
      const result = HighlightPlugin.extract(text, item)
      expect(result.processed).toBe('Hello HIGHLIGHT_abc!')
      expect(result.placeholder).toEqual({
        id: 'HIGHLIGHT_abc',
        type: 'highlight',
        text: 'world',
        color: '#123456',
        originalId: 'abc'
      })
    })
    it('defaults color if not provided', () => {
      const text = 'Test highlight'
      const item = { startOffset: 5, endOffset: 14, id: 'id2' }
      const result = HighlightPlugin.extract(text, item)
      expect(result.placeholder.color).toBe('#ffeb3b')
    })
  })

    // Removed empty render describe block
})
