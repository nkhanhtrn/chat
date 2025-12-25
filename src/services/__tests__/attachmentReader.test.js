import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AttachmentType,
  registerReader,
  unregisterReader,
  getReaders,
  clearReaders,
  findReader,
  readAttachment,
  readAttachments,
  formatAttachmentForPrompt,
  formatAttachmentsForPrompt,
  initializeDefaultReaders,
  urlReader,
  textFileReader,
  pdfReader,
  unsupportedFileReader,
  extractTextWithLayout,
  detectTableStructure
} from '../attachmentReader.js'

// Mock the urlFetcher module
vi.mock('../urlFetcher.js', () => ({
  fetchUrlContent: vi.fn()
}))

import { fetchUrlContent } from '../urlFetcher.js'

// Helper to create a mock File object
function createMockFile(name, content, type = '') {
  const blob = new Blob([content], { type })
  blob.name = name
  return blob
}

describe('attachmentReader', () => {
  beforeEach(() => {
    initializeDefaultReaders()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Registry Tests
  // ==========================================================================
  describe('Registry', () => {
    describe('registerReader', () => {
      it('should register a new reader', () => {
        const customReader = {
          name: 'custom',
          canHandle: () => true,
          read: async () => ({ content: 'test' })
        }

        const initialCount = getReaders().length
        registerReader(customReader)
        expect(getReaders().length).toBe(initialCount + 1)
        expect(getReaders().some(r => r.name === 'custom')).toBe(true)
      })

      it('should throw error if reader is missing required properties', () => {
        expect(() => registerReader({})).toThrow('Reader must have name, canHandle, and read properties')
        expect(() => registerReader({ name: 'test' })).toThrow()
        expect(() => registerReader({ name: 'test', canHandle: () => {} })).toThrow()
      })

      it('should insert reader based on priority', () => {
        clearReaders()

        registerReader({ name: 'low', priority: -10, canHandle: () => false, read: async () => ({}) })
        registerReader({ name: 'high', priority: 100, canHandle: () => false, read: async () => ({}) })
        registerReader({ name: 'medium', priority: 50, canHandle: () => false, read: async () => ({}) })

        const readers = getReaders()
        expect(readers[0].name).toBe('high')
        expect(readers[1].name).toBe('medium')
        expect(readers[2].name).toBe('low')
      })
    })

    describe('unregisterReader', () => {
      it('should remove a reader by name', () => {
        const readers = getReaders()
        const initialCount = readers.length
        expect(readers.some(r => r.name === 'text')).toBe(true)

        unregisterReader('text')
        expect(getReaders().length).toBe(initialCount - 1)
        expect(getReaders().some(r => r.name === 'text')).toBe(false)
      })

      it('should do nothing if reader name not found', () => {
        const initialCount = getReaders().length
        unregisterReader('nonexistent')
        expect(getReaders().length).toBe(initialCount)
      })
    })

    describe('clearReaders', () => {
      it('should remove all readers', () => {
        expect(getReaders().length).toBeGreaterThan(0)
        clearReaders()
        expect(getReaders().length).toBe(0)
      })
    })

    describe('getReaders', () => {
      it('should return a copy of the readers array', () => {
        const readers1 = getReaders()
        const readers2 = getReaders()
        expect(readers1).not.toBe(readers2)
        expect(readers1).toEqual(readers2)
      })
    })

    describe('findReader', () => {
      it('should find URL reader for URL attachments', () => {
        const attachment = { type: AttachmentType.URL, url: 'https://example.com' }
        const reader = findReader(attachment)
        expect(reader.name).toBe('url')
      })

      it('should find text reader for text files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('test.txt', 'content', 'text/plain')
        }
        const reader = findReader(attachment)
        expect(reader.name).toBe('text')
      })

      it('should find PDF reader for PDF files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('document.pdf', 'content', 'application/pdf')
        }
        const reader = findReader(attachment)
        expect(reader.name).toBe('pdf')
      })

      it('should find unsupported reader for unknown file types', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('image.png', 'content', 'image/png')
        }
        const reader = findReader(attachment)
        expect(reader.name).toBe('unsupported')
      })

      it('should return null if no reader matches', () => {
        clearReaders()
        const attachment = { type: 'unknown' }
        expect(findReader(attachment)).toBe(null)
      })
    })

    describe('initializeDefaultReaders', () => {
      it('should register all default readers', () => {
        clearReaders()
        initializeDefaultReaders()

        const readerNames = getReaders().map(r => r.name)
        expect(readerNames).toContain('url')
        expect(readerNames).toContain('text')
        expect(readerNames).toContain('pdf')
        expect(readerNames).toContain('unsupported')
      })
    })
  })

  // ==========================================================================
  // URL Reader Tests
  // ==========================================================================
  describe('urlReader', () => {
    describe('canHandle', () => {
      it('should handle URL attachments', () => {
        expect(urlReader.canHandle({ type: AttachmentType.URL, url: 'https://example.com' })).toBe(true)
      })

      it('should not handle file attachments', () => {
        expect(urlReader.canHandle({ type: AttachmentType.FILE, file: {} })).toBe(false)
      })

      it('should not handle URL type without url property', () => {
        expect(urlReader.canHandle({ type: AttachmentType.URL })).toBe(false)
      })
    })

    describe('read', () => {
      it('should fetch URL content', async () => {
        fetchUrlContent.mockResolvedValueOnce('Fetched content')

        const result = await urlReader.read({
          type: AttachmentType.URL,
          url: 'https://example.com'
        })

        expect(result.content).toBe('Fetched content')
        expect(result.metadata.url).toBe('https://example.com')
        expect(result.metadata.fetchedAt).toBeDefined()
        expect(fetchUrlContent).toHaveBeenCalledWith('https://example.com', {})
      })

      it('should pass options to fetchUrlContent', async () => {
        fetchUrlContent.mockResolvedValueOnce('Content')

        await urlReader.read(
          { type: AttachmentType.URL, url: 'https://example.com' },
          { maxLength: 5000 }
        )

        expect(fetchUrlContent).toHaveBeenCalledWith('https://example.com', { maxLength: 5000 })
      })
    })
  })

  // ==========================================================================
  // Text File Reader Tests
  // ==========================================================================
  describe('textFileReader', () => {
    describe('canHandle', () => {
      it('should handle .txt files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('test.txt', 'content')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .md files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('readme.md', 'content')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .json files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('config.json', '{}')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .js files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('script.js', 'code')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .py files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('script.py', 'code')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .vue files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('Component.vue', '<template>')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .html files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('page.html', '<html>')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .css files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('styles.css', 'body {}')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .yaml files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('config.yaml', 'key: value')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .xml files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('data.xml', '<root>')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .csv files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('data.csv', 'a,b,c')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle .sql files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('query.sql', 'SELECT *')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle files with text/* MIME type', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('unknown.xyz', 'content', 'text/plain')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should handle files with application/json MIME type', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('data', '{}', 'application/json')
        }
        expect(textFileReader.canHandle(attachment)).toBe(true)
      })

      it('should not handle binary files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('image.png', 'binary', 'image/png')
        }
        expect(textFileReader.canHandle(attachment)).toBe(false)
      })

      it('should not handle PDF files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('doc.pdf', 'binary', 'application/pdf')
        }
        expect(textFileReader.canHandle(attachment)).toBe(false)
      })

      it('should not handle URL attachments', () => {
        expect(textFileReader.canHandle({ type: AttachmentType.URL, url: 'https://example.com' })).toBe(false)
      })
    })

    describe('read', () => {
      it('should read text file content', async () => {
        const content = 'Hello, World!'
        const file = new File([content], 'test.txt', { type: 'text/plain' })

        const result = await textFileReader.read({
          type: AttachmentType.FILE,
          file
        })

        expect(result.content).toBe(content)
        expect(result.metadata.fileName).toBe('test.txt')
        expect(result.metadata.fileSize).toBe(content.length)
        expect(result.metadata.truncated).toBe(false)
      })

      it('should truncate long content', async () => {
        const content = 'A'.repeat(1000)
        const file = new File([content], 'long.txt', { type: 'text/plain' })

        const result = await textFileReader.read(
          { type: AttachmentType.FILE, file },
          { maxLength: 100 }
        )

        expect(result.content.length).toBeLessThan(content.length)
        expect(result.content).toContain('[Content truncated...]')
        expect(result.metadata.truncated).toBe(true)
      })

      it('should preserve content under max length', async () => {
        const content = 'Short content'
        const file = new File([content], 'short.txt', { type: 'text/plain' })

        const result = await textFileReader.read(
          { type: AttachmentType.FILE, file },
          { maxLength: 50000 }
        )

        expect(result.content).toBe(content)
        expect(result.metadata.truncated).toBe(false)
      })
    })
  })

  // ==========================================================================
  // PDF Reader Tests
  // ==========================================================================
  describe('pdfReader', () => {
    describe('canHandle', () => {
      it('should handle .pdf files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('document.pdf', 'content')
        }
        expect(pdfReader.canHandle(attachment)).toBe(true)
      })

      it('should handle files with application/pdf MIME type', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('document', 'content', 'application/pdf')
        }
        expect(pdfReader.canHandle(attachment)).toBe(true)
      })

      it('should not handle .txt files', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('file.txt', 'content', 'text/plain')
        }
        expect(pdfReader.canHandle(attachment)).toBe(false)
      })

      it('should not handle URL attachments', () => {
        expect(pdfReader.canHandle({ type: AttachmentType.URL, url: 'https://example.com' })).toBe(false)
      })
    })

    // Note: Full PDF reading tests would require mocking pdfjs-dist
    // which is complex. We test the layout extraction functions separately.
  })

  // ==========================================================================
  // Unsupported File Reader Tests
  // ==========================================================================
  describe('unsupportedFileReader', () => {
    describe('canHandle', () => {
      it('should handle any file attachment', () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('image.png', 'binary')
        }
        expect(unsupportedFileReader.canHandle(attachment)).toBe(true)
      })

      it('should not handle URL attachments', () => {
        expect(unsupportedFileReader.canHandle({ type: AttachmentType.URL })).toBe(false)
      })
    })

    describe('read', () => {
      it('should throw error with file extension', async () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('image.png', 'binary')
        }

        await expect(unsupportedFileReader.read(attachment)).rejects.toThrow('Unsupported file type: .png')
      })

      it('should handle files without extension', async () => {
        const attachment = {
          type: AttachmentType.FILE,
          file: createMockFile('noextension', 'binary')
        }

        await expect(unsupportedFileReader.read(attachment)).rejects.toThrow('Unsupported file type: .unknown')
      })
    })
  })

  // ==========================================================================
  // readAttachment Tests
  // ==========================================================================
  describe('readAttachment', () => {
    it('should read URL attachment using URL reader', async () => {
      fetchUrlContent.mockResolvedValueOnce('URL content')

      const result = await readAttachment({
        type: AttachmentType.URL,
        url: 'https://example.com'
      })

      expect(result.content).toBe('URL content')
      expect(result.readerName).toBe('url')
    })

    it('should read text file using text reader', async () => {
      const file = new File(['File content'], 'test.txt', { type: 'text/plain' })

      const result = await readAttachment({
        type: AttachmentType.FILE,
        file
      })

      expect(result.content).toBe('File content')
      expect(result.readerName).toBe('text')
    })

    it('should throw error for unsupported file types', async () => {
      const file = new File(['binary'], 'image.png', { type: 'image/png' })

      await expect(readAttachment({
        type: AttachmentType.FILE,
        file
      })).rejects.toThrow('Unsupported file type: .png')
    })

    it('should throw error when no reader found', async () => {
      clearReaders()

      await expect(readAttachment({
        type: 'unknown'
      })).rejects.toThrow('No reader found')
    })
  })

  // ==========================================================================
  // readAttachments Tests
  // ==========================================================================
  describe('readAttachments', () => {
    it('should read multiple attachments', async () => {
      fetchUrlContent.mockResolvedValueOnce('URL content')

      const file = new File(['File content'], 'test.txt', { type: 'text/plain' })

      const results = await readAttachments([
        { type: AttachmentType.URL, url: 'https://example.com' },
        { type: AttachmentType.FILE, file }
      ])

      expect(results.length).toBe(2)
      expect(results[0].result.content).toBe('URL content')
      expect(results[1].result.content).toBe('File content')
    })

    it('should handle mixed success and failure', async () => {
      fetchUrlContent.mockResolvedValueOnce('URL content')

      const pngFile = new File(['binary'], 'image.png', { type: 'image/png' })

      const results = await readAttachments([
        { type: AttachmentType.URL, url: 'https://example.com' },
        { type: AttachmentType.FILE, file: pngFile }
      ])

      expect(results.length).toBe(2)
      expect(results[0].result.content).toBe('URL content')
      expect(results[0].error).toBeUndefined()
      expect(results[1].error).toContain('Unsupported file type')
      expect(results[1].result).toBeUndefined()
    })

    it('should return empty array for empty input', async () => {
      const results = await readAttachments([])
      expect(results).toEqual([])
    })
  })

  // ==========================================================================
  // Format Helpers Tests
  // ==========================================================================
  describe('formatAttachmentForPrompt', () => {
    it('should format URL attachment', () => {
      const result = formatAttachmentForPrompt(
        { content: 'URL content' },
        { type: AttachmentType.URL, url: 'https://example.com' }
      )

      expect(result).toContain('--- Content from https://example.com ---')
      expect(result).toContain('URL content')
      expect(result).toContain('--- End of Content from https://example.com ---')
    })

    it('should format file attachment', () => {
      const result = formatAttachmentForPrompt(
        { content: 'File content' },
        { type: AttachmentType.FILE, file: { name: 'test.txt' } }
      )

      expect(result).toContain('--- File: test.txt ---')
      expect(result).toContain('File content')
      expect(result).toContain('--- End of File: test.txt ---')
    })

    it('should handle missing file name', () => {
      const result = formatAttachmentForPrompt(
        { content: 'Content' },
        { type: AttachmentType.FILE, file: {} }
      )

      expect(result).toContain('File: unknown')
    })
  })

  describe('formatAttachmentsForPrompt', () => {
    it('should format multiple attachments', () => {
      const results = [
        {
          result: { content: 'Content 1' },
          attachment: { type: AttachmentType.URL, url: 'https://example1.com' }
        },
        {
          result: { content: 'Content 2' },
          attachment: { type: AttachmentType.FILE, file: { name: 'file.txt' } }
        }
      ]

      const formatted = formatAttachmentsForPrompt(results)

      expect(formatted).toContain('https://example1.com')
      expect(formatted).toContain('Content 1')
      expect(formatted).toContain('file.txt')
      expect(formatted).toContain('Content 2')
    })

    it('should skip failed attachments', () => {
      const results = [
        {
          result: { content: 'Success' },
          attachment: { type: AttachmentType.URL, url: 'https://success.com' }
        },
        {
          error: 'Failed to read',
          attachment: { type: AttachmentType.URL, url: 'https://failed.com' }
        }
      ]

      const formatted = formatAttachmentsForPrompt(results)

      expect(formatted).toContain('https://success.com')
      expect(formatted).not.toContain('https://failed.com')
    })

    it('should return empty string for empty results', () => {
      expect(formatAttachmentsForPrompt([])).toBe('')
    })

    it('should return empty string when all attachments failed', () => {
      const results = [
        { error: 'Failed', attachment: { type: AttachmentType.URL, url: 'https://failed.com' } }
      ]

      expect(formatAttachmentsForPrompt(results)).toBe('')
    })
  })

  // ==========================================================================
  // PDF Layout Extraction Tests
  // ==========================================================================
  describe('PDF Layout Extraction', () => {
    // Helper to create mock text content items (simulating pdf.js output)
    function createTextItem(str, x, y, width = 50, fontSize = 12) {
      return {
        str,
        width,
        transform: [fontSize, 0, 0, fontSize, x, y] // [scaleX, skewX, skewY, scaleY, translateX, translateY]
      }
    }

    const mockViewport = { height: 800, width: 600 }

    describe('extractTextWithLayout', () => {
      it('should return empty string for empty content', () => {
        const result = extractTextWithLayout({ items: [] }, mockViewport)
        expect(result).toBe('')
      })

      it('should extract simple single-line text', () => {
        const textContent = {
          items: [
            createTextItem('Hello', 50, 700),
            createTextItem('World', 110, 700)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('Hello')
        expect(result).toContain('World')
      })

      it('should handle multiple lines', () => {
        const textContent = {
          items: [
            createTextItem('Line 1', 50, 750),
            createTextItem('Line 2', 50, 730),
            createTextItem('Line 3', 50, 710)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('Line 1')
        expect(result).toContain('Line 2')
        expect(result).toContain('Line 3')
      })

      it('should detect paragraph breaks from large vertical gaps', () => {
        const textContent = {
          items: [
            createTextItem('Paragraph 1', 50, 750),
            createTextItem('Still para 1', 50, 735),
            // Large gap here
            createTextItem('Paragraph 2', 50, 680)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        // Should have double newline between paragraphs
        expect(result.includes('\n\n')).toBe(true)
      })

      it('should preserve word spacing within lines', () => {
        const textContent = {
          items: [
            createTextItem('Word1', 50, 700, 40),
            createTextItem('Word2', 100, 700, 40),
            createTextItem('Word3', 150, 700, 40)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toMatch(/Word1\s+Word2\s+Word3/)
      })

      it('should detect list items with bullets', () => {
        const textContent = {
          items: [
            createTextItem('Header:', 50, 750),
            createTextItem('•', 60, 730),
            createTextItem('Item 1', 75, 730),
            createTextItem('•', 60, 710),
            createTextItem('Item 2', 75, 710)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('•')
        expect(result).toContain('Item 1')
        expect(result).toContain('Item 2')
      })

      it('should detect numbered lists', () => {
        const textContent = {
          items: [
            createTextItem('1.', 50, 750),
            createTextItem('First item', 70, 750),
            createTextItem('2.', 50, 730),
            createTextItem('Second item', 70, 730)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('1.')
        expect(result).toContain('First item')
        expect(result).toContain('2.')
        expect(result).toContain('Second item')
      })

      it('should filter out whitespace-only items', () => {
        const textContent = {
          items: [
            createTextItem('Real text', 50, 700),
            createTextItem('   ', 100, 700),
            createTextItem('More text', 150, 700)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('Real text')
        expect(result).toContain('More text')
      })

      it('should handle items on same line with different Y positions within threshold', () => {
        const textContent = {
          items: [
            createTextItem('Same', 50, 700),
            createTextItem('Line', 100, 703), // Slight Y variation
            createTextItem('Text', 150, 698)  // Slight Y variation
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        // All should be on same line
        const lines = result.split('\n').filter(l => l.trim())
        expect(lines.length).toBe(1)
      })
    })

    describe('detectTableStructure', () => {
      it('should return false for less than 3 lines', () => {
        expect(detectTableStructure([])).toBe(false)
        expect(detectTableStructure([[]])).toBe(false)
        expect(detectTableStructure([[], []])).toBe(false)
      })

      it('should detect table structure with consistent columns', () => {
        // Simulating a table with 3 columns
        const lines = [
          [
            { x: 50, endX: 100, str: 'Name' },
            { x: 200, endX: 250, str: 'Age' },
            { x: 350, endX: 400, str: 'City' }
          ],
          [
            { x: 50, endX: 100, str: 'John' },
            { x: 200, endX: 250, str: '25' },
            { x: 350, endX: 400, str: 'NYC' }
          ],
          [
            { x: 50, endX: 100, str: 'Jane' },
            { x: 200, endX: 250, str: '30' },
            { x: 350, endX: 400, str: 'LA' }
          ],
          [
            { x: 50, endX: 100, str: 'Bob' },
            { x: 200, endX: 250, str: '35' },
            { x: 350, endX: 400, str: 'SF' }
          ]
        ]

        expect(detectTableStructure(lines)).toBe(true)
      })

      it('should return false for regular paragraph text', () => {
        // Single column text
        const lines = [
          [{ x: 50, endX: 400, str: 'This is a long paragraph line' }],
          [{ x: 50, endX: 350, str: 'Another line of text here' }],
          [{ x: 50, endX: 380, str: 'And yet another line' }],
          [{ x: 50, endX: 320, str: 'Final line of paragraph' }]
        ]

        expect(detectTableStructure(lines)).toBe(false)
      })

      it('should handle mixed content (some table, some not)', () => {
        // Less than 40% table-like lines
        const lines = [
          [{ x: 50, endX: 100, str: 'Col1' }, { x: 200, endX: 250, str: 'Col2' }], // table-like
          [{ x: 50, endX: 400, str: 'Regular text line' }],
          [{ x: 50, endX: 380, str: 'Another regular line' }],
          [{ x: 50, endX: 350, str: 'More text' }],
          [{ x: 50, endX: 360, str: 'Even more' }]
        ]

        // Only 1 out of 5 lines is table-like (20%), should return false
        expect(detectTableStructure(lines)).toBe(false)
      })

      it('should detect table when majority of lines have columns', () => {
        const lines = [
          [{ x: 50, endX: 100, str: 'A' }, { x: 200, endX: 250, str: 'B' }],
          [{ x: 50, endX: 100, str: 'C' }, { x: 200, endX: 250, str: 'D' }],
          [{ x: 50, endX: 100, str: 'E' }, { x: 200, endX: 250, str: 'F' }],
          [{ x: 50, endX: 400, str: 'Footer text' }] // Only this is not table-like
        ]

        // 3 out of 4 lines are table-like (75%), should return true
        expect(detectTableStructure(lines)).toBe(true)
      })
    })

    describe('table formatting', () => {
      it('should format table-like content with pipe separators', () => {
        const textContent = {
          items: [
            createTextItem('Name', 50, 750, 50),
            createTextItem('Age', 200, 750, 30),
            createTextItem('City', 350, 750, 40),
            createTextItem('John', 50, 730, 50),
            createTextItem('25', 200, 730, 30),
            createTextItem('NYC', 350, 730, 40),
            createTextItem('Jane', 50, 710, 50),
            createTextItem('30', 200, 710, 30),
            createTextItem('LA', 350, 710, 40)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        // Should contain pipe separators for table
        expect(result).toContain('|')
      })
    })

    describe('header detection', () => {
      it('should treat short all-caps lines as headers', () => {
        const textContent = {
          items: [
            createTextItem('INTRODUCTION', 50, 750),
            createTextItem('This is the body text that follows the header.', 50, 730)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('INTRODUCTION')
        // Headers should cause line breaks
        expect(result.indexOf('INTRODUCTION')).toBeLessThan(result.indexOf('This is the body'))
      })

      it('should treat lines ending with colon as headers', () => {
        const textContent = {
          items: [
            createTextItem('Requirements:', 50, 750),
            createTextItem('Must have experience', 50, 730)
          ]
        }

        const result = extractTextWithLayout(textContent, mockViewport)
        expect(result).toContain('Requirements:')
      })
    })

    describe('PDF reader canHandle', () => {
      it('should detect PDF by extension regardless of case', () => {
        expect(pdfReader.canHandle({
          type: AttachmentType.FILE,
          file: createMockFile('DOC.PDF', 'content')
        })).toBe(true)

        expect(pdfReader.canHandle({
          type: AttachmentType.FILE,
          file: createMockFile('doc.Pdf', 'content')
        })).toBe(true)
      })
    })
  })

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration', () => {
    it('should use custom reader with higher priority', async () => {
      const customReader = {
        name: 'custom-txt',
        priority: 100, // Higher than text reader
        canHandle: (att) => att.file?.name?.endsWith('.txt'),
        read: async () => ({ content: 'Custom reader content' })
      }

      registerReader(customReader)

      const file = new File(['Original'], 'test.txt', { type: 'text/plain' })
      const result = await readAttachment({
        type: AttachmentType.FILE,
        file
      })

      expect(result.content).toBe('Custom reader content')
      expect(result.readerName).toBe('custom-txt')

      // Cleanup
      unregisterReader('custom-txt')
    })

    it('should fall back to lower priority reader when custom reader cannot handle', async () => {
      const customReader = {
        name: 'custom-json',
        priority: 100,
        canHandle: (att) => att.file?.name?.endsWith('.json'),
        read: async () => ({ content: 'JSON content' })
      }

      registerReader(customReader)

      // .txt file should still use text reader
      const file = new File(['Text content'], 'test.txt', { type: 'text/plain' })
      const result = await readAttachment({
        type: AttachmentType.FILE,
        file
      })

      expect(result.readerName).toBe('text')

      // Cleanup
      unregisterReader('custom-json')
    })
  })
})
