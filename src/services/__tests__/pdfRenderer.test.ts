import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TocItem } from '@/types/book'

// Use vi.hoisted so mocks are available in the hoisted vi.mock factory
const mocks = vi.hoisted(() => {
  const mockNumPages = 3
  const mockGetPage = vi.fn()
  const mockGetOutline = vi.fn().mockResolvedValue(null)
  const mockGetMetadata = vi.fn().mockResolvedValue({ info: {} })
  const mockGetDestination = vi.fn()
  const mockGetPageIndex = vi.fn()
  const mockDestroy = vi.fn()

  const mockPdfDoc = {
    numPages: mockNumPages,
    getPage: mockGetPage,
    getOutline: mockGetOutline,
    getMetadata: mockGetMetadata,
    getDestination: mockGetDestination,
    getPageIndex: mockGetPageIndex,
    destroy: mockDestroy,
  }

  return {
    mockNumPages,
    mockGetPage,
    mockGetOutline,
    mockGetMetadata,
    mockGetDestination,
    mockGetPageIndex,
    mockDestroy,
    mockPdfDoc,
  }
})

vi.mock('pdfjs-dist', () => {
  const mockLoadingTask = { promise: Promise.resolve(mocks.mockPdfDoc) }
  return {
    getDocument: vi.fn().mockReturnValue(mockLoadingTask),
    GlobalWorkerOptions: { workerSrc: '' },
    TextLayer: vi.fn().mockImplementation(function () {
      return { render: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() }
    }),
  }
})

const { mockNumPages, mockGetPage, mockGetOutline, mockGetMetadata, mockGetDestination, mockGetPageIndex, mockDestroy } = mocks

// Import after mocks
import { PdfRenderer, extractPdfInfo, extractPdfToc } from '../pdfRenderer'

function createMockPage(text = 'Hello world') {
  const viewport = { width: 200, height: 300 }
  return {
    getViewport: vi.fn().mockReturnValue(viewport),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({ items: [{ str: text, transform: [12, 0, 0, 12, 10, 20], width: 50, height: 12 }] }),
  }
}

function createContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('PdfRenderer', () => {
  let container: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    container = createContainer()
    // Reset mock defaults
    mockGetOutline.mockResolvedValue(null)
    mockGetMetadata.mockResolvedValue({ info: {} })
    mockGetPage.mockResolvedValue(createMockPage())
    mockDestroy.mockResolvedValue(undefined)
  })

  describe('constructor', () => {
    it('uses default scale of 1.5', () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      expect(renderer.getScale()).toBe(1.5)
    })

    it('accepts custom scale', () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { scale: 2.0 })
      expect(renderer.getScale()).toBe(2.0)
    })

    it('applies spreadMode option at construction', () => {
      expect(new PdfRenderer(container, new ArrayBuffer(8), { spreadMode: 'single' }).getSpreadMode()).toBe('single')
      expect(new PdfRenderer(container, new ArrayBuffer(8), { spreadMode: 'double' }).getSpreadMode()).toBe('double')
      expect(new PdfRenderer(container, new ArrayBuffer(8), { spreadMode: 'auto' }).getSpreadMode()).toBe('auto')
      expect(new PdfRenderer(container, new ArrayBuffer(8)).getSpreadMode()).toBe('auto')
    })
  })

  describe('initialize', () => {
    it('loads the PDF and sets total pages', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      expect(renderer.totalPages).toBe(mockNumPages)
      renderer.destroy()
    })

    it('renders the first page', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      expect(mockGetPage).toHaveBeenCalledWith(1)
      renderer.destroy()
    })

    it('fires onLocationChange with initial position', async () => {
      const onLocationChange = vi.fn()
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { onLocationChange })
      await renderer.initialize()

      expect(onLocationChange).toHaveBeenCalledWith({
        page: 1,
        totalPages: mockNumPages,
        percentage: 1 / mockNumPages,
      })
      renderer.destroy()
    })

    it('extracts outline when available', async () => {
      mockGetOutline.mockResolvedValue([
        { title: 'Chapter 1', dest: null, items: [] },
      ])
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      const toc = renderer.getTableOfContents()
      expect(toc).toHaveLength(1)
      expect(toc[0].label).toBe('Chapter 1')
      expect(toc[0].href).toBe('page:1')
      renderer.destroy()
    })

    it('does not mutate the original ArrayBuffer', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const original = new Uint8Array(data)
      const renderer = new PdfRenderer(container, data.buffer.slice(0))
      await renderer.initialize()
      renderer.destroy()

      // Original data should be unchanged
      expect(new Uint8Array(data.buffer)).toEqual(original)
    })
  })

  describe('getCurrentLocation', () => {
    it('returns null before initialization', () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      expect(renderer.getCurrentLocation()).toBeNull()
    })

    it('returns location after initialization', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      const loc = renderer.getCurrentLocation()
      expect(loc).toEqual({
        page: 1,
        totalPages: mockNumPages,
        percentage: 1 / mockNumPages,
      })
      renderer.destroy()
    })
  })

  describe('nextPage / prevPage', () => {
    it('navigates to next page', async () => {
      const onLocationChange = vi.fn()
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { onLocationChange })
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.nextPage()

      expect(mockGetPage).toHaveBeenCalledWith(2)
      const lastCall = onLocationChange.mock.calls[onLocationChange.mock.calls.length - 1][0]
      expect(lastCall.page).toBe(2)
      renderer.destroy()
    })

    it('does not go past the last page', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      // Go to last page
      for (let i = 1; i < mockNumPages; i++) await renderer.nextPage()
      vi.clearAllMocks()

      await renderer.nextPage()
      // Should not render beyond last page
      expect(mockGetPage).not.toHaveBeenCalled()
      renderer.destroy()
    })

    it('navigates to previous page', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      await renderer.nextPage()
      vi.clearAllMocks()

      await renderer.prevPage()

      expect(mockGetPage).toHaveBeenCalledWith(1)
      renderer.destroy()
    })

    it('does not go before the first page', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.prevPage()
      expect(mockGetPage).not.toHaveBeenCalled()
      renderer.destroy()
    })
  })

  describe('display', () => {
    it('navigates to a specific page number', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.display(3)

      expect(mockGetPage).toHaveBeenCalledWith(3)
      renderer.destroy()
    })

    it('navigates via page: string format', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.display('page:2')

      expect(mockGetPage).toHaveBeenCalledWith(2)
      renderer.destroy()
    })

    it('clamps to valid page range', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.display(999)

      // Should clamp to totalPages
      expect(mockGetPage).toHaveBeenCalledWith(mockNumPages)
      renderer.destroy()
    })

    it('defaults to page 1 with no argument', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      await renderer.nextPage()
      vi.clearAllMocks()

      await renderer.display()

      expect(mockGetPage).toHaveBeenCalledWith(1)
      renderer.destroy()
    })
  })

  describe('sequential navigation (keyboard-like)', () => {
    it('navigates through all pages sequentially', async () => {
      const onLocationChange = vi.fn()
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { onLocationChange })
      await renderer.initialize()

      // Page 1 -> 2 -> 3
      await renderer.nextPage()
      await renderer.nextPage()

      // Should be on last page now
      const loc = renderer.getCurrentLocation()!
      expect(loc.page).toBe(mockNumPages)

      // 3 -> 2 -> 1
      await renderer.prevPage()
      await renderer.prevPage()

      const loc2 = renderer.getCurrentLocation()!
      expect(loc2.page).toBe(1)
      renderer.destroy()
    })

    it('fires onLocationChange for each page turn', async () => {
      const onLocationChange = vi.fn()
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { onLocationChange })
      await renderer.initialize()
      const initCalls = onLocationChange.mock.calls.length

      await renderer.nextPage()
      await renderer.prevPage()

      // Should have fired once for init + once for next + once for prev
      expect(onLocationChange.mock.calls.length).toBe(initCalls + 2)
      renderer.destroy()
    })

    it('handles rapid sequential nextPage calls', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      // Fire multiple nextPage — the rendering guard serializes them
      await Promise.all([renderer.nextPage(), renderer.nextPage()])

      // Should end up on page 2 or 3 (one may have been blocked by rendering guard)
      const loc = renderer.getCurrentLocation()!
      expect(loc.page).toBeGreaterThanOrEqual(2)
      renderer.destroy()
    })
  })

  describe('setScale', () => {
    it('clamps scale to 0.5 minimum', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      await renderer.setScale(0.1)
      expect(renderer.getScale()).toBe(0.5)
      renderer.destroy()
    })

    it('clamps scale to 4 maximum', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      await renderer.setScale(10)
      expect(renderer.getScale()).toBe(4)
      renderer.destroy()
    })

    it('re-renders current page at new scale', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      vi.clearAllMocks()

      await renderer.setScale(2.0)

      expect(mockGetPage).toHaveBeenCalled()
      renderer.destroy()
    })
  })

  describe('spread mode', () => {
    it('"double" override renders two pages even when auto would be single', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { spreadMode: 'double' })
      await renderer.initialize()

      expect(renderer.getSpreadMode()).toBe('double')
      expect(mockGetPage).toHaveBeenCalledWith(1)
      expect(mockGetPage).toHaveBeenCalledWith(2)
      renderer.destroy()
    })

    it('"single" override renders one page even when auto would be spread', async () => {
      Object.defineProperty(container, 'offsetWidth', { configurable: true, get: () => 1000 })
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { spreadMode: 'single' })
      await renderer.initialize()

      expect(renderer.getSpreadMode()).toBe('single')
      expect(mockGetPage).toHaveBeenCalledWith(1)
      expect(mockGetPage).not.toHaveBeenCalledWith(2)
      renderer.destroy()
    })

    it('setSpreadMode switches and re-renders', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      expect(renderer.getSpreadMode()).toBe('auto')

      renderer.setSpreadMode('double')
      // setSpreadMode fires an async re-render; let it flush
      await new Promise(r => setTimeout(r, 10))

      expect(renderer.getSpreadMode()).toBe('double')
      expect(mockGetPage).toHaveBeenCalledWith(2)
      renderer.destroy()
    })
  })

  describe('destroy', () => {
    it('destroys the PDF document', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      renderer.destroy()

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('clears the container', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      renderer.destroy()

      expect(container.innerHTML).toBe('')
    })

    it('prevents operations after destruction', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      renderer.destroy()
      vi.clearAllMocks()

      await renderer.nextPage()
      await renderer.prevPage()
      await renderer.display(2)

      expect(mockGetPage).not.toHaveBeenCalled()
    })

    it('returns null from getCurrentLocation after destruction', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()
      renderer.destroy()

      expect(renderer.getCurrentLocation()).toBeNull()
    })
  })

  describe('getTableOfContents', () => {
    it('returns empty array when PDF has no outline', async () => {
      mockGetOutline.mockResolvedValue(null)
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      expect(renderer.getTableOfContents()).toEqual([])
      renderer.destroy()
    })

    it('returns outline items with page hrefs', async () => {
      mockGetOutline.mockResolvedValue([
        { title: 'Introduction', dest: null, items: [] },
        { title: 'Chapter 1', dest: null, items: [] },
      ])
      const renderer = new PdfRenderer(container, new ArrayBuffer(8))
      await renderer.initialize()

      const toc = renderer.getTableOfContents()
      expect(toc).toHaveLength(2)
      expect(toc[0].label).toBe('Introduction')
      expect(toc[0].href).toBe('page:1')
      expect(toc[1].label).toBe('Chapter 1')
      renderer.destroy()
    })
  })

  describe('drawing strokes', () => {
    it('attaches a stroke overlay per page render', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), {
        getStrokesForPage: () => [],
      })
      await renderer.initialize()

      expect(container.querySelector('svg.pdf-draw-layer')).not.toBeNull()
      renderer.destroy()
    })

    it('renders persisted strokes from getStrokesForPage', async () => {
      const strokes = [{ id: 's1', bookId: 'b', page: 1, tool: 'pen', colorIndex: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], createdAt: 1, updatedAt: 1 }]
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), {
        getStrokesForPage: () => strokes,
      })
      await renderer.initialize()

      expect(container.querySelectorAll('g[data-stroke-id]')).toHaveLength(1)
      renderer.destroy()
    })

    it('propagates tool/color changes to the active stroke layer', async () => {
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), { getStrokesForPage: () => [] })
      await renderer.initialize()

      const svg = container.querySelector('svg.pdf-draw-layer') as SVGSVGElement
      // SVG always has pointer-events auto now (pen always draws, even in select mode)
      expect(svg.style.pointerEvents).toBe('auto')

      renderer.setDrawTool('pen')
      expect(svg.style.pointerEvents).toBe('auto')

      renderer.setDrawColor(3)
      renderer.destroy()
    })

    it('redrawStrokes re-reads the strokes callback', async () => {
      let strokes: any[] = []
      const renderer = new PdfRenderer(container, new ArrayBuffer(8), {
        getStrokesForPage: () => strokes,
      })
      await renderer.initialize()

      expect(container.querySelectorAll('g[data-stroke-id]')).toHaveLength(0)
      strokes = [{ id: 's1', bookId: 'b', page: 1, tool: 'pen', colorIndex: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], createdAt: 1, updatedAt: 1 }]
      renderer.redrawStrokes()
      expect(container.querySelectorAll('g[data-stroke-id]')).toHaveLength(1)
      renderer.destroy()
    })
  })
})

