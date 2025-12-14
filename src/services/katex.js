import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * Sanitize LaTeX input by replacing problematic Unicode characters
 * with their LaTeX equivalents or standard ASCII.
 * @param {string} latex - The LaTeX string to sanitize.
 * @returns {string} - The sanitized LaTeX string.
 */
function sanitizeLatex(latex) {
  return latex
    // Narrow no-break space (U+202F) - common in French typography
    .replace(/\u202F/g, '\\,')
    // Regular no-break space (U+00A0)
    .replace(/\u00A0/g, '~')
    // Other problematic Unicode spaces
    .replace(/[\u2000-\u200A]/g, ' ')
    // Zero-width spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/**
 * Render LaTeX to HTML using KaTeX.
 * @param {string} latex - The LaTeX string to render.
 * @param {boolean} [displayMode=false] - Whether to use display (block) mode.
 * @returns {string} - The rendered HTML string.
 */
export function renderKatex(latex, displayMode = false) {
  const sanitized = sanitizeLatex(latex)
  return katex.renderToString(sanitized, {
    throwOnError: false,
    displayMode,
    strict: false  // Disable strict mode warnings for unrecognized characters
  })
}
