// EPUB renderer service using epub.js
import ePub from 'epubjs'

/**
 * EPUB Renderer class - wraps epub.js for easier usage
 */
export class EpubRenderer {
  /**
   * @param {HTMLElement} element - The container element to render into
   * @param {ArrayBuffer|string} bookData - ArrayBuffer or URL of the EPUB
   */
  constructor(element, bookData) {
    this.element = element

    // Convert any binary data to proper ArrayBuffer for epub.js
    let binaryData = bookData

    // Handle Uint8Array (commonly returned by IndexedDB)
    if (bookData instanceof Uint8Array) {
      binaryData = bookData.buffer.slice(bookData.byteOffset, bookData.byteOffset + bookData.byteLength)
    }
    // Handle other typed arrays
    else if (bookData?.buffer instanceof ArrayBuffer) {
      binaryData = bookData.buffer
    }

    const hasBuffer = binaryData instanceof ArrayBuffer ||
      (binaryData && typeof binaryData === 'object' && 'byteLength' in binaryData)

    if (hasBuffer) {
      const size = binaryData.byteLength
      if (size === 0) {
        throw new Error('EPUB file is empty (0 bytes)')
      }
      this._arrayBuffer = binaryData
    }

    // Initialize epub.js book - pass binary data directly or use as URL
    this.book = hasBuffer ? ePub(binaryData) : ePub(bookData || '')
    this.rendition = null
    this.navigation = null
    this.locations = null
    this.ready = false
    this._fontHookRegistered = false
    this._lastWidth = null
  }

  /**
   * Initialize the rendition
   * @param {Object} options - Rendition options
   * @returns {Promise} Resolves when rendition is ready
   */
  async initialize(options = {}) {
    // Wait for book to be ready
    await this.book.ready

    // Get content width from settings for rendition width
    const rootStyles = getComputedStyle(document.documentElement)
    const contentMaxWidth = rootStyles.getPropertyValue('--content-max-width').trim() || '800px'

    const defaultOptions = {
      width: contentMaxWidth,
      height: '100%',
      spread: 'none',
      flow: 'paginated',
      allowScriptedContent: false,
      ...options
    }

    this.rendition = this.book.renderTo(this.element, defaultOptions)

    // Apply theme styles BEFORE displaying
    this.applyThemeStyles()

    // Display the book
    await this.rendition.display()

    // Get navigation (table of contents)
    this.navigation = await this.book.loaded.navigation

    // Generate locations in background - this is slow so don't block
    this.ready = true
    this.book.locations.generate(1024).then((locations) => {
      this.locations = locations
    }).catch((err) => {
      // Silently fail - progress tracking won't work until this completes
    })

    return this.rendition
  }

