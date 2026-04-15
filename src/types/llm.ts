/** Provider categories */
export type ProviderCategory = 'free' | 'quick' | 'details' | 'reasoning'

/** LLM message format for API calls */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  fullContent?: string
}

/** Model info from a provider */
export interface ModelInfo {
  id: string
  name: string
  providerId?: string
}

/** Provider configuration from Settings */
export interface ProviderConfig {
  apiKey?: string
  apiKeys?: string[]
  baseUrl?: string
  codeApiUrl?: string
  model?: string
}

/** Token usage from an API response */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Result from sending a message */
export interface SendMessageResult {
  content: string
  usage?: TokenUsage | null
}

/** Options for send operations */
export interface SendMessageOptions {
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
  onUsage?: (usage: TokenUsage) => void
}

/** Provider metadata */
export interface ProviderInfo {
  id: string
  name: string
  category: ProviderCategory
  requiresApiKey: boolean
  supportsStreaming: boolean
  defaultBaseUrl?: string
}

/** Analysis result from task router */
export interface TaskAnalysis {
  capability: string
  taskDescription: string
  searchQuery?: string
  inputs?: unknown[]
  expectedOutput?: string
  steps?: TaskAnalysisStep[]
}

/** A step in a multi-step plan */
export interface TaskAnalysisStep {
  step: number
  capability: string
  task: string
}

/** Current model selection per provider */
export type CurrentModels = Record<string, string>

/** Provider configs per provider */
export type ProviderConfigs = Record<string, ProviderConfig>
