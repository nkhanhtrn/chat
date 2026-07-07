/**
 * AST-based Markdown Parser with Custom Content Support
 *
 * Uses markdown-it to parse markdown into an AST,
 * then injects custom content (links) at correct positions.
 */

import MarkdownIt from 'markdown-it'

// ── Types ──────────────────────────────────────────────────

export interface ASTNodeBase {
  type: string
  children?: ASTNodeType[]
  startOffset?: number
  endOffset?: number
  [key: string]: unknown
}

export interface TextNode extends ASTNodeBase {
  type: 'text'
  content: string
}

export interface HeadingNode extends ASTNodeBase {
  type: 'heading'
  level: number
}

export interface ListNode extends ASTNodeBase {
  type: 'list'
  ordered: boolean
}

export interface LinkNode extends ASTNodeBase {
  type: 'link'
  href: string
  title: string
}

export interface QuestionLinkNode extends ASTNodeBase {
  type: 'question-link'
  text: string
  targetMessageId: string
  questionId: string
  noteContent: string
  hasNote: boolean
  isLastSegment: boolean
  colorIndex: number
}

export interface NoteNode extends ASTNodeBase {
  type: 'note'
  text: string
  noteId: string
  noteContent: string
  hasNote: boolean
  isLastSegment: boolean
  colorIndex: number
}

export interface CodeBlockNode extends ASTNodeBase {
  type: 'code_block'
  language: string
  code: string
}

export interface CodeInlineNode extends ASTNodeBase {
  type: 'code_inline'
  content: string
}

export interface MathBlockNode extends ASTNodeBase {
  type: 'math_block' | 'math_inline'
  content: string
}

export interface MermaidBlockNode extends ASTNodeBase {
  type: 'mermaid_block'
  code: string
}

export interface TableNode extends ASTNodeBase {
  type: 'table'
  headers: ASTNodeType[][]
  rows: ASTNodeType[][][]
  alignments: string[]
}

export interface CollapsibleBlockNode extends ASTNodeBase {
  type: 'collapsible_block'
}

export interface ASTTree {
  type: 'root'
  children: ASTNodeType[]
}

export type ASTNodeType =
  | TextNode
  | HeadingNode
  | ListNode
  | { type: 'list_item'; children: ASTNodeType[] }
  | { type: 'blockquote'; children: ASTNodeType[] }
  | { type: 'strong'; children: ASTNodeType[] }
  | { type: 'em'; children: ASTNodeType[] }
  | LinkNode
  | HighlightNode
  | QuestionLinkNode
  | NoteNode
  | CodeBlockNode
  | CodeInlineNode
  | MathBlockNode
  | MermaidBlockNode
  | TableNode
  | CollapsibleBlockNode
  | { type: 'paragraph'; children: ASTNodeType[] }
  | { type: 'hr' }
  | { type: 'br' }
  | { type: 'html_inline'; content: string }
  | ASTNodeBase

interface CustomContentItem {
  type: string
  id: string
  startOffset: number
  endOffset: number
  targetMessageId?: string
  noteContent?: string
  hasNote?: boolean
}

interface ExtractedBlock {
  id: string
  type: string
  originalStart: number
  originalEnd: number
  language?: string
  code?: string
  content?: string
}

interface Replacement {
  originalStart: number
  originalEnd: number
  processedStart: number
  processedEnd: number
}

// ── PositionTracker ────────────────────────────────────────

class PositionTracker {
  offset = 0
  source: string

  constructor(source = '') {
    this.source = source
  }

  advance(length: number): number {
    this.offset += length
    return this.offset
  }

  reset(): void {
    this.offset = 0
  }
}

// ── Helper functions ───────────────────────────────────────

function findOverlappingItems(
  items: CustomContentItem[],
  textStart: number,
  textEnd: number
): CustomContentItem[] {
  if (!items || items.length === 0) return []
  return items.filter(
    item => item.startOffset < textEnd && item.endOffset > textStart
  )
}