  /**
   * Apply theme styles from global CSS variables to EPUB content
   */
  applyThemeStyles() {
    if (!this.rendition) return

    // Get CSS variables from document
    const rootStyles = getComputedStyle(document.documentElement)
    const fontFamily = rootStyles.getPropertyValue('--message-font-family').trim() || 'Georgia, serif'
    const fontSize = rootStyles.getPropertyValue('--message-font-size').trim() || '18px'
    const lineHeight = rootStyles.getPropertyValue('--message-line-height').trim() || '1.7'
    const contentMaxWidth = rootStyles.getPropertyValue('--content-max-width').trim() || '800px'

    // Get theme colors from CSS variables
    const textColor = rootStyles.getPropertyValue('--color-text-message').trim() || '#333333'
    const bgColor = rootStyles.getPropertyValue('--color-bg-page').trim() || '#ffffff'
    const linkColor = rootStyles.getPropertyValue('--color-primary').trim() || '#3b82f6'

    // Register and select the theme
    this.rendition.themes.register('reader', {
      body: {
        'color': textColor + ' !important',
        'background-color': bgColor + ' !important',
        'font-family': fontFamily + ' !important',
        'font-size': fontSize + ' !important',
        'line-height': lineHeight + ' !important',
        'padding': '40px !important',
        'margin': '0 !important'
      },
      p: {
        'color': textColor + ' !important',
        'background-color': 'transparent !important',
        'font-family': fontFamily + ' !important',
        'font-size': fontSize + ' !important',
        'line-height': lineHeight + ' !important'
      },
      div: {
        'background-color': 'transparent !important'
      },
      a: {
        'color': linkColor + ' !important',
        'text-decoration': 'underline !important'
      },
      'p:first-of-type::first-letter': {
        'text-transform': 'uppercase',
        'font-weight': 'bold'
      }
    })

    this.rendition.themes.select('reader')

    // Register font and background hooks only once
    if (!this._fontHookRegistered) {
      this._fontHookRegistered = true

      // Set iframe background when rendered
      this.rendition?.hooks?.render?.register((iframe, contents) => {
        const rootStyles = getComputedStyle(document.documentElement)
        const bgColor = rootStyles.getPropertyValue('--color-bg-page').trim() || '#ffffff'
        const textColor = rootStyles.getPropertyValue('--color-text-message').trim() || '#333333'

        // Set inline styles on iframe
        if (iframe && iframe.style) {
          iframe.style.background = bgColor
        }

        if (contents && contents.document) {
          const doc = contents.document

          // Set inline styles directly on html and body elements (highest specificity)
          if (doc.documentElement) {
            doc.documentElement.style.backgroundColor = bgColor
            doc.documentElement.style.color = textColor
          }
          if (doc.body) {
            doc.body.style.backgroundColor = bgColor
            doc.body.style.color = textColor
          }

          // Inject stylesheet with maximum specificity
          const style = doc.createElement('style')
          style.setAttribute('data-reader-theme', 'override')
          style.textContent = `
            html.html {
              background-color: ${bgColor} !important;
              color: ${textColor} !important;
            }
            body.body {
              background-color: ${bgColor} !important;
              color: ${textColor} !important;
            }
            html > body {
              background-color: ${bgColor} !important;
              color: ${textColor} !important;
            }
          `
          // Append at the end of head to override epub's styles
          doc.head.appendChild(style)
        }
      })

      // Inject fonts into EPUB iframe so custom fonts are available
      this.rendition?.hooks?.content?.register((contents) => {
        // Copy all @font-face and link tags from main document to EPUB iframe
        const mainDoc = document
        const epubDoc = contents.document

        // Copy font-face rules from all stylesheets
        for (const sheet of mainDoc.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSFontFaceRule) {
                const style = epubDoc.createElement('style')
                style.textContent = rule.cssText
                epubDoc.head.appendChild(style)
              }
            }
          } catch (e) {
            // CORS restrictions on some stylesheets - skip
          }
        }

        // Note: We DON'T copy link tags because:
        // 1. App CSS (Vue components, etc.) shouldn't be in the epub iframe
        // 2. Epub has its own stylesheets
        // 3. Copying app CSS causes 404 errors and style conflicts
      })
    }
  }

  /**
   * Refresh theme styles (call when settings change)
   */
  refreshTheme() {
    if (!this.rendition) return

    // Get content width from settings
    const rootStyles = getComputedStyle(document.documentElement)
    const contentMaxWidth = rootStyles.getPropertyValue('--content-max-width').trim() || '800px'

    // Only resize if width has changed (resize can cause rendering issues)
    if (this._lastWidth !== contentMaxWidth) {
      this._lastWidth = contentMaxWidth
      this.rendition.resize(contentMaxWidth, '100%')
    }

    // Re-apply theme styles
    this.applyThemeStyles()

    // Force re-display to apply new styles
    const currentCfi = this.getCurrentCfi()
    if (currentCfi) {
      this.rendition.display(currentCfi)
    }
  }

  /**
   * Navigate to a specific CFI (Canonical Fragment Identifier)
   * @param {string} cfi - The CFI to navigate to
   */
  async gotoCfi(cfi) {
    if (!this.rendition) {
      throw new Error('Rendition not initialized. Call initialize() first.')
    }
    return await this.rendition.display(cfi)
  }

  /**
   * Navigate to a specific href (chapter URL)
   * @param {string} href - The href to navigate to
   */
  async goto(href) {
    if (!this.rendition) {
      throw new Error('Rendition not initialized. Call initialize() first.')
    }
    return await this.rendition.display(href)
  }

  /**
   * Go to next page
   */
  async next() {
    if (!this.rendition) {
      throw new Error('Rendition not initialized. Call initialize() first.')
    }
    return await this.rendition.next()
  }

  /**
   * Go to previous page
   */
  async prev() {
    if (!this.rendition) {
      throw new Error('Rendition not initialized. Call initialize() first.')
    }
    return await this.rendition.prev()
  }

  /**
   * Get current CFI (reading position)
   * @returns {string} The current CFI
   */
  getCurrentCfi() {
    if (!this.rendition) {
      throw new Error('Rendition not initialized. Call initialize() first.')
    }
    const currentLocation = this.rendition.currentLocation()
    return currentLocation?.start?.cfi || null
  }

  /**
   * Get progress as a percentage (0-1)
   * @returns {number} Progress from 0 to 1
   */
  getProgress() {
    if (!this.rendition) {
      return 0
    }

    // If locations aren't ready yet (still generating in background), return 0
    if (!this.locations || typeof this.locations.percentageFromCfi !== 'function') {
      return 0
    }

    try {
      const currentCfi = this.getCurrentCfi()
      if (!currentCfi) return 0
      const progress = this.locations.percentageFromCfi(currentCfi) || 0
      return progress
    } catch {
      return 0
    }
  }

  /**
   * Get table of contents
   * @returns {Array} Array of chapter objects with label and href
   */
  getTableOfContents() {
    if (!this.navigation) {
      return []
    }
    return this.navigation.toc || []
  }

  /**
   * Get book metadata (title, author, etc.)
   * @returns {Promise<Object>} Book metadata
   */
  async getMetadata() {
    return await this.book.loaded.metadata
  }

  /**
   * Get cover URL
   * @returns {Promise<string>} Cover image URL
   */
  async getCoverUrl() {
    try {
      return await this.book.coverUrl()
    } catch {
      return null
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.book) {
      this.book.destroy()
    }
    // Clean up resources
    this._arrayBuffer = null
    this.ready = false
    this.rendition = null
    this.navigation = null
    this.locations = null
  }
}

