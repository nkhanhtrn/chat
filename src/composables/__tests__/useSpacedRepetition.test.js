import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSpacedRepetition } from '../useSpacedRepetition.js'
import { useChatStore } from '../../stores/chat.js'
import * as api from '../../services/api.js'

vi.mock('../../services/api.js', () => ({
  sendChatMessage: vi.fn()
}))

describe('useSpacedRepetition', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('cardsDue', () => {
    it('returns computed value from store', () => {
      const { cardsDue } = useSpacedRepetition()
      expect(cardsDue.value).toEqual([])
    })
  })

  describe('dueCount', () => {
    it('returns computed value from store', () => {
      const { dueCount } = useSpacedRepetition()
      expect(dueCount.value).toBe(0)
    })
  })

  describe('recordReview', () => {
    it('calls store recordSRReview', () => {
      const spy = vi.spyOn(chatStore, 'recordSRReview')
      const { recordReview } = useSpacedRepetition()
      recordReview('msg-1', 4)
      expect(spy).toHaveBeenCalledWith('msg-1', 4)
    })
  })

  describe('initializeCard', () => {
    it('calls store initializeSRCard', () => {
      const spy = vi.spyOn(chatStore, 'initializeSRCard')
      const { initializeCard } = useSpacedRepetition()
      initializeCard('msg-1', 'Test summary')
      expect(spy).toHaveBeenCalledWith('msg-1', 'Test summary')
    })

    it('uses empty string as default summary', () => {
      const spy = vi.spyOn(chatStore, 'initializeSRCard')
      const { initializeCard } = useSpacedRepetition()
      initializeCard('msg-1')
      expect(spy).toHaveBeenCalledWith('msg-1', '')
    })
  })

  describe('generateResponseSummary', () => {
    it('calls sendChatMessage with correct prompts', async () => {
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Summary ')
        onChunk('text')
      })

      const { generateResponseSummary } = useSpacedRepetition()
      const result = await generateResponseSummary('Test response', 'gpt-4')

      expect(api.sendChatMessage).toHaveBeenCalled()
      expect(result).toBe('Summary text')
    })

    it('returns fallback on API error', async () => {
      api.sendChatMessage.mockRejectedValue(new Error('API Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { generateResponseSummary } = useSpacedRepetition()
      const result = await generateResponseSummary('Short paragraph\n\nSecond paragraph', 'gpt-4')

      expect(result).toBe('Short paragraph')
      consoleSpy.mockRestore()
    })

    it('truncates long fallback to 200 chars', async () => {
      api.sendChatMessage.mockRejectedValue(new Error('API Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const longText = 'A'.repeat(300) + '\n\nSecond paragraph'
      const { generateResponseSummary } = useSpacedRepetition()
      const result = await generateResponseSummary(longText, 'gpt-4')

      expect(result).toBe('A'.repeat(200) + '...')
      consoleSpy.mockRestore()
    })
  })

  describe('initializeCardWithSummary', () => {
    it('initializes card immediately with empty summary', async () => {
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Generated summary')
      })

      const initSpy = vi.spyOn(chatStore, 'initializeSRCard')
      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { initializeCardWithSummary } = useSpacedRepetition()
      await initializeCardWithSummary('msg-1', 'Response text', 'gpt-4')

      expect(initSpy).toHaveBeenCalledWith('msg-1', '')
      expect(updateSpy).toHaveBeenCalledWith('msg-1', 'Generated summary')
    })

    it('returns the generated summary', async () => {
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Generated summary')
      })

      const { initializeCardWithSummary } = useSpacedRepetition()
      const result = await initializeCardWithSummary('msg-1', 'Response text', 'gpt-4')

      expect(result).toBe('Generated summary')
    })
  })

  describe('updateResponseSummary', () => {
    it('calls store updateSRResponseSummary', () => {
      const spy = vi.spyOn(chatStore, 'updateSRResponseSummary')
      const { updateResponseSummary } = useSpacedRepetition()
      updateResponseSummary('msg-1', 'New summary')
      expect(spy).toHaveBeenCalledWith('msg-1', 'New summary')
    })
  })

  describe('removeCard', () => {
    it('calls store removeSRCard', () => {
      const spy = vi.spyOn(chatStore, 'removeSRCard')
      const { removeCard } = useSpacedRepetition()
      removeCard('msg-1')
      expect(spy).toHaveBeenCalledWith('msg-1')
    })
  })

  describe('getCardData', () => {
    it('returns null for non-existent card', () => {
      const { getCardData } = useSpacedRepetition()
      expect(getCardData('msg-1')).toBe(null)
    })

    it('returns card data when exists', () => {
      chatStore.srData['msg-1'] = { easiness: 2.5, interval: 1 }
      const { getCardData } = useSpacedRepetition()
      expect(getCardData('msg-1')).toEqual({ easiness: 2.5, interval: 1 })
    })
  })

  describe('getUninitializedMessages', () => {
    it('returns empty array when no messages', () => {
      const { getUninitializedMessages } = useSpacedRepetition()
      expect(getUninitializedMessages()).toEqual([])
    })

    it('returns messages with responses not in SR', () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' },
        'msg-3': { id: 'msg-3', question: 'Q3', response: '' }
      }
      chatStore.srData = { 'msg-1': {} }

      const { getUninitializedMessages } = useSpacedRepetition()
      const result = getUninitializedMessages()

      expect(result).toHaveLength(1)
      expect(result[0].messageId).toBe('msg-2')
    })

    it('excludes messages without responses', () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: '' }
      }

      const { getUninitializedMessages } = useSpacedRepetition()
      expect(getUninitializedMessages()).toEqual([])
    })
  })

  describe('uninitializedCount', () => {
    it('returns 0 when no messages', () => {
      const { uninitializedCount } = useSpacedRepetition()
      expect(uninitializedCount.value).toBe(0)
    })

    it('counts messages with responses not in SR', () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' },
        'msg-3': { id: 'msg-3', question: 'Q3', response: '' }
      }
      chatStore.srData = { 'msg-1': {} }

      const { uninitializedCount } = useSpacedRepetition()
      expect(uninitializedCount.value).toBe(1)
    })
  })

  describe('initializeAllExisting', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Summary')
      })
    })

    it('returns 0 when no uninitialized messages', async () => {
      const { initializeAllExisting } = useSpacedRepetition()
      const result = await initializeAllExisting('gpt-4')
      expect(result).toBe(0)
    })

    it('initializes all uninitialized messages', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' }
      }

      const { initializeAllExisting } = useSpacedRepetition()
      const promise = initializeAllExisting('gpt-4')

      // Run all timers to completion
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe(2)
      expect(chatStore.srData['msg-1']).toBeDefined()
      expect(chatStore.srData['msg-2']).toBeDefined()
    })

    it('calls onProgress callback', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' }
      }

      const onProgress = vi.fn()
      const { initializeAllExisting } = useSpacedRepetition()
      const promise = initializeAllExisting('gpt-4', onProgress)

      await vi.runAllTimersAsync()
      await promise

      expect(onProgress).toHaveBeenCalledWith({
        completed: 0,
        total: 1,
        delayRemaining: 0,
        status: 'generating'
      })
      expect(onProgress).toHaveBeenCalledWith({
        completed: 1,
        total: 1,
        delayRemaining: 0,
        status: 'done'
      })
    })

    it('can be cancelled with abort signal', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' }
      }

      const abortController = new AbortController()
      const { initializeAllExisting } = useSpacedRepetition()

      // Start initialization
      const promise = initializeAllExisting('gpt-4', null, abortController.signal)

      // Abort before completion
      abortController.abort()

      await vi.runAllTimersAsync()

      // Wrap in try/catch to handle the rejection properly
      let thrownError
      try {
        await promise
      } catch (e) {
        thrownError = e
      }
      expect(thrownError).toBeDefined()
      expect(thrownError.message).toBe('Cancelled')
    })

    it('reports waiting status with delay countdown', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' }
      }

      const progressCalls = []
      const onProgress = (p) => progressCalls.push({ ...p })

      const { initializeAllExisting } = useSpacedRepetition()
      const promise = initializeAllExisting('gpt-4', onProgress)

      await vi.runAllTimersAsync()
      await promise

      // Should have waiting status calls
      const waitingCalls = progressCalls.filter(p => p.status === 'waiting')
      expect(waitingCalls.length).toBeGreaterThan(0)
    })
  })
})
