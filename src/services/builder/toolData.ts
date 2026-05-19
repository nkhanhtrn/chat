import { createToolPersistence } from '@/services/builder/toolPersistence'
import type { ProjectWindow } from '@/types/project'

export interface ToolDataMarker {
  toolName: string
  data: Record<string, unknown>
}

const TOOL_STATE_PREFIX = 'tool-state-'

export function getToolState(dataKey: string, windowId: string): Record<string, unknown> {
  const raw = localStorage.getItem(`${TOOL_STATE_PREFIX}${dataKey}-${windowId}`)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export function buildToolDataContext(dataKey: string, windows: ProjectWindow[]): string {
  const toolsWithData = windows
    .filter(w => w.type === 'tool' && w.code && w.displayState !== 'closed')
    .map(w => {
      const state = getToolState(dataKey, w.id)
      const keys = Object.keys(state)
      if (keys.length === 0) return null
      return {
        name: w.title,
        state,
      }
    })
    .filter(Boolean)

  if (toolsWithData.length === 0) return ''

  const lines = toolsWithData.map(t => {
    const entries = Object.entries(t!.state)
      .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
      .join('\n')
    return `- **${t!.name}**:\n${entries}`
  })

  return `\n\nCURRENT TOOL DATA (live state of each tool):\n${lines.join('\n')}\nYou can read this data and update it using @data markers.`
}

const DATA_MARKER_RE = /<!--\s*@data:\s*(.+?)\s*-->\s*\n([\s\S]*?)(?=<!--\s*@|$)/g

function extractJSONObject(str: string): string | null {
  const trimmed = str.trim()
  if (trimmed.startsWith('{')) {
    let depth = 0
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++
      else if (trimmed[i] === '}') {
        depth--
        if (depth === 0) return trimmed.slice(0, i + 1)
      }
    }
  }
  return null
}

export function parseToolDataFromResponse(response: string): ToolDataMarker[] {
  const markers: ToolDataMarker[] = []
  let match: RegExpExecArray | null

  const re = new RegExp(DATA_MARKER_RE.source, 'g')
  while ((match = re.exec(response)) !== null) {
    const toolName = match[1].trim()
    const rawData = match[2].trim()

    const codeFenceMatch = rawData.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    const jsonStr = codeFenceMatch
      ? codeFenceMatch[1].trim()
      : extractJSONObject(rawData) ?? rawData

    try {
      const data = JSON.parse(jsonStr)
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        markers.push({ toolName, data })
      }
    } catch { /* skip invalid */ }
  }

  return markers
}

export function writeToolData(dataKey: string, windowId: string, data: Record<string, unknown>): void {
  const persist = createToolPersistence(dataKey, windowId)
  persist.update(data)

  window.dispatchEvent(new CustomEvent('tool-data-updated', {
    detail: { dataKey, windowId, data },
  }))
}

export function findWindowByToolName(windows: ProjectWindow[], name: string): ProjectWindow | undefined {
  const normalized = name.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim()
  return windows.find(w => {
    if (w.type !== 'tool' || !w.title || w.displayState === 'closed') return false
    const t = w.title.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim()
    return t === normalized || w.title === name || w.title.includes(name)
  })
}

export function stripDataMarkers(response: string): string {
  return response.replace(/<!--\s*@data:\s*(.+?)\s*-->\s*\n[\s\S]*?(?=<!--\s*@|$)/g, '').trim()
}
