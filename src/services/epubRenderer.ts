import ePub, { type Book, type Rendition, type NavItem } from 'epubjs'

export interface EpubRendererOptions {
  width?: string | number
  height?: string | number
  onLocationChange?: (location: { cfi: string; percentage: number }) => void
  theme?: { bg: string; color: string; fontFamily?: string }
}

export class EpubRenderer {
  private book: Book | null = null
  private rendition: Rendition | null = null
  private container: HTMLElement
  private fileData: ArrayBuffer
  private options: EpubRendererOptions
  private _toc: NavItem[] = []
  private locationsReady = false

  constructor(container: HTMLElement, fileData: ArrayBuffer, options: EpubRendererOptions = {}) {
    this.container = container
    this.fileData = fileData
    this.options = options
  }

  async initialize(): Promise<void> {
    this.book = ePub(this.fileData) as Book

    await this.book.ready

    if (!this.book || !(this.book as any).packaging) {
      throw new Error('Failed to parse EPUB: book not properly initialized')
    }

    // Render to container — use the container's actual pixel width
    const containerWidth = this.container.clientWidth || this.container.offsetWidth || 800
    this.rendition = this.book.renderTo(this.container, {
      width: containerWidth + 'px',
      height: this.options.height ?? '100%',
      spread: 'none',
      flow: 'paginated',
    })

    // Apply theme to epub content BEFORE displaying
    if (this.options.theme) {
      const t = this.options.theme
      this.rendition.themes.default({
        'html, body': {
          'background-color': t.bg,
          'color': t.color,
          'font-family': t.fontFamily ?? 'inherit',
        },
        'a': {
          'color': t.color,
        },
      })
    }

    // Listen for location changes
    if (this.options.onLocationChange) {
      this.rendition.on('relocated', (location: any) => {
        if (location?.start) {
          const percentage = this.locationsReady
            ? (location.start.percentage ?? 0)
            : 0
          this.options.onLocationChange?.({
            cfi: location.start.cfi,
            percentage,
          })
        }
      })
    }

    // Display from the beginning — callers can navigate to a saved CFI after
    await this.rendition.display()

    // Extract TOC after display
    try {
      const nav = await this.book.loaded.navigation
      this._toc = nav?.toc ?? []
    } catch {
      this._toc = []
    }

    // Generate locations in the background
    this.book.locations.generate(1024).then(() => {
      this.locationsReady = true
    }).catch((err: unknown) => {
      console.warn('[EpubRenderer] Location generation failed:', err)
    })
  }

  async display(target?: string): Promise<void> {
    if (!this.rendition) throw new Error('EpubRenderer not initialized')
    await this.rendition.display(target)
  }

  async prevPage(): Promise<void> {
    if (!this.rendition) return
    await this.rendition.prev()
  }

  async nextPage(): Promise<void> {
    if (!this.rendition) return
    await this.rendition.next()
  }

  getTableOfContents(): NavItem[] {
    return this._toc
  }

  getCurrentLocation(): { cfi: string; percentage: number } | null {
    if (!this.rendition) return null
    const loc = this.rendition.currentLocation()
    if (loc?.start) {
      return {
        cfi: loc.start.cfi,
        percentage: loc.start.percentage ?? 0,
      }
    }
    return null
  }

  async getCoverUrl(): Promise<string | null> {
    if (!this.book) return null
    try {
      return await this.book.coverUrl()
    } catch {
      return null
    }
  }

  async getMetadata(): Promise<{ title: string; author: string }> {
    if (!this.book) return { title: '', author: '' }
    try {
      const meta = await this.book.loaded.metadata
      return {
        title: meta?.title ?? '',
        author: meta?.creator ?? '',
      }
    } catch {
      return { title: '', author: '' }
    }
  }

  resize(width: number | string, height: number | string): void {
    this.rendition?.resize(width, height)
  }

  destroy(): void {
    this.rendition?.destroy()
    this.book?.destroy()
    this.rendition = null
    this.book = null
    this._toc = []
  }
}

/**
 * Extract metadata and cover from an EPUB file without rendering.
 * Works directly with the Book API to avoid the Rendition queue issues.
 */
export async function extractEpubInfo(fileData: ArrayBuffer): Promise<{
  title: string
  author: string
  coverData: ArrayBuffer | null
}> {
  const book = ePub(fileData) as Book
  try {
    await book.ready

    // Get metadata
    let title = ''
    let author = ''
    try {
      const meta = await book.loaded.metadata
      title = meta?.title ?? ''
      author = meta?.creator ?? ''
    } catch {}

    // Get cover as raw bytes (not base64/blob URL) so it can be
    // uploaded to Storage without size bloat
    let coverData: ArrayBuffer | null = null
    try {
      const coverPath = await book.loaded.cover
      if (coverPath && (book as any).archived && (book as any).archive) {
        const archive = (book as any).archive
        const blob = await archive.request(coverPath, 'blob')
        if (blob) {
          coverData = await blob.arrayBuffer()
        }
      }
    } catch {}

    return { title, author, coverData }
  } finally {
    // Wait for book to fully finish internal async operations (replacements, etc.)
    // before destroying to prevent "replacements is undefined" errors
    await Promise.race([
      (book as any).opened?.catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 2000)),
    ])
    book.destroy()
  }
}
