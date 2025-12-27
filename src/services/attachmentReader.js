/**
 * Attachment Reader Service
 *
 * A registry-based system for reading different types of attachments.
 * Each reader can handle specific file types and provides specialized
 * content extraction.
 *
 * To add a new reader:
 * 1. Create a reader object with { name, canHandle, read }
 * 2. Call registerReader(reader) or add to DEFAULT_READERS
 *
 * Example:
 *   registerReader({
 *     name: 'csv',
 *     canHandle: (attachment) => attachment.file?.name?.endsWith('.csv'),
 *     read: async (attachment) => parseCSV(attachment.file)
 *   })
 */

import { fetchUrlContent, cleanHtml } from './urlFetcher.js'

/**
 * Attachment types
 */
export const AttachmentType = {
  URL: 'url',
  FILE: 'file'
}

/**
 * Reader registry - stores all registered readers
 * Readers are checked in order, first match wins
 */
const readers = []

/**
 * Register a new attachment reader
 * @param {Object} reader - Reader configuration
 * @param {string} reader.name - Unique name for the reader
 * @param {function} reader.canHandle - (attachment) => boolean, checks if reader can handle this attachment
 * @param {function} reader.read - (attachment) => Promise<{ content: string, metadata?: object }>, reads the attachment
 * @param {number} [reader.priority=0] - Higher priority readers are checked first
 */
export function registerReader(reader) {
  if (!reader.name || !reader.canHandle || !reader.read) {
    throw new Error('Reader must have name, canHandle, and read properties')
  }

  // Insert based on priority (higher priority first)
  const priority = reader.priority || 0
  const index = readers.findIndex(r => (r.priority || 0) < priority)

  if (index === -1) {
    readers.push(reader)
  } else {
    readers.splice(index, 0, reader)
  }
}

/**
 * Unregister a reader by name
 * @param {string} name - Reader name to remove
 */
export function unregisterReader(name) {
  const index = readers.findIndex(r => r.name === name)
  if (index !== -1) {
    readers.splice(index, 1)
  }
}

/**
 * Get all registered readers
 * @returns {Array} - List of registered readers
 */
export function getReaders() {
  return [...readers]
}

/**
 * Clear all readers (useful for testing)
 */
export function clearReaders() {
  readers.length = 0
}

/**
 * Find a reader that can handle the given attachment
 * @param {Object} attachment - The attachment to find a reader for
 * @returns {Object|null} - The reader or null if none found
 */
export function findReader(attachment) {
  return readers.find(r => r.canHandle(attachment)) || null
}

/**
 * Read an attachment using the appropriate reader
 * @param {Object} attachment - The attachment to read
 * @param {string} attachment.type - 'url' or 'file'
 * @param {string} [attachment.url] - URL if type is 'url'
 * @param {File} [attachment.file] - File object if type is 'file'
 * @param {Object} [options] - Options passed to the reader
 * @returns {Promise<{ content: string, metadata?: object, readerName: string }>}
 */
export async function readAttachment(attachment, options = {}) {
  const reader = findReader(attachment)

  if (!reader) {
    throw new Error(`No reader found for attachment: ${JSON.stringify({
      type: attachment.type,
      name: attachment.file?.name || attachment.url
    })}`)
  }

  const result = await reader.read(attachment, options)

  return {
    ...result,
    readerName: reader.name
  }
}

/**
 * Read multiple attachments
 * @param {Array} attachments - Array of attachments to read
 * @param {Object} [options] - Options passed to readers
 * @returns {Promise<Array<{ attachment, result?, error? }>>}
 */
export async function readAttachments(attachments, options = {}) {
  return Promise.all(
    attachments.map(async (attachment) => {
      try {
        const result = await readAttachment(attachment, options)
        return { attachment, result }
      } catch (error) {
        return { attachment, error: error.message }
      }
    })
  )
}

// ============================================================================
// Built-in Readers
// ============================================================================

