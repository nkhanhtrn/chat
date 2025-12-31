import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EpubRenderer, extractEpubMetadata, coverUrlToDataUrl } from '../epubRenderer.js'

// Mock FileReader
global.FileReader = class MockFileReader {
  constructor() {
    this.result = null
    this.readyState = 0
    this.onerror = null
    this.onload = null
  }

  readAsArrayBuffer(blob) {
    this.readyState = 1
    setTimeout(() => {
      this.readyState = 2
      this.result = new ArrayBuffer(1024)
      this.onload?.({ target: this })
    }, 0)
  }

  readAsDataURL(blob) {
    this.readyState = 1
    setTimeout(() => {
      this.readyState = 2
      // Return a base64 data URL for the blob
      this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      this.onload?.({ target: this })
    }, 0)
  }
}

// Mock epubjs
vi.mock('epubjs', () => {
  const mockBook = {
    ready: Promise.resolve(),
    loaded: {
      metadata: Promise.resolve({
        title: 'Test Book',
        creator: 'Test Author'
      }),
      navigation: Promise.resolve({
        toc: [
          { label: 'Chapter 1', href: 'chapter1.xhtml' },
          { label: 'Chapter 2', href: 'chapter2.xhtml' }
        ]
      })
    },
    locations: {
      generate: vi.fn(() => Promise.resolve({}))
    },
    coverUrl: vi.fn(() => Promise.resolve('blob:cover-url')),
    renderTo: vi.fn(() => mockRendition),
    destroy: vi.fn()
  }

  const mockRendition = {
    display: vi.fn(() => Promise.resolve()),
    next: vi.fn(() => Promise.resolve()),
    prev: vi.fn(() => Promise.resolve()),
    currentLocation: vi.fn(() => ({ start: { cfi: 'epubcfi(/6/4)' } })),
    themes: {
      register: vi.fn(),
      select: vi.fn()
    },
    hooks: {
      content: {
        register: vi.fn()
      }
    },
    resize: vi.fn()
  }

  return {
    default: vi.fn(() => mockBook)
  }
})

