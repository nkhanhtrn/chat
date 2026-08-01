import { defineStore } from 'pinia'
import lmService from '@/services/llm/LMService'
import type { LLMMessage } from '@/types/llm'

function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?>[\s\S]*$/gi, '')
}

export interface SideChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'side-chat'

interface PersistedChat {
  messages: SideChatMessage[]
  sessionId: string | null
}

function loadPersistedChat(): PersistedChat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [], sessionId: null }
    const parsed = JSON.parse(raw)
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages as SideChatMessage[] : [],
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
    }
  } catch {
    return { messages: [], sessionId: null }
  }
}

export const useSideChatStore = defineStore('sideChat', {
  state: () => {
    const persisted = loadPersistedChat()
    return {
      messages: persisted.messages,
      sessionId: persisted.sessionId,
      isStreaming: false,
      streamingContent: '',
      error: null as string | null,
    }
  },

  actions: {
    async sendMessage(text: string): Promise<void> {
      if (!text.trim() || this.isStreaming) return

      this.error = null

      const userMsg: SideChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      }
      this.messages.push(userMsg)
      this.persist()

      this.isStreaming = true
      this.streamingContent = ''
      let rawContent = ''

      try {
        if (!this.sessionId) {
          this.sessionId = await lmService.ensureSession(
            'side-chat',
            null,
            'Side Chat'
          )
        }

        const llmMessages: LLMMessage[] = [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Be concise and clear. Use markdown formatting when helpful.',
          },
        ]

        for (const msg of this.messages) {
          llmMessages.push({
            role: msg.role,
            content: msg.content,
          })
        }

        const fullContent = await lmService.chat(
          this.sessionId,
          llmMessages,
          (chunk: string) => {
            rawContent += chunk
            this.streamingContent = stripThinking(rawContent)
          }
        )

        this.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: stripThinking(fullContent ?? rawContent),
        })
        this.persist()
      } catch (err) {
        this.error = (err as Error).message
      } finally {
        this.isStreaming = false
        this.streamingContent = ''
      }
    },

    clearChat(): void {
      this.messages = []
      this.sessionId = null
      this.error = null
      this.streamingContent = ''
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        console.warn('[sideChat] Failed to clear persisted chat:', e)
      }
    },

    persist(): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          messages: this.messages,
          sessionId: this.sessionId,
        } as PersistedChat))
      } catch (e) {
        console.warn('[sideChat] Failed to persist chat:', e)
      }
    },
  },
})
