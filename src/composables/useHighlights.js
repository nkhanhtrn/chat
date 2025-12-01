import { computed } from 'vue'
import { mergeOverlappingHighlights } from '../utils/highlightUtils.js'

/**
 * Composable for managing highlights on a message
 * Provides add, remove, update operations and computes effective custom content with temp highlights
 */
export function useHighlights(store, getMessage) {
  /**
   * Add a highlight to the current message
   * @param {string} text - The highlighted text
   * @param {number} startOffset - Start offset in the response
   * @param {number} endOffset - End offset in the response
   * @param {number} colorIndex - Color index for the highlight
   * @returns {string|null} The highlight ID or null if failed
   */
  function addHighlight(text, startOffset, endOffset, colorIndex = 0) {
    const message = getMessage()
    if (!text || !message) return null

    if (startOffset === undefined || endOffset === undefined) {
      console.error('Invalid offsets for highlight')
      return null
    }

    const highlightId = crypto.randomUUID()
    const highlight = {
      id: highlightId,
      type: 'highlight',
      text,
      colorIndex,
      startOffset,
      endOffset
    }

    store.addCustomContent(message.id, highlight)
    return highlightId
  }

  /**
   * Remove a highlight from the current message
   * @param {string} highlightId - The ID of the highlight to remove
   */
  function removeHighlight(highlightId) {
    const message = getMessage()
    if (!highlightId || !message) return
    store.removeCustomContent(message.id, highlightId)
  }

  /**
   * Update highlight properties
   * @param {string} highlightId - The ID of the highlight to update
   * @param {Object} updates - Properties to update
   */
  function updateHighlight(highlightId, updates) {
    const message = getMessage()
    if (!highlightId || !message) return
    store.updateCustomContent(message.id, highlightId, updates)
  }

  /**
   * Add a highlight with a note
   * @param {Object} params - Highlight params with note content
   * @returns {string|null} The highlight ID or null if failed
   */
  function addHighlightWithNote({ text, startOffset, endOffset, colorIndex = 0, noteContent }) {
    const message = getMessage()
    if (!text || !message) return null

    const highlightId = crypto.randomUUID()
    const highlight = {
      id: highlightId,
      type: 'highlight',
      text,
      colorIndex,
      startOffset,
      endOffset,
      hasNote: true,
      noteContent
    }

    store.addCustomContent(message.id, highlight)
    return highlightId
  }

  /**
   * Add a question link to a message
   * @param {Object} params - Link parameters
   * @returns {string|null} The link ID or null if failed
   */
  function addQuestionLink({ text, targetMessageId, startOffset, endOffset, noteContent = '' }) {
    const message = getMessage()
    if (!text || !message) return null

    const linkId = crypto.randomUUID()
    const questionLink = {
      id: linkId,
      type: 'question-link',
      text,
      targetMessageId,
      startOffset,
      endOffset
    }

    if (noteContent) {
      questionLink.hasNote = true
      questionLink.noteContent = noteContent
    }

    store.addCustomContent(message.id, questionLink)
    return linkId
  }

  /**
   * Create a computed property that merges base custom content with a temp highlight
   * @param {Function} getTempHighlight - Function that returns the current temp highlight
   * @returns {ComputedRef} Computed effective custom content
   */
  function createEffectiveCustomContent(getTempHighlight) {
    return computed(() => {
      const message = getMessage()
      const base = message?.customContent || []
      const tempHighlight = getTempHighlight()

      if (!tempHighlight) {
        return base
      }

      return mergeOverlappingHighlights(base, tempHighlight, message?.response)
    })
  }

  return {
    addHighlight,
    removeHighlight,
    updateHighlight,
    addHighlightWithNote,
    addQuestionLink,
    createEffectiveCustomContent
  }
}
