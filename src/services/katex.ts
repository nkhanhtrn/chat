import katex from 'katex'
import 'katex/dist/katex.min.css'

function sanitizeLatex(latex: string): string {
  return latex
    .replace(/\u202F/g, '\\,')
    .replace(/\u00A0/g, '~')
    .replace(/[\u2000-\u200A]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

export function renderKatex(latex: string, displayMode = false): string {
  const sanitized = sanitizeLatex(latex)
  return katex.renderToString(sanitized, {
    throwOnError: false,
    displayMode,
    strict: false,
  })
}
