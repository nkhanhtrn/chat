import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBookChatStore } from '../bookChat'
import lmService from '@/services/llm/LMService'

vi.mock('@/services/llm/LMService', () => ({
  default: {
    ensureSession: vi.fn().mockResolvedValue('mock-book-session'),
    chat: vi.fn().mockResolvedValue('Here is the answer!'),
  },
}))

vi.mock('@/services/BookChatStorage', () => ({
  BookChatStorage: {
    saveBookChat: vi.fn().mockResolvedValue(undefined),
    getBookChat: vi.fn().mockResolvedValue(null),
    deleteBookChat: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/firestore/firestore-book-chat', () => ({
  saveBookChatToFirestore: vi.fn().mockResolvedValue(undefined),
  loadBookChatFromFirestore: vi.fn().mockResolvedValue(null),
  deleteBookChatFromFirestore: vi.fn().mockResolvedValue(undefined),
}))

const { BookChatStorage } = await import('@/services/BookChatStorage')
const { saveBookChatToFirestore, loadBookChatFromFirestore, deleteBookChatFromFirestore } = await import('@/services/firestore/firestore-book-chat')

describe('useBookChatStore', () => {
  let store: ReturnType<typeof useBookChatStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useBookChatStore()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with empty messages', () => expect(store.messages).toEqual([]))
    it('starts with no current book', () => expect(store.currentBookId).toBeNull())
    it('is not loaded', () => expect(store.loaded).toBe(false))
    it('is not streaming', () => expect(store.isStreaming).toBe(false))
    it('has no error', () => expect(store.error).toBeNull())
  })

  describe('loadChat', () => {
    it('loads messages from local cache', async () => {
      BookChatStorage.getBookChat.mockResolvedValueOnce([
        { id: '1', role: 'user', content: 'cached q' },
        { id: '2', role: 'assistant', content: 'cached a' },
      ])
      await store.loadChat('book-1')
      expect(store.currentBookId).toBe('book-1')
      expect(store.messages).toHaveLength(2)
      expect(store.loaded).toBe(true)
    })

    it('prefers cloud messages when cloud has more', async () => {
      BookChatStorage.getBookChat.mockResolvedValueOnce([
        { id: '1', role: 'user', content: 'cached q' },
      ])
      loadBookChatFromFirestore.mockResolvedValueOnce([
        { id: '1', role: 'user', content: 'cached q' },
        { id: '2', role: 'assistant', content: 'cloud a' },
        { id: '3', role: 'user', content: 'cloud q2' },
      ])
      await store.loadChat('book-1')
      expect(store.messages).toHaveLength(3)
      expect(BookChatStorage.saveBookChat).toHaveBeenCalledWith('book-1', store.messages)
    })

    it('keeps local when cloud is shorter', async () => {
      BookChatStorage.getBookChat.mockResolvedValueOnce([
        { id: '1', role: 'user', content: 'cached q' },
        { id: '2', role: 'assistant', content: 'cached a' },
      ])
      loadBookChatFromFirestore.mockResolvedValueOnce([
        { id: '1', role: 'user', content: 'cloud q' },
      ])
      await store.loadChat('book-1')
      expect(store.messages).toHaveLength(2)
    })

    it('does not reload the same book twice', async () => {
      await store.loadChat('book-1')
      await store.loadChat('book-1')
      expect(BookChatStorage.getBookChat).toHaveBeenCalledTimes(1)
    })

    it('reloads when switching to a different book', async () => {
      await store.loadChat('book-1')
      await store.loadChat('book-2')
      expect(store.currentBookId).toBe('book-2')
      expect(BookChatStorage.getBookChat).toHaveBeenCalledTimes(2)
    })
  })

  describe('sendMessage', () => {
    it('adds a user message and assistant response', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('Hello')
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].role).toBe('user')
      expect(store.messages[0].content).toBe('Hello')
      expect(store.messages[1].role).toBe('assistant')
      expect(store.messages[1].content).toBe('Here is the answer!')
    })

    it('ignores empty messages', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('   ')
      expect(store.messages).toHaveLength(0)
    })

    it('creates a session on first message', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('Hello')
      expect(lmService.ensureSession).toHaveBeenCalledWith('book-chat', null, 'Book Chat')
      expect(store.sessionId).toBe('mock-book-session')
    })

    it('persists to local and cloud after sending', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('Hello')
      expect(BookChatStorage.saveBookChat).toHaveBeenCalledWith('book-1', expect.any(Array))
      expect(saveBookChatToFirestore).toHaveBeenCalledWith('book-1', expect.any(Array))
    })

    it('sends a reading-assistant system prompt', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('Hello')
      const messages = lmService.chat.mock.calls[0][1]
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toContain('reading assistant')
    })

    it('sets error on failure and still adds user message', async () => {
      await store.loadChat('book-1')
      lmService.chat.mockRejectedValueOnce(new Error('Network error'))
      await store.sendMessage('Hello')
      expect(store.error).toBe('Network error')
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].role).toBe('user')
    })
  })

  describe('clearChat', () => {
    it('resets state and deletes from local and cloud', async () => {
      await store.loadChat('book-1')
      await store.sendMessage('Hello')
      await store.clearChat()
      expect(store.messages).toEqual([])
      expect(store.sessionId).toBeNull()
      expect(BookChatStorage.deleteBookChat).toHaveBeenCalledWith('book-1')
      expect(deleteBookChatFromFirestore).toHaveBeenCalledWith('book-1')
    })
  })
})
