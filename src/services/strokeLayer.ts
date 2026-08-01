import type { Stroke, StrokeDraft, StrokePoint, StrokeTool } from '@/types/stroke'

export type DrawTool = StrokeTool | 'select'

export interface StrokeLayerOptions {
  page: number
  viewBoxWidth: number
  viewBoxHeight: number
  displayWidth: number
  displayHeight: number
  tool: DrawTool
  colorIndex: number
  getStrokes: () => Stroke[]
  onCreate?: (draft: StrokeDraft) => void
  onErase?: (id: string) => void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const PEN_WIDTH = 1.8
const HIGHLIGHTER_WIDTH = 14
const HIGHLIGHTER_OPACITY = 0.7
const HIT_PADDING = 8

/** Solid fallback palette (matches the light-theme --color-stroke-* hues). */
export const STROKE_COLORS = ['#cc9833', '#38a053', '#2f80d6', '#d65a7c', '#8b5cc7']

/** Pen strokes render darker (less bright) than the highlighter. */
const PEN_DARKEN = '32%'

export function strokeColor(tool: StrokeTool, colorIndex: number): string {
  const i = Math.max(0, Math.min(STROKE_COLORS.length - 1, colorIndex))
  const base = `var(--color-stroke-${i}, ${STROKE_COLORS[i]})`
  return tool === 'pen' ? `color-mix(in srgb, ${base}, black ${PEN_DARKEN})` : base
}

function toolWidth(tool: StrokeTool): number {
  return tool === 'highlighter' ? HIGHLIGHTER_WIDTH : PEN_WIDTH
}

function createSvgEl<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name)
}

export class StrokeLayer {
  private wrapper: HTMLElement
  private svg: SVGSVGElement
  private hlLayer: SVGGElement
  private opts: StrokeLayerOptions
  private scale: number
  private tool: DrawTool
  private color: number
  private drawing = false
  private currentPoints: StrokePoint[] = []
  private liveEl: SVGElement | null = null
  private destroyed = false
  private boundDown: (e: PointerEvent) => void
  private boundMove: ((e: PointerEvent) => void) | null = null
  private boundUp: ((e: PointerEvent) => void) | null = null

  constructor(wrapper: HTMLElement, opts: StrokeLayerOptions) {
    this.wrapper = wrapper
    this.opts = opts
    this.tool = opts.tool
    this.color = opts.colorIndex
    this.scale = opts.viewBoxWidth > 0 && opts.displayWidth > 0
      ? opts.displayWidth / opts.viewBoxWidth
      : 1

    this.svg = createSvgEl('svg')
    this.svg.setAttribute('class', 'pdf-draw-layer')
    this.svg.setAttribute('width', String(opts.displayWidth))
    this.svg.setAttribute('height', String(opts.displayHeight))
    this.svg.setAttribute('viewBox', `0 0 ${opts.viewBoxWidth} ${opts.viewBoxHeight}`)
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    this.svg.style.position = 'absolute'
    this.svg.style.left = '0'
    this.svg.style.top = '0'
    this.svg.style.overflow = 'visible'

    this.wrapper.appendChild(this.svg)

    // Highlighter strokes render opaque inside this shared translucent group,
    // so overlapping strokes union instead of compounding their alpha.
    this.hlLayer = createSvgEl('g')
    this.hlLayer.setAttribute('class', 'pdf-highlighter-layer')
    this.hlLayer.setAttribute('opacity', String(HIGHLIGHTER_OPACITY))
    this.svg.appendChild(this.hlLayer)

    this.renderPersisted()
    this.applyToolPolicy()

    this.boundDown = this.onPointerDown.bind(this)
    this.svg.addEventListener('pointerdown', this.boundDown)
  }

  setTool(tool: DrawTool): void {
    this.tool = tool
    this.applyToolPolicy()
  }

  setColor(colorIndex: number): void {
    this.color = colorIndex
  }

  redraw(): void {
    this.clearPersisted()
    this.renderPersisted()
    this.applyToolPolicy()
  }

  detach(): void {
    this.destroyed = true
    this.svg.removeEventListener('pointerdown', this.boundDown)
    if (this.boundMove) this.svg.removeEventListener('pointermove', this.boundMove)
    if (this.boundUp) {
      this.svg.removeEventListener('pointerup', this.boundUp)
      this.svg.removeEventListener('pointercancel', this.boundUp)
    }
    this.svg.remove()
  }

  // --- pointer handling ---

