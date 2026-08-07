import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSideChatStore, bookScopeId, GLOBAL_SCOPE } from '../sideChat'
import lmService from '@/services/llm/LMService'

vi.mock('@/services/llm/LMService', () => ({
  default: {
    ensureSession: vi.fn().mockResolvedValue('mock-session-id'),
    chat: vi.fn().mockResolvedValue('Hello! How can I help?'),
  },
}))

function readPersisted(): { scopes: Record<string, { messages: unknown[]; sessionId: string | null }>; activeScope: string } {
  const raw = localStorage.getItem('side-chat')
  return JSON.parse(raw!)
}

describe('useSideChatStore', () => {
  let store: ReturnType<typeof useSideChatStore>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    store = useSideChatStore()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts on the global scope', () => expect(store.activeScope).toBe(GLOBAL_SCOPE))
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

  describe('context label', () => {
    it('defaults to empty string', () => {
      expect(store.contextLabel).toBe('')
    })

    it('setContextLabel updates the label', () => {
      store.setContextLabel('Reading "Dune" by Frank Herbert')
      expect(store.contextLabel).toBe('Reading "Dune" by Frank Herbert')
    })

    it('injects context into system prompt on sendMessage', async () => {
      store.setContextLabel('Reading "Dune" by Frank Herbert')
      await store.sendMessage('Who is the author?')
      const messages = lmService.chat.mock.calls[0][1]
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toContain('Reading "Dune" by Frank Herbert')
      expect(messages[0].content).toContain('Current context:')
    })

    it('omits context from system prompt when not set', async () => {
      await store.sendMessage('Hello')
      const messages = lmService.chat.mock.calls[0][1]
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).not.toContain('Current context:')
    })

    it('updates context label between messages', async () => {
      store.setContextLabel('Reading book A')
      await store.sendMessage('First')
      store.setContextLabel('Reading book B')
      await store.sendMessage('Second')

      const firstCall = lmService.chat.mock.calls[0][1]
      const secondCall = lmService.chat.mock.calls[1][1]
      expect(firstCall[0].content).toContain('Reading book A')
      expect(secondCall[0].content).toContain('Reading book B')
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

  describe('stripThink', () => {
    it('leaves normal content untouched', async () => {
      await store.sendMessage('test')
      expect(store.messages[1].content).toBe('Hello! How can I help?')
    })
  })

  describe('per-content scoping', () => {
    it('bookScopeId prefixes with book-', () => {
      expect(bookScopeId('abc-123')).toBe('book-abc-123')
    })

    it('isolates messages per scope', async () => {
      await store.sendMessage('global question')

      const bookScope = bookScopeId('book-1')
      store.setActiveScope(bookScope)
      expect(store.activeScope).toBe(bookScope)
      expect(store.messages).toEqual([])

      await store.sendMessage('book question')
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].content).toBe('book question')

      // Switching back to global preserves its thread
      store.setActiveScope(GLOBAL_SCOPE)
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].content).toBe('global question')
    })

    it('persists all scopes to localStorage', async () => {
      await store.sendMessage('global question')
      store.setActiveScope(bookScopeId('book-1'))
      await store.sendMessage('book question')

      const parsed = readPersisted()
      expect(parsed.scopes.global.messages).toHaveLength(2)
      expect(parsed.scopes['book-book-1'].messages).toHaveLength(2)
    })

    it('clearChat only clears the active scope', async () => {
      await store.sendMessage('global question')
      store.setActiveScope(bookScopeId('book-1'))
      await store.sendMessage('book question')
      store.clearChat()

      const parsed = readPersisted()
      expect(parsed.scopes['book-book-1'].messages).toEqual([])
      expect(parsed.scopes.global.messages).toHaveLength(2)
    })
  })

  describe('local persistence', () => {
    it('persists messages to localStorage after sending', async () => {
      await store.sendMessage('Hello')
      const parsed = readPersisted()
      expect(parsed.scopes.global.messages).toHaveLength(2)
      expect(parsed.scopes.global.sessionId).toBe('mock-session-id')
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

    it('clears active scope messages on clearChat', async () => {
      await store.sendMessage('Hello')
      store.clearChat()
      const parsed = readPersisted()
      expect(parsed.scopes.global.messages).toEqual([])
      expect(parsed.scopes.global.sessionId).toBeNull()
    })

    it('migrates legacy single-thread localStorage shape', async () => {
      localStorage.setItem('side-chat', JSON.stringify({
        messages: [{ id: 'old-1', role: 'user', content: 'legacy' }],
        sessionId: 'legacy-session',
      }))

      const fresh = createPinia()
      setActivePinia(fresh)
      const migrated = useSideChatStore()

      expect(migrated.activeScope).toBe(GLOBAL_SCOPE)
      expect(migrated.messages).toHaveLength(1)
      expect(migrated.messages[0].content).toBe('legacy')
      expect(migrated.sessionId).toBe('legacy-session')
    })
  })
})
