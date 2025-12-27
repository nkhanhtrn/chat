/**
 * Pure utility functions for formatting text and data
 * These are stateless and easily unit testable
 */

/**
 * Truncate URL for display
 * @param {string} url - The URL to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated URL
 */
export function truncateUrl(url, maxLength = 50) {
  if (url.length <= maxLength) return url
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname.length > 20
      ? urlObj.pathname.substring(0, 17) + '...'
      : urlObj.pathname
    return urlObj.hostname + path
  } catch {
    return url.substring(0, maxLength - 3) + '...'
  }
}

/**
 * Truncate file name for display, preserving extension
 * @param {string} name - The file name to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated file name
 */
export function truncateFileName(name, maxLength = 30) {
  if (name.length <= maxLength) return name
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : ''
  const baseName = name.slice(0, name.length - ext.length)
  return baseName.slice(0, maxLength - 5 - ext.length) + '...' + ext
}

/**
 * Format character count for display
 * @param {number} charCount - Number of characters
 * @returns {string} Formatted size string
 */
export function formatSize(charCount) {
  if (charCount < 1000) return `${charCount} chars`
  return `${(charCount / 1000).toFixed(1)}k chars`
}
