import { defineStore } from 'pinia'

export const useStreamingStore = defineStore('streaming', {
  state: () => ({
    isStreaming: false,
    streamingMessageId: null as string | null,
    streamAbortController: null as AbortController | null,
    error: null as string | null,
  }),
  actions: {
    startStreaming(messageId: string | null = null): AbortSignal {
      this.streamAbortController = new AbortController()
      this.isStreaming = true
      this.streamingMessageId = messageId
      return this.streamAbortController.signal
    },

    stopStreaming(): void {
      this.streamAbortController?.abort()
      this.streamAbortController = null
      this.isStreaming = false
      this.streamingMessageId = null
    },

    setError(err: string | null): void {
      this.error = err
    },
  },
})
