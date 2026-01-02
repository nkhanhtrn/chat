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
      // Manually load state (simulating what session manager would do)
      const loadedState = JSON.parse(localStorageMock.getItem('studio-canvas-windows'))
      canvas.loadState(loadedState)

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

    it('should allow multiple tool windows to be open', () => {
      const canvas = useStudioCanvas()

      // Add first tool window
      const tool1 = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: { name: 'Tool 1' } })
      expect(canvas.windows.value).toHaveLength(1)

      // Add second tool window - should keep both
      const tool2 = canvas.addWindow({ messageId: 'msg-2', type: 'tool', content: { name: 'Tool 2' } })
      expect(canvas.windows.value).toHaveLength(2)
      expect(canvas.windows.value[0].id).toBe(tool1.id)
      expect(canvas.windows.value[1].id).toBe(tool2.id)
    })

    it('should not close non-tool windows when adding a tool window', () => {
      const canvas = useStudioCanvas()

      // Add a chart first
      canvas.addWindow({ messageId: 'msg-1', type: 'chart', content: {} })
      expect(canvas.windows.value).toHaveLength(1)

      // Add a tool - should only replace existing tools, not charts
      const tool = canvas.addWindow({ messageId: 'msg-2', type: 'tool', content: { name: 'Tool' } })
      expect(canvas.windows.value).toHaveLength(2)
      expect(canvas.windows.value[0].type).toBe('chart')
      expect(canvas.windows.value[1].type).toBe('tool')
    })

    it('should preserve existing windows when using preserveExisting flag', () => {
      const canvas = useStudioCanvas()

      // Add first tool window
      const tool1 = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: { name: 'Tool 1' } })

      // Add second tool with preserveExisting flag (for cloning)
      const tool2 = canvas.addWindow({
        messageId: 'msg-2',
        type: 'tool',
        content: { name: 'Tool 2' },
        preserveExisting: true
      })

      expect(canvas.windows.value).toHaveLength(2)
      expect(canvas.windows.value[0].id).toBe(tool1.id)
      expect(canvas.windows.value[1].id).toBe(tool2.id)
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

  describe('Tool History', () => {
    beforeEach(() => {
      // Reset state before each history test
      const canvas = useStudioCanvas()
      canvas.resetState()
    })

    describe('hasHistory', () => {
      it('should return false for window with no history', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'initial code' }
        })

        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should return true for window with history', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'initial code' }
        })

        // Update content to push to history
        canvas.updateWindowContent(window.id, { code: 'updated code' })

        expect(canvas.hasHistory(window.id)).toBe(true)
      })

      it('should return false for non-existent window', () => {
        const canvas = useStudioCanvas()
        expect(canvas.hasHistory('non-existent')).toBe(false)
      })
    })

    describe('pushToHistory', () => {
      it('should save content to history stack', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'version 1' }
        })

        canvas.updateWindowContent(window.id, { code: 'version 2' })

        expect(canvas.hasHistory(window.id)).toBe(true)
      })

      it('should not save history for non-tool windows', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'chart',
          content: { title: 'Chart' }
        })

        canvas.updateWindowContent(window.id, { title: 'Updated' })

        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should maintain separate history for each tool window', () => {
        const canvas = useStudioCanvas()
        const tool1 = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Tool 1', code: 'tool1 v1' }
        })
        const tool2 = canvas.addWindow({
          messageId: 'msg-2',
          type: 'tool',
          content: { name: 'Tool 2', code: 'tool2 v1' }
        })

        canvas.updateWindowContent(tool1.id, { code: 'tool1 v2' })
        canvas.updateWindowContent(tool2.id, { code: 'tool2 v2' })

        expect(canvas.hasHistory(tool1.id)).toBe(true)
        expect(canvas.hasHistory(tool2.id)).toBe(true)
      })
    })

    describe('popFromHistory', () => {
      it('should return and remove previous content from history', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'version 1' }
        })

        canvas.updateWindowContent(window.id, { code: 'version 2' })

        const previous = canvas.popFromHistory(window.id)
        expect(previous).toEqual({ name: 'Test', code: 'version 1' })
        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should return null when history is empty', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'code' }
        })

        const previous = canvas.popFromHistory(window.id)
        expect(previous).toBeNull()
      })

      it('should return null for non-existent window', () => {
        const canvas = useStudioCanvas()
        const previous = canvas.popFromHistory('non-existent')
        expect(previous).toBeNull()
      })

      it('should maintain LIFO order (stack)', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1' }
        })

        canvas.updateWindowContent(window.id, { code: 'v2' })
        canvas.updateWindowContent(window.id, { code: 'v3' })

        expect(canvas.popFromHistory(window.id)).toEqual({ name: 'Test', code: 'v2' })
        expect(canvas.popFromHistory(window.id)).toEqual({ name: 'Test', code: 'v1' })
        expect(canvas.popFromHistory(window.id)).toBeNull()
      })
    })

    describe('clearHistory', () => {
      it('should clear history for a specific window', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1' }
        })

        canvas.updateWindowContent(window.id, { code: 'v2' })
        expect(canvas.hasHistory(window.id)).toBe(true)

        canvas.clearHistory(window.id)
        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should not error when clearing non-existent window history', () => {
        const canvas = useStudioCanvas()
        expect(() => canvas.clearHistory('non-existent')).not.toThrow()
      })
    })

    describe('getCurrentContent', () => {
      it('should return current window content', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'my code' }
        })

        const content = canvas.getCurrentContent(window.id)
        expect(content).toEqual({ name: 'Test', code: 'my code' })
      })

      it('should return null for non-existent window', () => {
        const canvas = useStudioCanvas()
        const content = canvas.getCurrentContent('non-existent')
        expect(content).toBeNull()
      })
    })

    describe('restoreContent', () => {
      it('should restore content to window', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'current' }
        })

        canvas.restoreContent(window.id, { name: 'Test', code: 'restored' }, false, false)

        expect(canvas.windows.value[0].content).toEqual({ name: 'Test', code: 'restored' })
      })

      it('should preserve existing id, name, emoji when restoring', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { id: 'tool-123', name: 'Calculator', emoji: '🧮', code: 'v1' }
        })

        canvas.restoreContent(window.id, { code: 'v2' }, false, false)

        expect(canvas.windows.value[0].content.id).toBe('tool-123')
        expect(canvas.windows.value[0].content.name).toBe('Calculator')
        expect(canvas.windows.value[0].content.emoji).toBe('🧮')
        expect(canvas.windows.value[0].content.code).toBe('v2')
      })

      it('should save to history before restoring when saveToHistory is true', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'current' }
        })

        canvas.restoreContent(window.id, { name: 'Test', code: 'new' }, true, false)

        expect(canvas.hasHistory(window.id)).toBe(true)
        const previous = canvas.popFromHistory(window.id)
        expect(previous).toEqual({ name: 'Test', code: 'current' })
      })

      it('should not save to history when saveToHistory is false', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'current' }
        })

        canvas.restoreContent(window.id, { name: 'Test', code: 'new' }, false, false)

        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should save to IndexedDB when saveToIndexedDB is true', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', emoji: '🔧', code: 'code' }
        })
        vi.clearAllMocks()

        canvas.restoreContent(window.id, { name: 'Test', code: 'new' }, false, true)

        expect(mockSaveTool).toHaveBeenCalledWith({
          id: undefined,
          name: 'Test',
          emoji: '🔧',
          type: undefined,
          code: 'new'
        })
      })

      it('should not save to IndexedDB when saveToIndexedDB is false', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', emoji: '🔧', code: 'code' }
        })
        vi.clearAllMocks()

        canvas.restoreContent(window.id, { name: 'Test', code: 'new' }, false, false)

        expect(mockSaveTool).not.toHaveBeenCalled()
      })

      it('should not restore content for non-tool windows', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'chart',
          content: { title: 'Chart' }
        })
        vi.clearAllMocks()

        canvas.restoreContent(window.id, { title: 'New' }, false, false)

        // Content should not change for non-tool windows
        expect(canvas.windows.value[0].content.title).toBe('Chart')
      })
    })

    describe('updateWindowContent with history', () => {
      it('should automatically save to history before updating tool content', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1' }
        })

        canvas.updateWindowContent(window.id, { code: 'v2' })

        expect(canvas.hasHistory(window.id)).toBe(true)
        const previous = canvas.popFromHistory(window.id)
        expect(previous).toEqual({ name: 'Test', code: 'v1' })
      })

      it('should not save to history for non-tool windows', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'chart',
          content: { title: 'Chart' }
        })

        canvas.updateWindowContent(window.id, { title: 'Updated' })

        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should skip saving to history when saveToHistory is false', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1' }
        })

        // Update with saveToHistory=false (like during streaming)
        canvas.updateWindowContent(window.id, { code: 'v2' }, false)

        expect(canvas.hasHistory(window.id)).toBe(false)
      })

      it('should save to history when saveToHistory is true (explicit)', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1' }
        })

        // Update with saveToHistory=true (explicit)
        canvas.updateWindowContent(window.id, { code: 'v2' }, true)

        expect(canvas.hasHistory(window.id)).toBe(true)
        const previous = canvas.popFromHistory(window.id)
        expect(previous).toEqual({ name: 'Test', code: 'v1' })
      })

      it('should allow multiple updates without history (streaming scenario)', () => {
        const canvas = useStudioCanvas()
        const window = canvas.addWindow({
          messageId: 'msg-1',
          type: 'tool',
          content: { name: 'Test', code: 'v1', stdout: '' }
        })

        // Simulate streaming - get current content and spread it (like StudioChat.vue does)
        let currentContent = { ...window.content }

        // Update with stdout accumulation - spreading currentContent preserves all fields
        currentContent.stdout = 'chunk1'
        canvas.updateWindowContent(window.id, { ...currentContent }, false)

        currentContent.stdout = 'chunk1chunk2'
        canvas.updateWindowContent(window.id, { ...currentContent }, false)

        currentContent.stdout = 'chunk1chunk2chunk3'
        canvas.updateWindowContent(window.id, { ...currentContent }, false)

        // No history should be created during streaming
        expect(canvas.hasHistory(window.id)).toBe(false)

        // Now save the final version with history (simulating onComplete)
        // First save to history with the state before the final update
        canvas.pushToHistory(window.id, currentContent)
        // Then update with new code
        currentContent.code = 'v2'
        canvas.updateWindowContent(window.id, { ...currentContent }, false)

        expect(canvas.hasHistory(window.id)).toBe(true)
        // Only one history entry, not 4
        const historyEntry = canvas.popFromHistory(window.id)
        expect(historyEntry.name).toBe('Test')
        expect(historyEntry.code).toBe('v1')
        expect(historyEntry.stdout).toBe('chunk1chunk2chunk3')
        expect(canvas.hasHistory(window.id)).toBe(false)
      })
    })
  })

  describe('cleanObject helper', () => {
    it('should remove undefined values from objects', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Test', code: 'code', id: undefined, emoji: undefined }
      })

      // The addWindow function cleans the content
      expect(window.content.id).toBeUndefined()
      expect(window.content.emoji).toBeUndefined()
      // But name and code should be present
      expect(window.content.name).toBe('Test')
      expect(window.content.code).toBe('code')
    })

    it('should clean nested objects', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: {
          name: 'Test',
          code: 'code',
          nested: { a: 1, b: undefined, c: { d: 2, e: undefined } }
        }
      })

      // Check that nested undefined values are removed
      expect(window.content.nested.b).toBeUndefined()
      expect(window.content.nested.c.e).toBeUndefined()
      expect(window.content.nested.a).toBe(1)
      expect(window.content.nested.c.d).toBe(2)
    })

    it('should handle arrays', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: {
          name: 'Test',
          items: [1, undefined, 3, { a: undefined, b: 2 }]
        }
      })

      // Arrays should be preserved with undefined values filtered from objects
      expect(window.content.items).toEqual([1, undefined, 3, { b: 2 }])
    })
  })

  describe('Debounced save behavior', () => {
    it('should debounce saveToStorage for position updates', () => {
      vi.useFakeTimers()
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Test' }
      })
      vi.clearAllMocks()

      // Multiple rapid position updates
      canvas.updateWindowPosition(window.id, { x: 10, y: 10 })
      canvas.updateWindowPosition(window.id, { x: 20, y: 20 })
      canvas.updateWindowPosition(window.id, { x: 30, y: 30 })

      // Should not have saved yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      // Fast forward past debounce time
      vi.advanceTimersByTime(500)

      // Now it should have saved once
      expect(localStorageMock.setItem).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should debounce saveToStorage for size updates', () => {
      vi.useFakeTimers()
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Test' }
      })
      vi.clearAllMocks()

      // Multiple rapid size updates
      canvas.updateWindowSize(window.id, { width: 400, height: 300 })
      canvas.updateWindowSize(window.id, { width: 500, height: 400 })
      canvas.updateWindowSize(window.id, { width: 600, height: 500 })

      // Should not have saved yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      vi.advanceTimersByTime(500)

      expect(localStorageMock.setItem).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should debounce saveToStorage for bringToFront', () => {
      vi.useFakeTimers()
      const canvas = useStudioCanvas()
      const w1 = canvas.addWindow({ messageId: 'msg-1', type: 'tool', content: {} })
      const w2 = canvas.addWindow({ messageId: 'msg-2', type: 'tool', content: {} })
      vi.clearAllMocks()

      // Multiple rapid bringToFront calls
      canvas.bringToFront(w1.id)
      canvas.bringToFront(w2.id)
      canvas.bringToFront(w1.id)

      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      vi.advanceTimersByTime(500)

      expect(localStorageMock.setItem).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should save immediately for content changes (not debounced)', () => {
      const canvas = useStudioCanvas()
      const window = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Test', code: 'code' }
      })
      vi.clearAllMocks()

      canvas.updateWindowContent(window.id, { code: 'new code' })

      // Should save immediately
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('Multiple tool windows', () => {
    it('should allow multiple tool windows to be open', () => {
      const canvas = useStudioCanvas()

      const tool1 = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Tool 1', code: 'code1' }
      })
      const tool2 = canvas.addWindow({
        messageId: 'msg-2',
        type: 'tool',
        content: { name: 'Tool 2', code: 'code2' }
      })

      expect(canvas.windows.value).toHaveLength(2)
      expect(canvas.windows.value[0].id).toBe(tool1.id)
      expect(canvas.windows.value[1].id).toBe(tool2.id)
    })

    it('should maintain separate history for each tool window', () => {
      const canvas = useStudioCanvas()

      const tool1 = canvas.addWindow({
        messageId: 'msg-1',
        type: 'tool',
        content: { name: 'Tool 1', code: 'v1' }
      })
      const tool2 = canvas.addWindow({
        messageId: 'msg-2',
        type: 'tool',
        content: { name: 'Tool 2', code: 'v1' }
      })

      canvas.updateWindowContent(tool1.id, { code: 'tool1 v2' })
      canvas.updateWindowContent(tool2.id, { code: 'tool2 v2' })

      expect(canvas.hasHistory(tool1.id)).toBe(true)
      expect(canvas.hasHistory(tool2.id)).toBe(true)

      const tool1History = canvas.popFromHistory(tool1.id)
      const tool2History = canvas.popFromHistory(tool2.id)

      // History contains the original content with preserved name
      expect(tool1History.name).toBe('Tool 1')
      expect(tool1History.code).toBe('v1')
      expect(tool2History.name).toBe('Tool 2')
      expect(tool2History.code).toBe('v1')
    })
  })
})