/**
 * URL Reader - Fetches content from URLs
 */
export const urlReader = {
  name: 'url',
  priority: 10,

  canHandle(attachment) {
    return attachment.type === AttachmentType.URL && !!attachment.url
  },

  async read(attachment) {
    // Use pre-fetched content if available to avoid duplicate network requests
    const rawContent = attachment.prefetchedContent || await fetchUrlContent(attachment.url)
    return {
      content: cleanHtml(rawContent),
      metadata: {
        url: attachment.url,
        fetchedAt: new Date().toISOString()
      }
    }
  }
}

/**
 * Text File Reader - Reads plain text files
 */
export const textFileReader = {
  name: 'text',
  priority: 0, // Default priority, can be overridden by more specific readers

  // Text-based file extensions
  textExtensions: [
    '.txt', '.md', '.markdown',
    '.json', '.xml', '.yaml', '.yml', '.toml',
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.sh', '.bash', '.zsh', '.fish',
    '.sql', '.graphql', '.gql',
    '.env', '.gitignore', '.dockerignore',
    '.csv', '.tsv',
    '.log', '.conf', '.config', '.ini'
  ],

  canHandle(attachment) {
    if (attachment.type !== AttachmentType.FILE || !attachment.file) {
      return false
    }

    const fileName = attachment.file.name.toLowerCase()
    const mimeType = attachment.file.type || ''

    // Check by extension
    if (this.textExtensions.some(ext => fileName.endsWith(ext))) {
      return true
    }

    // Check by MIME type
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript') {
      return true
    }

    return false
  },

  async read(attachment, options = {}) {
    const { maxLength = 50000 } = options

    const content = await readFileAsText(attachment.file)

    // Truncate if too long
    const truncated = content.length > maxLength
    const finalContent = truncated
      ? content.substring(0, maxLength) + '\n\n[Content truncated...]'
      : content

    return {
      content: finalContent,
      metadata: {
        fileName: attachment.file.name,
        fileSize: attachment.file.size,
        mimeType: attachment.file.type,
        truncated
      }
    }
  }
}

/**
 * PDF Reader - Extracts text from PDF files using pdfjs-dist
 * Enhanced to preserve layout, detect paragraphs, and handle tables
 */
export const pdfReader = {
  name: 'pdf',
  priority: 5,

  canHandle(attachment) {
    if (attachment.type !== AttachmentType.FILE || !attachment.file) {
      return false
    }

    const fileName = attachment.file.name.toLowerCase()
    const mimeType = attachment.file.type || ''

    return fileName.endsWith('.pdf') || mimeType === 'application/pdf'
  },

  async read(attachment, options = {}) {
    const { maxLength = 100000 } = options

    try {
      const pdfjsLib = await import('pdfjs-dist')

      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString()

      const arrayBuffer = await readFileAsArrayBuffer(attachment.file)
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      const textParts = []
      const numPages = pdf.numPages

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const viewport = page.getViewport({ scale: 1.0 })

        const pageText = extractTextWithLayout(textContent, viewport)
        textParts.push(`--- Page ${pageNum} ---\n${pageText}`)

        const currentLength = textParts.join('\n\n').length
        if (currentLength > maxLength) {
          textParts.push(`\n\n[Content truncated at page ${pageNum} of ${numPages}...]`)
          break
        }
      }

      const content = textParts.join('\n\n')

      return {
        content,
        metadata: {
          fileName: attachment.file.name,
          fileSize: attachment.file.size,
          numPages,
          pagesExtracted: Math.min(numPages, textParts.length - (content.includes('[Content truncated') ? 1 : 0))
        }
      }
    } catch (error) {
      throw new Error(`Failed to read PDF: ${error.message}`)
    }
  }
}

/**
 * Extract text from PDF while preserving layout structure
 * @exported for testing
 */
