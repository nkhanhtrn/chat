import { describe, it, expect, beforeEach, vi } from 'vitest'
import { touchDragState, startTouchDrag, moveTouchDrag, endTouchDrag, cancelTouchDrag, isPointInElement } from '../touchDrag'

function mockTouchEvent(x: number, y: number): TouchEvent {
  return { touches: [{ clientX: x, clientY: y } as Touch] } as TouchEvent
}

describe('touchDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cancelTouchDrag()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('startTouchDrag', () => {
    it('sets initial state but does not start dragging immediately', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      expect(touchDragState.messageId).toBe('msg-1')
      expect(touchDragState.startX).toBe(100)
      expect(touchDragState.startY).toBe(200)
      expect(touchDragState.isDragging).toBe(false)
    })

    it('starts dragging after long-press duration', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      expect(touchDragState.isDragging).toBe(true)
    })

    it('creates ghost element after long-press', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { questionSummarized: 'Summary' })
      vi.advanceTimersByTime(300)
      expect(touchDragState.ghostElement).not.toBeNull()
      expect(touchDragState.ghostElement?.textContent).toBe('Summary')
    })
  })

  describe('moveTouchDrag', () => {
    it('does nothing when no messageId is set', () => {
      touchDragState.messageId = null
      const prevX = touchDragState.currentX
      moveTouchDrag(mockTouchEvent(200, 300))
      expect(touchDragState.currentX).toBe(prevX)
    })

    it('cancels drag when moved before long-press', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      // Move beyond threshold before long-press fires
      moveTouchDrag(mockTouchEvent(120, 200))
      vi.advanceTimersByTime(300)
      expect(touchDragState.isDragging).toBe(false)
      expect(touchDragState.messageId).toBeNull()
    })

    it('updates position during active drag', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      expect(touchDragState.isDragging).toBe(true)

      const moveEvent = mockTouchEvent(150, 250)
      moveEvent.preventDefault = vi.fn()
      moveTouchDrag(moveEvent)
      expect(touchDragState.currentX).toBe(150)
      expect(touchDragState.currentY).toBe(250)
    })
  })

  describe('endTouchDrag', () => {
    it('returns null when not actively dragging', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      // End before long-press
      const result = endTouchDrag()
      expect(result).toBeNull()
    })

    it('returns drag data after active drag', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      moveTouchDrag({ touches: [{ clientX: 150, clientY: 250 } as Touch], preventDefault: vi.fn() } as TouchEvent)

      const result = endTouchDrag()
      expect(result).toEqual({
        messageId: 'msg-1',
        messageData: { question: 'test' },
        x: 150,
        y: 250,
      })
    })

    it('resets state after ending', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      endTouchDrag()
      expect(touchDragState.isDragging).toBe(false)
      expect(touchDragState.messageId).toBeNull()
      expect(touchDragState.startX).toBe(0)
    })

    it('removes ghost element', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      expect(touchDragState.ghostElement).not.toBeNull()
      endTouchDrag()
      expect(touchDragState.ghostElement).toBeNull()
    })
  })

  describe('cancelTouchDrag', () => {
    it('clears timer and resets state', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      cancelTouchDrag()
      expect(touchDragState.isDragging).toBe(false)
      expect(touchDragState.messageId).toBeNull()
    })

    it('removes ghost element if present', () => {
      startTouchDrag(mockTouchEvent(100, 200), 'msg-1', { question: 'test' })
      vi.advanceTimersByTime(300)
      cancelTouchDrag()
      expect(touchDragState.ghostElement).toBeNull()
    })
  })

  describe('isPointInElement', () => {
    it('returns false for null element', () => {
      expect(isPointInElement(0, 0, null)).toBe(false)
    })

    it('returns true for point inside element bounds', () => {
      const el = document.createElement('div')
      el.getBoundingClientRect = () => ({ left: 10, top: 10, right: 100, bottom: 100, width: 90, height: 90, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect
      expect(isPointInElement(50, 50, el)).toBe(true)
    })

    it('returns false for point outside element bounds', () => {
      const el = document.createElement('div')
      el.getBoundingClientRect = () => ({ left: 10, top: 10, right: 100, bottom: 100, width: 90, height: 90, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect
      expect(isPointInElement(5, 5, el)).toBe(false)
      expect(isPointInElement(150, 150, el)).toBe(false)
    })
  })
})
