import type { ProviderCategory, LLMMessage } from '@/types/llm'
import type { ProviderBase } from './ProviderBase'
import { cerebrasProvider } from './providers/cerebras'
import { googleProvider } from './providers/google'
import { lmstudioProvider } from './providers/lmstudio'
import { codeApiProvider } from './providers/codeapi'
import { mockE2EProvider } from './providers/mockE2E'

export const Category: Record<string, ProviderCategory> = {
  FREE: 'free',
  QUICK: 'quick',
  DETAILS: 'details',
  REASONING: 'reasoning'
}

class LMService {
  private _providers = new Map<string, ProviderBase>()

  constructor() {
    this.register(lmstudioProvider)
    this.register(cerebrasProvider)
    this.register(googleProvider)
    this.register(codeApiProvider)
    this.register(mockE2EProvider)
  }

  register(provider: ProviderBase): void {
    this._providers.set(provider.id, provider)
  }

  getProvider(providerId: string): ProviderBase {
    const provider = this._providers.get(providerId)
    if (!provider) throw new Error(`Unknown provider: ${providerId}`)
    return provider
  }

  getProviderByCategory(category: ProviderCategory): ProviderBase {
    const isE2E = typeof window !== 'undefined' && localStorage.getItem('__e2e__') === 'true'
    if (isE2E) return mockE2EProvider

    const isDev = import.meta.env.DEV
    const usePublicAI = (window as any).__devUsePublicAI

    if (isDev && !usePublicAI && category !== 'reasoning') {
      for (const provider of this._providers.values()) {
        if (provider.category === 'free') return provider
      }
    }

    for (const provider of this._providers.values()) {
      if (provider.category === category) return provider
    }
    throw new Error(`No provider found for category: ${category}`)
  }

  getFreeProvider(): ProviderBase { return this.getProviderByCategory('free') }
  getQuickProvider(): ProviderBase { return this.getProviderByCategory('quick') }
  getDetailsProvider(): ProviderBase { return this.getProviderByCategory('details') }
  getReasoningProvider(): ProviderBase { return this.getProviderByCategory('reasoning') }
  getDefaultProviderId(): string { return 'lmstudio' }

  listProviders(): Array<{ id: string; name: string; category: string; requiresApiKey: boolean; supportsStreaming: boolean }> {
    return Array.from(this._providers.values()).map(p => ({
      id: p.id, name: p.name, category: p.category,
      requiresApiKey: p.requiresApiKey, supportsStreaming: p.supportsStreaming
    }))
  }

  async send(providerId: string, messages: LLMMessage[]) {
    return this.getProvider(providerId).send(messages)
  }

  async sendStream(providerId: string, messages: LLMMessage[], onChunk?: ((chunk: string) => void) | null): Promise<string> {
    const provider = this.getProvider(providerId)
    if (!provider.supportsStreaming) {
      const result = await provider.send(messages)
      return result.content
    }
    let fullContent = ''
    for await (const chunk of provider.sendStream(messages)) {
      fullContent += chunk
      onChunk?.(chunk)
    }
    return fullContent
  }

  async sendByCategory(category: ProviderCategory, messages: LLMMessage[], onChunk: ((chunk: string) => void) | null = null): Promise<string | null> {
    const provider = this.getProviderByCategory(category)
    if (onChunk && provider.supportsStreaming) {
      return await this.sendStream(provider.id, messages, onChunk)
    }
    const result = await this.send(provider.id, messages)
    const content = result?.content ?? null
    if (onChunk && content) onChunk(content)
    return content
  }
}

export const lmService = new LMService()
export { LMService }
export default lmService
