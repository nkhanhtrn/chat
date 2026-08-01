import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StrokeLayer, strokeColor } from '../strokeLayer'
import type { Stroke } from '@/types/stroke'

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 'persisted-1',
    bookId: 'book-123',
    page: 1,
    tool: 'pen',
    colorIndex: 0,
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function makeLayer(overrides: Partial<ConstructorParameters<typeof StrokeLayer>[1]> = {}) {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)
  const opts = {
    page: 1,
    viewBoxWidth: 200,
    viewBoxHeight: 300,
    displayWidth: 200,
    displayHeight: 300,
    tool: 'select' as const,
    colorIndex: 0,
    getStrokes: () => [] as Stroke[],
    ...overrides,
  }
  const layer = new StrokeLayer(wrapper, opts)
  return { layer, wrapper, svg: wrapper.querySelector('svg') as SVGSVGElement }
}

describe('StrokeLayer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('construction', () => {
    it('appends an svg overlay with the correct viewBox and size', () => {
      const { svg } = makeLayer()
      expect(svg).not.toBeNull()
      expect(svg.getAttribute('viewBox')).toBe('0 0 200 300')
      expect(svg.getAttribute('width')).toBe('200')
      expect(svg.getAttribute('height')).toBe('300')
      expect(svg.style.position).toBe('absolute')
    })

    it('keeps pointer-events auto in select mode (pen always draws)', () => {
      const { svg } = makeLayer({ tool: 'select' })
      expect(svg.style.pointerEvents).toBe('auto')
    })

    it('enables pointer-events in pen mode', () => {
      const { svg } = makeLayer({ tool: 'pen' })
      expect(svg.style.pointerEvents).toBe('auto')
    })
  })

  describe('persisted rendering', () => {
    it('renders a group per persisted stroke', () => {
      const { svg } = makeLayer({ getStrokes: () => [makeStroke()] })
      const groups = svg.querySelectorAll('g[data-stroke-id]')
      expect(groups).toHaveLength(1)
      expect(groups[0].getAttribute('data-stroke-id')).toBe('persisted-1')
    })

    it('highlighter strokes render inside a single translucent group (no overlap compounding)', () => {
      const { svg } = makeLayer({ getStrokes: () => [makeStroke({ tool: 'highlighter' })] })
      const hlLayer = svg.querySelector('.pdf-highlighter-layer') as SVGGElement
      expect(hlLayer).not.toBeNull()
      expect(hlLayer.getAttribute('opacity')).toBe('0.7')
      // the highlighter stroke is nested inside the shared layer, opaque itself
      const polyline = hlLayer.querySelector('g[data-stroke-id] polyline') as SVGElement
      expect(polyline).not.toBeNull()
      expect(polyline.getAttribute('stroke-opacity')).toBeFalsy()
    })

    it('pen strokes render on the main svg, outside the highlighter layer', () => {
      const { svg } = makeLayer({ getStrokes: () => [makeStroke({ tool: 'pen' })] })
      const hlLayer = svg.querySelector('.pdf-highlighter-layer') as SVGGElement
      expect(hlLayer.querySelector('g[data-stroke-id]')).toBeNull()
      expect(svg.querySelector(':scope > g[data-stroke-id]')).not.toBeNull()
    })

    it('nests multiple highlighter strokes in the shared layer (no overlap compounding)', () => {
      const { svg } = makeLayer({
        getStrokes: () => [
          makeStroke({ id: 'a', tool: 'highlighter' }),
          makeStroke({ id: 'b', tool: 'highlighter' }),
        ],
      })
      const hlLayer = svg.querySelector('.pdf-highlighter-layer') as SVGGElement
      expect(hlLayer.querySelectorAll('g[data-stroke-id]')).toHaveLength(2)
    })

    it('the erase hit-target is transparent (no thick ghost stroke)', () => {
      const { svg } = makeLayer({ getStrokes: () => [makeStroke()] })
      const group = svg.querySelector('g[data-stroke-id]')!
      const hit = group.querySelector('[data-hit]') as SVGElement
      expect(hit).not.toBeNull()
      expect(hit.style.stroke).toBe('transparent')
      // the visible polyline is NOT transparent
      const visible = group.querySelector('polyline:not([data-hit])') as SVGElement
      expect(visible.style.stroke).not.toBe('transparent')
    })
  })

  describe('strokeColor', () => {
    it('darkens pen strokes via color-mix with black', () => {
      const c = strokeColor('pen', 0)
      expect(c).toContain('color-mix')
      expect(c).toContain('black')
      expect(c).toContain('--color-stroke-0')
    })

    it('keeps highlighter strokes at the plain stroke color', () => {
      const c = strokeColor('highlighter', 2)
      expect(c).not.toContain('color-mix')
      expect(c).toContain('--color-stroke-2')
    })

    it('clamps out-of-range color indices', () => {
      expect(strokeColor('pen', 99)).toContain('--color-stroke-4')
      expect(strokeColor('highlighter', -5)).toContain('--color-stroke-0')
    })
  })

  describe('setTool', () => {
    it('toggles pointer-events and eraser hit targets', () => {
      const { layer, svg } = makeLayer({ getStrokes: () => [makeStroke()] })
      layer.setTool('eraser')
      const hit = svg.querySelector('[data-hit]') as SVGElement
      expect(hit.getAttribute('pointer-events')).toBe('all')

      layer.setTool('select')
      expect((svg.querySelector('[data-hit]') as SVGElement).getAttribute('pointer-events')).toBe('none')
    })
  })

  describe('redraw', () => {
    it('re-reads getStrokes and repaints', () => {
      let strokes: Stroke[] = []
      const { layer, svg } = makeLayer({ getStrokes: () => strokes })

      expect(svg.querySelectorAll('g[data-stroke-id]')).toHaveLength(0)
      strokes = [makeStroke()]
      layer.redraw()
      expect(svg.querySelectorAll('g[data-stroke-id]')).toHaveLength(1)
    })
  })

  describe('detach', () => {
    it('removes the svg from the wrapper', () => {
      const { layer, wrapper } = makeLayer()
      expect(wrapper.querySelector('svg')).not.toBeNull()
      layer.detach()
      expect(wrapper.querySelector('svg')).toBeNull()
    })
  })

  describe('drawing flow', () => {
    it('emits onCreate with normalized points on a pen draw', () => {
      const onCreate = vi.fn()
      const { layer, svg } = makeLayer({ tool: 'pen', onCreate })

      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 15, pointerId: 1 }))
      svg.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 45, pointerId: 1 }))
      svg.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 45, pointerId: 1 }))

      expect(onCreate).toHaveBeenCalledTimes(1)
      const draft = onCreate.mock.calls[0][0]
      expect(draft.tool).toBe('pen')
      expect(draft.points).toEqual([
        { x: 10, y: 15 },
        { x: 40, y: 45 },
      ])
      expect(svg.querySelectorAll('g[data-stroke-id]')).toHaveLength(1)
    })

    it('ignores degenerate clicks (single point)', () => {
      const onCreate = vi.fn()
      const { layer, svg } = makeLayer({ tool: 'pen', onCreate })

      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 }))
      svg.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5, pointerId: 1 }))

      expect(onCreate).not.toHaveBeenCalled()
    })

    it('emits onCreate for a highlighter draw and nests it in the highlighter layer', () => {
      const onCreate = vi.fn()
      const { layer, svg } = makeLayer({ tool: 'highlighter', onCreate })

      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }))
      svg.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, clientY: 30, pointerId: 1 }))
      svg.dispatchEvent(new PointerEvent('pointerup', { clientX: 30, clientY: 30, pointerId: 1 }))

      expect(onCreate).toHaveBeenCalledTimes(1)
      expect(onCreate.mock.calls[0][0].tool).toBe('highlighter')
      const hlLayer = svg.querySelector('.pdf-highlighter-layer') as SVGGElement
      expect(hlLayer.querySelector('g[data-stroke-id]')).not.toBeNull()
    })

    it('does nothing in select mode', () => {
      const onCreate = vi.fn()
      const { layer, svg } = makeLayer({ tool: 'select', onCreate })
      layer.setTool('select')

      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))

      expect(onCreate).not.toHaveBeenCalled()
    })

    it('erasing a stroke calls onErase and removes the group', () => {
      const onErase = vi.fn()
      const stroke = makeStroke()
      const { layer, svg } = makeLayer({ getStrokes: () => [stroke], onErase })
      layer.setTool('eraser')

      expect(svg.querySelectorAll('g[data-stroke-id]')).toHaveLength(1)
      const hit = svg.querySelector('[data-hit]') as SVGElement
      hit.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 2 }))

      expect(onErase).toHaveBeenCalledWith('persisted-1')
      expect(svg.querySelectorAll('g[data-stroke-id]')).toHaveLength(0)
    })
  })
})
