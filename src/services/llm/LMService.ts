import type { LLMMessage } from '@/types/llm'
import { openCodeProvider } from './providers/opencode'

class LMService {
  async ensureSession(messageId: string, existingSessionId?: string | null, title?: string): Promise<string> {
    if (existingSessionId) return existingSessionId
    return openCodeProvider.createSession(title)
  }

  async chat(
    sessionId: string,
    messages: LLMMessage[],
    onChunk: ((chunk: string) => void) | null = null,
    signal?: AbortSignal
  ): Promise<string | null> {
    const text = buildPromptText(messages)

    if (onChunk) {
      let fullContent = ''
      for await (const chunk of openCodeProvider.sendStream(sessionId, text, signal)) {
        fullContent += chunk
        onChunk(chunk)
      }
      return fullContent
    }

    return openCodeProvider.send(sessionId, text)
  }

  async ephemeralChat(
    messages: LLMMessage[],
    onChunk: ((chunk: string) => void) | null = null,
    signal?: AbortSignal
  ): Promise<string | null> {
    const sessionId = await openCodeProvider.createSession()
    try {
      return await this.chat(sessionId, messages, onChunk, signal)
    } finally {
      openCodeProvider.deleteSession(sessionId)
    }
  }

  invalidateClient(): void {
    openCodeProvider.invalidateClient()
  }
}

function buildPromptText(messages: LLMMessage[]): string {
  const parts: string[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      parts.push(`[System]: ${m.content}`)
    } else if (m.role === 'user') {
      parts.push(m.content)
    } else if (m.role === 'assistant') {
      parts.push(`[Previous response]: ${m.content}`)
    }
  }
  return parts.join('\n\n')
}

export const lmService = new LMService()
export default lmService
