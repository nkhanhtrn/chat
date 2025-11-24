import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * Render LaTeX to HTML using KaTeX.
 * @param {string} latex - The LaTeX string to render.
 * @param {boolean} [displayMode=false] - Whether to use display (block) mode.
 * @returns {string} - The rendered HTML string.
 */
export function renderKatex(latex, displayMode = false) {
  return katex.renderToString(latex, {
    throwOnError: false,
    displayMode
  })
}
