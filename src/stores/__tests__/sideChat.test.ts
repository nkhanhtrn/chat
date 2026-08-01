import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSideChatStore } from '../sideChat'
import lmService from '@/services/llm/LMService'

vi.mock('@/services/llm/LMService', () => ({
  default: {
    ensureSession: vi.fn().mockResolvedValue('mock-session-id'),
    chat: vi.fn().mockResolvedValue('Hello! How can I help?'),
  },
}))

describe('useSideChatStore', () => {
  let store: ReturnType<typeof useSideChatStore>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    store = useSideChatStore()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with empty messages', () => expect(store.messages).toEqual([]))
    it('starts with no session', () => expect(store.sessionId).toBeNull())
    it('is not streaming', () => expect(store.isStreaming).toBe(false))
    it('has no error', () => expect(store.error).toBeNull())
    it('has empty streaming content', () => expect(store.streamingContent).toBe(''))
  })

  describe('sendMessage', () => {
    it('adds a user message and assistant response', async () => {
      await store.sendMessage('Hello')
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].role).toBe('user')
      expect(store.messages[0].content).toBe('Hello')
      expect(store.messages[1].role).toBe('assistant')
      expect(store.messages[1].content).toBe('Hello! How can I help?')
    })

    it('trims whitespace from user input', async () => {
      await store.sendMessage('  Hello  ')
      expect(store.messages[0].content).toBe('Hello')
    })

    it('ignores empty messages', async () => {
      await store.sendMessage('')
      await store.sendMessage('   ')
      expect(store.messages).toHaveLength(0)
    })

    it('ignores messages while streaming', async () => {
      let resolveChat!: () => void
      lmService.chat.mockReturnValueOnce(new Promise((r) => { resolveChat = () => r('response') }))

      store.sendMessage('first')
      await store.sendMessage('second')

      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].content).toBe('first')
      resolveChat()
    })

    it('creates a session on first message', async () => {
      await store.sendMessage('Hello')
      expect(lmService.ensureSession).toHaveBeenCalledWith('side-chat', null, 'Side Chat')
      expect(store.sessionId).toBe('mock-session-id')
    })

    it('reuses session on subsequent messages', async () => {
      await store.sendMessage('First')
      await store.sendMessage('Second')
      expect(lmService.ensureSession).toHaveBeenCalledTimes(1)
    })

    it('sends conversation history with system prompt', async () => {
      await store.sendMessage('First')
      await store.sendMessage('Second')
      const messages = lmService.chat.mock.calls[1][1]
      expect(messages[0].role).toBe('system')
      expect(messages).toHaveLength(4)
    })

    it('sets isStreaming during request and clears after', async () => {
      let resolveChat!: () => void
      lmService.chat.mockReturnValueOnce(new Promise((r) => { resolveChat = () => r('response') }))

      const promise = store.sendMessage('Hello')
      expect(store.isStreaming).toBe(true)

      resolveChat()
      await promise
      expect(store.isStreaming).toBe(false)
      expect(store.streamingContent).toBe('')
    })

    it('sets error on failure and still adds user message', async () => {
      lmService.chat.mockRejectedValueOnce(new Error('Network error'))
      await store.sendMessage('Hello')

      expect(store.error).toBe('Network error')
      expect(store.isStreaming).toBe(false)
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].role).toBe('user')
    })
  })

  describe('clearChat', () => {
    it('resets all state', async () => {
      await store.sendMessage('Hello')
      store.clearChat()
      expect(store.messages).toEqual([])
      expect(store.sessionId).toBeNull()
      expect(store.error).toBeNull()
      expect(store.streamingContent).toBe('')
    })
  })

  describe('stripThinking', () => {
    it('leaves normal content untouched', async () => {
      await store.sendMessage('test')
      expect(store.messages[1].content).toBe('Hello! How can I help?')
    })
  })

  describe('local persistence', () => {
    it('persists messages to localStorage after sending', async () => {
      await store.sendMessage('Hello')
      const raw = localStorage.getItem('side-chat')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.messages).toHaveLength(2)
      expect(parsed.sessionId).toBe('mock-session-id')
    })

    it('hydrates messages from localStorage on init', async () => {
      await store.sendMessage('Persisted')
      const fresh = createPinia()
      setActivePinia(fresh)
      const reloaded = useSideChatStore()
      expect(reloaded.messages).toHaveLength(2)
      expect(reloaded.messages[0].content).toBe('Persisted')
      expect(reloaded.sessionId).toBe('mock-session-id')
    })

    it('removes persisted chat on clearChat', async () => {
      await store.sendMessage('Hello')
      expect(localStorage.getItem('side-chat')).not.toBeNull()
      store.clearChat()
      expect(localStorage.getItem('side-chat')).toBeNull()
    })
  })
})