export function extractTextWithLayout(textContent, viewport) {
  const items = textContent.items
  if (items.length === 0) return ''

  // Extract items with position info
  const textItems = items
    .filter(item => item.str && item.str.trim())
    .map(item => {
      // Transform coordinates (PDF uses bottom-left origin)
      const tx = item.transform
      const x = tx[4]
      const y = viewport.height - tx[5] // Flip Y to top-left origin
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1])
      const width = item.width || 0

      return {
        str: item.str,
        x: Math.round(x),
        y: Math.round(y),
        fontSize: Math.round(fontSize),
        width: Math.round(width),
        endX: Math.round(x + width)
      }
    })
    .sort((a, b) => {
      // Sort by Y first (top to bottom), then by X (left to right)
      const yDiff = a.y - b.y
      if (Math.abs(yDiff) > 5) return yDiff
      return a.x - b.x
    })

  if (textItems.length === 0) return ''

  // Group items into lines based on Y position
  const lines = []
  let currentLine = [textItems[0]]
  let currentY = textItems[0].y

  for (let i = 1; i < textItems.length; i++) {
    const item = textItems[i]
    const yDiff = Math.abs(item.y - currentY)

    // Same line if Y difference is small (within ~line height)
    if (yDiff < 8) {
      currentLine.push(item)
    } else {
      lines.push(currentLine)
      currentLine = [item]
      currentY = item.y
    }
  }
  lines.push(currentLine)

  // Detect if content looks like a table (multiple columns with consistent X positions)
  const isTableLike = detectTableStructure(lines)

  // Process lines into text
  const processedLines = []
  let prevLineY = null
  let prevLineEndX = 0

  for (const line of lines) {
    // Sort items within line by X position
    line.sort((a, b) => a.x - b.x)

    const lineY = line[0].y
    const lineStartX = line[0].x

    // Detect paragraph breaks (larger vertical gap)
    if (prevLineY !== null) {
      const lineGap = lineY - prevLineY
      const avgFontSize = line.reduce((sum, item) => sum + item.fontSize, 0) / line.length

      // Large gap = new paragraph
      if (lineGap > avgFontSize * 1.5) {
        processedLines.push('')
      }
    }

    // Build line text with proper spacing
    let lineText = ''
    let lastEndX = 0

    for (const item of line) {
      // Add spacing based on X gap
      if (lineText && item.x > lastEndX) {
        const gap = item.x - lastEndX
        if (gap > 20) {
          // Large gap - likely column separator or tab
          lineText += isTableLike ? ' | ' : '    '
        } else if (gap > 3) {
          // Normal word spacing
          lineText += ' '
        }
      }

      lineText += item.str
      lastEndX = item.endX || (item.x + item.width)
    }

    // Detect list items
    const trimmedLine = lineText.trim()
    const listMatch = trimmedLine.match(/^([\u2022\u2023\u25E6\u2043\u2219•●○◦-]\s*|\d+[.)]\s*|[a-zA-Z][.)]\s*)/)
    if (listMatch) {
      // Ensure list items are on their own line
      if (processedLines.length > 0 && processedLines[processedLines.length - 1] !== '') {
        // Keep as is, it's already a new line
      }
    }

    processedLines.push(lineText.trim())

    prevLineY = lineY
    prevLineEndX = lastEndX
  }

  // Join lines, preserving paragraph breaks
  let result = ''
  let prevWasEmpty = false

  for (const line of processedLines) {
    if (line === '') {
      if (!prevWasEmpty) {
        result += '\n\n'
        prevWasEmpty = true
      }
    } else {
      // Check if this line should continue the previous or start new
      const shouldContinue = !prevWasEmpty &&
        result &&
        !result.endsWith('\n\n') &&
        !isLineBreakIndicator(line) &&
        !isLineBreakIndicator(processedLines[processedLines.indexOf(line) - 1])

      if (shouldContinue && !isTableLike) {
        // Continue same paragraph with space
        result += ' ' + line
      } else {
        result += (result && !result.endsWith('\n') ? '\n' : '') + line
      }
      prevWasEmpty = false
    }
  }

  return result.trim()
}

