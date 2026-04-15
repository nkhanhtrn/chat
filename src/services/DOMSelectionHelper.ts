/**
 * DOM Selection Helper - Maps browser selections to markdown offsets
 *
 * This uses the data-md-start and data-md-end attributes added by the AST renderer
 * to accurately map user selections back to raw markdown positions.
 */

/**
 * Find the closest element with markdown position data
 */
function findPositionedElement(node: Node | null): Element | null {
  if (!node) return null

  if (node.nodeType === Node.TEXT_NODE) {
    return findPositionedElement(node.parentElement)
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    if (el.hasAttribute('data-md-start') && el.hasAttribute('data-md-end')) {
      return el
    }
    return findPositionedElement(el.parentElement)
  }

  return null
}

/**
 * Get all positioned elements in a range
 */
function getElementsInRange(range: Range): Element[] {
  const container = range.commonAncestorContainer
  const root = container.nodeType === Node.ELEMENT_NODE
    ? container as Element
    : container.parentElement

  if (!root) return []

  const positionedElements = Array.from(root.querySelectorAll('[data-md-start][data-md-end]'))

  if (root.hasAttribute && root.hasAttribute('data-md-start') && root.hasAttribute('data-md-end')) {
    positionedElements.unshift(root)
  }

  if (positionedElements.length === 0) {
    let searchRoot = root.parentElement
    while (searchRoot && positionedElements.length === 0) {
      const found = Array.from(searchRoot.querySelectorAll('[data-md-start][data-md-end]'))
      if (found.length > 0) {
        positionedElements.push(...found)
      }
      searchRoot = searchRoot.parentElement
    }
  }

  return positionedElements
    .filter(element => range.intersectsNode(element))
    .sort((a, b) => {
      const aStart = parseInt(a.getAttribute('data-md-start')!, 10)
      const bStart = parseInt(b.getAttribute('data-md-start')!, 10)
      return aStart - bStart
    })
}

/**
 * Calculate markdown offsets from a browser selection
 */
export function getMarkdownOffsetsFromSelection(selection: Selection | null = window.getSelection()): {
  startOffset: number; endOffset: number; selectedText: string
} | null {
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (range.collapsed) {
    return null
  }

  const selectedText = selection.toString()
  if (!selectedText.trim()) {
    return null
  }

  try {
    const startElement = findPositionedElement(range.startContainer)
    const endElement = findPositionedElement(range.endContainer)

    if (!startElement || !endElement) {
      return null
    }

    let startOffset: number, endOffset: number

    if (startElement === endElement) {
      const mdStart = parseInt(startElement.getAttribute('data-md-start')!, 10)

      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        startOffset = mdStart + range.startOffset
        endOffset = mdStart + range.endOffset
      } else {
        const mdEnd = parseInt(startElement.getAttribute('data-md-end')!, 10)
        startOffset = mdStart
        endOffset = mdEnd
      }
    } else {
      const elements = getElementsInRange(range)

      if (elements.length === 0) {
        return null
      }

      const firstElement = elements[0]
      const firstMdStart = parseInt(firstElement.getAttribute('data-md-start')!, 10)

      if (findPositionedElement(range.startContainer) === firstElement) {
        const offset = range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startOffset
          : 0
        startOffset = firstMdStart + offset
      } else {
        startOffset = firstMdStart
      }

      const lastElement = elements[elements.length - 1]
      const lastMdStart = parseInt(lastElement.getAttribute('data-md-start')!, 10)
      const lastMdEnd = parseInt(lastElement.getAttribute('data-md-end')!, 10)

      if (findPositionedElement(range.endContainer) === lastElement) {
        const offset = range.endContainer.nodeType === Node.TEXT_NODE
          ? range.endOffset
          : lastElement.textContent!.length
        endOffset = lastMdStart + offset
      } else {
        endOffset = lastMdEnd
      }
    }

    return { startOffset, endOffset, selectedText }
  } catch {
    return null
  }
}

/**
 * Get selected text and its position for context menu
 */
export function getSelectedTextAndPosition(selection: Selection | null = window.getSelection()): {
  selectedText: string; x: number; y: number; visible: boolean
  startOffset?: number; endOffset?: number
} {
  const selectedText = selection && selection.toString().trim()

  if (!selectedText) {
    return { selectedText: '', x: 0, y: 0, visible: false }
  }

  const range = selection!.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  const offsets = getMarkdownOffsetsFromSelection(selection)

  const CONTEXT_MENU_HEIGHT = 200
  const CONTEXT_MENU_WIDTH = 250

  const spaceBelow = window.innerHeight - rect.bottom
  const showAbove = spaceBelow < CONTEXT_MENU_HEIGHT
  const y = showAbove
    ? rect.top + window.scrollY - CONTEXT_MENU_HEIGHT
    : rect.bottom + window.scrollY

  let x = rect.left + window.scrollX
  const spaceRight = window.innerWidth - rect.left
  if (spaceRight < CONTEXT_MENU_WIDTH) {
    x = window.innerWidth - CONTEXT_MENU_WIDTH + window.scrollX
  }
  if (x < window.scrollX) {
    x = window.scrollX
  }

  return {
    selectedText,
    x,
    y,
    visible: true,
    startOffset: offsets?.startOffset,
    endOffset: offsets?.endOffset
  }
}