  private onPointerDown(e: PointerEvent): void {
    if (this.destroyed) return
    if (this.tool === 'select' || this.tool === 'eraser') return
    e.preventDefault()
    this.svg.setPointerCapture?.(e.pointerId)
    this.drawing = true
    this.currentPoints = [this.toUser(e)]
    this.liveEl = this.createVisibleEl(this.tool as StrokeTool, this.color, this.currentPoints)
    this.strokeParent(this.tool as StrokeTool).appendChild(this.liveEl)

    this.boundMove = this.onPointerMove.bind(this)
    this.boundUp = this.onPointerUp.bind(this)
    this.svg.addEventListener('pointermove', this.boundMove)
    this.svg.addEventListener('pointerup', this.boundUp)
    this.svg.addEventListener('pointercancel', this.boundUp)
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drawing) return
    this.currentPoints.push(this.toUser(e))
    if (this.liveEl) this.updateGeometry(this.liveEl, this.currentPoints)
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drawing) return
    this.drawing = false
    if (this.boundMove) {
      this.svg.removeEventListener('pointermove', this.boundMove)
      this.boundMove = null
    }
    if (this.boundUp) {
      this.svg.removeEventListener('pointerup', this.boundUp)
      this.svg.removeEventListener('pointercancel', this.boundUp)
      this.boundUp = null
    }
    try { this.svg.releasePointerCapture?.(e.pointerId) } catch {}
    this.finalize()
  }

  private toUser(e: PointerEvent): StrokePoint {
    const r = this.svg.getBoundingClientRect()
    const scale = this.scale || 1
    return {
      x: (e.clientX - r.left) / scale,
      y: (e.clientY - r.top) / scale,
    }
  }

  private finalize(): void {
    if (this.liveEl) { this.liveEl.remove(); this.liveEl = null }
    const pts = this.currentPoints
    this.currentPoints = []
    if (pts.length < 2) return

    const draft: StrokeDraft = {
      id: crypto.randomUUID(),
      page: this.opts.page,
      tool: this.tool as StrokeTool,
      colorIndex: this.color,
      points: pts,
    }
    this.strokeParent(draft.tool).appendChild(this.createPersistedGroup(draft))
    this.applyToolPolicy()
    this.opts.onCreate?.(draft)
  }

  private strokeParent(tool: StrokeTool): SVGElement {
    return tool === 'highlighter' ? this.hlLayer : this.svg
  }

  // --- element builders ---

  private createVisibleEl(tool: StrokeTool, colorIndex: number, pts: StrokePoint[]): SVGElement {
    const el = createSvgEl('polyline')
    el.setAttribute('fill', 'none')
    el.style.stroke = strokeColor(tool, colorIndex)
    el.setAttribute('stroke-width', String(toolWidth(tool)))
    el.setAttribute('stroke-linecap', 'round')
    el.setAttribute('stroke-linejoin', 'round')
    this.updateGeometry(el, pts)
    return el
  }

  private updateGeometry(el: SVGElement, pts: StrokePoint[]): void {
    el.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '))
  }

  private createPersistedGroup(draft: { id: string; tool: StrokeTool; colorIndex: number; points: StrokePoint[] }): SVGGElement {
    const g = createSvgEl('g')
    g.setAttribute('data-stroke-id', draft.id)

    const visible = this.createVisibleEl(draft.tool, draft.colorIndex, draft.points)
    visible.setAttribute('pointer-events', 'none')
    g.appendChild(visible)

    // Invisible, wider hit target for easy erase selection
    const hit = this.createVisibleEl(draft.tool, draft.colorIndex, draft.points)
    hit.setAttribute('data-hit', 'true')
    hit.style.stroke = 'transparent'
    hit.style.fill = 'transparent'
    hit.setAttribute('stroke-width', String(toolWidth(draft.tool) + HIT_PADDING))
    hit.style.cursor = 'pointer'
    hit.setAttribute('pointer-events', 'none')
    hit.addEventListener('pointerdown', (e) => {
      if (this.tool !== 'eraser' || this.destroyed) return
      e.stopPropagation()
      e.preventDefault()
      g.remove()
      this.opts.onErase?.(draft.id)
    })
    g.appendChild(hit)

    return g
  }

  private renderPersisted(): void {
    const strokes = this.opts.getStrokes() ?? []
    for (const s of strokes) {
      this.strokeParent(s.tool).appendChild(this.createPersistedGroup(s))
    }
  }

  private clearPersisted(): void {
    this.svg.querySelectorAll('g[data-stroke-id]').forEach(g => g.remove())
  }

  private applyToolPolicy(): void {
    const drawable = this.tool !== 'select' && this.tool !== 'eraser'
    this.svg.style.pointerEvents = drawable ? 'auto' : 'none'
    this.svg.style.cursor = drawable ? 'crosshair' : (this.tool === 'eraser' ? 'pointer' : 'default')
    const hitTarget = this.tool === 'eraser' ? 'all' : 'none'
    this.svg.querySelectorAll<SVGElement>('[data-hit]').forEach(el => {
      el.setAttribute('pointer-events', hitTarget)
    })
  }
}
