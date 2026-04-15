/** Description of a capability for the task router */
export interface CapabilityDescription {
  name: string
  description: string
  conditions: string[]
  antiConditions?: string[]
  outputSchema?: Record<string, unknown>
  examples: Array<{ input: string; output: Record<string, unknown> }>
}

/** Result from executing a capability */
export interface ProcessResult {
  success: boolean
  result: unknown
  error: string | null
  metadata: Record<string, unknown>
  pipe?: PipeData
  chainTo?: string | null
}

/** Standard pipe data format for capability chaining */
export interface PipeData {
  data: unknown
  source: string
}

/** Context passed to capability execution */
export interface CapabilityContext {
  analysis: Record<string, unknown>
  userMessage: string
  attachments?: unknown[]
  webSearchResults?: unknown[]
  [key: string]: unknown
}

/** Formatted output from a capability */
export interface CapabilityOutput {
  type: string
  content: unknown
  displayHint: string
}