/**
 * Detect if the content structure looks like a table
 * @exported for testing
 */
export function detectTableStructure(lines) {
  if (lines.length < 3) return false

  // Count how many lines have multiple "columns" (items with large X gaps)
  let multiColumnLines = 0

  for (const line of lines) {
    if (line.length < 2) continue

    line.sort((a, b) => a.x - b.x)
    let hasLargeGap = false

    for (let i = 1; i < line.length; i++) {
      const gap = line[i].x - (line[i - 1].endX || line[i - 1].x + line[i - 1].width)
      if (gap > 30) {
        hasLargeGap = true
        break
      }
    }

    if (hasLargeGap) multiColumnLines++
  }

  // If more than 40% of lines have multiple columns, treat as table
  return multiColumnLines / lines.length > 0.4
}

/**
 * Check if a line indicates a natural break (headers, list items, etc.)
 */
function isLineBreakIndicator(line) {
  if (!line) return false
  const trimmed = line.trim()

  // Headers (often short, possibly all caps or ending with colon)
  if (trimmed.length < 50 && (trimmed === trimmed.toUpperCase() || trimmed.endsWith(':'))) {
    return true
  }

  // List items
  if (/^([\u2022\u2023\u25E6\u2043\u2219•●○◦-]\s*|\d+[.)]\s*|[a-zA-Z][.)]\s*)/.test(trimmed)) {
    return true
  }

  // Table rows (contains | separator)
  if (trimmed.includes(' | ')) {
    return true
  }

  return false
}

/**
 * EPUB Reader - Extracts text from EPUB files using epubjs
 */
export const epubReader = {
  name: 'epub',
  priority: 5,

  canHandle(attachment) {
    if (attachment.type !== AttachmentType.FILE || !attachment.file) {
      return false
    }

    const fileName = attachment.file.name.toLowerCase()
    const mimeType = attachment.file.type || ''

    return fileName.endsWith('.epub') || mimeType === 'application/epub+zip'
  },

  async read(attachment, options = {}) {
    const { maxLength = 100000 } = options

    try {
      const ePub = (await import('epubjs')).default
      const JSZip = (await import('jszip')).default

      const arrayBuffer = await readFileAsArrayBuffer(attachment.file)
      const book = ePub(arrayBuffer)

      await book.ready

      // Get book metadata
      const metadata = await book.loaded.metadata
      const spine = book.spine

      // Load the EPUB as a zip to directly access content files
      // This avoids epubjs CSS replacement issues
      const zip = await JSZip.loadAsync(arrayBuffer)

      const textParts = []
      let chapterNum = 0

      // Extract text from each chapter
      for (const item of spine.items) {
        chapterNum++
        try {
          // Try to load content directly from zip to avoid CSS processing issues
          let chapterText = ''
          const href = item.href

          // Find the file in the zip (may be in a subdirectory like OEBPS/)
          let zipEntry = zip.file(href)
          if (!zipEntry) {
            // Try common EPUB directory structures
            for (const prefix of ['OEBPS/', 'OPS/', 'EPUB/', '']) {
              zipEntry = zip.file(prefix + href)
              if (zipEntry) break
            }
          }

          if (zipEntry) {
            const htmlContent = await zipEntry.async('string')
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlContent, 'text/html')
            chapterText = extractTextFromHtml(doc.body)
          } else {
            // Fallback to epubjs loading (may fail for some files)
            try {
              const doc = await book.load(item.href)
              if (doc && doc.body) {
                chapterText = extractTextFromHtml(doc.body)
              } else if (typeof doc === 'string') {
                const parser = new DOMParser()
                const parsedDoc = parser.parseFromString(doc, 'text/html')
                chapterText = extractTextFromHtml(parsedDoc.body)
              }
            } catch (loadError) {
              console.warn(`Fallback load failed for chapter ${chapterNum}:`, loadError.message)
            }
          }

          if (chapterText.trim()) {
            textParts.push(`--- Chapter ${chapterNum} ---\n${chapterText.trim()}`)
          }

          const currentLength = textParts.join('\n\n').length
          if (currentLength > maxLength) {
            textParts.push(`\n\n[Content truncated at chapter ${chapterNum}...]`)
            break
          }
        } catch (chapterError) {
          // Skip chapters that fail to load
          console.warn(`Failed to load chapter ${chapterNum}:`, chapterError)
        }
      }

      const content = textParts.join('\n\n')

      book.destroy()

      return {
        content: content || '[No text content found in EPUB]',
        metadata: {
          fileName: attachment.file.name,
          fileSize: attachment.file.size,
          title: metadata.title,
          creator: metadata.creator,
          chaptersExtracted: chapterNum
        }
      }
    } catch (error) {
      throw new Error(`Failed to read EPUB: ${error.message}`)
    }
  }
}

