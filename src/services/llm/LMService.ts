import type { LLMMessage } from '@/types/llm'
import { openCodeProvider } from './providers/opencode'
import { zenProvider } from './providers/zen'

const ZEN_SESSION_ID = 'zen'

class LMService {
  private localDown = false

  private _markLocalDown(): void {
    this.localDown = true
  }

  async ensureSession(messageId: string, existingSessionId?: string | null, title?: string): Promise<string> {
    if (existingSessionId) return existingSessionId
    if (this.localDown && zenProvider.isConfigured()) return ZEN_SESSION_ID
    try {
      return await openCodeProvider.createSession(title)
    } catch {
      this._markLocalDown()
      if (zenProvider.isConfigured()) return ZEN_SESSION_ID
      throw new Error('OpenCode server is unavailable and no Zen API key is configured')
    }
  }

  async chat(
    sessionId: string,
    messages: LLMMessage[],
    onChunk: ((chunk: string) => void) | null = null,
    signal?: AbortSignal
  ): Promise<string | null> {
    const text = buildPromptText(messages)

    if (sessionId === ZEN_SESSION_ID) {
      return this._chatZen(text, onChunk, signal)
    }

    if (this.localDown && zenProvider.isConfigured()) {
      return this._chatZen(text, onChunk, signal)
    }

    if (onChunk) {
      let streamedAny = false
      const wrap = (chunk: string) => { streamedAny = true; onChunk(chunk) }
      try {
        let fullContent = ''
        for await (const chunk of openCodeProvider.sendStream(sessionId, text, signal)) {
          fullContent += chunk
          wrap(chunk)
        }
        return fullContent
      } catch (err) {
        if (signal?.aborted || streamedAny || !zenProvider.isConfigured()) throw err
        this._markLocalDown()
        return this._chatZen(text, onChunk, signal)
      }
    }

    try {
      return await openCodeProvider.send(sessionId, text)
    } catch (err) {
      if (signal?.aborted || !zenProvider.isConfigured()) throw err
      this._markLocalDown()
      return this._chatZen(text, null, signal)
    }
  }

  private async _chatZen(
    text: string,
    onChunk: ((chunk: string) => void) | null,
    signal?: AbortSignal
  ): Promise<string | null> {
    if (onChunk) {
      let fullContent = ''
      for await (const chunk of zenProvider.sendStream(text, signal)) {
        fullContent += chunk
        onChunk(chunk)
      }
      return fullContent
    }
    return zenProvider.send(text, signal)
  }

  async ephemeralChat(
    messages: LLMMessage[],
    onChunk: ((chunk: string) => void) | null = null,
    signal?: AbortSignal
  ): Promise<string | null> {
    const sessionId = await this.ensureSession('ephemeral')
    try {
      return await this.chat(sessionId, messages, onChunk, signal)
    } finally {
      if (sessionId !== ZEN_SESSION_ID) openCodeProvider.deleteSession(sessionId)
    }
  }

  invalidateClient(): void {
    openCodeProvider.invalidateClient()
    this.localDown = false
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
