import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../chat.js'
import VocabCard from '../VocabCard.js'
import * as storage from '../../services/storage.js'

// Mock storage
vi.mock('../../services/storage.js', () => ({
  saveChatState: vi.fn(),
  loadChatState: vi.fn().mockResolvedValue({ hasConflict: false, state: null }),
  resolveConflict: vi.fn()
}))

describe('Chat Store - Vocabulary', () => {
  let chatStore
  const DAY_IN_MS = 24 * 60 * 60 * 1000

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('vocabData state', () => {
    it('initializes with empty vocabData', () => {
      expect(chatStore.vocabData).toEqual({})
    })
  })

  describe('addVocabCard', () => {
    it('creates and stores a new vocab card', () => {
      const id = chatStore.addVocabCard({ word: 'ephemeral' })

      expect(id).toBeDefined()
      expect(chatStore.vocabData[id]).toBeDefined()
      expect(chatStore.vocabData[id].word).toBe('ephemeral')
    })

    it('creates card with all provided properties', () => {
      const id = chatStore.addVocabCard({
        word: 'ephemeral',
        definition: 'short-lived',
        context: 'some context',
        messageId: 'msg-1'
      })

      const card = chatStore.vocabData[id]
      expect(card.word).toBe('ephemeral')
      expect(card.definition).toBe('short-lived')
      expect(card.context).toBe('some context')
      expect(card.messageId).toBe('msg-1')
    })

    it('creates card with default values', () => {
      const id = chatStore.addVocabCard({ word: 'test' })

      const card = chatStore.vocabData[id]
      expect(card.definition).toBe('')
      expect(card.context).toBe('')
      expect(card.messageId).toBe(null)
      expect(card.easiness).toBe(2.5)
      expect(card.interval).toBe(1)
      expect(card.repetitions).toBe(0)
    })

    it('returns the card id', () => {
      const id = chatStore.addVocabCard({ word: 'test' })
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('appendToVocabDefinition', () => {
    it('appends to existing definition', () => {
      const id = chatStore.addVocabCard({ word: 'test', definition: 'Initial' })

      chatStore.appendToVocabDefinition(id, ' chunk')

      expect(chatStore.vocabData[id].definition).toBe('Initial chunk')
    })

    it('handles multiple appends', () => {
      const id = chatStore.addVocabCard({ word: 'test', definition: '' })

      chatStore.appendToVocabDefinition(id, '**bold**')
      chatStore.appendToVocabDefinition(id, '\n')
      chatStore.appendToVocabDefinition(id, 'text')

      expect(chatStore.vocabData[id].definition).toBe('**bold**\ntext')
    })

    it('does nothing for non-existent card', () => {
      chatStore.appendToVocabDefinition('nonexistent', 'chunk')
      expect(chatStore.vocabData['nonexistent']).toBeUndefined()
    })
  })

  describe('updateVocabDefinition', () => {
    it('replaces entire definition', () => {
      const id = chatStore.addVocabCard({ word: 'test', definition: 'old' })

      chatStore.updateVocabDefinition(id, 'completely new definition')

      expect(chatStore.vocabData[id].definition).toBe('completely new definition')
    })

    it('does nothing for non-existent card', () => {
      chatStore.updateVocabDefinition('nonexistent', 'new def')
      expect(chatStore.vocabData['nonexistent']).toBeUndefined()
    })
  })

  describe('recordVocabReview', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)
    })

    it('updates card with review result', () => {
      const id = chatStore.addVocabCard({ word: 'test' })

      chatStore.recordVocabReview(id, 4)

      const card = chatStore.vocabData[id]
      expect(card.repetitions).toBe(1)
      expect(card.interval).toBe(1)
    })

    it('resets progress on failed review', () => {
      const id = chatStore.addVocabCard({
        word: 'test',
        repetitions: 5,
        interval: 30
      })
      // Force the properties since addVocabCard creates a new VocabCard
      chatStore.vocabData[id].repetitions = 5
      chatStore.vocabData[id].interval = 30

      chatStore.recordVocabReview(id, 0) // Again

      const card = chatStore.vocabData[id]
      expect(card.repetitions).toBe(0)
      expect(card.interval).toBe(1)
    })

    it('does nothing for non-existent card', () => {
      chatStore.recordVocabReview('nonexistent', 4)
      expect(chatStore.vocabData['nonexistent']).toBeUndefined()
    })
  })

  describe('removeVocabCard', () => {
    it('removes existing card', () => {
      const id = chatStore.addVocabCard({ word: 'test' })
      expect(chatStore.vocabData[id]).toBeDefined()

      chatStore.removeVocabCard(id)

      expect(chatStore.vocabData[id]).toBeUndefined()
    })

    it('does nothing for non-existent card', () => {
      const initialCount = Object.keys(chatStore.vocabData).length
      chatStore.removeVocabCard('nonexistent')
      expect(Object.keys(chatStore.vocabData).length).toBe(initialCount)
    })
  })

  describe('getVocabCard', () => {
    it('returns card when exists', () => {
      const id = chatStore.addVocabCard({ word: 'ephemeral' })

      const card = chatStore.getVocabCard(id)

      expect(card).toBeDefined()
      expect(card.word).toBe('ephemeral')
    })

    it('returns null for non-existent card', () => {
      expect(chatStore.getVocabCard('nonexistent')).toBe(null)
    })
  })

  describe('findVocabCardByWord', () => {
    it('finds card by exact word', () => {
      chatStore.addVocabCard({ word: 'ephemeral' })

      const card = chatStore.findVocabCardByWord('ephemeral')

      expect(card).toBeDefined()
      expect(card.word).toBe('ephemeral')
    })

    it('finds card case-insensitively', () => {
      chatStore.addVocabCard({ word: 'Ephemeral' })

      expect(chatStore.findVocabCardByWord('ephemeral')).toBeDefined()
      expect(chatStore.findVocabCardByWord('EPHEMERAL')).toBeDefined()
      expect(chatStore.findVocabCardByWord('EpHeMeRaL')).toBeDefined()
    })

    it('trims whitespace when searching', () => {
      chatStore.addVocabCard({ word: 'ephemeral' })

      expect(chatStore.findVocabCardByWord('  ephemeral  ')).toBeDefined()
    })

    it('returns null when word not found', () => {
      expect(chatStore.findVocabCardByWord('nonexistent')).toBe(null)
    })
  })

  describe('vocabCardsDueForReview getter', () => {
    it('returns empty array when no cards', () => {
      expect(chatStore.vocabCardsDueForReview).toEqual([])
    })

    it('returns cards due for review', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      chatStore.addVocabCard({ word: 'test1' }) // Due immediately
      chatStore.addVocabCard({ word: 'test2' }) // Due immediately

      const due = chatStore.vocabCardsDueForReview
      expect(due).toHaveLength(2)
    })

    it('excludes cards not yet due', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      const id = chatStore.addVocabCard({ word: 'test' })
      // Set nextReviewDate to future
      chatStore.vocabData[id].nextReviewDate = 1000000000000 + DAY_IN_MS

      expect(chatStore.vocabCardsDueForReview).toHaveLength(0)
    })

    it('sorts by nextReviewDate (oldest first)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      const id1 = chatStore.addVocabCard({ word: 'newer' })
      const id2 = chatStore.addVocabCard({ word: 'older' })

      chatStore.vocabData[id1].nextReviewDate = 1000000000000 - 1000
      chatStore.vocabData[id2].nextReviewDate = 1000000000000 - 5000

      const due = chatStore.vocabCardsDueForReview
      expect(due[0].word).toBe('older')
      expect(due[1].word).toBe('newer')
    })
  })

  describe('vocabCardsDueCount getter', () => {
    it('returns 0 when no cards', () => {
      expect(chatStore.vocabCardsDueCount).toBe(0)
    })

    it('returns count of due cards', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      chatStore.addVocabCard({ word: 'test1' })
      chatStore.addVocabCard({ word: 'test2' })

      expect(chatStore.vocabCardsDueCount).toBe(2)
    })

    it('excludes cards not yet due', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      const id1 = chatStore.addVocabCard({ word: 'due' })
      const id2 = chatStore.addVocabCard({ word: 'not-due' })

      chatStore.vocabData[id2].nextReviewDate = 1000000000000 + DAY_IN_MS

      expect(chatStore.vocabCardsDueCount).toBe(1)
    })
  })

  describe('allVocabCards getter', () => {
    it('returns empty array when no cards', () => {
      expect(chatStore.allVocabCards).toEqual([])
    })

    it('returns all vocab cards', () => {
      chatStore.addVocabCard({ word: 'test1' })
      chatStore.addVocabCard({ word: 'test2' })

      expect(chatStore.allVocabCards).toHaveLength(2)
    })

    it('sorts by createdAt (newest first)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000000)

      const id1 = chatStore.addVocabCard({ word: 'older' })
      chatStore.vocabData[id1].createdAt = 1000000000000 - 5000

      vi.setSystemTime(1000000000000 + 1000)
      const id2 = chatStore.addVocabCard({ word: 'newer' })

      const all = chatStore.allVocabCards
      expect(all[0].word).toBe('newer')
      expect(all[1].word).toBe('older')
    })
  })

  describe('_applyState with vocabData', () => {
    it('reconstructs VocabCard objects from plain objects', async () => {
      const savedState = {
        vocabData: {
          'vocab-1': {
            id: 'vocab-1',
            word: 'ephemeral',
            definition: 'short-lived',
            context: 'some context',
            messageId: 'msg-1',
            easiness: 2.3,
            interval: 6,
            repetitions: 2,
            nextReviewDate: 12345,
            lastReviewDate: 12340,
            createdAt: 10000
          }
        },
        messagesById: {},
        chats: [],
        currentChatId: null,
        currentModel: null
      }

      chatStore._applyState(savedState)

      const card = chatStore.vocabData['vocab-1']
      expect(card).toBeInstanceOf(VocabCard)
      expect(card.word).toBe('ephemeral')
      expect(card.definition).toBe('short-lived')
      expect(card.easiness).toBe(2.3)
      expect(typeof card.recordReview).toBe('function')
    })

    it('handles empty vocabData in saved state', () => {
      const savedState = {
        vocabData: {},
        messagesById: {},
        chats: [],
        currentChatId: null,
        currentModel: null
      }

      chatStore._applyState(savedState)

      expect(chatStore.vocabData).toEqual({})
    })

    it('handles missing vocabData in saved state', () => {
      const savedState = {
        messagesById: {},
        chats: [],
        currentChatId: null,
        currentModel: null
      }

      chatStore._applyState(savedState)

      expect(chatStore.vocabData).toEqual({})
    })
  })

  describe('_persistState includes vocabData', () => {
    it('includes vocabData when persisting', () => {
      chatStore.addVocabCard({ word: 'test' })

      // Force persist
      chatStore._persistState()

      expect(storage.saveChatState).toHaveBeenCalled()
      const savedState = storage.saveChatState.mock.calls[storage.saveChatState.mock.calls.length - 1][0]
      expect(savedState.vocabData).toBeDefined()
      expect(Object.keys(savedState.vocabData)).toHaveLength(1)
    })
  })
})