/**
 * Extract text from HTML element, preserving basic structure
 */
function extractTextFromHtml(element) {
  if (!element) return ''

  const lines = []

  function walk(node) {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent.trim()
      if (text) {
        lines.push(text)
      }
    } else if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase()

      // Add line breaks before block elements
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'tr'].includes(tagName)) {
        if (lines.length > 0 && lines[lines.length - 1] !== '') {
          lines.push('')
        }
      }

      // Process children
      for (const child of node.childNodes) {
        walk(child)
      }

      // Add extra line break after headings and paragraphs
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
        lines.push('')
      }
    }
  }

  walk(element)

  // Clean up multiple blank lines
  const result = []
  let prevBlank = false
  for (const line of lines) {
    if (line === '') {
      if (!prevBlank) {
        result.push('')
        prevBlank = true
      }
    } else {
      result.push(line)
      prevBlank = false
    }
  }

  return result.join('\n')
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read a File as text
 * @param {File} file - File to read
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file as text'))
    reader.readAsText(file)
  })
}

/**
 * Read a File as ArrayBuffer
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file as ArrayBuffer'))
    reader.readAsArrayBuffer(file)
  })
}


// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format read attachment content for inclusion in a prompt
 * @param {Object} readResult - Result from readAttachment
 * @param {Object} attachment - Original attachment
 * @returns {string}
 */
export function formatAttachmentForPrompt(readResult, attachment) {
  // Just return the content without labels/names
  return readResult.content
}

/**
 * Format multiple read attachments for inclusion in a prompt
 * @param {Array} results - Results from readAttachments
 * @returns {string}
 */
export function formatAttachmentsForPrompt(results) {
  return results
    .filter(r => r.result && !r.error)
    .map(r => formatAttachmentForPrompt(r.result, r.attachment))
    .join('\n\n')
}

/**
 * Unsupported File Reader - Catches all files and reports unsupported type
 * This should be registered last (lowest priority)
 */
export const unsupportedFileReader = {
  name: 'unsupported',
  priority: -100, // Lowest priority, only matches if nothing else does

  canHandle(attachment) {
    return attachment.type === AttachmentType.FILE && !!attachment.file
  },

  async read(attachment) {
    const fileName = attachment.file.name
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'unknown'
    throw new Error(`Unsupported file type: .${ext}`)
  }
}

// ============================================================================
// Initialize Default Readers
// ============================================================================

/**
 * Initialize the reader registry with default readers
 */
export function initializeDefaultReaders() {
  clearReaders()
  registerReader(urlReader)
  registerReader(textFileReader)
  registerReader(pdfReader)
  registerReader(epubReader)
  registerReader(unsupportedFileReader)
}

// Auto-initialize with default readers
initializeDefaultReaders()
