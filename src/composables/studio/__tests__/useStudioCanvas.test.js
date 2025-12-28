import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock saveTool from indexedDB
vi.mock('../../../services/indexedDB.js', () => ({
  saveTool: vi.fn(() => Promise.resolve())
}))

import { saveTool as mockSaveTool } from '../../../services/indexedDB.js'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { useStudioCanvas } from '../useStudioCanvas.js'

describe('useStudioCanvas', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    mockSaveTool.mockClear()

    // Reset the singleton state before each test
    const canvas = useStudioCanvas()
    canvas.resetState()
  })

  describe('Initialization', () => {
    it('should return windows ref', () => {
      const canvas = useStudioCanvas()
      expect(canvas.windows).toBeDefined()
      expect(canvas.windows.value).toEqual([])
    })

    it('should return all action functions', () => {
      const canvas = useStudioCanvas()
      expect(typeof canvas.addWindow).toBe('function')
      expect(typeof canvas.removeWindow).toBe('function')
      expect(typeof canvas.updateWindowPosition).toBe('function')
      expect(typeof canvas.updateWindowSize).toBe('function')
      expect(typeof canvas.bringToFront).toBe('function')
      expect(typeof canvas.minimizeWindow).toBe('function')
      expect(typeof canvas.restoreWindow).toBe('function')
      expect(typeof canvas.clearWindows).toBe('function')
      expect(typeof canvas.getWindowByMessageId).toBe('function')
      expect(typeof canvas.getMinSize).toBe('function')
    })

    it('should return computed properties for visible and minimized windows', () => {
      const canvas = useStudioCanvas()
      expect(canvas.visibleWindows).toBeDefined()
      expect(canvas.minimizedWindowsByCategory).toBeDefined()
    })

    it('should load from localStorage on init', () => {
      const savedState = {
        windows: [{ id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }],
        nextWindowId: 2,
        cascadeOffset: { x: 30, y: 30 },
        maxZIndex: 100
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState))

      const canvas = useStudioCanvas()
      canvas.loadFromStorage()

      expect(canvas.windows.value).toHaveLength(1)
      expect(canvas.windows.value[0].id).toBe('window-1')
    })
  })

  describe('addWindow', () => {
    it('should add a new window', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'chart',
        content: { title: 'Test Chart' }
      })

      expect(canvas.windows.value).toHaveLength(1)
      expect(window.id).toBe('window-1')
      expect(window.messageId).toBe('msg-1')
      expect(window.type).toBe('chart')
    })

    it('should generate unique IDs', () => {
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })

      expect(w1.id).not.toBe(w2.id)
    })

    it('should use default sizes by type', () => {
      const canvas = useStudioCanvas()

      const chart = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      expect(chart.size).toEqual({ width: 450, height: 350 })

      const mermaid = canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })
      expect(mermaid.size).toEqual({ width: 500, height: 400 })

      const tool = canvas.addWindow({ messageId: 'msg-3', type: 'tool', content: {} })
      expect(tool.size).toEqual({ width: 350, height: 400 })
    })

    it('should cascade window positions', () => {
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })
      const w3 = canvas.addWindow({ messageId: 'msg-3', type: 'chart', content: {} })

      expect(w1.position).toEqual({ x: 0, y: 0 })
      expect(w2.position).toEqual({ x: 30, y: 30 })
      expect(w3.position).toEqual({ x: 60, y: 60 })
    })

    it('should reset cascade after threshold', () => {
      const canvas = useStudioCanvas()

      // Add 11 windows to exceed 300px threshold (11 * 30 = 330)
      for (let i = 0; i < 11; i++) {
        canvas.addWindow({ messageId: `msg-${i}`, type: 'chart', content: {} })
      }

      const lastWindow = canvas.addWindow({ messageId: 'msg-11', type: 'chart', content: {} })
      expect(lastWindow.position).toEqual({ x: 0, y: 0 })
    })

    it('should increment zIndex for each window', () => {
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })

      expect(w2.zIndex).toBeGreaterThan(w1.zIndex)
    })

    it('should generate title from type', () => {
      const canvas = useStudioCanvas()

      const chart = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      expect(chart.title).toBe('Chart')

      const mermaid = canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })
      expect(mermaid.title).toBe('Diagram')

      const svg = canvas.addWindow({ messageId: 'msg-3', type: 'svg', content: {} })
      expect(svg.title).toBe('SVG')

      const tool = canvas.addWindow({ messageId: 'msg-4', type: 'tool', content: { name: 'Calculator' } })
      expect(tool.title).toBe('Calculator')

      const codeResult = canvas.addWindow({ messageId: 'msg-5', type: 'codeResult', content: {} })
      expect(codeResult.title).toBe('Code Result')
    })

    it('should use content title if available', () => {
      const canvas = useStudioCanvas()
      const chart = canvas.addWindow({
        messageId: 'msg-1',
        type: 'chart',
        content: { title: 'Sales Data' }
      })
      expect(chart.title).toBe('Sales Data')
    })

    it('should save to localStorage after adding', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('removeWindow', () => {
    it('should remove a window by id', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      expect(canvas.windows.value).toHaveLength(1)
      canvas.removeWindow(window.id)
      expect(canvas.windows.value).toHaveLength(0)
    })

    it('should not error when removing non-existent window', () => {
      const canvas = useStudioCanvas()
      expect(() => canvas.removeWindow('non-existent')).not.toThrow()
    })

    it('should save to localStorage after removing', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      vi.clearAllMocks()

      canvas.removeWindow(window.id)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('updateWindowPosition', () => {
    it('should update window position', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      canvas.updateWindowPosition(window.id, { x: 100, y: 200 })
      expect(canvas.windows.value[0].position).toEqual({ x: 100, y: 200 })
    })

    it('should not error for non-existent window', () => {
      const canvas = useStudioCanvas()
      expect(() => canvas.updateWindowPosition('non-existent', { x: 0, y: 0 })).not.toThrow()
    })
  })

  describe('updateWindowSize', () => {
    it('should update window size', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      canvas.updateWindowSize(window.id, { width: 600, height: 500 })
      expect(canvas.windows.value[0].size).toEqual({ width: 600, height: 500 })
    })

    it('should enforce minimum sizes', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      canvas.updateWindowSize(window.id, { width: 100, height: 100 })
      // Chart minimum is 300x250
      expect(canvas.windows.value[0].size.width).toBeGreaterThanOrEqual(300)
      expect(canvas.windows.value[0].size.height).toBeGreaterThanOrEqual(250)
    })
  })

  describe('bringToFront', () => {
    it('should update zIndex to be highest', () => {
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })

      const originalW2ZIndex = w2.zIndex
      canvas.bringToFront(w1.id)

      expect(canvas.windows.value[0].zIndex).toBeGreaterThan(originalW2ZIndex)
    })
  })

  describe('getWindowByMessageId', () => {
    it('should find window by message id', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })

      const found = canvas.getWindowByMessageId('msg-2')
      expect(found).toBeDefined()
      expect(found.type).toBe('mermaid')
    })

    it('should return undefined for non-existent message', () => {
      const canvas = useStudioCanvas()
      const found = canvas.getWindowByMessageId('non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('clearWindows', () => {
    it('should remove all windows', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })

      expect(canvas.windows.value).toHaveLength(2)
      canvas.clearWindows()
      expect(canvas.windows.value).toHaveLength(0)
    })

    it('should reset cascade offset', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })
      canvas.clearWindows()

      const newWindow = canvas.addWindow({ messageId: 'msg-3', type: 'chart', content: {} })
      expect(newWindow.position).toEqual({ x: 0, y: 0 })
    })
  })

  describe('getMinSize', () => {
    it('should return minimum sizes by type', () => {
      const canvas = useStudioCanvas()

      expect(canvas.getMinSize('chart')).toEqual({ width: 300, height: 250 })
      expect(canvas.getMinSize('mermaid')).toEqual({ width: 300, height: 200 })
      expect(canvas.getMinSize('svg')).toEqual({ width: 200, height: 200 })
      expect(canvas.getMinSize('tool')).toEqual({ width: 250, height: 200 })
      expect(canvas.getMinSize('codeResult')).toEqual({ width: 300, height: 150 })
    })

    it('should return default for unknown type', () => {
      const canvas = useStudioCanvas()
      expect(canvas.getMinSize('unknown')).toEqual({ width: 200, height: 150 })
    })
  })

  describe('Singleton Pattern', () => {
    it('should share state across multiple calls', () => {
      const canvas1 = useStudioCanvas()
      canvas1.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      const canvas2 = useStudioCanvas()
      expect(canvas2.windows.value).toHaveLength(1)
    })
  })

  describe('minimizeWindow', () => {
    it('should set minimized to true', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      expect(window.minimized).toBe(false)
      canvas.minimizeWindow(window.id)
      expect(canvas.windows.value[0].minimized).toBe(true)
    })

    it('should not error for non-existent window', () => {
      const canvas = useStudioCanvas()
      expect(() => canvas.minimizeWindow('non-existent')).not.toThrow()
    })

    it('should save to localStorage after minimizing', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      vi.clearAllMocks()

      canvas.minimizeWindow(window.id)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('restoreWindow', () => {
    it('should set minimized to false', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      canvas.minimizeWindow(window.id)
      expect(canvas.windows.value[0].minimized).toBe(true)

      canvas.restoreWindow(window.id)
      expect(canvas.windows.value[0].minimized).toBe(false)
    })

    it('should bring window to front when restoring', () => {
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })

      canvas.minimizeWindow(w1.id)
      const w2ZIndex = w2.zIndex

      canvas.restoreWindow(w1.id)
      expect(canvas.windows.value[0].zIndex).toBeGreaterThan(w2ZIndex)
    })
  })

  describe('visibleWindows', () => {
    it('should return only non-minimized windows', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'mermaid', content: {} })
      canvas.addWindow({ messageId: 'msg-3', type: 'svg', content: {} })

      canvas.minimizeWindow(w2.id)

      expect(canvas.windows.value).toHaveLength(3)
      expect(canvas.visibleWindows.value).toHaveLength(2)
      expect(canvas.visibleWindows.value.every(w => !w.minimized)).toBe(true)
    })
  })

  describe('updateWindowContent', () => {
    it('should update window content', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: { code: 'old' } })

      canvas.updateWindowContent(window.id, { code: 'new', type: 'vue-sfc' })

      expect(canvas.windows.value[0].content).toEqual({ code: 'new', type: 'vue-sfc' })
    })

    it('should trigger reactivity by replacing window object', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: { code: 'old' } })

      const originalWindow = canvas.windows.value[0]
      canvas.updateWindowContent(window.id, { code: 'new' })

      // Should be a new object reference (for reactivity)
      expect(canvas.windows.value[0]).not.toBe(originalWindow)
      expect(canvas.windows.value[0].content).toEqual({ code: 'new' })
    })

    it('should preserve other window properties', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: { code: 'old' } })

      canvas.updateWindowPosition(window.id, { x: 100, y: 200 })
      canvas.updateWindowContent(window.id, { code: 'new' })

      expect(canvas.windows.value[0].position).toEqual({ x: 100, y: 200 })
      expect(canvas.windows.value[0].type).toBe('tool')
      expect(canvas.windows.value[0].messageId).toBe('msg-1')
    })

    it('should not error for non-existent window', () => {
      const canvas = useStudioCanvas()
      expect(() => canvas.updateWindowContent('non-existent', { code: 'test' })).not.toThrow()
    })

    it('should save to localStorage after updating', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: {} })
      vi.clearAllMocks()

      canvas.updateWindowContent(window.id, { code: 'new' })
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('minimizedWindowsByCategory', () => {
    it('should group minimized windows by type', () => {
      const canvas = useStudioCanvas()
      const chart1 = canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      const chart2 = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })
      const mermaid1 = canvas.addWindow({ messageId: 'msg-3', type: 'mermaid', content: {} })

      canvas.minimizeWindow(chart1.id)
      canvas.minimizeWindow(chart2.id)
      canvas.minimizeWindow(mermaid1.id)

      const categories = canvas.minimizedWindowsByCategory.value
      expect(categories).toHaveLength(2)

      const chartCategory = categories.find(c => c.type === 'chart')
      expect(chartCategory).toBeDefined()
      expect(chartCategory.windows).toHaveLength(2)
      expect(chartCategory.name).toBe('Charts')

      const mermaidCategory = categories.find(c => c.type === 'mermaid')
      expect(mermaidCategory).toBeDefined()
      expect(mermaidCategory.windows).toHaveLength(1)
      expect(mermaidCategory.name).toBe('Diagrams')
    })

    it('should sort categories by order', () => {
      const canvas = useStudioCanvas()
      const tool = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: {} })
      const chart = canvas.addWindow({ messageId: 'msg-2', type: 'chart', content: {} })
      const code = canvas.addWindow({ messageId: 'msg-3', type: 'codeResult', content: {} })

      canvas.minimizeWindow(tool.id)
      canvas.minimizeWindow(chart.id)
      canvas.minimizeWindow(code.id)

      const categories = canvas.minimizedWindowsByCategory.value
      expect(categories[0].type).toBe('chart') // order 1
      expect(categories[1].type).toBe('tool')  // order 4
      expect(categories[2].type).toBe('codeResult') // order 5
    })

    it('should return empty array when no windows are minimized', () => {
      const canvas = useStudioCanvas()
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })

      expect(canvas.minimizedWindowsByCategory.value).toHaveLength(0)
    })
  })

  describe('cloneWindow', () => {
    it('should create a new window with cloned content', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Calculator', code: '<template>...</template>', type: 'vue-sfc' }
      })

      const cloned = canvas.cloneWindow(original)

      expect(canvas.windows.value).toHaveLength(2)
      expect(cloned.id).not.toBe(original.id)
      expect(cloned.type).toBe('tool')
    })

    it('should generate unique name with (Copy) suffix', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Calculator', code: '<template>...</template>', type: 'vue-sfc' }
      })

      const cloned = canvas.cloneWindow(original)

      expect(cloned.content.name).toBe('Calculator (Copy)')
    })

    it('should increment copy number if (Copy) already exists', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Calculator', code: '<template>...</template>', type: 'vue-sfc' }
      })

      canvas.cloneWindow(original)
      const secondClone = canvas.cloneWindow(original)

      expect(secondClone.content.name).toBe('Calculator (Copy 2)')
    })

    it('should use cascade position for cloned window', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Calculator', code: '<template>...</template>' }
      })

      const cloned = canvas.cloneWindow(original)

      // Cascade should advance from original's position
      expect(cloned.position).toEqual({ x: 30, y: 30 })
    })

    it('should save cloned tool to IndexedDB', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: {
          name: 'Calculator',
          emoji: '🧮',
          type: 'vue-sfc',
          code: '<template>...</template>'
        }
      })

      canvas.cloneWindow(original)

      expect(mockSaveTool).toHaveBeenCalledWith({
        name: 'Calculator (Copy)',
        emoji: '🧮',
        type: 'vue-sfc',
        code: '<template>...</template>'
      })
    })

    it('should not save non-tool windows to IndexedDB', () => {
      const canvas = useStudioCanvas()
      const original = canvas.addWindow({
        messageId: 'msg-1',
        type: 'chart',
        content: { title: 'Sales' }
      })

      canvas.cloneWindow(original)

      expect(mockSaveTool).not.toHaveBeenCalled()
    })
  })
})
