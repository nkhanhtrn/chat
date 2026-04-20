import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockRendition = {
    resize: vi.fn(),
    spread: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    themes: {
      default: vi.fn(),
      register: vi.fn(),
      select: vi.fn(),
    },
    destroy: vi.fn(),
    display: vi.fn().mockResolvedValue(undefined),
    currentLocation: vi.fn().mockReturnValue(null),
    prev: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    goTo: vi.fn().mockResolvedValue(undefined),
  }

  const mockBook = {
    ready: Promise.resolve(),
    packaging: {},
    renderTo: vi.fn().mockReturnValue(mockRendition),
    loaded: {
      navigation: Promise.resolve({ toc: [] }),
    },
    locations: {
      generate: vi.fn().mockResolvedValue(undefined),
      cfFromPercentage: vi.fn().mockReturnValue('epubcfi(/6/4[id]!/4/2/1:0)'),
      percentageFromCfi: vi.fn().mockReturnValue(0),
    },
    destroy: vi.fn(),
  }

  return { mockRendition, mockBook }
})

vi.mock('epubjs', () => {
  return {
    default: vi.fn(() => mocks.mockBook),
  }
})

import { EpubRenderer } from '../epubRenderer'

function createContainer(): HTMLElement {
  const div = document.createElement('div')
  div.style.width = '800px'
  div.style.height = '600px'
  return div
}

describe('EpubRenderer', () => {
  let renderer: EpubRenderer

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = new EpubRenderer(createContainer(), new ArrayBuffer(8), {
      theme: { bg: '#fff', color: '#333', accent: '#6366f1' },
    })
  })

  describe('destroy', () => {
    it('destroys rendition and book', async () => {
      await renderer.initialize()
      renderer.destroy()
      expect(mocks.mockRendition.destroy).toHaveBeenCalled()
      expect(mocks.mockBook.destroy).toHaveBeenCalled()
    })

    it('can be called safely without initialization', () => {
      expect(() => renderer.destroy()).not.toThrow()
    })

    it('can be called multiple times safely', async () => {
      await renderer.initialize()
      renderer.destroy()
      renderer.destroy()
      expect(mocks.mockRendition.destroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('resize', () => {
    it('is a no-op after destroy', async () => {
      await renderer.initialize()
      renderer.destroy()
      renderer.resize(500, 400)
      expect(mocks.mockRendition.resize).not.toHaveBeenCalled()
    })

    it('calls rendition.resize with correct args', async () => {
      await renderer.initialize()
      renderer.resize(600, '100%')
      expect(mocks.mockRendition.resize).toHaveBeenCalledWith(600, '100%')
    })

    it('is a no-op before initialization', () => {
      renderer.resize(600, 400)
      expect(mocks.mockRendition.resize).not.toHaveBeenCalled()
    })

    it('sets spread mode based on width', async () => {
      await renderer.initialize()
      renderer.resize(1000, 600)
      expect(mocks.mockRendition.spread).toHaveBeenCalledWith('auto')
      renderer.resize(500, 600)
      expect(mocks.mockRendition.spread).toHaveBeenCalledWith('none')
    })
  })

  describe('selectCleanup', () => {
    it('stores callback ref for proper off() call', async () => {
      const onTextSelect = vi.fn()
      const r = new EpubRenderer(createContainer(), new ArrayBuffer(8), {
        onTextSelect,
      })
      await r.initialize()

      const onCall = mocks.mockRendition.on as vi.Mock
      expect(onCall).toHaveBeenCalledWith('selected', expect.any(Function))

      r.destroy()

      const offCall = mocks.mockRendition.off as vi.Mock
      expect(offCall).toHaveBeenCalledWith('selected', expect.any(Function))
    })

    it('does not fail when no onTextSelect callback', async () => {
      const r = new EpubRenderer(createContainer(), new ArrayBuffer(8))
      await r.initialize()
      expect(() => r.destroy()).not.toThrow()
    })
  })
})