/**
 * Extract metadata from an EPUB file
 * @param {File|ArrayBuffer} file - The EPUB file or ArrayBuffer
 * @returns {Promise<{title: string, author: string, coverUrl: string}>}
 */
export async function extractEpubMetadata(file) {
  // If it's already an ArrayBuffer, extract directly
  if (!(file instanceof File)) {
    return await extractFromBuffer(file)
  }

  // Otherwise read the File first
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const result = await extractFromBuffer(arrayBuffer)
        resolve(result)
      } catch (error) {
        // Return defaults instead of rejecting - allows upload to continue
        console.warn('EPUB metadata extraction failed, using defaults:', error.message)
        resolve({
          title: file.name.replace('.epub', '') || 'Untitled Book',
          author: 'Unknown Author',
          coverUrl: null
        })
      }
    }

    reader.onerror = () => {
      // Return defaults instead of rejecting
      resolve({
        title: file.name.replace('.epub', '') || 'Untitled Book',
        author: 'Unknown Author',
        coverUrl: null
      })
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract metadata from ArrayBuffer
 */
async function extractFromBuffer(arrayBuffer) {
  let book = null
  try {
    book = ePub(arrayBuffer)
    const metadata = await book.loaded.metadata

    let coverUrl = null
    try {
      coverUrl = await book.coverUrl()
    } catch {
      // No cover available
    }

    book.destroy()

    return {
      title: metadata.title || 'Untitled',
      author: metadata.creator || 'Unknown',
      coverUrl
    }
  } catch (error) {
    // Clean up book instance if error occurred
    if (book) {
      try {
        book.destroy()
      } catch {}
    }
    // epub.js has known issues with some EPUB files - return defaults
    console.warn('EPUB metadata extraction failed, using defaults:', error.message)
    return {
      title: 'Untitled Book',
      author: 'Unknown Author',
      coverUrl: null
    }
  }
}

/**
 * Convert cover URL to data URL (for storing in IndexedDB/Firestore)
 * @param {string} url - The cover URL (blob: or https:)
 * @returns {Promise<string>} Data URL
 */
export async function coverUrlToDataUrl(url) {
  if (!url) return null

  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
