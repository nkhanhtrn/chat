export function useMessageParser() {
  const parseMessage = (content) => {
    if (!content) return []

    // Only use tag parsing if the message starts with <| (to avoid breaking code block parsing)
    if (content.trim().startsWith('<|')) {
      const tagPattern = /<\|([a-zA-Z]+)\|>([^<]*)/g
      let tagMatch
      let tagElements = []
      let lastIndex = 0
      while ((tagMatch = tagPattern.exec(content)) !== null) {
        // Add any text before the tag as normal parsed content
        if (tagMatch.index > lastIndex) {
          const before = content.slice(lastIndex, tagMatch.index)
          if (before.trim()) {
            tagElements.push(...parseInlineElementsWithoutEscaping(before))
          }
        }
        const tag = tagMatch[1]
        let value = tagMatch[2].trim()
        // For channel, check for 'to=final' or similar
        if (tag === 'channel') {
          // e.g. 'commentary to=final'
          const channelMatch = value.match(/^(\w+)(?:\s+to=(\w+))?/)
          tagElements.push({
            type: 'channel',
            value: channelMatch ? channelMatch[1] : value,
            to: channelMatch && channelMatch[2] ? channelMatch[2] : undefined
          })
        } else if (tag === 'constrain') {
          tagElements.push({ type: 'constrain', value })
        } else if (tag === 'message') {
          tagElements.push({ type: 'message', value })
        } else if (tag === 'commentary') {
          tagElements.push({ type: 'commentary', value })
        } else {
          // Unknown tag, just add as plain
          tagElements.push({ type: 'tag', tag, value })
        }
        lastIndex = tagPattern.lastIndex
      }
      // Add any trailing text after the last tag
      if (lastIndex < content.length) {
        const after = content.slice(lastIndex)
        if (after.trim()) {
          tagElements.push(...parseInlineElementsWithoutEscaping(after))
        }
      }
      // If we found any tag elements, return them directly
      if (tagElements.length > 0) return tagElements
    }

    // Fallback to original logic if no tags found or message doesn't start with <|
    const elements = []
    let currentPosition = 0

    // Parse code and math blocks FIRST (before escaping HTML)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const mathBlockRegex = /\\\[([\s\S]*?)\\\]/g
    let match, mathMatches = [];

    // Find all code blocks
    let codeMatches = [];
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeMatches.push({
        type: 'codeblock',
        start: match.index,
        end: match.index + match[0].length,
        language: match[1] || 'plaintext',
        code: match[2].trim()
      });
    }

    // Find all math blocks
    while ((match = mathBlockRegex.exec(content)) !== null) {
      mathMatches.push({
        type: 'mathblock',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1].trim()
      });
    }

    // Merge and sort all blocks by start index
    let allBlocks = [...codeMatches, ...mathMatches].sort((a, b) => a.start - b.start);

    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      // Add text before block
      if (block.start > currentPosition) {
        const textBefore = content.slice(currentPosition, block.start);
        elements.push(...parseInlineElementsWithoutEscaping(textBefore));
      }
      if (block.type === 'codeblock') {
        elements.push({
          type: 'codeblock',
          language: block.language,
          code: block.code
        });
      } else if (block.type === 'mathblock') {
        elements.push({
          type: 'mathblock',
          content: block.content
        });
      }
      currentPosition = block.end;
    }

    // Add remaining text (parse inline elements WITHOUT HTML escaping yet)
    if (currentPosition < content.length) {
      const remainingText = content.slice(currentPosition);
      elements.push(...parseInlineElementsWithoutEscaping(remainingText));
    }

    return elements;
  }
  
  const escapeHtmlExceptCode = (text) => {
    // Extract inline code blocks and URLs to preserve them
    const parts = []
    let currentPos = 0
    const codeRegex = /`([^`]+)`/g
    const urlRegex = /(https?:\/\/[^\s]+)/g
    
    // Combine both patterns to find all matches
    const allMatches = []
    let match
    
    // Find code matches
    while ((match = codeRegex.exec(text)) !== null) {
      allMatches.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      })
    }
    
    // Find URL matches
    while ((match = urlRegex.exec(text)) !== null) {
      allMatches.push({
        type: 'url',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      })
    }
    
    // Sort by position
    allMatches.sort((a, b) => a.start - b.start)
    
    // Build result by escaping only the text between matches
    allMatches.forEach(item => {
      // Add escaped text before this match
      if (item.start > currentPos) {
        parts.push(escapeHtml(text.slice(currentPos, item.start)))
      }
      // Add the match itself unescaped
      parts.push(item.text)
      currentPos = item.end
    })
    
    // Add remaining escaped text
    if (currentPos < text.length) {
      parts.push(escapeHtml(text.slice(currentPos)))
    }
    
    return parts.join('')
  }
  
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  
  const parseInlineElementsWithoutEscaping = (text) => {
    const elements = []
    const lines = text.split('\n')
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
      // Check for blockquote (lines starting with >)
      if (/^>\s?/.test(line)) {
        const blockquoteResult = parseBlockquote(lines, i)
        elements.push(blockquoteResult.element)
        i = blockquoteResult.nextIndex
        // Add line break after blockquote if not last element
        if (i < lines.length) {
          elements.push({ type: 'linebreak' })
        }
        continue
      }
      
      // Check for horizontal rule (---, ***, or ___) 
      if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
        elements.push({
          type: 'hr'
        })
        i++
        continue
      }
      
      // Check if this line starts a table
      if (i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const tableResult = parseTable(lines, i)
        if (tableResult) {
          elements.push(tableResult.element)
          i = tableResult.nextIndex
          continue
        }
      }
      
      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        elements.push({
          type: 'header',
          level: headerMatch[1].length,
          content: parseTextFormattingWithEscaping(headerMatch[2])
        })
        // Add line break after headers if not last line
        if (i < lines.length - 1) {
          elements.push({ type: 'linebreak' })
        }
      } else if (line.trim()) {
        elements.push({
          type: 'text',
          content: parseTextFormattingWithEscaping(line)
        })
        // Add line break after text if not last line
        if (i < lines.length - 1) {
          elements.push({ type: 'linebreak' })
        }
      }
      
      i++
    }
    
    return elements
  }
  
  const parseInlineElements = (text) => {
    const elements = []
    const lines = text.split('\n')
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
      // Check for blockquote (lines starting with >, with or without space)
      if (/^>\s?/.test(line)) {
        const blockquoteResult = parseBlockquote(lines, i)
        elements.push(blockquoteResult.element)
        i = blockquoteResult.nextIndex
        // Add line break after blockquote if not last element
        if (i < lines.length) {
          elements.push({ type: 'linebreak' })
        }
        continue
      }
      
      // Check for horizontal rule (---, ***, or ___)
      if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
        elements.push({
          type: 'hr'
        })
        i++
        continue
      }
      
      // Check if this line starts a table
      if (i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const tableResult = parseTable(lines, i)
        if (tableResult) {
          elements.push(tableResult.element)
          i = tableResult.nextIndex
          continue
        }
      }
      
      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        elements.push({
          type: 'header',
          level: headerMatch[1].length,
          content: parseTextFormatting(headerMatch[2])
        })
        // Add line break after headers if not last line
        if (i < lines.length - 1) {
          elements.push({ type: 'linebreak' })
        }
      } else if (line.trim()) {
        elements.push({
          type: 'text',
          content: parseTextFormatting(line)
        })
        // Add line break after text if not last line
        if (i < lines.length - 1) {
          elements.push({ type: 'linebreak' })
        }
      }
      
      i++
    }
    
    return elements
  }
  
  const isTableSeparator = (line) => {
    // Table separator line like: | --- | --- | or | :--- | :---: | ---: |
    return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line)
  }
  
  const parseBlockquote = (lines, startIndex) => {
    const blockquoteLines = []
    let i = startIndex
    
    // Collect all consecutive lines that start with >
    while (i < lines.length && /^>/.test(lines[i])) {
      // Remove the > prefix and any following space
      const content = lines[i].replace(/^>\s?/, '')
      if (content.trim()) {
        blockquoteLines.push(content)
      }
      i++
    }
    
    // Join lines and parse formatting with HTML escaping
    const blockquoteText = blockquoteLines.join(' ')
    
    return {
      element: {
        type: 'blockquote',
        content: parseTextFormattingWithEscaping(blockquoteText)
      },
      nextIndex: i
    }
  }
  
  const parseTable = (lines, startIndex) => {
    const headerLine = lines[startIndex]
    const separatorLine = lines[startIndex + 1]
    
    // Parse header with formatting
    const headers = headerLine.split('|')
      .map(h => h.trim())
      .filter(h => h.length > 0)
      .map(h => parseTextFormattingWithEscaping(h))
    
    if (headers.length === 0) return null
    
    // Parse alignments from separator
    const alignments = separatorLine.split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => {
        if (s.startsWith(':') && s.endsWith(':')) return 'center'
        if (s.endsWith(':')) return 'right'
        return 'left'
      })
    
    // Parse rows with formatting
    const rows = []
    let i = startIndex + 2
    
    while (i < lines.length) {
      const line = lines[i]
      // Stop if we hit an empty line or non-table line
      if (!line.trim() || !line.includes('|')) break
      
      const cells = line.split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .map(c => parseTextFormattingWithEscaping(c))
      
      if (cells.length > 0) {
        rows.push(cells)
      }
      i++
    }
    
    return {
      element: {
        type: 'table',
        headers,
        rows,
        alignments
      },
      nextIndex: i
    }
  }
  
  const parseTextFormatting = (text) => {
    const parts = []
    let currentPosition = 0

    // Regular expressions for inline formatting, including inline math
    const patterns = [
      { type: 'mathinline', regex: /\\\((.+?)\\\)/g },
      { type: 'code', regex: /`([^`]+)`/g },
      { type: 'link', regex: /(https?:\/\/[^\s]+)/g },
      { type: 'bold', regex: /\*\*([^*]+)\*\*/g },
      { type: 'italic', regex: /\*([^*]+)\*/g }
    ]

    // Find all matches
    const allMatches = []
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.regex.exec(text)) !== null) {
        allMatches.push({
          type: pattern.type,
          start: match.index,
          end: match.index + match[0].length,
          content: match[1]
        })
      }
    })
    
    // Sort matches by position and filter overlapping
    allMatches.sort((a, b) => a.start - b.start)
    const validMatches = []
    let lastEnd = 0
    
    allMatches.forEach(match => {
      if (match.start >= lastEnd) {
        validMatches.push(match)
        lastEnd = match.end
      }
    })
    
    // Build formatted parts
    validMatches.forEach(match => {
      // Add text before match
      if (match.start > currentPosition) {
        parts.push({
          type: 'plain',
          text: text.slice(currentPosition, match.start)
        })
      }
      
      // Add formatted part
      if (match.type === 'mathinline') {
        parts.push({
          type: 'mathinline',
          content: match.content
        })
      } else {
        parts.push({
          type: match.type,
          text: match.content
        })
      }
      
      currentPosition = match.end
    })
    
    // Add remaining text
    if (currentPosition < text.length) {
      parts.push({
        type: 'plain',
        text: text.slice(currentPosition)
      })
    }
    
    return parts.length > 0 ? parts : [{ type: 'plain', text }]
  }
  
  const parseTextFormattingWithEscaping = (text) => {
    const parts = []
    let currentPosition = 0

    // Regular expressions for inline formatting, including inline math
    const patterns = [
      { type: 'mathinline', regex: /\\\((.+?)\\\)/g },
      { type: 'code', regex: /`([^`]+)`/g },
      { type: 'link', regex: /(https?:\/\/[^\s]+)/g },
      { type: 'bold', regex: /\*\*([^*]+)\*\*/g },
      { type: 'italic', regex: /\*([^*]+)\*/g }
    ]
    
    // Find all matches
    const allMatches = []
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.regex.exec(text)) !== null) {
        allMatches.push({
          type: pattern.type,
          start: match.index,
          end: match.index + match[0].length,
          content: match[1]
        })
      }
    })
    
    // Sort matches by position and filter overlapping
    allMatches.sort((a, b) => a.start - b.start)
    const validMatches = []
    let lastEnd = 0
    
    allMatches.forEach(match => {
      if (match.start >= lastEnd) {
        validMatches.push(match)
        lastEnd = match.end
      }
    })
    
    // Build formatted parts with HTML escaping for plain text
    validMatches.forEach(match => {
      // Add text before match (escaped)
      if (match.start > currentPosition) {
        parts.push({
          type: 'plain',
          text: escapeHtml(text.slice(currentPosition, match.start))
        })
      }

      // Add formatted part - escape HTML in code/link content too for safety
      // but DON'T escape URLs themselves
      if (match.type === 'mathinline') {
        parts.push({
          type: 'mathinline',
          content: match.content
        })
      } else if (match.type === 'link') {
        parts.push({
          type: match.type,
          text: match.content // URLs are not escaped
        })
      } else {
        parts.push({
          type: match.type,
          text: match.type === 'code' ? match.content : escapeHtml(match.content)
        })
      }

      currentPosition = match.end
    })
    
    // Add remaining text (escaped)
    if (currentPosition < text.length) {
      parts.push({
        type: 'plain',
        text: escapeHtml(text.slice(currentPosition))
      })
    }
    
    return parts.length > 0 ? parts : [{ type: 'plain', text: escapeHtml(text) }]
  }
  
  return {
    parseMessage,
    parseTextFormattingWithEscaping,
    escapeHtml,
    escapeHtmlExceptCode,
    parseInlineElementsWithoutEscaping,
    parseInlineElements,
    isTableSeparator,
    parseBlockquote,
    parseTable,
    parseTextFormatting
  }
}
