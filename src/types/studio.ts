/** A Studio session (metadata) */
export interface StudioSession {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

/** Chat message in a Studio session */
export interface StudioChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  attachments?: StudioAttachment[]
}

/** Attachment in a studio message */
export interface StudioAttachment {
  type: 'image' | 'code' | 'text'
  name: string
  content: string
}

/** Canvas window position and size */
export interface CanvasWindow {
  id: string
  sessionId: string
  title: string
  type: string
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  zIndex: number
  toolInstanceId?: string
  data?: unknown
}

/** Tool instance (runtime) */
export interface ToolInstance {
  id: string
  sessionId: string
  type: string
  code: string
  compiledCode?: string
  state?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/** Session data for persistence */
export interface StudioSessionData {
  session: StudioSession
  messages: StudioChatMessage[]
}
