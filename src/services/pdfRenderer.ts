import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { TocItem } from '@/types/book'

// Set up the web worker for pdfjs
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfRendererOptions {
  scale?: number
  /** Force spread (double-page) mode. `null` = auto-detect by container width. */
  spread?: boolean | null
  onLocationChange?: (location: { page: number; totalPages: number; percentage: number; pageEnd?: number }) => void
}

export class PdfRenderer {
  private pdfDoc: PDFDocumentProxy | null = null
  private container: HTMLElement
  private fileData: ArrayBuffer
  private options: PdfRendererOptions
  private _outline: TocItem[] = []
  private _currentPage = 1
  private _totalPages = 0
  private _scale: number
  private _spreadOverride: boolean | null = null
  private rendering = false
  private destroyed = false
  private panCleanup: (() => void) | null = null

  constructor(container: HTMLElement, fileData: ArrayBuffer, options: PdfRendererOptions = {}) {
    this.container = container
    this.fileData = fileData
    this.options = options
    this._scale = options.scale ?? 1.5
    this._spreadOverride = options.spread ?? null
  }

  async initialize(): Promise<void> {
    // Copy data — getDocument transfers the buffer to the worker, detaching it
    const data = new Uint8Array(this.fileData).slice()
    const loadingTask = getDocument({ data })
    this.pdfDoc = await loadingTask.promise
    this._totalPages = this.pdfDoc.numPages

    // Extract outline
    const outline = await this.pdfDoc.getOutline()
    if (outline) {
      this._outline = await this.convertOutline(outline)
    }

    // Render first page
    await this.renderPage(this._currentPage)

    // Setup drag-to-pan interaction
    this.setupPan()

    // Notify initial location
    this.notifyLocationChange()
  }

  async display(target?: number | string): Promise<void> {
    let page: number
    if (typeof target === 'number') {
      page = target
    } else if (typeof target === 'string' && target.startsWith('page:')) {
      page = parseInt(target.slice(5), 10)
    } else {
      page = 1
    }

    page = Math.max(1, Math.min(page, this._totalPages))
    await this.renderPage(page)
    if (this.destroyed) return
    this.notifyLocationChange()
  }

  async prevPage(): Promise<void> {
    if (this._currentPage <= 1 || this.destroyed) return
    const step = this.isSpread ? 2 : 1
    const newPage = Math.max(1, this._currentPage - step)
    if (newPage === this._currentPage) return
    await this.renderPage(newPage)
    if (this.destroyed) return
    this.notifyLocationChange()
  }

  async nextPage(): Promise<void> {
    if (this.destroyed) return
    const step = this.isSpread ? 2 : 1
    const newPage = this._currentPage + step
    if (newPage > this._totalPages) return
    await this.renderPage(newPage)
    if (this.destroyed) return
    this.notifyLocationChange()
  }

  getTableOfContents(): TocItem[] {
    return this._outline
  }

  getCurrentLocation(): { page: number; totalPages: number; percentage: number } | null {
    if (!this.pdfDoc) return null
    return {
      page: this._currentPage,
      totalPages: this._totalPages,
      percentage: this._currentPage / this._totalPages,
    }
  }

  async setScale(scale: number): Promise<void> {
    this._scale = Math.max(0.5, Math.min(4, scale))
    if (this.destroyed) return
    await this.renderPage(this._currentPage)
  }

  getScale(): number {
    return this._scale
  }

  get totalPages(): number {
    return this._totalPages
  }

  private get isSpread(): boolean {
    if (this._spreadOverride !== null) return this._spreadOverride
    return (this.container.clientWidth || this.container.offsetWidth || 800) >= 900
  }

  /** Returns the effective spread (double-page) state. */
  getSpread(): boolean {
    return this.isSpread
  }

  /** Force single (false) or double (true) page mode, then re-render. */
  async setSpread(enabled: boolean): Promise<void> {
    if (this._spreadOverride === enabled) return
    this._spreadOverride = enabled
    if (this.destroyed) return
    await this.renderPage(this._currentPage)
    if (this.destroyed) return
    this.notifyLocationChange()
  }

