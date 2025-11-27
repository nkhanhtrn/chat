import { escapeHtml } from '../markdownUtils.js'

/**
 * Plugin for rendering highlighted text in messages
 */
export const HighlightPlugin = {
  /**
   * Extract highlight from text and replace with placeholder
   * @param {string} text - Text to process
   * @param {Object} item - Highlight metadata
   * @returns {Object} - { processed: string, placeholder: Object }
   */
  extract(text, item) {
    const { startOffset, endOffset, id, color } = item

    // Extract text parts
    const beforeText = text.substring(0, startOffset)
    const highlightText = text.substring(startOffset, endOffset)
    const afterText = text.substring(endOffset)

    const placeholderId = `HIGHLIGHT_${id}`

    return {
      processed: beforeText + placeholderId + afterText,
      placeholder: {
        id: placeholderId,
        type: 'highlight',
        text: highlightText,
        color: color || '#ffeb3b',
        originalId: id
      }
    }
  },

  /**
   * Render placeholder as highlighted HTML
   * @param {Object} placeholder - Placeholder object
   * @returns {string} - Rendered HTML
   */
  render(placeholder) {
    const { text, color, originalId } = placeholder
    const escapedText = escapeHtml(text)
    return `<mark class="custom-highlight" style="background-color: ${color}; border-radius: 3px;" data-highlight-id="${originalId}">${escapedText}</mark>`
  }
}
