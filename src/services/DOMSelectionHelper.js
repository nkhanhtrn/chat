/**
 * DOM Selection Helper - Maps browser selections to markdown offsets
 *
 * This uses the data-md-start and data-md-end attributes added by the AST renderer
 * to accurately map user selections back to raw markdown positions.
 */

/**
 * Find the closest element with markdown position data
 * @param {Node} node - DOM node to search from
 * @returns {Element|null} - Element with data-md-start/end or null
 */
function findPositionedElement(node) {
  if (!node) return null

  // If it's a text node, check its parent
  if (node.nodeType === Node.TEXT_NODE) {
    return findPositionedElement(node.parentElement)
  }

  // If it's an element, check if it has position data
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.hasAttribute('data-md-start') && node.hasAttribute('data-md-end')) {
      return node
    }
    // Otherwise check parent
    return findPositionedElement(node.parentElement)
  }

  return null
}

/**
 * Get markdown offset for a position within an element
 * @param {Element} element - Element with position data
 * @param {number} offset - Character offset within element's text
 * @returns {number} - Markdown offset
 */
function getMarkdownOffset(element, offset) {
  const start = parseInt(element.getAttribute('data-md-start'), 10)
  return start + offset
}

/**
 * Get all positioned elements in a range
 * @param {Range} range - DOM range
 * @returns {Array} - Array of positioned elements in order
 */
function getElementsInRange(range) {
  const elements = []
  const container = range.commonAncestorContainer
  const root = container.nodeType === Node.ELEMENT_NODE
    ? container
    : container.parentElement

  if (!root) return elements

  // Get all elements with position data within the root
  const positionedElements = Array.from(root.querySelectorAll('[data-md-start][data-md-end]'))

  // Check each element to see if it intersects with the range
  // Sort by markdown position to ensure correct order
  const intersecting = positionedElements
    .filter(element => range.intersectsNode(element))
    .sort((a, b) => {
      const aStart = parseInt(a.getAttribute('data-md-start'), 10)
      const bStart = parseInt(b.getAttribute('data-md-start'), 10)
      return aStart - bStart
    })

  return intersecting
}

/**
 * Calculate markdown offsets from a browser selection
 * @param {Selection} selection - Browser selection object
 * @returns {Object|null} - {startOffset, endOffset, selectedText} or null
 */
export function getMarkdownOffsetsFromSelection(selection = window.getSelection()) {
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (range.collapsed) {
    return null // No selection
  }

  // Get the actual selected text
  const selectedText = selection.toString()
  if (!selectedText.trim()) {
    return null
  }

  try {
    // Find positioned elements at start and end of selection
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    const startElement = findPositionedElement(startContainer)
    const endElement = findPositionedElement(endContainer)

    if (!startElement || !endElement) {
      console.warn('Could not find positioned elements for selection')
      return null
    }

    // Calculate offsets
    let startOffset, endOffset

    // Handle single element selection
    if (startElement === endElement) {
      const mdStart = parseInt(startElement.getAttribute('data-md-start'), 10)
      const mdEnd = parseInt(startElement.getAttribute('data-md-end'), 10)

      // Get text content of the element
      const elementText = startElement.textContent || ''

      // Find where the selection starts and ends within this element
      const selectionStart = range.startOffset
      const selectionEnd = range.endOffset

      // Simple case: text node selection
      if (startContainer.nodeType === Node.TEXT_NODE) {
        startOffset = mdStart + selectionStart
        endOffset = mdStart + selectionEnd
      } else {
        // Element selection - use the full element range
        startOffset = mdStart
        endOffset = mdEnd
      }
    } else {
      // Multi-element selection
      const elements = getElementsInRange(range)

      if (elements.length === 0) {
        console.warn('No positioned elements found in selection range')
        return null
      }

      // Get start offset from first element
      const firstElement = elements[0]
      const firstMdStart = parseInt(firstElement.getAttribute('data-md-start'), 10)

      // If selection starts in first element, calculate offset
      if (findPositionedElement(startContainer) === firstElement) {
        const offset = startContainer.nodeType === Node.TEXT_NODE
          ? range.startOffset
          : 0
        startOffset = firstMdStart + offset
      } else {
        startOffset = firstMdStart
      }

      // Get end offset from last element
      const lastElement = elements[elements.length - 1]
      const lastMdStart = parseInt(lastElement.getAttribute('data-md-start'), 10)
      const lastMdEnd = parseInt(lastElement.getAttribute('data-md-end'), 10)

      // If selection ends in last element, calculate offset
      if (findPositionedElement(endContainer) === lastElement) {
        const offset = endContainer.nodeType === Node.TEXT_NODE
          ? range.endOffset
          : lastElement.textContent.length
        endOffset = lastMdStart + offset
      } else {
        endOffset = lastMdEnd
      }
    }

    return {
      startOffset,
      endOffset,
      selectedText // Keep original text, don't trim
    }
  } catch (error) {
    console.error('Error calculating markdown offsets:', error)
    return null
  }
}

/**
 * Get selected text and its position for context menu
 * This is a drop-in replacement for the existing getSelectedTextAndPosition
 * @param {Selection} selection - Browser selection
 * @returns {Object} - {selectedText, x, y, visible, startOffset, endOffset}
 */
export function getSelectedTextAndPosition(selection = window.getSelection()) {
  const selectedText = selection && selection.toString().trim()

  if (!selectedText) {
    return { selectedText: '', x: 0, y: 0, visible: false }
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  // Get markdown offsets
  const offsets = getMarkdownOffsetsFromSelection(selection)

  return {
    selectedText,
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY,
    visible: true,
    startOffset: offsets?.startOffset,
    endOffset: offsets?.endOffset
  }
}