describe('extractPdfInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMetadata.mockResolvedValue({ info: {} })
    mockGetPage.mockResolvedValue(createMockPage())
    mockDestroy.mockResolvedValue(undefined)
    mockGetOutline.mockResolvedValue(null)
  })

  it('extracts title and author from metadata', async () => {
    mockGetMetadata.mockResolvedValue({
      info: { Title: 'Test PDF', Author: 'Test Author' },
    })

    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.title).toBe('Test PDF')
    expect(result.author).toBe('Test Author')
  })

  it('returns empty strings when metadata is missing', async () => {
    mockGetMetadata.mockResolvedValue({ info: null })

    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.title).toBe('')
    expect(result.author).toBe('')
  })

  it('returns total page count', async () => {
    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.totalPages).toBe(mockNumPages)
  })

  it('generates cover from first page', async () => {
    // Mock canvas.toBlob
    const mockBlob = new Blob(['cover'], { type: 'image/jpeg' })
    const origToBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (cb: any, type?: string, quality?: any) {
      cb(mockBlob)
    }

    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.coverData).not.toBeNull()
    expect(result.coverData!.byteLength).toBeGreaterThan(0)

    HTMLCanvasElement.prototype.toBlob = origToBlob
  })

  it('destroys the PDF document after extraction', async () => {
    await extractPdfInfo(new ArrayBuffer(8))

    expect(mockDestroy).toHaveBeenCalled()
  })

  it('handles metadata extraction errors gracefully', async () => {
    mockGetMetadata.mockRejectedValue(new Error('metadata error'))

    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.title).toBe('')
    expect(result.author).toBe('')
    expect(result.totalPages).toBe(mockNumPages)
  })

  it('handles cover generation errors gracefully', async () => {
    mockGetPage.mockRejectedValue(new Error('page error'))

    const result = await extractPdfInfo(new ArrayBuffer(8))

    expect(result.coverData).toBeNull()
  })

  it('does not mutate the input ArrayBuffer', async () => {
    const data = new Uint8Array([10, 20, 30, 40])
    const original = new Uint8Array(data)

    await extractPdfInfo(data.buffer.slice(0))

    expect(new Uint8Array(data.buffer)).toEqual(original)
  })
})

describe('extractPdfToc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDestroy.mockResolvedValue(undefined)
  })

  it('returns empty array when PDF has no outline', async () => {
    mockGetOutline.mockResolvedValue(null)

    const result = await extractPdfToc(new ArrayBuffer(8))

    expect(result).toEqual([])
  })

  it('extracts outline items', async () => {
    mockGetOutline.mockResolvedValue([
      { title: 'Chapter 1', dest: null, items: [] },
      { title: 'Chapter 2', dest: null, items: [] },
    ])

    const result = await extractPdfToc(new ArrayBuffer(8))

    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Chapter 1')
    expect(result[1].label).toBe('Chapter 2')
  })

  it('destroys the PDF document after extraction', async () => {
    mockGetOutline.mockResolvedValue(null)

    await extractPdfToc(new ArrayBuffer(8))

    expect(mockDestroy).toHaveBeenCalled()
  })
})
