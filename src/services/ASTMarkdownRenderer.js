/**
 * AST-based Markdown Parser with Custom Content Support
 *
 * This parser uses markdown-it to parse markdown into an AST,
 * then injects custom content (highlights, links) at the correct positions
 * in the AST tree. This approach properly handles highlights that cross
 * markdown element boundaries (e.g., highlighting "**bold** text").
 */

import MarkdownIt from 'markdown-it'

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
 * Split text and inject custom content into AST nodes
 * @param {string} text - The text content to process
 * @param {Array} items - Custom content items that overlap with this text
 * @param {number} textStartOffset - The starting offset of this text in the original markdown
 * @returns {Array} - Array of AST nodes with custom content injected
 */
function injectCustomContentIntoText(text, items, textStartOffset) {
  if (items.length === 0) {
    const textEndOffset = textStartOffset + text.length
    return [{
      type: 'text',
      content: text,
      startOffset: textStartOffset,
      endOffset: textEndOffset
    }]
  }

  const textEndOffset = textStartOffset + text.length
  const nodes = []
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
      nodes.push({
        type: 'text',
        content: beforeText,
        startOffset: beforeStart,
        endOffset: beforeEnd
      })
    }

    // Add the custom content node
    const contentText = text.substring(relativeStart, relativeEnd)
    const contentStart = textStartOffset + relativeStart
    const contentEnd = textStartOffset + relativeEnd
    nodes.push(createCustomContentNode(item, contentText, contentStart, contentEnd))

    currentPos = relativeEnd
  })

  // Add remaining text after all custom content
  if (currentPos < text.length) {
    const afterText = text.substring(currentPos)
    const afterStart = textStartOffset + currentPos
    const afterEnd = textEndOffset
    nodes.push({
      type: 'text',
      content: afterText,
      startOffset: afterStart,
      endOffset: afterEnd
    })
  }

  return nodes
}

/**
 * Create a custom content AST node
 * @param {Object} item - Custom content metadata
 * @param {string} text - The text content to wrap
 * @param {number} startOffset - Start position in markdown
 * @param {number} endOffset - End position in markdown
 * @returns {Object} - AST node
 */
function createCustomContentNode(item, text, startOffset, endOffset) {
  const baseNode = {
    text,
    startOffset,
    endOffset
  }

  switch (item.type) {
    case 'highlight':
      // isLastSegment is true when this segment ends at the highlight's actual end
      const isLastSegment = endOffset >= item.endOffset
      return {
        type: 'highlight',
        ...baseNode,
        colorIndex: item.colorIndex ?? 0,
        highlightId: item.id,
        noteContent: item.noteContent || '',
        hasNote: !!item.hasNote,
        isLastSegment
      }

    case 'question-link':
      return {
        type: 'question-link',
        ...baseNode,
        targetMessageId: item.targetMessageId,
        questionId: item.id
      }

    default:
      return {
        type: 'text',
        content: text,
        startOffset,
        endOffset
      }
  }
}

/**
 * Convert markdown-it token to AST node
 * @param {Object} token - markdown-it token
 * @param {Array} customContentItems - Array of custom content metadata
 * @returns {Object|Array} - AST node or array of nodes
 */
function tokenToASTNode(token, customContentItems) {
  switch (token.type) {
    case 'heading_open':
      return null // Handled by heading_close

    case 'paragraph_open':
      return null // Handled by paragraph_close

    case 'bullet_list_open':
      return { type: 'list', ordered: false, children: [] }

    case 'ordered_list_open':
      return { type: 'list', ordered: true, children: [] }

    case 'list_item_open':
      return { type: 'list_item', children: [] }

    case 'blockquote_open':
      return { type: 'blockquote', children: [] }

    case 'strong_open':
      return { type: 'strong', children: [] }

    case 'em_open':
      return { type: 'em', children: [] }

    case 'link_open':
      const href = token.attrGet('href') || ''
      const title = token.attrGet('title') || ''
      return { type: 'link', href, title, children: [] }

    case 'table_open':
      return { type: 'table', headers: [], rows: [], alignments: [] }

    case 'thead_open':
      return { type: 'thead', children: [] }

    case 'tbody_open':
      return { type: 'tbody', children: [] }

    case 'tr_open':
      return { type: 'tr', children: [] }

    case 'th_open':
      const thAlign = token.attrGet('style')
      return { type: 'th', align: thAlign, children: [] }

    case 'td_open':
      const tdAlign = token.attrGet('style')
      return { type: 'td', align: tdAlign, children: [] }

    case 'code_inline':
      const textStartOffset = token.sourceOffset
      const textEndOffset = textStartOffset + token.content.length
      const overlapping = findOverlappingItems(customContentItems, textStartOffset, textEndOffset)

      if (overlapping.length === 0) {
        return {
          type: 'code_inline',
          content: token.content,
          startOffset: textStartOffset,
          endOffset: textEndOffset
        }
      }

      // Inject custom content into inline code
      return {
        type: 'code_inline',
        children: injectCustomContentIntoText(token.content, overlapping, textStartOffset)
      }

    case 'text':
      const start = token.sourceOffset
      const end = start + token.content.length
      const items = findOverlappingItems(customContentItems, start, end)

      // Return array of nodes (may be split by custom content)
      return injectCustomContentIntoText(token.content, items, start)

    case 'softbreak':
    case 'hardbreak':
      return { type: 'br' }

    case 'hr':
      return { type: 'hr' }

    default:
      return null
  }
}

