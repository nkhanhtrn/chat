import { escapeHtml } from '../markdownUtils.js'

/**
 * Plugin for rendering clickable question links in messages
 */
export const QuestionLinkPlugin = {
  /**
   * Extract question link from text and replace with placeholder
   * @param {string} text - Text to process
   * @param {Object} item - Question link metadata
   * @returns {Object} - { processed: string, placeholder: Object }
   */
  extract(text, item) {
    const { startOffset, endOffset, id, childIndex } = item

    // Extract text parts
    const beforeText = text.substring(0, startOffset)
    const linkText = text.substring(startOffset, endOffset)
    const afterText = text.substring(endOffset)

    const placeholderId = `QUESTION_LINK_${id}`

    return {
      processed: beforeText + placeholderId + afterText,
      placeholder: {
        id: placeholderId,
        type: 'question-link',
        text: linkText,
        childIndex,
        originalId: id
      }
    }
  },

  /**
   * Render placeholder as clickable link HTML
   * @param {Object} placeholder - Placeholder object
   * @returns {string} - Rendered HTML
   */
  render(placeholder) {
    const { text, childIndex, originalId } = placeholder
    const escapedText = escapeHtml(text)
    return `<a href="#" class="question-link" data-child-index="${childIndex}" data-question-id="${originalId}">${escapedText}</a>`
  }
}
