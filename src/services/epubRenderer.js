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
    this.book = ePub(bookData || '')
    this.rendition = null
    this.navigation = null
    this.locations = null
    this.ready = false
  }

  /**
   * Initialize the rendition
   * @param {Object} options - Rendition options
   * @returns {Promise} Resolves when rendition is ready
   */
  async initialize(options = {}) {
    const defaultOptions = {
      width: '100%',
      height: '100%',
      spread: 'none',
      ...options
    }

    this.rendition = this.book.renderTo(this.element, defaultOptions)

    // Display the book
    await this.rendition.display()

    // Get navigation (table of contents)
    this.navigation = await this.book.loaded.navigation

    // Generate locations for progress tracking (character count for CFI generation)
    // 1024 is a reasonable character count for accurate progress
    this.locations = await this.book.locations.generate(1024)

    this.ready = true
    return this.rendition
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
    if (!this.locations || !this.rendition) {
      return 0
    }
    try {
      const currentCfi = this.getCurrentCfi()
      if (!currentCfi) return 0
      return this.locations.percentageFromCfi(currentCfi) || 0
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
   * Set the font size
   * @param {number} size - Font size in pixels
   */
  setFontSize(size) {
    if (!this.rendition) return
    this.rendition.themes.fontSize(`${size}px`)
  }

  /**
   * Set the theme
   * @param {string} theme - Theme name ('light', 'dark', 'sepia')
   */
  setTheme(theme) {
    if (!this.rendition) return

    const themes = {
      light: { body: { color: '#000', background: '#fff' } },
      dark: { body: { color: '#fff', background: '#1a1a1a' } },
      sepia: { body: { color: '#5c4b37', background: '#f4ecd8' } }
    }

    this.rendition.themes.register(themes[theme] || themes.light)
    this.rendition.themes.select(theme)
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.book) {
      this.book.destroy()
    }
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