/**
 * Process tokens recursively to build AST tree
 * @param {Array} tokens - markdown-it tokens
 * @param {Array} customContentItems - Array of custom content metadata
 * @param {PositionTracker} tracker - Position tracker instance
 * @returns {Array} - Array of AST nodes
 */
function processTokens(tokens, customContentItems, tracker) {
  const ast = []
  const stack = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Track positions for text tokens
    if (token.type === 'text' || token.type === 'code_inline') {
      if (!token.sourceOffset) {
        token.sourceOffset = tracker.offset
      }
      tracker.advance(token.content.length)
    } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
      tracker.advance(1)
    }

    if (token.markup) {
      tracker.advance(token.markup.length)
    }

    // Handle children inline tokens
    if (token.children && token.children.length > 0) {
      const childrenAST = processTokens(token.children, customContentItems, tracker)

      // Determine parent node type
      if (token.type === 'inline') {
        // For inline tokens, we need to check the parent
        const parentToken = tokens[i - 1]
        if (parentToken && parentToken.type === 'heading_open') {
          const level = parseInt(parentToken.tag.substring(1))
          const headingNode = { type: 'heading', level, children: childrenAST }
          ast.push(headingNode)
        } else if (parentToken && parentToken.type === 'paragraph_open') {
          // Check if we're inside a list item - if so, add children directly without paragraph wrapper
          const isInListItem = stack.some(node => node.type === 'list_item')
          if (isInListItem && stack.length > 0) {
            const current = stack[stack.length - 1]
            if (!current.children) {
              current.children = []
            }
            current.children.push(...childrenAST)
          } else {
            const paragraphNode = { type: 'paragraph', children: childrenAST }
            ast.push(paragraphNode)
          }
        } else if (parentToken && (parentToken.type === 'th_open' || parentToken.type === 'td_open')) {
          // For table cells, add children to the current stack item (th or td)
          if (stack.length > 0) {
            const current = stack[stack.length - 1]
            if (!current.children) {
              current.children = []
            }
            current.children.push(...childrenAST)
          }
        } else if (stack.length > 0) {
          // Add to current stack item for other cases
          const current = stack[stack.length - 1]
          if (!current.children) {
            current.children = []
          }
          current.children.push(...childrenAST)
        }
      }
      continue
    }

    // Handle open/close tokens
    if (token.type.endsWith('_open')) {
      const node = tokenToASTNode(token, customContentItems)
      if (node) {
        stack.push(node)
      }
    } else if (token.type.endsWith('_close')) {
      // Skip paragraph_close if we're in a list item (since we didn't push paragraph_open)
      const isInListItem = stack.some(node => node.type === 'list_item')
      if (token.type === 'paragraph_close' && isInListItem) {
        // Don't pop anything - we never pushed a paragraph node
        continue
      }

      if (stack.length > 0) {
        const node = stack.pop()
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(node)
        } else {
          ast.push(node)
        }
      }
    } else {
      // Self-closing tokens
      const node = tokenToASTNode(token, customContentItems)
      if (node) {
        if (Array.isArray(node)) {
          // Text nodes may be split into multiple nodes
          if (stack.length > 0) {
            const parent = stack[stack.length - 1]
            if (!parent.children) {
              parent.children = []
            }
            parent.children.push(...node)
          } else {
            ast.push(...node)
          }
        } else {
          if (stack.length > 0) {
            const parent = stack[stack.length - 1]
            if (!parent.children) {
              parent.children = []
            }
            parent.children.push(node)
          } else {
            ast.push(node)
          }
        }
      }
    }
  }

  return ast
}

