/**
 * Abstract base class for all LLM providers
 *
 * Provides `getResolvedConfig()` to eliminate repeated config boilerplate
 * in every provider method.
 */

import type { ProviderCategory, LLMMessage, ProviderConfig, SendMessageResult } from '@/types/llm'
import { Settings } from '@/services/settings'

export abstract class ProviderBase {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly category: ProviderCategory
  abstract readonly requiresApiKey: boolean
  abstract readonly supportsStreaming: boolean
  abstract readonly defaultBaseUrl: string

  abstract getDefaultModel(): string
  abstract send(messages: LLMMessage[]): Promise<SendMessageResult>
  abstract sendStream(messages: LLMMessage[]): AsyncIterable<string>
  abstract listModels(): Promise<Array<{ id: string; name: string }>>

  /** Get the model ID for this provider from Settings */
  getModelId(): string {
    const settings = Settings.getAll() as Record<string, any>
    return settings.currentModels?.[this.id] ?? this.getDefaultModel()
  }

  /** Get resolved config: merges provider-specific settings from Settings */
  getResolvedConfig(): ProviderConfig {
    const settings = Settings.getAll() as Record<string, any>
    return settings.providerConfigs?.[this.id] ?? {}
  }
}
