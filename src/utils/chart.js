/**
 * Pure utility functions for chart operations
 */

/**
 * Parse chart option JSON safely
 * @param {string} content - JSON string of chart options
 * @returns {Object} Parsed chart options or error placeholder
 */
export function parseChartOption(content) {
  try {
    return JSON.parse(content)
  } catch (e) {
    console.warn('Failed to parse chart option:', e)
    return { title: { text: 'Chart parsing error' } }
  }
}
