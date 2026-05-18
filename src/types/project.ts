export interface SubProject {
  id: string
  name: string
  createdAt: number
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  subprojects: SubProject[]
  activeSubprojectId: string
  closedSubprojectIds?: string[]
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

export interface ProjectMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isError?: boolean
  webSearchResults?: WebSearchResult[]
  targetToolName?: string
}

export type WindowDisplayState = 'open' | 'minimized' | 'closed'

export type WindowType = 'chart' | 'mermaid' | 'svg' | 'tool' | 'codeResult' | 'text' | 'code' | 'html'

export interface ProjectWindow {
  id: string
  sessionId: string
  title: string
  type: WindowType
  displayState: WindowDisplayState
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
  content?: Record<string, unknown>
  code?: string
  previousCode?: string
  isReverted?: boolean
  toolInstanceId?: string
  templateId?: string
}
