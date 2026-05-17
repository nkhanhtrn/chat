import type { LLMMessage } from '@/types/llm'

class LMService {
  async chat(
    _sessionId: string,
    _messages: LLMMessage[],
    _onChunk?: ((chunk: string) => void) | null,
    _signal?: AbortSignal
  ): Promise<string | null> {
    throw new Error('LLM service not configured. Please configure an LLM provider in settings.')
  }

  async ephemeralChat(
    _messages: LLMMessage[],
    _onChunk?: ((chunk: string) => void) | null,
    _signal?: AbortSignal
  ): Promise<string | null> {
    throw new Error('LLM service not configured. Please configure an LLM provider in settings.')
  }

  invalidateClient(): void {}
}

export const lmService = new LMService()
export { LMService }
export default lmService