/**
 * Extract code blocks and math blocks to process them separately
 * @param {string} content - Markdown content
 * @returns {Object} - { processedContent, extractedBlocks }
 */
function extractSpecialBlocks(content) {
  const extractedBlocks = []
  let processedContent = content

  // Extract collapsible/hidden blocks ([HIDDEN]...[/HIDDEN])
  processedContent = processedContent.replace(/\[HIDDEN\]([\s\S]*?)\[\/HIDDEN\]/g, (match, innerContent, index) => {
    const id = `COLLAPSIBLEBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'collapsible_block',
      content: innerContent.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return `\n${id}\n`
  })

  // Extract code blocks (```...```)
  processedContent = processedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code, index) => {
    const id = `CODEBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'code_block',
      language: lang || 'text',
      code: code.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return `\n${id}\n`
  })

  // Extract math blocks ($$...$$)
  processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (match, math, index) => {
    const id = `MATHBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'math_block',
      content: math.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return `\n${id}\n`
  })

  // Extract math blocks with bracket notation (\[...\])
  processedContent = processedContent.replace(/\\\[([\s\S]+?)\\\]/g, (match, math, index) => {
    const id = `MATHBLOCK${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'math_block',
      content: math.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return `\n${id}\n`
  })

  // Extract inline math ($...$) - but not $$
  processedContent = processedContent.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (match, math, index) => {
    const id = `MATHINLINE${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'math_inline',
      content: math.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return id
  })

  // Extract inline math with parenthesis notation (\(...\))
  processedContent = processedContent.replace(/\\\((.+?)\\\)/g, (match, math, index) => {
    const id = `MATHINLINE${extractedBlocks.length}PLACEHOLDER`
    extractedBlocks.push({
      id,
      type: 'math_inline',
      content: math.trim(),
      originalStart: index,
      originalEnd: index + match.length
    })
    return id
  })

  return { processedContent, extractedBlocks }
}

/**
 * Check if a highlight fully contains a math block
 * @param {Object} highlight - Highlight item with startOffset/endOffset
 * @param {Object} block - Extracted block with originalStart/originalEnd
 * @returns {boolean} - True if highlight fully contains block
 */
function highlightContainsBlock(highlight, block) {
  if (block.originalStart === undefined || block.originalEnd === undefined) {
    return false
  }
  // Highlight must start at or before block start AND end at or after block end
  return highlight.startOffset <= block.originalStart && highlight.endOffset >= block.originalEnd
}

/**
 * Find the first highlight that fully contains this block
 * @param {Array} highlights - Array of highlight items
 * @param {Object} block - Extracted block
 * @returns {Object|null} - The highlight or null
 */
function findContainingHighlight(highlights, block) {
  if (!highlights || highlights.length === 0) return null

  for (const highlight of highlights) {
    if (highlight.type === 'highlight' && highlightContainsBlock(highlight, block)) {
      return highlight
    }
  }
  return null
}

/**
 * Restore special blocks in the AST
 * @param {Array} ast - AST nodes
 * @param {Array} extractedBlocks - Extracted blocks to restore
 * @param {Array} customContentItems - Custom content items (highlights, etc.)
 * @returns {Array} - AST with blocks restored
 */
function restoreSpecialBlocksInAST(ast, extractedBlocks, customContentItems = []) {
  return ast.flatMap(node => {
    if (node.type === 'text' && node.content) {
      // Check if this text node contains any placeholders
      let content = node.content
      let hasPlaceholder = false

      for (const block of extractedBlocks) {
        if (content.includes(block.id)) {
          hasPlaceholder = true
          break
        }
      }

      if (!hasPlaceholder) {
        return node
      }

      // Split text by all placeholders and rebuild as array of nodes
      const result = []
      let remaining = content

      while (remaining) {
        let foundBlock = null
        let foundIndex = -1

        // Find the first placeholder in remaining text
        for (const block of extractedBlocks) {
          const idx = remaining.indexOf(block.id)
          if (idx !== -1 && (foundIndex === -1 || idx < foundIndex)) {
            foundIndex = idx
            foundBlock = block
          }
        }

        if (foundBlock === null) {
          // No more placeholders, add remaining text
          if (remaining) {
            result.push({
              type: 'text',
              content: remaining,
              startOffset: node.startOffset,
              endOffset: node.endOffset
            })
          }
          break
        }

        // Add text before placeholder
        if (foundIndex > 0) {
          result.push({
            type: 'text',
            content: remaining.substring(0, foundIndex),
            startOffset: node.startOffset,
            endOffset: node.endOffset
          })
        }

        // Add the block node with highlight info if applicable
        const blockNode = {
          type: foundBlock.type,
          ...foundBlock,
          startOffset: foundBlock.originalStart,
          endOffset: foundBlock.originalEnd
        }

        // Check if this math block should be highlighted
        if (foundBlock.type === 'math_block' || foundBlock.type === 'math_inline') {
          const highlight = findContainingHighlight(customContentItems, foundBlock)
          if (highlight) {
            blockNode.highlighted = true
            blockNode.colorIndex = highlight.colorIndex ?? 0
            blockNode.highlightId = highlight.id
          }
        }

        result.push(blockNode)

        // Continue with text after placeholder
        remaining = remaining.substring(foundIndex + foundBlock.id.length)
      }

      return result
    }

    if (node.type === 'paragraph' && node.children) {
      // Check if paragraph contains only a placeholder
      const updatedChildren = restoreSpecialBlocksInAST(node.children, extractedBlocks, customContentItems)
      if (updatedChildren.length === 1 &&
          (updatedChildren[0].type === 'code_block' || updatedChildren[0].type === 'math_block')) {
        // Replace paragraph with the block directly
        return updatedChildren[0]
      }
      return { ...node, children: updatedChildren }
    }

    if (node.children) {
      const updatedChildren = restoreSpecialBlocksInAST(node.children, extractedBlocks, customContentItems).flat()
      return { ...node, children: updatedChildren }
    }

    return node
  })
}

/**
 * Check if a highlight overlaps with a block (any overlap)
 * @param {Object} highlight - Highlight item with startOffset/endOffset
 * @param {Object} block - Extracted block with originalStart/originalEnd
 * @returns {boolean} - True if they overlap at all
 */
function highlightOverlapsBlock(highlight, block) {
  if (block.originalStart === undefined || block.originalEnd === undefined) {
    return false
  }
  return highlight.startOffset < block.originalEnd && highlight.endOffset > block.originalStart
}

/**
 * Filter out custom content items that overlap with extracted blocks
 * Items that fully contain blocks will be applied to the blocks in restoreSpecialBlocksInAST
 * Items that partially overlap are filtered out entirely (ignored)
 * @param {Array} customContentItems - All custom content items
 * @param {Array} extractedBlocks - Extracted blocks (code, math)
 * @returns {Array} - Filtered custom content items
 */
function filterItemsNotOverlappingBlocks(customContentItems, extractedBlocks) {
  if (!customContentItems || customContentItems.length === 0) return []
  if (!extractedBlocks || extractedBlocks.length === 0) return customContentItems

  return customContentItems.filter(item => {
    // Check if this item overlaps with any extracted block (fully or partially)
    for (const block of extractedBlocks) {
      if (highlightOverlapsBlock(item, block)) {
        // This item overlaps with a block, filter it out from text processing
        return false
      }
    }
    return true
  })
}

/**
 * Parse markdown into AST tree with custom content
 * @param {string} content - Raw markdown content
 * @param {Array} customContentItems - Array of custom content metadata
 * @returns {Object} - AST tree
 */
export function parseMarkdownToAST(content, customContentItems = []) {
  if (!content) return { type: 'root', children: [] }

  // Extract special blocks (code, math)
  const { processedContent, extractedBlocks } = extractSpecialBlocks(content)

  // Filter out custom content items that overlap with extracted blocks
  // Items fully containing blocks will be applied in restoreSpecialBlocksInAST
  // Items partially overlapping blocks are ignored entirely
  const nonBlockItems = filterItemsNotOverlappingBlocks(customContentItems, extractedBlocks)

  // Create position tracker
  const tracker = new PositionTracker()

  // Initialize markdown-it with sensible defaults
  const md = new MarkdownIt({
    html: false, // Disable raw HTML for security
    breaks: true, // Convert \n to <br>
    linkify: true, // Auto-convert URLs to links
    typographer: true // Enable smart quotes and other typography
  })

  // Parse markdown to tokens
  const tokens = md.parse(processedContent, {})

  // Convert tokens to AST (only with non-block-overlapping items)
  tracker.reset()
  let children = processTokens(tokens, nonBlockItems, tracker)

  // Restore special blocks (with highlight support for block-overlapping items)
  children = restoreSpecialBlocksInAST(children, extractedBlocks, customContentItems)

  return {
    type: 'root',
    children
  }
}

/**
 * Alias for backward compatibility
 */
export function processMarkdownWithCustomContent(content, customContentItems = []) {
  return parseMarkdownToAST(content, customContentItems)
}
