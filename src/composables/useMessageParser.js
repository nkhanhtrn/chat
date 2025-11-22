export function useMessageParser() {
  const parseMessage = (content) => {
    if (!content) return []
    
    const elements = []
    let currentPosition = 0
    
    // Parse code blocks FIRST (before escaping HTML)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block (with HTML escaping)
      if (match.index > currentPosition) {
        const textBefore = content.slice(currentPosition, match.index)
        elements.push(...parseInlineElements(escapeHtml(textBefore)))
      }
      
      // Add code block (WITHOUT HTML escaping)
      elements.push({
        type: 'codeblock',
        language: match[1] || 'plaintext',
        code: match[2].trim()
      })
      
      currentPosition = match.index + match[0].length
    }
    
    // Add remaining text (with HTML escaping)
    if (currentPosition < content.length) {
      const remainingText = content.slice(currentPosition)
      elements.push(...parseInlineElements(escapeHtml(remainingText)))
    }
    
    return elements
  }
  
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  
  const parseInlineElements = (text) => {
    const elements = []
    let currentText = text
    
    // Split by newlines to handle headers
    const lines = currentText.split('\n')
    
    lines.forEach((line, index) => {
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
      if (index < lines.length - 1) {
        elements.push({ type: 'linebreak' })
      }
    })
    
    return elements
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
