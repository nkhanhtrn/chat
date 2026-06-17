import { defineStore } from 'pinia'
import lmService from '@/services/llm/LMService'
import { BookChatStorage } from '@/services/BookChatStorage'
import { saveBookChatToFirestore, loadBookChatFromFirestore, deleteBookChatFromFirestore } from '@/services/firestore/firestore-book-chat'
import type { LLMMessage } from '@/types/llm'

function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?>[\s\S]*$/gi, '')
}

export interface BookChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export const useBookChatStore = defineStore('bookChat', {
  state: () => ({
    currentBookId: null as string | null,
    messages: [] as BookChatMessage[],
    sessionId: null as string | null,
    isStreaming: false,
    streamingContent: '',
    error: null as string | null,
    loaded: false,
  }),

  actions: {
    async loadChat(bookId: string): Promise<void> {
      if (this.currentBookId === bookId && this.loaded) return
      this.currentBookId = bookId
      this.sessionId = null
      this.error = null
      this.streamingContent = ''
      this.loaded = false

      // 1. Local cache (fast)
      let local = await BookChatStorage.getBookChat(bookId)
      this.messages = local ?? []

      // 2. Cloud merge (cloud wins when it has more messages)
      try {
        const cloud = await loadBookChatFromFirestore(bookId)
        if (cloud && cloud.length >= this.messages.length) {
          this.messages = cloud
          await BookChatStorage.saveBookChat(bookId, cloud)
        }
      } catch (err) {
        console.warn('[BookChat] cloud load failed:', err)
      }

      this.loaded = true
    },

    async persist(): Promise<void> {
      const bookId = this.currentBookId
      if (!bookId) return
      await BookChatStorage.saveBookChat(bookId, this.messages)
      saveBookChatToFirestore(bookId, this.messages).catch((err) => {
        console.warn('[BookChat] cloud save failed:', err)
      })
    },

    async sendMessage(text: string): Promise<void> {
      if (!text.trim() || this.isStreaming) return

      this.error = null

      const userMsg: BookChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      }
      this.messages.push(userMsg)

      this.isStreaming = true
      this.streamingContent = ''
      let rawContent = ''

      try {
        if (!this.sessionId) {
          this.sessionId = await lmService.ensureSession(
            'book-chat',
            null,
            'Book Chat'
          )
        }

        const llmMessages: LLMMessage[] = [
          {
            role: 'system',
            content:
              'You are a helpful reading assistant. Answer questions about the book the user is reading. Be concise and clear. Use markdown formatting when helpful.',
          },
        ]

        for (const msg of this.messages) {
          llmMessages.push({ role: msg.role, content: msg.content })
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
        await this.persist()
      } catch (err) {
        this.error = (err as Error).message
      } finally {
        this.isStreaming = false
        this.streamingContent = ''
      }
    },

    async clearChat(): Promise<void> {
      const bookId = this.currentBookId
      this.messages = []
      this.sessionId = null
      this.error = null
      this.streamingContent = ''
      if (bookId) {
        await BookChatStorage.deleteBookChat(bookId)
        deleteBookChatFromFirestore(bookId).catch(() => {})
      }
    },
  },
})
