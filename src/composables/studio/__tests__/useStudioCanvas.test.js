import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ref } from 'vue'
import { useStudioCanvas, hasHistory, pushToHistory, popFromHistory, clearHistory } from '../useStudioCanvas.js'

describe('useStudioCanvas', () => {
  let canvas

  beforeEach(() => {
    vi.clearAllMocks()
    canvas = useStudioCanvas()
  })

  describe('UI Helpers', () => {
    it('should provide getNextZIndex', () => {
      const z1 = canvas.getNextZIndex()
      expect(z1).toBe(101)

      const z2 = canvas.getNextZIndex()
      expect(z2).toBe(102)
    })

    it('should provide getDefaultSize for different window types', () => {
      expect(canvas.getDefaultSize('chart')).toEqual({ width: 450, height: 350 })
      expect(canvas.getDefaultSize('mermaid')).toEqual({ width: 500, height: 400 })
      expect(canvas.getDefaultSize('tool')).toEqual({ width: 350, height: 400 })
      expect(canvas.getDefaultSize('unknown')).toEqual({ width: 400, height: 300 })
    })

    it('should provide getMinSize for different window types', () => {
      expect(canvas.getMinSize('chart')).toEqual({ width: 300, height: 250 })
      expect(canvas.getMinSize('tool')).toEqual({ width: 250, height: 200 })
      expect(canvas.getMinSize('unknown')).toEqual({ width: 200, height: 150 })
    })

    it('should generate titles based on type and content', () => {
      expect(canvas.generateTitle('chart', { title: 'My Chart' })).toBe('My Chart')
      expect(canvas.generateTitle('tool', { name: 'Calculator' })).toBe('Calculator')
      expect(canvas.generateTitle('mermaid', {})).toBe('Diagram')
      expect(canvas.generateTitle('tool', {})).toBe('Tool')
      expect(canvas.generateTitle('unknown', {})).toBe('Output')
    })

    it('should clean objects by removing undefined values', () => {
      const input = {
        a: 1,
        b: undefined,
        c: { d: 2, e: undefined },
        f: null
      }
      const cleaned = canvas.cleanObject(input)
      expect(cleaned).toEqual({
        a: 1,
        c: { d: 2 },
        f: null
      })
    })

    it('should have DISPLAY_STATES constant', () => {
      expect(canvas.DISPLAY_STATES).toEqual({
        OPEN: 'open',
        MINIMIZED: 'minimized',
        CLOSED: 'closed'
      })
    })
  })

  describe('History Management (exported functions)', () => {
    const windowId = 'test-window-1'

    beforeEach(() => {
      clearHistory(windowId)
    })

    it('should track history for windows', () => {
      const content1 = { code: 'version 1' }
      const content2 = { code: 'version 2' }

      pushToHistory(windowId, content1)
      pushToHistory(windowId, content2)

      expect(hasHistory(windowId)).toBe(true)
    })

    it('should pop history in LIFO order', () => {
      const content1 = { code: 'version 1' }
      const content2 = { code: 'version 2' }

      pushToHistory(windowId, content1)
      pushToHistory(windowId, content2)

      expect(popFromHistory(windowId)).toEqual(content2)
      expect(popFromHistory(windowId)).toEqual(content1)
      expect(popFromHistory(windowId)).toBeNull()
    })

    it('should clear history', () => {
      pushToHistory(windowId, { code: 'test' })
      expect(hasHistory(windowId)).toBe(true)

      clearHistory(windowId)
      expect(hasHistory(windowId)).toBe(false)
    })

    it('should deep clone content when pushing to history', () => {
      const content = { data: { nested: 'value' } }
      pushToHistory(windowId, content)

      // Modify original
      content.data.nested = 'modified'

      // Popped content should have original value
      const popped = popFromHistory(windowId)
      expect(popped.data.nested).toBe('value')
    })
  })
})