function injectCustomContentIntoText(
  text: string,
  items: CustomContentItem[],
  textStartOffset: number
): ASTNodeType[] {
  if (items.length === 0) {
    const textEndOffset = textStartOffset + text.length
    return [{ type: 'text', content: text, startOffset: textStartOffset, endOffset: textEndOffset }]
  }

  const textEndOffset = textStartOffset + text.length
  const nodes: ASTNodeType[] = []
  let currentPos = 0
  const sorted = [...items].sort((a, b) => a.startOffset - b.startOffset)

  for (const item of sorted) {
    const relativeStart = Math.max(0, item.startOffset - textStartOffset)
    const relativeEnd = Math.min(text.length, item.endOffset - textStartOffset)

    if (relativeStart >= text.length || relativeEnd <= 0) continue

    if (relativeStart > currentPos) {
      const beforeText = text.substring(currentPos, relativeStart)
      nodes.push({
        type: 'text',
        content: beforeText,
        startOffset: textStartOffset + currentPos,
        endOffset: textStartOffset + relativeStart,
      })
    }

    const contentText = text.substring(relativeStart, relativeEnd)
    nodes.push(
      createCustomContentNode(item, contentText, textStartOffset + relativeStart, textStartOffset + relativeEnd)
    )
    currentPos = relativeEnd
  }

  if (currentPos < text.length) {
    nodes.push({
      type: 'text',
      content: text.substring(currentPos),
      startOffset: textStartOffset + currentPos,
      endOffset: textEndOffset,
    })
  }

  return nodes
}

function createCustomContentNode(
  item: CustomContentItem,
  text: string,
  startOffset: number,
  endOffset: number
): ASTNodeType {
  const baseNode = { text, startOffset, endOffset }

  switch (item.type) {
    case 'question-link':
      return {
        type: 'question-link',
        ...baseNode,
        targetMessageId: item.targetMessageId ?? '',
        questionId: item.id,
        noteContent: item.noteContent || '',
        hasNote: !!item.hasNote,
        isLastSegment: endOffset >= item.endOffset,
        colorIndex: item.colorIndex ?? 0,
      }

    case 'note':
      return {
        type: 'note',
        ...baseNode,
        noteId: item.id,
        noteContent: item.noteContent || '',
        hasNote: !!item.hasNote,
        colorIndex: item.colorIndex ?? 0,
        isLastSegment: endOffset >= item.endOffset,
      }

    default:
      return { type: 'text', content: text, startOffset, endOffset }
  }
}

// ── Token to AST conversion ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokenToASTNode(token: any, customContentItems: CustomContentItem[]): ASTNodeType | ASTNodeType[] | null {
  switch (token.type) {
    case 'heading_open':
    case 'paragraph_open':
      return null

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

    case 'link_open': {
      const href = token.attrGet('href') || ''
      const title = token.attrGet('title') || ''
      return { type: 'link', href, title, children: [] }
    }

    case 'table_open':
      return { type: 'table', headers: [], rows: [], alignments: [] }
    case 'thead_open':
      return { type: 'thead', children: [] }
    case 'tbody_open':
      return { type: 'tbody', children: [] }
    case 'tr_open':
      return { type: 'tr', children: [] }
    case 'th_open': {
      const thAlign = token.attrGet('style')
      return { type: 'th', align: thAlign, children: [] }
    }
    case 'td_open': {
      const tdAlign = token.attrGet('style')
      return { type: 'td', align: tdAlign, children: [] }
    }

    case 'code_inline': {
      const textStartOffset = token.sourceOffset
      const textEndOffset = textStartOffset + token.content.length
      const overlapping = findOverlappingItems(customContentItems, textStartOffset, textEndOffset)
      if (overlapping.length === 0) {
        return { type: 'code_inline', content: token.content, startOffset: textStartOffset, endOffset: textEndOffset }
      }
      const children = injectCustomContentIntoText(token.content, overlapping, textStartOffset)
      return { type: 'code_inline', children, startOffset: textStartOffset, endOffset: textEndOffset }
    }

    case 'text': {
      const start = token.sourceOffset
      const end = start + token.content.length
      const items = findOverlappingItems(customContentItems, start, end)
      return injectCustomContentIntoText(token.content, items, start)
    }

    case 'softbreak':
    case 'hardbreak':
      return { type: 'br' }

    case 'hr':
      return { type: 'hr' }

    case 'html_inline':
      return { type: 'html_inline', content: token.content }

    default:
      return null
  }
}

