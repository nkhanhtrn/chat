/**
 * Pure utility functions for highlight operations
 * These are stateless and easily unit testable
 */

/**
 * Merge overlapping highlights with a temporary highlight
 * @param {Array} baseHighlights - The existing custom content array
 * @param {Object} tempHighlight - The temporary highlight to merge
 * @param {string} responseText - The full response text (for extracting merged text)
 * @returns {Array} New array with merged highlights
 */
export function mergeOverlappingHighlights(baseHighlights, tempHighlight, responseText = '') {
  if (!tempHighlight) {
    return baseHighlights
  }

  const tempStart = tempHighlight.startOffset
  const tempEnd = tempHighlight.endOffset

  // Find overlapping highlights (only type: 'highlight', not question-links)
  const overlapping = baseHighlights.filter(
    item => item.type === 'highlight' &&
      item.startOffset < tempEnd &&
      item.endOffset > tempStart
  )

  if (overlapping.length === 0) {
    return [...baseHighlights, tempHighlight]
  }

  // Calculate merged range
  let mergedStart = tempStart
  let mergedEnd = tempEnd
  overlapping.forEach(item => {
    mergedStart = Math.min(mergedStart, item.startOffset)
    mergedEnd = Math.max(mergedEnd, item.endOffset)
  })

  // Extract merged text from the response
  const mergedText = responseText
    ? responseText.substring(mergedStart, mergedEnd)
    : tempHighlight.text

  // Create merged temp highlight
  const mergedTempHighlight = {
    ...tempHighlight,
    startOffset: mergedStart,
    endOffset: mergedEnd,
    text: mergedText
  }

  // Filter out overlapping highlights and add merged temp
  const result = baseHighlights.filter(item => !overlapping.includes(item))
  result.push(mergedTempHighlight)
  return result
}

/**
 * Build conversation chain from a message to root (for API context)
 * @param {Object} messagesById - The messages lookup object
 * @param {string} messageId - The starting message ID
 * @returns {Array} Array of { question } objects from root to message
 */
export function buildConversationChain(messagesById, messageId) {
  const chain = []
  let msg = messagesById[messageId]
  while (msg) {
    chain.unshift({ question: msg.question })
    msg = msg.parentId ? messagesById[msg.parentId] : null
  }
  return chain
}

/**
 * Check if a message is in the tree of a root message
 * @param {Object} messagesById - The messages lookup object
 * @param {string} messageId - The message to check
 * @param {string} rootMessageId - The root message ID
 * @returns {boolean} True if messageId is in the tree rooted at rootMessageId
 */
export function isMessageInTree(messagesById, messageId, rootMessageId) {
  let msg = messagesById[messageId]
  while (msg) {
    if (msg.id === rootMessageId) {
      return true
    }
    msg = msg.parentId ? messagesById[msg.parentId] : null
  }
  return false
}

/**
 * Create a temporary highlight object
 * @param {Object} params - Highlight parameters
 * @returns {Object} Temporary highlight object
 */
export function createTempHighlight({ text, startOffset, endOffset, colorIndex = 0, hasNote = false, noteContent = '' }) {
  return {
    id: hasNote ? '__temp_highlight_with_note__' : '__temp_highlight__',
    type: 'highlight',
    text,
    colorIndex,
    startOffset,
    endOffset,
    hasNote,
    noteContent
  }
}

/**
 * Create a highlight object ready for storage
 * @param {Object} params - Highlight parameters
 * @returns {Object} Highlight object with generated ID
 */
export function createHighlight({ text, startOffset, endOffset, colorIndex = 0, hasNote = false, noteContent = '' }) {
  const highlight = {
    id: crypto.randomUUID(),
    type: 'highlight',
    text,
    colorIndex,
    startOffset,
    endOffset
  }

  if (hasNote) {
    highlight.hasNote = true
    highlight.noteContent = noteContent
  }

  return highlight
}

/**
 * Create a question link object ready for storage
 * @param {Object} params - Link parameters
 * @returns {Object} Question link object with generated ID
 */
export function createQuestionLink({ text, targetMessageId, startOffset, endOffset, noteContent = '' }) {
  const link = {
    id: crypto.randomUUID(),
    type: 'question-link',
    text,
    targetMessageId,
    startOffset,
    endOffset
  }

  if (noteContent) {
    link.hasNote = true
    link.noteContent = noteContent
  }

  return link
}
