export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messageCount: number
  windowCount: number
}

export interface ProjectMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isError?: boolean
}

export type WindowDisplayState = 'open' | 'minimized' | 'closed'

export type WindowType = 'chart' | 'mermaid' | 'svg' | 'tool' | 'codeResult' | 'text'

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
  toolInstanceId?: string
}
