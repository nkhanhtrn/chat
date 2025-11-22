export function useMessageParser() {
  const parseMessage = (content) => {
    if (!content) return []
    
    const elements = []
    let currentPosition = 0
    
    // Parse code blocks FIRST (before escaping HTML)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block (with selective HTML escaping)
      if (match.index > currentPosition) {
        const textBefore = content.slice(currentPosition, match.index)
        elements.push(...parseInlineElements(escapeHtmlExceptCode(textBefore)))
      }
      
      // Add code block (WITHOUT HTML escaping)
      elements.push({
        type: 'codeblock',
        language: match[1] || 'plaintext',
        code: match[2].trim()
      })
      
      currentPosition = match.index + match[0].length
    }
    
    // Add remaining text (with selective HTML escaping)
    if (currentPosition < content.length) {
      const remainingText = content.slice(currentPosition)
      elements.push(...parseInlineElements(escapeHtmlExceptCode(remainingText)))
    }
    
    return elements
  }
  
  const escapeHtmlExceptCode = (text) => {
    // Extract inline code blocks to preserve them
    const parts = []
    let currentPos = 0
    const codeRegex = /`([^`]+)`/g
    let match
    
    while ((match = codeRegex.exec(text)) !== null) {
      // Add escaped text before code
      if (match.index > currentPos) {
        parts.push(escapeHtml(text.slice(currentPos, match.index)))
      }
      // Add code with backticks (unescaped)
      parts.push('`' + match[1] + '`')
      currentPos = match.index + match[0].length
    }
    
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
  
  const parseInlineElements = (text) => {
    const elements = []
    const lines = text.split('\n')
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
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
      } else if (line.trim()) {
        elements.push({
          type: 'text',
          content: parseTextFormatting(line)
        })
      }
      
      // Add line break if not last line
      if (i < lines.length - 1) {
        elements.push({ type: 'linebreak' })
      }
      
      i++
    }
    
    return elements
  }
  
  const isTableSeparator = (line) => {
    // Table separator line like: | --- | --- | or | :--- | :---: | ---: |
    return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line)
  }
  
  const parseTable = (lines, startIndex) => {
    const headerLine = lines[startIndex]
    const separatorLine = lines[startIndex + 1]
    
    // Parse header with formatting
    const headers = headerLine.split('|')
      .map(h => h.trim())
      .filter(h => h.length > 0)
      .map(h => parseTextFormatting(h))
    
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
        .map(c => parseTextFormatting(c))
      
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
    
    // Regular expressions for inline formatting
    const patterns = [
      { type: 'code', regex: /`([^`]+)`/g },
      { type: 'bold', regex: /\*\*([^*]+)\*\*/g },
      { type: 'italic', regex: /\*([^*]+)\*/g }
    ]
    
    // Find all matches
    const allMatches = []
    patterns.forEach(pattern => {
      let match
      const regex = new RegExp(pattern.regex)
      while ((match = regex.exec(text)) !== null) {
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
      parts.push({
        type: match.type,
        text: match.content
      })
      
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
  
  return {
    parseMessage
  }
}