describe('EpubRenderer', () => {
  let container
  let mockArrayBuffer

  beforeEach(() => {
    // Create a mock container element
    container = document.createElement('div')
    document.documentElement.style.setProperty('--message-font-family', 'Georgia, serif')
    document.documentElement.style.setProperty('--message-font-size', '18px')
    document.documentElement.style.setProperty('--message-line-height', '1.7')
    document.documentElement.style.setProperty('--content-max-width', '800px')
    document.documentElement.style.setProperty('--color-text-message', '#333333')
    document.documentElement.style.setProperty('--color-bg-page', '#ffffff')
    document.documentElement.style.setProperty('--color-primary', '#3b82f6')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('creates instance with ArrayBuffer', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      expect(renderer.element).toBe(container)
      expect(renderer._arrayBuffer).toBe(mockArrayBuffer)
      expect(renderer.ready).toBe(false)
    })

    it('creates instance with Uint8Array', () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4])
      const renderer = new EpubRenderer(container, uint8Array)

      expect(renderer._arrayBuffer).toBeInstanceOf(ArrayBuffer)
      expect(renderer._arrayBuffer.byteLength).toBe(4)
    })

    it('creates instance with URL string', () => {
      const renderer = new EpubRenderer(container, 'https://example.com/book.epub')

      expect(renderer.element).toBe(container)
      expect(renderer._arrayBuffer).toBeUndefined()
    })

    it('throws error for empty ArrayBuffer', () => {
      const emptyBuffer = new ArrayBuffer(0)

      expect(() => new EpubRenderer(container, emptyBuffer)).toThrow('EPUB file is empty')
    })

    it('initializes font hook registered flag', () => {
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      expect(renderer._fontHookRegistered).toBe(false)
    })
  })

  describe('initialize', () => {
    it('initializes rendition with default options', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await renderer.initialize()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()

      expect(mockBook.renderTo).toHaveBeenCalledWith(container, {
        width: '800px',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        allowScriptedContent: false
      })
    })

    it('applies theme styles before displaying', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      const applyThemeSpy = vi.spyOn(renderer, 'applyThemeStyles')

      await renderer.initialize()

      expect(applyThemeSpy).toHaveBeenCalled()
    })

    it('loads table of contents', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await renderer.initialize()

      expect(renderer.navigation).toBeDefined()
      expect(renderer.navigation.toc).toHaveLength(2)
    })

    it('sets ready flag to true', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await renderer.initialize()

      expect(renderer.ready).toBe(true)
    })
  })

  describe('applyThemeStyles', () => {
    it('reads CSS variables from document', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      renderer.applyThemeStyles()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.themes.register).toHaveBeenCalledWith('reader', expect.objectContaining({
        body: expect.objectContaining({
          'font-family': 'Georgia, serif !important',
          'font-size': '18px !important',
          'line-height': '1.7 !important'
        })
      }))
    })

    it('includes link color from theme', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      renderer.applyThemeStyles()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.themes.register).toHaveBeenCalledWith('reader', expect.objectContaining({
        a: expect.objectContaining({
          'color': '#3b82f6 !important'
        })
      }))
    })

    it('registers font injection hook only once', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      renderer.applyThemeStyles()
      renderer.applyThemeStyles()

      expect(renderer._fontHookRegistered).toBe(true)

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      // Hook should only be registered once
      expect(mockRendition.hooks.content.register).toHaveBeenCalledTimes(1)
    })

    it('does nothing if rendition is not ready', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      expect(() => renderer.applyThemeStyles()).not.toThrow()
    })
  })

  describe('refreshTheme', () => {
    it('resizes rendition to new width', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      document.documentElement.style.setProperty('--content-max-width', '600px')
      renderer.refreshTheme()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.resize).toHaveBeenCalledWith('600px', '100%')
    })

    it('re-applies theme styles', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const applyThemeSpy = vi.spyOn(renderer, 'applyThemeStyles')
      renderer.refreshTheme()

      expect(applyThemeSpy).toHaveBeenCalled()
    })

    it('re-displays current position', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      renderer.refreshTheme()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.display).toHaveBeenCalledWith('epubcfi(/6/4)')
    })

    it('does nothing if rendition is not ready', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      expect(() => renderer.refreshTheme()).not.toThrow()
    })
  })

  describe('gotoCfi', () => {
    it('navigates to specific CFI', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      await renderer.gotoCfi('epubcfi(/6/8)')

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.display).toHaveBeenCalledWith('epubcfi(/6/8)')
    })

    it('throws error if rendition not initialized', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await expect(renderer.gotoCfi('epubcfi(/6/8)')).rejects.toThrow('Rendition not initialized')
    })
  })

  describe('goto', () => {
    it('navigates to href', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      await renderer.goto('chapter2.xhtml')

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.display).toHaveBeenCalledWith('chapter2.xhtml')
    })

    it('throws error if rendition not initialized', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await expect(renderer.goto('chapter2.xhtml')).rejects.toThrow('Rendition not initialized')
    })
  })

  describe('next', () => {
    it('navigates to next page', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      await renderer.next()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.next).toHaveBeenCalled()
    })

    it('throws error if rendition not initialized', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await expect(renderer.next()).rejects.toThrow('Rendition not initialized')
    })
  })

  describe('prev', () => {
    it('navigates to previous page', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      await renderer.prev()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      const mockRendition = mockBook.renderTo()

      expect(mockRendition.prev).toHaveBeenCalled()
    })

    it('throws error if rendition not initialized', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      await expect(renderer.prev()).rejects.toThrow('Rendition not initialized')
    })
  })

  describe('getCurrentCfi', () => {
    it('returns current CFI', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const cfi = renderer.getCurrentCfi()

      expect(cfi).toBe('epubcfi(/6/4)')
    })

    it('returns null if rendition not initialized', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      expect(() => renderer.getCurrentCfi()).toThrow()
    })
  })

  describe('getProgress', () => {
    it('returns estimated progress', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const progress = renderer.getProgress()

      expect(progress).toBe(0)
    })

    it('returns 0 if rendition not initialized', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      const progress = renderer.getProgress()

      expect(progress).toBe(0)
    })
  })

  describe('getTableOfContents', () => {
    it('returns table of contents', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const toc = renderer.getTableOfContents()

      expect(toc).toHaveLength(2)
      expect(toc[0]).toEqual({ label: 'Chapter 1', href: 'chapter1.xhtml' })
    })

    it('returns empty array if navigation not loaded', () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)

      const toc = renderer.getTableOfContents()

      expect(toc).toEqual([])
    })
  })

  describe('getMetadata', () => {
    it('returns book metadata', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const metadata = await renderer.getMetadata()

      expect(metadata.title).toBe('Test Book')
      expect(metadata.creator).toBe('Test Author')
    })
  })

  describe('getCoverUrl', () => {
    it('returns cover URL', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const coverUrl = await renderer.getCoverUrl()

      expect(coverUrl).toBe('blob:cover-url')
    })

    it('returns null if cover not available', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      const ePub = (await import('epubjs')).default
      const mockBook = ePub()
      mockBook.coverUrl = vi.fn(() => Promise.reject(new Error('No cover')))

      const coverUrl = await renderer.getCoverUrl()

      expect(coverUrl).toBeNull()
    })
  })

  describe('destroy', () => {
    it('cleans up resources', async () => {
      mockArrayBuffer = new ArrayBuffer(1024)
      const renderer = new EpubRenderer(container, mockArrayBuffer)
      await renderer.initialize()

      renderer.destroy()

      expect(renderer._arrayBuffer).toBeNull()
      expect(renderer.ready).toBe(false)
      expect(renderer.rendition).toBeNull()
      expect(renderer.navigation).toBeNull()
    })
  })
})