  resize(width: number, height: number): void {
    if (this.destroyed || !this.pdfDoc || this.rendering) return
    this.renderPage(this._currentPage).then(() => {
      if (!this.destroyed) this.notifyLocationChange()
    })
  }

  destroy(): void {
    this.destroyed = true
    if (this.panCleanup) {
      this.panCleanup()
      this.panCleanup = null
    }
    this.container.innerHTML = ''
    if (this.pdfDoc) {
      this.pdfDoc.destroy()
      this.pdfDoc = null
    }
  }

  private async renderPage(pageNum: number): Promise<void> {
    if (!this.pdfDoc || this.rendering || this.destroyed) return
    this.rendering = true

    try {
      if (this.isSpread) {
        const leftPage = pageNum % 2 === 0 ? pageNum - 1 : pageNum
        this._currentPage = Math.max(1, leftPage)
        await this.renderSpread()
      } else {
        this._currentPage = pageNum
        await this.renderSinglePage(pageNum)
      }

      this.container.scrollTop = 0
      this.updatePanCursor()
    } finally {
      this.rendering = false
    }
  }

  private async renderSinglePage(pageNum: number): Promise<void> {
    const containerWidth = this.container.clientWidth || this.container.offsetWidth
    const maxWidth = containerWidth > 0 ? Math.max(100, containerWidth - 32) : 0
    const wrapper = await this.createPageElement(pageNum, maxWidth)
    if (!wrapper || this.destroyed) return
    this.container.innerHTML = ''
    this.container.appendChild(wrapper)
  }

  private async renderSpread(): Promise<void> {
    const leftPage = this._currentPage
    const rightPage = leftPage + 1

    const containerWidth = this.container.clientWidth || this.container.offsetWidth
    const maxWidth = containerWidth > 0 ? Math.max(100, (containerWidth - 16) / 2) : 0

    const leftWrapper = await this.createPageElement(leftPage, maxWidth)
    if (!leftWrapper || this.destroyed) return

    let rightWrapper: HTMLElement | null = null
    if (rightPage <= this._totalPages) {
      rightWrapper = await this.createPageElement(rightPage, maxWidth)
    }
    if (this.destroyed) return

    const spreadDiv = document.createElement('div')
    spreadDiv.className = 'pdf-spread'
    spreadDiv.appendChild(leftWrapper)
    if (rightWrapper) spreadDiv.appendChild(rightWrapper)

    this.container.innerHTML = ''
    this.container.appendChild(spreadDiv)
  }

  private async createPageElement(pageNum: number, maxWidth: number): Promise<HTMLElement | null> {
    if (!this.pdfDoc || this.destroyed) return null

    const page: PDFPageProxy = await this.pdfDoc.getPage(pageNum)
    if (this.destroyed) return null

    const naturalViewport = page.getViewport({ scale: 1.0 })
    const fitScale = maxWidth > 0 ? maxWidth / naturalViewport.width : 1
    const effectiveScale = fitScale * this._scale

    const viewport = page.getViewport({ scale: effectiveScale })

    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.round(viewport.width)
    const displayHeight = Math.round(viewport.height)

    const canvas = document.createElement('canvas')
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'

    const ctx = canvas.getContext('2d')!
    if (ctx) ctx.scale(dpr, dpr)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    if (this.destroyed) return null

    const wrapper = document.createElement('div')
    wrapper.className = 'pdf-page-wrapper'
    wrapper.style.width = displayWidth + 'px'
    wrapper.appendChild(canvas)

    return wrapper
  }

  private setupPan(): void {
    let panning = false
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let startScrollTop = 0

    const onDown = (e: PointerEvent) => {
      if (!this.contentOverflows()) return
      panning = true
      startX = e.clientX
      startY = e.clientY
      startScrollLeft = this.container.scrollLeft
      startScrollTop = this.container.scrollTop
      this.container.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!panning) return
      this.container.scrollLeft = startScrollLeft - (e.clientX - startX)
      this.container.scrollTop = startScrollTop - (e.clientY - startY)
    }
    const onUp = () => {
      if (!panning) return
      panning = false
      this.updatePanCursor()
    }

