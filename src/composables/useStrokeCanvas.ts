import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue'
import { StrokeLayer, type DrawTool } from '@/services/strokeLayer'
import type { Stroke, StrokeDraft } from '@/types/stroke'

export interface StrokeCanvasOptions {
  /** Logical coordinate-space width (the SVG viewBox). Strokes persist in this space. */
  logicalWidth: number
  /** Logical coordinate-space height. */
  logicalHeight: number
  /** Logical page index — stamped onto emitted StrokeDrafts (default 0). */
  page?: number
  /** Initial drawing tool (default 'pen'). */
  tool?: DrawTool
  /** Initial color index (default 0). */
  colorIndex?: number
  penWidth?: number
  highlighterWidth?: number
  eraserWidth?: number
  eraserOpacity?: number
  /** Returns the strokes to render. Re-invoked on every recreate/redraw. */
  getStrokes: () => Stroke[]
  /** Called when the user finishes a new stroke. */
  onCreate?: (draft: StrokeDraft) => void
  /** Called when the user erases a stroke. */
  onErase?: (id: string) => void
}

/**
 * Mounts a {@link StrokeLayer} on `target` and manages its lifecycle.
 *
 * The SVG layer uses `width:100%;height:100%` CSS so it auto-scales with the
 * container — no ResizeObserver or recreation needed for size changes.
 * `liveScale()` inside StrokeLayer reads the current rendered size on every
 * pointer event, keeping coordinate mapping exact at any resolution.
 *
 * Tool/color/width are applied live via the returned setters; switching `page`
 * triggers a recreate so the new page's strokes render.
 */
export function useStrokeCanvas(target: Ref<HTMLElement | null>, options: StrokeCanvasOptions) {
  const layer = shallowRef<StrokeLayer | null>(null)

  let currentPage = options.page ?? 0

  function create(): void {
    const el = target.value
    if (!el) return
    layer.value = new StrokeLayer(el, {
      page: currentPage,
      viewBoxWidth: options.logicalWidth,
      viewBoxHeight: options.logicalHeight,
      displayWidth: options.logicalWidth,
      displayHeight: options.logicalHeight,
      tool: options.tool ?? 'pen',
      colorIndex: options.colorIndex ?? 0,
      penWidth: options.penWidth,
      highlighterWidth: options.highlighterWidth,
      eraserWidth: options.eraserWidth,
      eraserOpacity: options.eraserOpacity,
      getStrokes: options.getStrokes,
      onCreate: options.onCreate,
      onErase: options.onErase,
      scrollOnSelect: false,
    })
  }

  onMounted(() => {
    create()
  })

  onBeforeUnmount(() => {
    layer.value?.detach()
    layer.value = null
  })

  return {
    layer,
    setTool: (t: DrawTool) => layer.value?.setTool(t),
    setColor: (c: number) => layer.value?.setColor(c),
    setPenWidth: (w: number) => layer.value?.setPenWidth(w),
    setHighlighterWidth: (w: number) => layer.value?.setHighlighterWidth(w),
    setEraserWidth: (w: number) => layer.value?.setEraserWidth(w),
    setEraserOpacity: (o: number) => layer.value?.setEraserOpacity(o),
    setPage: (p: number) => { currentPage = p; layer.value?.setPage(p) },
    redraw: () => layer.value?.redraw(),
    setGestureActive: (active: boolean) => layer.value?.setGestureActive(active),
    cancelDraw: () => layer.value?.cancelDraw(),
    getDebugInfo: () => layer.value?.getDebugInfo(),
  }
}