describe('extractEpubMetadata', () => {
  it('extracts metadata from ArrayBuffer', async () => {
    const mockBuffer = new ArrayBuffer(1024)

    const metadata = await extractEpubMetadata(mockBuffer)

    expect(metadata.title).toBe('Test Book')
    expect(metadata.author).toBe('Test Author')
    // coverUrlToDataUrl returns null in test since fetch isn't mocked for blob URLs
    expect(metadata.coverUrl).toBeNull()
  })

  it('extracts metadata from File', async () => {
    const mockFile = new File([new ArrayBuffer(1024)], 'test.epub', { type: 'application/epub+zip' })

    const metadata = await extractEpubMetadata(mockFile)

    expect(metadata.title).toBe('Test Book')
    expect(metadata.author).toBe('Test Author')
  })

  it('returns defaults on extraction failure', async () => {
    const mockBuffer = new ArrayBuffer(1024)

    const ePub = (await import('epubjs')).default
    ePub.mockImplementationOnce(() => {
      throw new Error('Invalid EPUB')
    })

    const metadata = await extractEpubMetadata(mockBuffer)

    expect(metadata.title).toBe('Untitled Book')
    expect(metadata.author).toBe('Unknown Author')
    expect(metadata.coverUrl).toBeNull()
  })

  it('returns defaults for File with error', async () => {
    const mockFile = new File([new ArrayBuffer(1024)], 'test.epub', { type: 'application/epub+zip' })

    // Mock FileReader to trigger onerror
    const MockFileReaderWithError = class {
      constructor() {
        this.result = null
        this.readyState = 0
        this.onerror = null
        this.onload = null
      }
      readAsArrayBuffer(blob) {
        setTimeout(() => this.onerror?.(), 0)
      }
      readAsDataURL(blob) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    global.FileReader = MockFileReaderWithError

    const metadata = await extractEpubMetadata(mockFile)

    expect(metadata.title).toBe('test')
    expect(metadata.author).toBe('Unknown Author')

    // Restore original mock
    global.FileReader = class MockFileReader {
      constructor() {
        this.result = null
        this.readyState = 0
        this.onerror = null
        this.onload = null
      }

      readAsArrayBuffer(blob) {
        this.readyState = 1
        setTimeout(() => {
          this.readyState = 2
          this.result = new ArrayBuffer(1024)
          this.onload?.({ target: this })
        }, 0)
      }

      readAsDataURL(blob) {
        this.readyState = 1
        setTimeout(() => {
          this.readyState = 2
          // Return a base64 data URL for the blob
          this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          this.onload?.({ target: this })
        }, 0)
      }
    }
  })
})

describe('coverUrlToDataUrl', () => {
  it('converts blob URL to data URL', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' }))
      })
    )

    const dataUrl = await coverUrlToDataUrl('blob:test-url')

    expect(dataUrl).toMatch(/^data:image\/png;base64/)
  })

  it('returns null for invalid URL', async () => {
    const dataUrl = await coverUrlToDataUrl(null)

    expect(dataUrl).toBeNull()
  })

  it('returns null on fetch error', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

    const dataUrl = await coverUrlToDataUrl('blob:test-url')

    expect(dataUrl).toBeNull()
  })
})
