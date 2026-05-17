export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  fullContent?: string
}

export interface SendMessageResult {
  content: string
  usage?: Record<string, unknown> | null
}

export type CurrentModels = Record<string, string>
export type ProviderConfigs = Record<string, unknown>
