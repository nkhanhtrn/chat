import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVocabulary } from '../useVocabulary.js'
import { useChatStore } from '../../stores/chat.js'

describe('useVocabulary', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    vi.clearAllMocks()
  })

  describe('vocabCardsDue', () => {
    it('returns computed value from store', () => {
      const { vocabCardsDue } = useVocabulary()
      expect(vocabCardsDue.value).toEqual([])
    })
  })

  describe('vocabDueCount', () => {
    it('returns computed value from store', () => {
      const { vocabDueCount } = useVocabulary()
      expect(vocabDueCount.value).toBe(0)
    })
  })

  describe('allVocabCards', () => {
    it('returns computed value from store', () => {
      const { allVocabCards } = useVocabulary()
      expect(allVocabCards.value).toEqual([])
    })
  })

  describe('totalVocabCount', () => {
    it('returns 0 when no vocab cards', () => {
      const { totalVocabCount } = useVocabulary()
      expect(totalVocabCount.value).toBe(0)
    })

    it('returns count of vocab cards', () => {
      chatStore.vocabData = {
        'vocab-1': { id: 'vocab-1', word: 'test1' },
        'vocab-2': { id: 'vocab-2', word: 'test2' }
      }
      const { totalVocabCount } = useVocabulary()
      expect(totalVocabCount.value).toBe(2)
    })
  })

  describe('addVocabCard', () => {
    it('calls store addVocabCard and returns id', () => {
      const spy = vi.spyOn(chatStore, 'addVocabCard')
      const { addVocabCard } = useVocabulary()

      const id = addVocabCard({ word: 'ephemeral', definition: 'short-lived' })

      // Store receives full object with defaults filled in
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0].word).toBe('ephemeral')
      expect(spy.mock.calls[0][0].definition).toBe('short-lived')
      expect(id).toBeDefined()
    })

    it('creates card with context and messageId', () => {
      const { addVocabCard } = useVocabulary()

      const id = addVocabCard({
        word: 'ephemeral',
        definition: 'short-lived',
        context: '...the ephemeral nature...',
        messageId: 'msg-1'
      })

      const card = chatStore.vocabData[id]
      expect(card.word).toBe('ephemeral')
      expect(card.context).toBe('...the ephemeral nature...')
      expect(card.messageId).toBe('msg-1')
    })
  })

  describe('appendToDefinition', () => {
    it('calls store appendToVocabDefinition', () => {
      const { addVocabCard, appendToDefinition } = useVocabulary()
      const id = addVocabCard({ word: 'test' })

      const spy = vi.spyOn(chatStore, 'appendToVocabDefinition')
      appendToDefinition(id, ' chunk')

      expect(spy).toHaveBeenCalledWith(id, ' chunk')
    })

    it('appends to existing definition', () => {
      const { addVocabCard, appendToDefinition } = useVocabulary()
      const id = addVocabCard({ word: 'test', definition: 'Initial' })

      appendToDefinition(id, ' chunk1')
      appendToDefinition(id, ' chunk2')

      expect(chatStore.vocabData[id].definition).toBe('Initial chunk1 chunk2')
    })
  })

  describe('updateDefinition', () => {
    it('calls store updateVocabDefinition', () => {
      const { addVocabCard, updateDefinition } = useVocabulary()
      const id = addVocabCard({ word: 'test' })

      const spy = vi.spyOn(chatStore, 'updateVocabDefinition')
      updateDefinition(id, 'New definition')

      expect(spy).toHaveBeenCalledWith(id, 'New definition')
    })

    it('replaces existing definition', () => {
      const { addVocabCard, updateDefinition } = useVocabulary()
      const id = addVocabCard({ word: 'test', definition: 'Old' })

      updateDefinition(id, 'Completely new definition')

      expect(chatStore.vocabData[id].definition).toBe('Completely new definition')
    })
  })

  describe('recordReview', () => {
    it('calls store recordVocabReview', () => {
      const { addVocabCard, recordReview } = useVocabulary()
      const id = addVocabCard({ word: 'test' })

      const spy = vi.spyOn(chatStore, 'recordVocabReview')
      recordReview(id, 4)

      expect(spy).toHaveBeenCalledWith(id, 4)
    })
  })

  describe('removeCard', () => {
    it('calls store removeVocabCard', () => {
      const { addVocabCard, removeCard } = useVocabulary()
      const id = addVocabCard({ word: 'test' })

      const spy = vi.spyOn(chatStore, 'removeVocabCard')
      removeCard(id)

      expect(spy).toHaveBeenCalledWith(id)
    })

    it('removes the card from store', () => {
      const { addVocabCard, removeCard } = useVocabulary()
      const id = addVocabCard({ word: 'test' })

      expect(chatStore.vocabData[id]).toBeDefined()
      removeCard(id)
      expect(chatStore.vocabData[id]).toBeUndefined()
    })
  })

  describe('getCard', () => {
    it('returns null for non-existent card', () => {
      const { getCard } = useVocabulary()
      expect(getCard('nonexistent')).toBe(null)
    })

    it('returns card when exists', () => {
      const { addVocabCard, getCard } = useVocabulary()
      const id = addVocabCard({ word: 'ephemeral', definition: 'short-lived' })

      const card = getCard(id)
      expect(card).toBeDefined()
      expect(card.word).toBe('ephemeral')
    })
  })

  describe('findByWord', () => {
    it('returns null when word not found', () => {
      const { findByWord } = useVocabulary()
      expect(findByWord('nonexistent')).toBe(null)
    })

    it('returns card when word exists', () => {
      const { addVocabCard, findByWord } = useVocabulary()
      addVocabCard({ word: 'ephemeral', definition: 'short-lived' })

      const card = findByWord('ephemeral')
      expect(card).toBeDefined()
      expect(card.word).toBe('ephemeral')
    })

    it('finds word case-insensitively', () => {
      const { addVocabCard, findByWord } = useVocabulary()
      addVocabCard({ word: 'Ephemeral', definition: 'short-lived' })

      expect(findByWord('ephemeral')).toBeDefined()
      expect(findByWord('EPHEMERAL')).toBeDefined()
      expect(findByWord('ePHeMeRaL')).toBeDefined()
    })

    it('trims whitespace when searching', () => {
      const { addVocabCard, findByWord } = useVocabulary()
      addVocabCard({ word: 'ephemeral', definition: 'short-lived' })

      expect(findByWord('  ephemeral  ')).toBeDefined()
    })
  })

  describe('wordExists', () => {
    it('returns false when word not in vocab', () => {
      const { wordExists } = useVocabulary()
      expect(wordExists('nonexistent')).toBe(false)
    })

    it('returns true when word exists', () => {
      const { addVocabCard, wordExists } = useVocabulary()
      addVocabCard({ word: 'ephemeral' })

      expect(wordExists('ephemeral')).toBe(true)
    })

    it('checks case-insensitively', () => {
      const { addVocabCard, wordExists } = useVocabulary()
      addVocabCard({ word: 'Ephemeral' })

      expect(wordExists('ephemeral')).toBe(true)
      expect(wordExists('EPHEMERAL')).toBe(true)
    })
  })

  describe('integration: full vocab card lifecycle', () => {
    it('handles complete card lifecycle', () => {
      const {
        addVocabCard,
        appendToDefinition,
        recordReview,
        getCard,
        vocabDueCount,
        totalVocabCount
      } = useVocabulary()

      // Create card
      const id = addVocabCard({ word: 'ephemeral', context: 'some context' })
      expect(totalVocabCount.value).toBe(1)
      expect(vocabDueCount.value).toBe(1) // New card is due immediately

      // Stream definition
      appendToDefinition(id, '**ephemeral**\n')
      appendToDefinition(id, 'lasting for a very short time')

      let card = getCard(id)
      expect(card.definition).toBe('**ephemeral**\nlasting for a very short time')

      // Review card
      recordReview(id, 4) // Good

      card = getCard(id)
      expect(card.repetitions).toBe(1)
      expect(card.interval).toBe(1)
      expect(vocabDueCount.value).toBe(0) // No longer due after review
    })
  })
})
