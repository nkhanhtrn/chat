/**
 * AST-based Markdown Renderer with Custom Content Support
 *
 * This renderer uses markdown-it to parse markdown into an AST,
 * then injects custom content (highlights, links) at the correct positions
 * in the rendered HTML. This approach properly handles highlights that cross
 * markdown element boundaries (e.g., highlighting "**bold** text").
 */

import MarkdownIt from 'markdown-it'
import { escapeHtml } from './markdownUtils.js'

/**
 * Track character positions as we walk through the source text
 * This allows us to map custom content offsets to the correct positions in the AST
 */
class PositionTracker {
  constructor() {
    this.offset = 0
  }

  advance(length) {
    this.offset += length
    return this.offset
  }

  reset() {
    this.offset = 0
  }
}

/**
 * Find custom content items that overlap with a given text range
 * @param {Array} items - Custom content items with startOffset/endOffset
 * @param {number} textStart - Start offset of the text range
 * @param {number} textEnd - End offset of the text range
 * @returns {Array} - Items that overlap with the range
 */
function findOverlappingItems(items, textStart, textEnd) {
  if (!items || items.length === 0) return []

  return items.filter(item => {
    // Item overlaps if it starts before range ends and ends after range starts
    return item.startOffset < textEnd && item.endOffset > textStart
  })
}

/**
 * Split text and inject custom content HTML at the correct positions
 * @param {string} text - The text content to process
 * @param {Array} items - Custom content items that overlap with this text
 * @param {number} textStartOffset - The starting offset of this text in the original markdown
 * @returns {string} - HTML with custom content injected
 */
function injectCustomContent(text, items, textStartOffset) {
  if (items.length === 0) {
    const textEndOffset = textStartOffset + text.length
    return `<span data-md-start="${textStartOffset}" data-md-end="${textEndOffset}">${escapeHtml(text)}</span>`
  }

  const textEndOffset = textStartOffset + text.length
  const parts = []
  let currentPos = 0

  // Sort items by start offset to process them in order
  const sorted = [...items].sort((a, b) => a.startOffset - b.startOffset)

  sorted.forEach(item => {
    // Calculate relative positions within this text node
    const relativeStart = Math.max(0, item.startOffset - textStartOffset)
    const relativeEnd = Math.min(text.length, item.endOffset - textStartOffset)

    // Skip items that don't actually overlap with this text
    if (relativeStart >= text.length || relativeEnd <= 0) {
      return
    }

    // Add text before this custom content with position markers
    if (relativeStart > currentPos) {
      const beforeText = text.substring(currentPos, relativeStart)
      const beforeStart = textStartOffset + currentPos
      const beforeEnd = textStartOffset + relativeStart
      parts.push(`<span data-md-start="${beforeStart}" data-md-end="${beforeEnd}">${escapeHtml(beforeText)}</span>`)
    }

    // Add the custom content with position markers
    const contentText = text.substring(relativeStart, relativeEnd)
    const contentStart = textStartOffset + relativeStart
    const contentEnd = textStartOffset + relativeEnd
    parts.push(renderCustomItem(item, contentText, contentStart, contentEnd))

    currentPos = relativeEnd
  })

  // Add remaining text after all custom content with position markers
  if (currentPos < text.length) {
    const afterText = text.substring(currentPos)
    const afterStart = textStartOffset + currentPos
    const afterEnd = textEndOffset
    parts.push(`<span data-md-start="${afterStart}" data-md-end="${afterEnd}">${escapeHtml(afterText)}</span>`)
  }

  return parts.join('')
}

/**
 * Render a custom content item as HTML
 * @param {Object} item - Custom content metadata
 * @param {string} text - The text content to wrap
 * @param {number} startOffset - Start position in markdown
 * @param {number} endOffset - End position in markdown
 * @returns {string} - Rendered HTML
 */
function renderCustomItem(item, text, startOffset, endOffset) {
  const escapedText = escapeHtml(text)
  const positionAttrs = `data-md-start="${startOffset}" data-md-end="${endOffset}"`

  switch (item.type) {
    case 'highlight':
      return `<mark class="custom-highlight" style="background-color: ${item.color || '#ffeb3b'}; border-radius: 3px;" data-highlight-id="${item.id}" ${positionAttrs}>${escapedText}</mark>`

    case 'question-link':
      return `<a href="#" class="question-link" data-child-index="${item.childIndex}" data-question-id="${item.id}" ${positionAttrs}>${escapedText}</a>`

    default:
      return `<span ${positionAttrs}>${escapedText}</span>`
  }
}

/**
 * Create a markdown-it plugin that injects custom content
 * @param {Array} customContentItems - Array of custom content metadata
 * @param {PositionTracker} tracker - Position tracker instance
 * @returns {Function} - markdown-it plugin function
 */