// ── Process tokens recursively ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processTokens(tokens: any[], customContentItems: CustomContentItem[], tracker: PositionTracker, mapOffset = (x: number) => x): ASTNodeType[] {
  const ast: ASTNodeType[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack: any[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Track positions for text tokens
    if (token.type === 'text') {
      if (!token.sourceOffset) {
        const searchStart = tracker.offset
        const foundPos = tracker.source.indexOf(token.content, searchStart)
        const maxSkip = 20
        if (foundPos !== -1 && foundPos - searchStart <= maxSkip) {
          token.sourceOffset = mapOffset(foundPos)
          tracker.offset = foundPos + token.content.length
        } else {
          token.sourceOffset = mapOffset(tracker.offset)
          tracker.advance(token.content.length)
        }
      } else {
        tracker.advance(token.content.length)
      }
    } else if (token.type === 'code_inline') {
      const searchStart = tracker.offset
      const codeWithBackticks = token.markup + token.content + token.markup
      const foundPos = tracker.source.indexOf(codeWithBackticks, searchStart)
      if (foundPos !== -1) {
        const contentPos = foundPos + token.markup.length
        if (!token.sourceOffset) token.sourceOffset = mapOffset(contentPos)
        tracker.offset = foundPos + codeWithBackticks.length
      } else {
        const markupLen = token.markup ? token.markup.length : 1
        tracker.advance(markupLen)
        if (!token.sourceOffset) token.sourceOffset = mapOffset(tracker.offset)
        tracker.advance(token.content.length)
        tracker.advance(markupLen)
      }
    } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
      tracker.advance(1)
    }

    if (token.markup && token.type !== 'code_inline' && token.type !== 'text') {
      tracker.advance(token.markup.length)
    }

    // Handle inline children
    if (token.children && token.children.length > 0) {
      const childrenAST = processTokens(token.children, customContentItems, tracker, mapOffset)

      if (token.type === 'inline') {
        const parentToken = tokens[i - 1]
        if (parentToken && parentToken.type === 'heading_open') {
          const level = parseInt(parentToken.tag.substring(1))
          ast.push({ type: 'heading', level, children: childrenAST })
        } else if (parentToken && parentToken.type === 'paragraph_open') {
          const isInListItem = stack.some(node => node.type === 'list_item')
          if (isInListItem && stack.length > 0) {
            const current = stack[stack.length - 1]
            if (!current.children) current.children = []
            current.children.push(...childrenAST)
          } else {
            ast.push({ type: 'paragraph', children: childrenAST })
          }
        } else if (parentToken && (parentToken.type === 'th_open' || parentToken.type === 'td_open')) {
          if (stack.length > 0) {
            const current = stack[stack.length - 1]
            if (!current.children) current.children = []
            current.children.push(...childrenAST)
          }
        } else if (stack.length > 0) {
          const current = stack[stack.length - 1]
          if (!current.children) current.children = []
          current.children.push(...childrenAST)
        }
      }
      continue
    }

    // Open/close tokens
    if (token.type.endsWith('_open')) {
      const node = tokenToASTNode(token, customContentItems)
      if (node && !Array.isArray(node)) stack.push(node)
    } else if (token.type.endsWith('_close')) {
      const isInListItem = stack.some(node => node.type === 'list_item')
      if (token.type === 'paragraph_close' && isInListItem) continue

      if (stack.length > 0) {
        const node = stack.pop()
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]
          if (!parent.children) parent.children = []
          parent.children.push(node)
        } else {
          ast.push(node)
        }
      }
    } else {
      const node = tokenToASTNode(token, customContentItems)
      if (node) {
        if (Array.isArray(node)) {
          if (stack.length > 0) {
            const parent = stack[stack.length - 1]
            if (!parent.children) parent.children = []
            parent.children.push(...node)
          } else {
            ast.push(...node)
          }
        } else {
          if (stack.length > 0) {
            const parent = stack[stack.length - 1]
            if (!parent.children) parent.children = []
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

// ── Extract special blocks ─────────────────────────────────

function extractSpecialBlocks(content: string): {
  processedContent: string
  extractedBlocks: ExtractedBlock[]
  mapProcessedToOriginal: (offset: number) => number
} {
  const extractedBlocks: ExtractedBlock[] = []
  const allMatches: { type: string; match: string; index: number; length: number; extra: Record<string, string> }[] = []

  const patterns: { regex: RegExp; type: string; getExtra: (m: RegExpExecArray) => Record<string, string> }[] = [
    { regex: /\[HIDDEN\]([\s\S]*?)\[\/HIDDEN\]/g, type: 'COLLAPSIBLEBLOCK', getExtra: m => ({ content: m[1].trim() }) },
    { regex: /```mermaid\n([\s\S]*?)```/g, type: 'MERMAIDBLOCK', getExtra: m => ({ code: m[1].trim() }) },
    { regex: /```(\w+)?\n([\s\S]*?)```/g, type: 'CODEBLOCK', getExtra: m => ({ language: m[1] || 'text', code: m[2].trim() }) },
    { regex: /\$\$([\s\S]+?)\$\$/g, type: 'MATHBLOCK', getExtra: m => ({ content: m[1].trim() }) },
    { regex: /\\\[([\s\S]+?)\\\]/g, type: 'MATHBLOCK', getExtra: m => ({ content: m[1].trim() }) },
    { regex: /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, type: 'MATHINLINE', getExtra: m => ({ content: m[1].trim() }) },
    { regex: /\\\((.+?)\\\)/g, type: 'MATHINLINE', getExtra: m => ({ content: m[1].trim() }) },
  ]

  for (const { regex, type, getExtra } of patterns) {
    let match: RegExpExecArray | null
    const re = new RegExp(regex.source, regex.flags)
    while ((match = re.exec(content)) !== null) {
      allMatches.push({ type, match: match[0], index: match.index, length: match[0].length, extra: getExtra(match) })
    }
  }

  allMatches.sort((a, b) => a.index - b.index)

  const filteredMatches: typeof allMatches = []
  for (const m of allMatches) {
    const overlaps = filteredMatches.some(existing =>
      m.index < existing.index + existing.length && m.index + m.length > existing.index
    )
    if (!overlaps) filteredMatches.push(m)
  }

  const replacements: Replacement[] = []
  let processedContent = ''
  let lastEnd = 0

  for (const m of filteredMatches) {
    processedContent += content.substring(lastEnd, m.index)
    const id = `${m.type}${extractedBlocks.length}PLACEHOLDER`
    const fullReplacement = m.type === 'MATHINLINE' ? id : `\n${id}\n`
    const processedStart = processedContent.length

    extractedBlocks.push({
      id,
      type: m.type.toLowerCase().replace('block', '_block').replace('inline', '_inline'),
      originalStart: m.index,
      originalEnd: m.index + m.length,
      ...m.extra,
    })

    replacements.push({
      originalStart: m.index,
      originalEnd: m.index + m.length,
      processedStart,
      processedEnd: processedStart + fullReplacement.length,
    })

    processedContent += fullReplacement
    lastEnd = m.index + m.length
  }

  processedContent += content.substring(lastEnd)

  const mapProcessedToOriginal = (processedOffset: number): number => {
    let shift = 0
    for (const r of replacements) {
      if (processedOffset < r.processedStart) return processedOffset + shift
      if (processedOffset >= r.processedStart && processedOffset < r.processedEnd) return r.originalStart
      shift += (r.originalEnd - r.originalStart) - (r.processedEnd - r.processedStart)
    }
    return processedOffset + shift
  }

  return { processedContent, extractedBlocks, mapProcessedToOriginal }
}

// ── Content/block helpers ────────────────────────────────

function contentItemOverlapsBlock(item: CustomContentItem, block: ExtractedBlock): boolean {
  if (block.originalStart === undefined || block.originalEnd === undefined) return false
  return item.startOffset < block.originalEnd && item.endOffset > block.originalStart
}

function filterItemsNotOverlappingBlocks(items: CustomContentItem[], blocks: ExtractedBlock[]): CustomContentItem[] {
  if (!items || items.length === 0) return []
  if (!blocks || blocks.length === 0) return items
  return items.filter(item => {
    for (const block of blocks) {
      if (contentItemOverlapsBlock(item, block)) return false
    }
    return true
  })
}

// ── Restore special blocks in AST ──────────────────────────

function restoreSpecialBlocksInAST(
  ast: ASTNodeType[],
  extractedBlocks: ExtractedBlock[],
  customContentItems: CustomContentItem[] = []
): ASTNodeType[] {
  return ast.flatMap(node => {
    if (node.type === 'text' && (node as TextNode).content) {
      let content = (node as TextNode).content
      let hasPlaceholder = false
      for (const block of extractedBlocks) {
        if (content.includes(block.id)) { hasPlaceholder = true; break }
      }
      if (!hasPlaceholder) return node

      const result: ASTNodeType[] = []
      let remaining = content

      while (remaining) {
        let foundBlock: ExtractedBlock | null = null
        let foundIndex = -1

        for (const block of extractedBlocks) {
          const idx = remaining.indexOf(block.id)
          if (idx !== -1 && (foundIndex === -1 || idx < foundIndex)) {
            foundIndex = idx
            foundBlock = block
          }
        }

        if (foundBlock === null) {
          if (remaining) {
            result.push({ type: 'text', content: remaining, startOffset: node.startOffset, endOffset: node.endOffset })
          }
          break
        }

        if (foundIndex > 0) {
          result.push({ type: 'text', content: remaining.substring(0, foundIndex), startOffset: node.startOffset, endOffset: node.endOffset })
        }

        const blockNode: Record<string, unknown> = {
          type: foundBlock.type,
          ...foundBlock,
          startOffset: foundBlock.originalStart,
          endOffset: foundBlock.originalEnd,
        }

        if (foundBlock.type === 'collapsible_block' && foundBlock.content) {
          const parsedInner = parseMarkdownToAST(foundBlock.content)
          blockNode.children = parsedInner.children
          delete blockNode.content
        }

        result.push(blockNode as ASTNodeType)
        remaining = remaining.substring(foundIndex + foundBlock.id.length)
      }

      return result
    }

    if (node.type === 'paragraph' && node.children) {
      const updatedChildren = restoreSpecialBlocksInAST(node.children, extractedBlocks, customContentItems)
      if (updatedChildren.length === 1 &&
          (updatedChildren[0].type === 'code_block' || updatedChildren[0].type === 'math_block' || updatedChildren[0].type === 'mermaid_block')) {
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

// ── Main export ────────────────────────────────────────────

export function parseMarkdownToAST(content: string, customContentItems: CustomContentItem[] = []): ASTTree {
  if (!content) return { type: 'root', children: [] }

  const { processedContent, extractedBlocks, mapProcessedToOriginal } = extractSpecialBlocks(content)
  const nonBlockItems = filterItemsNotOverlappingBlocks(customContentItems, extractedBlocks)
  const tracker = new PositionTracker(processedContent)

  const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: false,
    typographer: false,
  })

  const tokens = md.parse(processedContent, {})
  tracker.reset()
  let children = processTokens(tokens, nonBlockItems, tracker, mapProcessedToOriginal)
  children = restoreSpecialBlocksInAST(children, extractedBlocks, customContentItems)

  return { type: 'root', children }
}
