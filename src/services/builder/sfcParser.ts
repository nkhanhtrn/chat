export interface ParsedTool {
  code: string
  name: string
  emoji: string | null
  textBeforeCode: string
}

export function parseToolFromResponse(response: string): ParsedTool | null {
  if (!response.includes('<template>')) return null

  let textBeforeCode = ''
  const templateStart = response.indexOf('<template>')
  if (templateStart > 0) {
    textBeforeCode = response.substring(0, templateStart).trim()
    if (textBeforeCode.startsWith('<!-- @tool:')) {
      textBeforeCode = ''
    }
  }

  let code = response.trim()

  if (code.startsWith('```')) {
    code = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
  }

  let name: string | null = null
  let emoji: string | null = null
  const toolMatch = code.match(/<!--\s*@tool:\s*(.+?)\s*-->/)
  if (toolMatch) {
    const toolInfo = toolMatch[1].trim()
    const emojiMatch = toolInfo.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u)
    if (emojiMatch) {
      emoji = emojiMatch[0]
      name = toolInfo.slice(0, -emoji.length).trim()
    } else {
      name = toolInfo
    }
  }

  const start = code.indexOf('<template>')
  const endStyle = code.lastIndexOf('</style>')
  const endScript = code.lastIndexOf('</script>')
  const end = endStyle !== -1 ? endStyle + 8 : endScript + 9

  if (start !== -1 && end > start) {
    code = code.substring(start, end)
  }

  if (!code.includes('<template>')) {
    return null
  }

  code = code.replace(/:root\s*\{[^}]*\}/g, '')

  if (!name) {
    name = extractComponentName(code)
  }

  return {
    code,
    name: name || 'Tool',
    emoji,
    textBeforeCode,
  }
}

function extractComponentName(code: string): string {
  const nameMatch = code.match(/name\s*:\s*['"]([^'"]+)['"]/)
  if (nameMatch) return nameMatch[1]

  const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim().substring(0, 30)

  const titleMatch = code.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i) ||
                     code.match(/<[^>]+title[^>]*>([^<]+)</i)
  if (titleMatch) return titleMatch[1].trim().substring(0, 30)

  return 'Tool'
}