    this.container.addEventListener('pointerdown', onDown)
    this.container.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    this.panCleanup = () => {
      this.container.removeEventListener('pointerdown', onDown)
      this.container.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }

  private contentOverflows(): boolean {
    return this.container.scrollWidth > this.container.clientWidth + 1 ||
      this.container.scrollHeight > this.container.clientHeight + 1
  }

  private updatePanCursor(): void {
    if (this.destroyed) return
    const overflows = this.contentOverflows()
    this.container.style.cursor = overflows ? 'grab' : 'default'
    this.container.style.touchAction = overflows ? 'none' : 'auto'
  }

  private notifyLocationChange(): void {
    const pageEnd = this.isSpread && this._currentPage + 1 <= this._totalPages
      ? this._currentPage + 1
      : undefined
    this.options.onLocationChange?.({
      page: this._currentPage,
      totalPages: this._totalPages,
      percentage: this._currentPage / this._totalPages,
      pageEnd,
    })
  }

  private async convertOutline(outline: { title: string; dest: unknown; items: unknown[] }[]): Promise<TocItem[]> {
    const result: TocItem[] = []
    for (const item of outline) {
      let pageNumber = 1
      if (item.dest) {
        try {
          const dest = typeof item.dest === 'string'
            ? await this.pdfDoc!.getDestination(item.dest)
            : item.dest
          if (dest) {
            const pageIndex = await this.pdfDoc!.getPageIndex((dest as unknown[])[0] as any)
            pageNumber = pageIndex + 1
          }
        } catch {
          // ignore dest resolution errors
        }
      }
      result.push({
        id: `outline-${pageNumber}-${item.title}`,
        label: item.title,
        href: `page:${pageNumber}`,
        subitems: (item.items as any[])?.length
          ? await this.convertOutline(item.items as any[])
          : [],
      })
    }
    return result
  }
}

/** Extract metadata and cover from a PDF file without full rendering */
export async function extractPdfInfo(fileData: ArrayBuffer): Promise<{
  title: string
  author: string
  coverData: ArrayBuffer | null
  totalPages: number
}> {
  // Copy data — getDocument transfers the buffer to the worker, detaching it
  const loadingTask = getDocument({ data: new Uint8Array(fileData).slice() })
  const pdf = await loadingTask.promise

  try {
    // Extract metadata
    let title = ''
    let author = ''
    try {
      const metadata = await pdf.getMetadata()
      const info = metadata.info as Record<string, string> | null
      title = info?.Title ?? ''
      author = info?.Author ?? ''
    } catch {
      // ignore metadata errors
    }

    // Generate cover from first page
    let coverData: ArrayBuffer | null = null
    try {
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 0.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.7)
      })
      coverData = await blob.arrayBuffer()
    } catch {
      // ignore cover generation errors
    }

    return { title, author, coverData, totalPages: pdf.numPages }
  } finally {
    pdf.destroy()
  }
}

/** Lightweight TOC extraction for preloading (avoids full renderer init) */
export async function extractPdfToc(fileData: ArrayBuffer): Promise<TocItem[]> {
  const loadingTask = getDocument({ data: new Uint8Array(fileData).slice() })
  const pdf = await loadingTask.promise

  try {
    const outline = await pdf.getOutline()
    if (!outline) return []

    const result: TocItem[] = []
    for (const item of outline) {
      let pageNumber = 1
      if (item.dest) {
        try {
          const dest = typeof item.dest === 'string'
            ? await pdf.getDestination(item.dest)
            : item.dest
          if (dest) {
            const pageIndex = await pdf.getPageIndex(dest[0] as any)
            pageNumber = pageIndex + 1
          }
        } catch {
          // ignore
        }
      }
      result.push({
        id: `outline-${pageNumber}-${item.title}`,
        label: item.title,
        href: `page:${pageNumber}`,
        subitems: [], // shallow for preload
      })
    }
    return result
  } finally {
    pdf.destroy()
  }
}
