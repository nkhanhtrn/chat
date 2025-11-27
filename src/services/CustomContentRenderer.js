/**
 * Custom Content Renderer - Plugin-based system for rendering custom content in messages
 */
export class CustomContentRenderer {
  constructor() {
    this.plugins = new Map()
  }

  /**
   * Register a plugin for a specific content type
   * @param {string} type - Content type (e.g., 'highlight', 'note')
   * @param {Object} plugin - Plugin with extract and render methods
   */
  register(type, plugin) {
    this.plugins.set(type, plugin)
  }

  /**
   * Extract custom content from text and create placeholders
   * @param {string} text - Original text
   * @param {Array} customContentItems - Array of custom content metadata
   * @returns {Object} - { processed: string, placeholders: Array }
   */
  extract(text, customContentItems) {
    if (!customContentItems || customContentItems.length === 0) {
      return { processed: text, placeholders: [] }
    }

    let processed = text
    const placeholders = []

    // Sort by offset (descending) to process from end to start
    // This prevents offset shifts when replacing text
    const sorted = [...customContentItems].sort((a, b) => b.startOffset - a.startOffset)

    for (const item of sorted) {
      const plugin = this.plugins.get(item.type)
      if (plugin?.extract) {
        const result = plugin.extract(processed, item)
        processed = result.processed
        placeholders.push(result.placeholder)
      }
    }

    return { processed, placeholders }
  }

  /**
   * Replace placeholders with rendered HTML
   * @param {string} html - HTML with placeholders
   * @param {Array} placeholders - Array of placeholder objects
   * @returns {string} - HTML with rendered custom content
   */
  render(html, placeholders) {
    let result = html
    for (const placeholder of placeholders) {
      const plugin = this.plugins.get(placeholder.type)
      if (plugin?.render) {
        const rendered = plugin.render(placeholder)
        result = result.replace(placeholder.id, rendered)
      }
    }
    return result
  }
}