function createCustomContentPlugin(customContentItems, tracker) {
  return (md) => {
    // Store the default renderer for text tokens
    const defaultTextRender = md.renderer.rules.text || function(tokens, idx) {
      return escapeHtml(tokens[idx].content)
    }

    // Override the text renderer to inject custom content
    md.renderer.rules.text = function(tokens, idx, options, env, self) {
      const token = tokens[idx]
      const content = token.content
      const textStartOffset = token.sourceOffset
      const textEndOffset = textStartOffset + content.length

      // Find custom items that overlap with this text node
      const overlapping = findOverlappingItems(
        customContentItems,
        textStartOffset,
        textEndOffset
      )

      if (overlapping.length === 0) {
        // Wrap text in span with position markers for selection mapping
        return `<span data-md-start="${textStartOffset}" data-md-end="${textEndOffset}">${escapeHtml(content)}</span>`
      }

      // Inject custom content into the text
      return injectCustomContent(content, overlapping, textStartOffset)
    }

    // Also handle inline code to preserve highlighting inside code blocks
    const defaultCodeInlineRender = md.renderer.rules.code_inline || function(tokens, idx) {
      return '<code>' + escapeHtml(tokens[idx].content) + '</code>'
    }

    md.renderer.rules.code_inline = function(tokens, idx, options, env, self) {
      const token = tokens[idx]
      const content = token.content
      const textStartOffset = token.sourceOffset
      const textEndOffset = textStartOffset + content.length

      const overlapping = findOverlappingItems(
        customContentItems,
        textStartOffset,
        textEndOffset
      )

      if (overlapping.length === 0) {
        return '<code class="inline-code">' + escapeHtml(content) + '</code>'
      }

      const injected = injectCustomContent(content, overlapping, textStartOffset)
      return '<code class="inline-code">' + injected + '</code>'
    }
  }
}

/**
 * Create a markdown-it plugin that tracks source positions
 * This walks through all tokens and assigns sourceOffset to each text token
 * @param {PositionTracker} tracker - Position tracker instance
 * @returns {Function} - markdown-it plugin function
 */
function createPositionTrackingPlugin(tracker) {
  return (md) => {
    md.core.ruler.push('track_source_positions', (state) => {
      tracker.reset()

      function walkTokens(tokens) {
        tokens.forEach(token => {
          if (token.type === 'text' || token.type === 'code_inline') {
            token.sourceOffset = tracker.offset
            tracker.advance(token.content.length)
          } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
            tracker.advance(1) // newline character
          } else if (token.children) {
            walkTokens(token.children)
          }

          // Track markdown syntax characters
          // This is approximate but works for most cases
          if (token.markup) {
            // markup contains the markdown syntax like '**', '#', etc.
            tracker.advance(token.markup.length)
          }
        })
      }

      walkTokens(state.tokens)
    })
  }
}

/**
 * Process markdown with AST-based custom content injection
 * @param {string} content - Raw markdown content
 * @param {Array} customContentItems - Array of custom content metadata
 * @returns {string} - Rendered HTML with custom content
 */
export function processMarkdownAST(content, customContentItems = []) {
  if (!content) return ''

  // Create position tracker
  const tracker = new PositionTracker()

  // Initialize markdown-it with sensible defaults
  const md = new MarkdownIt({
    html: false, // Disable raw HTML for security
    breaks: true, // Convert \n to <br>
    linkify: true, // Auto-convert URLs to links
    typographer: true // Enable smart quotes and other typography
  })

  // Register plugins
  md.use(createPositionTrackingPlugin(tracker))
  md.use(createCustomContentPlugin(customContentItems, tracker))

  // Render markdown to HTML
  return md.render(content)
}

/**
 * Enhanced version that also handles code blocks and math
 * This is a drop-in replacement for the existing processMarkdown function
 */
export function processMarkdownWithCustomContent(
  content,
  customContentItems = [],
  options = {}
) {
  if (!content) return ''

  // First, extract code blocks and math to prevent them from being processed
  const { processedContent, extractedBlocks } = extractSpecialBlocks(content)

  // Process markdown with custom content
  let html = processMarkdownAST(processedContent, customContentItems)

  // Restore code blocks and math
  html = restoreSpecialBlocks(html, extractedBlocks)

  return html
}

/**
 * Extract code blocks and math blocks to process them separately
 * @param {string} content - Markdown content
 * @returns {Object} - { processedContent, extractedBlocks }
 */
function extractSpecialBlocks(content) {
  const extractedBlocks = []
  let processedContent = content

  // Extract code blocks (```...```)
  processedContent = processedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const id = `CODEBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'code',
      lang: lang || 'text',
      content: code.trim()
    })
    return `\n${id}\n`
  })

  // Extract math blocks ($$...$$)
  processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (_match, math) => {
    const id = `MATHBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'math',
      content: math.trim()
    })
    return `\n${id}\n`
  })

  return { processedContent, extractedBlocks }
}

/**
 * Restore special blocks in the HTML
 * @param {string} html - Rendered HTML
 * @param {Array} extractedBlocks - Extracted blocks to restore
 * @returns {string} - HTML with blocks restored
 */
function restoreSpecialBlocks(html, extractedBlocks) {
  let result = html

  extractedBlocks.forEach(block => {
    let replacement = ''

    if (block.type === 'code') {
      replacement = `<div class="code-block-wrapper"><pre><code class="language-${block.lang}">${escapeHtml(block.content)}</code></pre></div>`
    } else if (block.type === 'math') {
      // Use KaTeX if available
      const rendered = typeof window !== 'undefined' && window.katex
        ? window.katex.renderToString(block.content, { displayMode: true, throwOnError: false })
        : escapeHtml(block.content)
      replacement = `<div class="math-block-wrapper">${rendered}</div>`
    }

    result = result.replace(block.id, replacement)
  })

  return result
}
