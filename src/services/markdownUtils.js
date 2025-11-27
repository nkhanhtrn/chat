/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
export const escapeHtml = (text) => {
  // Always use manual escaping for consistency
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Render math expression using KaTeX
 * @param {string} math - Math expression
 * @param {boolean} isBlock - Whether to render as block or inline
 * @returns {string} - Rendered HTML or escaped fallback
 */
export const renderMath = (math, isBlock = false) => {
  try {
    if (typeof window !== 'undefined' && window.katex) {
      return window.katex.renderToString(math, {
        displayMode: isBlock,
        throwOnError: false
      })
    }
  } catch (e) {
    console.error('KaTeX rendering error:', e)
  }
  return escapeHtml(math)
}

/**
 * Extract code blocks from markdown text
 * @param {string} text - Markdown text
 * @returns {object} - { processed: string, blocks: Array }
 */
export const extractCodeBlocks = (text) => {
  const blocks = []
  const processed = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const id = `CODE_BLOCK_${blocks.length}`
    blocks.push({ id, lang: lang || 'text', code: code.trim() })
    return `\n${id}\n`
  })
  return { processed, blocks }
}

/**
 * Extract math blocks from markdown text
 * @param {string} text - Markdown text
 * @returns {object} - { processed: string, blocks: Array }
 */
export const extractMathBlocks = (text) => {
  const blocks = []
  const processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, math) => {
    const id = `MATH_BLOCK_${blocks.length}`
    blocks.push({ id, math: math.trim() })
    return `\n${id}\n`
  })
  return { processed, blocks }
}

/**
 * Extract inline math from markdown text
 * @param {string} text - Markdown text
 * @returns {object} - { processed: string, blocks: Array }
 */
export const extractInlineMath = (text) => {
  const blocks = []
  const processed = text.replace(/\$([^\$\n]+?)\$/g, (_match, math) => {
    const id = `MATH_INLINE_${blocks.length}`
    blocks.push({ id, math: math.trim() })
    return id
  })
  return { processed, blocks }
}

/**
 * Extract inline code from markdown text
 * @param {string} text - Markdown text
 * @returns {object} - { processed: string, blocks: Array }
 */
export const extractInlineCode = (text) => {
  const blocks = []
  const processed = text.replace(/`([^`]+?)`/g, (_match, code) => {
    const id = `CODE_INLINE_${blocks.length}`
    blocks.push({ id, code })
    return id
  })
  return { processed, blocks }
}

/**
 * Replace placeholders with rendered HTML in text
 * @param {string} html - HTML with placeholders
 * @param {Array} blocks - Array of { id, content } objects
 * @param {Function} renderFn - Function to render each block
 * @returns {string} - HTML with replaced placeholders
 */
export const replacePlaceholders = (html, blocks, renderFn) => {
  let result = html
  blocks.forEach(block => {
    result = result.replace(block.id, renderFn(block))
  })
  return result
}

/**
 * Process markdown content with code, math, inline elements, and custom content
 * @param {string} content - Raw markdown content
 * @param {Function} markdownRenderer - Function to render markdown (e.g., marked)
 * @param {Array} customContentItems - Array of custom content metadata (highlights, notes, etc.)
 * @param {Object} customRenderer - CustomContentRenderer instance (optional, will be created if not provided)
 * @returns {string} - Processed HTML
 */
export const processMarkdown = (content, markdownRenderer, customContentItems = [], customRenderer = null) => {
  if (!content) return ''

  // STEP 1: Extract custom content FIRST (before other extractions)
  let processed = content
  let customPlaceholders = []

  if (customContentItems?.length > 0 && customRenderer) {
    const customResult = customRenderer.extract(processed, customContentItems)
    processed = customResult.processed
    customPlaceholders = customResult.placeholders
  }

  // STEP 2: Extract special elements in order (to avoid conflicts)
  let { processed: p1, blocks: codeBlocks } = extractCodeBlocks(processed)
  processed = p1
  let mathResult = extractMathBlocks(processed)
  processed = mathResult.processed
  const mathBlocks = mathResult.blocks

  let inlineMathResult = extractInlineMath(processed)
  processed = inlineMathResult.processed
  const inlineMath = inlineMathResult.blocks

  let inlineCodeResult = extractInlineCode(processed)
  processed = inlineCodeResult.processed
  const inlineCode = inlineCodeResult.blocks

  // STEP 3: Render markdown
  let html = markdownRenderer(processed)

  // STEP 4: Replace placeholders with rendered content
  html = replacePlaceholders(html, codeBlocks, ({ lang, code }) =>
    `<div class="code-block-wrapper"><pre><code class="language-${lang}">${escapeHtml(code)}</code></pre></div>`
  )

  html = replacePlaceholders(html, mathBlocks, ({ math }) =>
    `<div class="math-block-wrapper">${renderMath(math, true)}</div>`
  )

  html = replacePlaceholders(html, inlineMath, ({ math }) =>
    `<span class="math-inline-wrapper">${renderMath(math, false)}</span>`
  )

  html = replacePlaceholders(html, inlineCode, ({ code }) =>
    `<code class="inline-code">${escapeHtml(code)}</code>`
  )

  // STEP 5: Replace custom content placeholders LAST (to preserve interactivity)
  if (customPlaceholders.length > 0 && customRenderer) {
    html = customRenderer.render(html, customPlaceholders)
  }

  return html
}
