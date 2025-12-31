/**
 * Generate a default book cover as a data URL
 * Creates an SVG with the book title and author
 * @param {string} title - Book title
 * @param {string} author - Book author
 * @returns {string} Data URL of the generated cover
 */
export function generateDefaultCover(title = '', author = '') {
  // Word wrap function for title (max 18 chars per line, max 3 lines)
  const wrapText = (text, maxCharsPerLine) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    for (const word of words) {
      const testLine = (currentLine + ' ' + word).trim()
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        // Handle long words that exceed max line length
        if (word.length > maxCharsPerLine) {
          // Break the long word
          for (let i = 0; i < word.length; i += maxCharsPerLine) {
            lines.push(word.substring(i, i + maxCharsPerLine))
          }
          currentLine = ''
        } else {
          currentLine = word
        }
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  const displayTitle = title || 'Untitled'
  const displayAuthor = author || ''

  // Wrap title to max 3 lines, 18 chars each
  const titleLines = wrapText(displayTitle, 18).slice(0, 3)

  // Wrap author to max 2 lines, 22 chars each
  const authorLines = displayAuthor ? wrapText(displayAuthor, 22).slice(0, 2) : []

  // Calculate vertical positioning
  const titleStartY = 170 - ((titleLines.length - 1) * 30)
  const authorStartY = titleStartY + (titleLines.length * 30) + 35

  // Create SVG text elements for title lines
  const titleTextElements = titleLines.map((line, index) =>
    `<text x="150" y="${titleStartY + (index * 30)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${titleLines.length > 2 ? 20 : titleLines.length > 1 ? 24 : 26}" font-weight="600" fill="white" text-anchor="middle">
      ${escapeSvgText(line)}
    </text>`
  ).join('\n      ')

  // Create SVG text elements for author lines
  const authorTextElements = authorLines.map((line, index) =>
    `<text x="150" y="${authorStartY + (index * 22)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="rgba(255,255,255,0.7)" text-anchor="middle">
      ${escapeSvgText(line)}
    </text>`
  ).join('\n      ')

  // Create SVG with gradient background and border
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4a5568" />
          <stop offset="100%" style="stop-color:#2d3748" />
        </linearGradient>
      </defs>
      <rect width="300" height="450" fill="url(#bg)" />
      <rect x="20" y="20" width="260" height="410" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" rx="2" />
      <rect x="22" y="22" width="256" height="406" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="2" />
      ${titleTextElements}
      ${authorTextElements}
    </svg>
  `

  // Convert SVG to data URL
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return URL.createObjectURL(blob)
}

/**
 * Escape text for SVG to prevent XSS
 */
function escapeSvgText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
