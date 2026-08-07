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
  penWidth?: number
  highlighterWidth?: number
  eraserWidth?: number
  eraserOpacity?: number
  getStrokes: () => Stroke[]
  onCreate?: (draft: StrokeDraft) => void
  onErase?: (id: string) => void
  scrollOnSelect?: boolean
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_PEN_WIDTH = 1.8
const DEFAULT_HIGHLIGHTER_WIDTH = 14
const HIGHLIGHTER_OPACITY = 0.7
const HIT_PADDING = 8
const DEFAULT_ERASER_WIDTH = 20
const DEFAULT_ERASER_OPACITY = 0.4

function defaultToolWidth(tool: StrokeTool): number {
  return tool === 'highlighter' ? DEFAULT_HIGHLIGHTER_WIDTH : DEFAULT_PEN_WIDTH
}

/** Solid fallback palette (matches the light-theme --color-stroke-* hues). */
export const STROKE_COLORS = ['#cc9833', '#38a053', '#2f80d6', '#d65a7c', '#8b5cc7']

/** Pen strokes render darker (less bright) than the highlighter. */
const PEN_DARKEN = '32%'

export function strokeColor(tool: StrokeTool, colorIndex: number): string {
  const i = Math.max(0, Math.min(STROKE_COLORS.length - 1, colorIndex))
  const base = `var(--color-stroke-${i}, ${STROKE_COLORS[i]})`
  return tool === 'pen' ? `color-mix(in srgb, ${base}, black ${PEN_DARKEN})` : base
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
  private penWidth: number
  private highlighterWidth: number
  private eraserWidth: number
  private eraserOpacity: number
  private drawing = false
  private penErasing = false
  private currentPoints: StrokePoint[] = []
  private liveEl: SVGElement | null = null
  private destroyed = false
  private gestureActive = false
  private activePointerId: number | null = null
  private activeTool: StrokeTool = 'pen'
  private drawingPointerType: string = ''
  private lastEraseX = 0
  private lastEraseY = 0
  private eraseEl: SVGElement | null = null
  private erasePath: { x: number; y: number }[] = []
  private boundDown: (e: PointerEvent) => void
  private boundMove: ((e: PointerEvent) => void) | null = null
  private boundUp: ((e: PointerEvent) => void) | null = null
  private cursorEl: HTMLDivElement | null = null
  private boundCursorMove: (e: PointerEvent) => void
  private boundCursorLeave: () => void

  constructor(wrapper: HTMLElement, opts: StrokeLayerOptions) {
    this.wrapper = wrapper
    this.opts = opts
    this.tool = opts.tool
    this.color = opts.colorIndex
    this.penWidth = opts.penWidth ?? DEFAULT_PEN_WIDTH
    this.highlighterWidth = opts.highlighterWidth ?? DEFAULT_HIGHLIGHTER_WIDTH
    this.eraserWidth = opts.eraserWidth ?? DEFAULT_ERASER_WIDTH
    this.eraserOpacity = opts.eraserOpacity ?? DEFAULT_ERASER_OPACITY
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
    this.svg.style.width = '100%'
    this.svg.style.height = '100%'
    this.svg.style.overflow = 'hidden'

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

    // Brush-size preview cursor — follows mouse/pen hover over the canvas
    this.cursorEl = document.createElement('div')
    this.cursorEl.className = 'pdf-brush-cursor'
    this.cursorEl.style.position = 'absolute'
    this.cursorEl.style.pointerEvents = 'none'
    this.cursorEl.style.borderRadius = '50%'
    this.cursorEl.style.transform = 'translate(-50%, -50%)'
    this.cursorEl.style.zIndex = '10'
    this.cursorEl.style.display = 'none'
    this.wrapper.appendChild(this.cursorEl)
    this.boundCursorMove = this.onCursorMove.bind(this)
    this.boundCursorLeave = this.onCursorLeave.bind(this)
    this.svg.addEventListener('pointermove', this.boundCursorMove)
    this.svg.addEventListener('pointerleave', this.boundCursorLeave)
  }

  setTool(tool: DrawTool): void {
    this.tool = tool
    this.applyToolPolicy()
  }

  setPage(page: number): void {
    this.opts.page = page
    this.redraw()
  }

  setColor(colorIndex: number): void {
    this.color = colorIndex
    this.updateCursorStyle()
  }

  setPenWidth(width: number): void {
    this.penWidth = width
    this.updateCursorStyle()
  }

  setHighlighterWidth(width: number): void {
    this.highlighterWidth = width
    this.updateCursorStyle()
  }

  setEraserWidth(width: number): void {
    this.eraserWidth = width
    this.updateCursorStyle()
  }

  setEraserOpacity(opacity: number): void {
    this.eraserOpacity = opacity
  }

  setGestureActive(active: boolean): void {
    this.gestureActive = active
    if (active && this.drawingPointerType !== 'pen') this.cancelDraw()
  }

  cancelDraw(): void {
    if (!this.drawing && !this.penErasing) return
    this.drawing = false
    this.penErasing = false
    if (this.liveEl) { this.liveEl.remove(); this.liveEl = null }
    if (this.eraseEl) { this.eraseEl.remove(); this.eraseEl = null }
    this.currentPoints = []
    this.erasePath = []
    if (this.boundMove) {
      this.svg.removeEventListener('pointermove', this.boundMove)
      this.boundMove = null
    }
    if (this.boundUp) {
      this.svg.removeEventListener('pointerup', this.boundUp)
      this.svg.removeEventListener('pointercancel', this.boundUp)
      this.boundUp = null
    }
    if (this.activePointerId !== null) {
      try { this.svg.releasePointerCapture?.(this.activePointerId) } catch {}
      this.activePointerId = null
    }
    this.applyToolPolicy()
  }

  redraw(): void {
    this.clearPersisted()
    this.renderPersisted()
    this.applyToolPolicy()
  }

  detach(): void {
    this.destroyed = true
    this.svg.removeEventListener('pointerdown', this.boundDown)
    this.svg.removeEventListener('pointermove', this.boundCursorMove)
    this.svg.removeEventListener('pointerleave', this.boundCursorLeave)
    if (this.boundMove) this.svg.removeEventListener('pointermove', this.boundMove)
    if (this.boundUp) {
      this.svg.removeEventListener('pointerup', this.boundUp)
      this.svg.removeEventListener('pointercancel', this.boundUp)
    }
    this.cursorEl?.remove()
    this.cursorEl = null
    this.svg.remove()
  }

  // --- pointer handling ---

  private beginErase(clientX: number, clientY: number, pointerId: number, pointerType: string): void {
    this.penErasing = true
    this.drawingPointerType = pointerType
    this.activePointerId = pointerId
    try { this.svg.setPointerCapture?.(pointerId) } catch {}
    this.setHitTargetEvents('all')

    this.eraseEl = createSvgEl('polyline')
    this.eraseEl.setAttribute('fill', 'none')
    this.eraseEl.style.stroke = 'var(--color-bg-page, #fff)'
    this.eraseEl.setAttribute('stroke-width', String(this.eraserWidth))
    this.eraseEl.setAttribute('stroke-linecap', 'round')
    this.eraseEl.setAttribute('stroke-linejoin', 'round')
    this.eraseEl.setAttribute('opacity', String(this.eraserOpacity))
    this.eraseEl.style.mixBlendMode = 'difference'
    this.eraseEl.style.pointerEvents = 'none'
    const r = this.svg.getBoundingClientRect()
    const { scale, offsetX, offsetY } = this.liveScale(r)
    this.eraseEl.setAttribute('points', `${(clientX - r.left - offsetX) / scale},${(clientY - r.top - offsetY) / scale}`)
    this.svg.appendChild(this.eraseEl)

    this.erasePath = [{ x: clientX, y: clientY }]

    this.boundMove = this.onPointerMove.bind(this)
    this.boundUp = this.onPointerUp.bind(this)
    this.svg.addEventListener('pointermove', this.boundMove)
    this.svg.addEventListener('pointerup', this.boundUp)
    this.svg.addEventListener('pointercancel', this.boundUp)
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.destroyed) return
    if (this.drawing || this.penErasing) return

    const isPen = e.pointerType === 'pen'
    const penBarrel = isPen && (e.buttons & 2) !== 0
    const shouldErase = penBarrel || this.tool === 'eraser'

    if (shouldErase) {
      e.preventDefault()
      this.beginErase(e.clientX, e.clientY, e.pointerId, e.pointerType)
      return
    }

    if (!isPen && this.gestureActive) return
    if (!isPen && this.tool === 'select') return

    e.preventDefault()
    this.drawingPointerType = e.pointerType
    this.activeTool = this.tool === 'select' ? 'pen' : this.tool as StrokeTool
    this.activePointerId = e.pointerId
    try { this.svg.setPointerCapture?.(e.pointerId) } catch {}
    this.drawing = true
    this.currentPoints = [this.toUser(e)]
    this.liveEl = this.createVisibleEl(this.activeTool, this.color, this.currentPoints, this.toolWidth(this.activeTool))
    this.strokeParent(this.activeTool).appendChild(this.liveEl)

    this.boundMove = this.onPointerMove.bind(this)
    this.boundUp = this.onPointerUp.bind(this)
    this.svg.addEventListener('pointermove', this.boundMove)
    this.svg.addEventListener('pointerup', this.boundUp)
    this.svg.addEventListener('pointercancel', this.boundUp)
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.penErasing) {
      this.erasePath.push({ x: e.clientX, y: e.clientY })
      if (this.eraseEl) {
        const p = this.toUser(e)
        const pts = this.eraseEl.getAttribute('points') ?? ''
        this.eraseEl.setAttribute('points', pts + ` ${p.x},${p.y}`)
      }
      return
    }
    if (!this.drawing) return
    this.currentPoints.push(this.toUser(e))
    if (this.liveEl) this.updateGeometry(this.liveEl, this.currentPoints)
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.penErasing) {
      this.penErasing = false
      if (this.eraseEl) { this.eraseEl.remove(); this.eraseEl = null }
      // Process the full erase path now — delete all touched strokes
      for (let i = 0; i < this.erasePath.length; i++) {
        const p = this.erasePath[i]
        if (i > 0) {
          const prev = this.erasePath[i - 1]
          this.eraseAlongPath(prev.x, prev.y, p.x, p.y)
        } else {
          this.eraseAtClientPoint(p.x, p.y)
        }
      }
      this.erasePath = []
      this.cleanupListeners(e.pointerId)
      this.applyToolPolicy()
      return
    }
    if (!this.drawing) return
    this.drawing = false
    this.cleanupListeners(e.pointerId)
    this.finalize()
  }

  private cleanupListeners(pointerId: number): void {
    if (this.boundMove) {
      this.svg.removeEventListener('pointermove', this.boundMove)
      this.boundMove = null
    }
    if (this.boundUp) {
      this.svg.removeEventListener('pointerup', this.boundUp)
      this.svg.removeEventListener('pointercancel', this.boundUp)
      this.boundUp = null
    }
    if (this.activePointerId !== null) {
      try { this.svg.releasePointerCapture?.(pointerId) } catch {}
      this.activePointerId = null
    }
  }

  private eraseAtClientPoint(clientX: number, clientY: number): void {
    const els = document.elementsFromPoint(clientX, clientY)
    for (const el of els) {
      if (!(el instanceof SVGElement) || !el.hasAttribute('data-hit')) continue
      if (!this.svg.contains(el)) continue
      const group = el.closest('g[data-stroke-id]')
      if (!group || !group.parentNode) continue
      const id = group.getAttribute('data-stroke-id')
      group.remove()
      if (id) this.opts.onErase?.(id)
    }
  }

  private eraseAlongPath(prevX: number, prevY: number, currX: number, currY: number): void {
    const dx = currX - prevX
    const dy = currY - prevY
    const dist = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.ceil(dist / 4))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      this.eraseAtClientPoint(prevX + dx * t, prevY + dy * t)
    }
  }

  private setHitTargetEvents(value: string): void {
    this.svg.querySelectorAll<SVGElement>('[data-hit]').forEach(el => {
      el.setAttribute('pointer-events', value)
    })
  }

  /**
   * Derives the uniform display scale and centering offsets from the SVG's
   * *current* rendered size vs its viewBox.  With `preserveAspectRatio: meet`
   * the browser scales uniformly by `min(sx, sy)` and centres along the other
   * axis — callers must subtract the offsets before dividing by the scale.
   */
  private liveScale(r: DOMRect): { scale: number; offsetX: number; offsetY: number } {
    if (r.width <= 0 || r.height <= 0) {
      return { scale: this.scale || 1, offsetX: 0, offsetY: 0 }
    }
    const sx = r.width / this.opts.viewBoxWidth
    const sy = r.height / this.opts.viewBoxHeight
    const scale = Math.min(sx, sy)
    const offsetX = (r.width - this.opts.viewBoxWidth * scale) / 2
    const offsetY = (r.height - this.opts.viewBoxHeight * scale) / 2
    return { scale, offsetX, offsetY }
  }

  private toUser(e: PointerEvent): StrokePoint {
    const r = this.svg.getBoundingClientRect()
    const { scale, offsetX, offsetY } = this.liveScale(r)
    return {
      x: (e.clientX - r.left - offsetX) / scale,
      y: (e.clientY - r.top - offsetY) / scale,
    }
  }

  private onCursorMove(e: PointerEvent): void {
    if (this.destroyed || !this.cursorEl) return
    if (this.tool === 'select') { this.cursorEl.style.display = 'none'; return }
    const r = this.svg.getBoundingClientRect()
    this.cursorEl.style.left = (e.clientX - r.left) + 'px'
    this.cursorEl.style.top = (e.clientY - r.top) + 'px'
    this.cursorEl.style.display = ''
  }

  private onCursorLeave(): void {
    if (this.cursorEl) this.cursorEl.style.display = 'none'
  }

  private updateCursorStyle(): void {
    if (!this.cursorEl) return
    if (this.tool === 'select') { this.cursorEl.style.display = 'none'; return }
    const r = this.svg.getBoundingClientRect()
    const { scale } = this.liveScale(r)
    const isEraser = this.tool === 'eraser'
    const tool: StrokeTool = isEraser ? 'pen' : (this.tool === 'select' ? 'pen' : this.tool as StrokeTool)
    const w = isEraser ? this.eraserWidth : this.toolWidth(tool)
    const size = Math.max(4, w * scale)
    this.cursorEl.style.width = size + 'px'
    this.cursorEl.style.height = size + 'px'
    if (isEraser) {
      this.cursorEl.style.border = '1.5px dashed var(--color-text-muted, #888)'
      this.cursorEl.style.background = 'transparent'
      this.cursorEl.style.opacity = '1'
    } else {
      this.cursorEl.style.border = `1.5px solid ${strokeColor(tool, this.color)}`
      this.cursorEl.style.background = tool === 'highlighter' ? strokeColor(tool, this.color) : 'transparent'
      this.cursorEl.style.opacity = tool === 'highlighter' ? '0.25' : '0.7'
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
      tool: this.activeTool,
      colorIndex: this.color,
      width: this.toolWidth(this.activeTool),
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

  private toolWidth(tool: StrokeTool): number {
    return tool === 'highlighter' ? this.highlighterWidth : this.penWidth
  }

  private createVisibleEl(tool: StrokeTool, colorIndex: number, pts: StrokePoint[], width: number): SVGElement {
    const el = createSvgEl('polyline')
    el.setAttribute('fill', 'none')
    el.style.stroke = strokeColor(tool, colorIndex)
    el.setAttribute('stroke-width', String(width))
    el.setAttribute('stroke-linecap', 'round')
    el.setAttribute('stroke-linejoin', 'round')
    this.updateGeometry(el, pts)
    return el
  }

  private updateGeometry(el: SVGElement, pts: StrokePoint[]): void {
    el.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '))
  }

  private createPersistedGroup(draft: { id: string; tool: StrokeTool; colorIndex: number; width?: number; points: StrokePoint[] }): SVGGElement {
    const g = createSvgEl('g')
    g.setAttribute('data-stroke-id', draft.id)
    const width = draft.width ?? defaultToolWidth(draft.tool)

    const visible = this.createVisibleEl(draft.tool, draft.colorIndex, draft.points, width)
    visible.setAttribute('pointer-events', 'none')
    g.appendChild(visible)

    // Invisible, wider hit target for erase detection via elementsFromPoint
    const hit = this.createVisibleEl(draft.tool, draft.colorIndex, draft.points, width)
    hit.setAttribute('data-hit', 'true')
    hit.style.stroke = 'transparent'
    hit.style.fill = 'transparent'
    hit.setAttribute('stroke-width', String(width + HIT_PADDING))
    hit.setAttribute('pointer-events', 'none')
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
    const isSelect = this.tool === 'select'
    const passThrough = isSelect && (this.opts.scrollOnSelect ?? false)
    this.svg.style.pointerEvents = passThrough ? 'none' : 'auto'
    this.wrapper.style.touchAction = passThrough ? 'auto' : 'none'
    this.svg.style.cursor = isSelect ? 'default' : 'none'
    this.updateCursorStyle()
    const hitTarget = this.tool === 'eraser' ? 'all' : 'none'
    this.svg.querySelectorAll<SVGElement>('[data-hit]').forEach(el => {
      el.setAttribute('pointer-events', hitTarget)
    })
  }

  getDebugInfo(): Record<string, unknown> {
    return {
      tool: this.tool,
      color: this.color,
      penWidth: this.penWidth,
      highlighterWidth: this.highlighterWidth,
      pointerEvents: this.svg.style.pointerEvents,
      cursor: this.svg.style.cursor,
      strokeCount: this.svg.querySelectorAll('g[data-stroke-id]').length,
      hitTargetCount: this.svg.querySelectorAll('[data-hit]').length,
      destroyed: this.destroyed,
    }
  }
}
