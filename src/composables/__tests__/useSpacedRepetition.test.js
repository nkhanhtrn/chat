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
      initializeCard('msg-1')
      expect(spy).toHaveBeenCalledWith('msg-1')
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
    it('initializes card and generates summary', async () => {
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Generated summary')
      })

      const initSpy = vi.spyOn(chatStore, 'initializeSRCard')
      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { initializeCardWithSummary } = useSpacedRepetition()
      await initializeCardWithSummary('msg-1', 'Response text', 'gpt-4')

      expect(initSpy).toHaveBeenCalledWith('msg-1')
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

    it('calls onProgress callback with done status', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' }
      }

      const onProgress = vi.fn()
      const { initializeAllExisting } = useSpacedRepetition()
      await initializeAllExisting('gpt-4', onProgress)

      // Since initializeAllExisting is now instant (no API calls), only done status is reported
      expect(onProgress).toHaveBeenCalledTimes(1)
      expect(onProgress).toHaveBeenCalledWith({
        completed: 1,
        total: 1,
        delayRemaining: 0,
        status: 'done'
      })
    })

    it('completes immediately without delays', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' }
      }

      const { initializeAllExisting } = useSpacedRepetition()

      // Should complete synchronously without needing timers
      const result = await initializeAllExisting('gpt-4')

      expect(result).toBe(2)
      expect(chatStore.srData['msg-1']).toBeDefined()
      expect(chatStore.srData['msg-2']).toBeDefined()
    })

    it('reports done status immediately', async () => {
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2' }
      }

      const progressCalls = []
      const onProgress = (p) => progressCalls.push({ ...p })

      const { initializeAllExisting } = useSpacedRepetition()
      await initializeAllExisting('gpt-4', onProgress)

      // Should only have done status (no generating/waiting since no API calls)
      expect(progressCalls).toHaveLength(1)
      expect(progressCalls[0]).toEqual({
        completed: 2,
        total: 2,
        delayRemaining: 0,
        status: 'done'
      })
    })
  })

  describe('getMessagesMissingSummaryInNotebook', () => {
    it('returns empty array when notebook does not exist', () => {
      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      expect(getMessagesMissingSummaryInNotebook('nonexistent')).toEqual([])
    })

    it('returns empty array when notebook has no messages', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: [] }]

      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      expect(getMessagesMissingSummaryInNotebook('notebook-1')).toEqual([])
    })

    it('returns messages missing summaries in notebook', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Summary exists' }
      }

      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      const result = getMessagesMissingSummaryInNotebook('notebook-1')

      expect(result).toHaveLength(1)
      expect(result[0].messageId).toBe('msg-1')
    })

    it('includes child messages missing summaries', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Has summary', childIds: ['msg-2'] },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null, childIds: ['msg-3'] },
        'msg-3': { id: 'msg-3', question: 'Q3', response: 'R3', responseSummary: null }
      }

      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      const result = getMessagesMissingSummaryInNotebook('notebook-1')

      expect(result).toHaveLength(2)
      expect(result.map(r => r.messageId)).toEqual(['msg-2', 'msg-3'])
    })

    it('excludes messages without responses', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: '', responseSummary: null }
      }

      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      expect(getMessagesMissingSummaryInNotebook('notebook-1')).toEqual([])
    })

    it('only returns messages from specified notebook', () => {
      chatStore.chats = [
        { id: 'notebook-1', rootMessageIds: ['msg-1'] },
        { id: 'notebook-2', rootMessageIds: ['msg-2'] }
      ]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const { getMessagesMissingSummaryInNotebook } = useSpacedRepetition()
      const result = getMessagesMissingSummaryInNotebook('notebook-1')

      expect(result).toHaveLength(1)
      expect(result[0].messageId).toBe('msg-1')
    })
  })

  describe('getMissingSummaryCountInNotebook', () => {
    it('returns 0 when notebook does not exist', () => {
      const { getMissingSummaryCountInNotebook } = useSpacedRepetition()
      expect(getMissingSummaryCountInNotebook('nonexistent')).toBe(0)
    })

    it('returns count of messages missing summaries', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2', 'msg-3'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Has summary' },
        'msg-3': { id: 'msg-3', question: 'Q3', response: 'R3', responseSummary: null }
      }

      const { getMissingSummaryCountInNotebook } = useSpacedRepetition()
      expect(getMissingSummaryCountInNotebook('notebook-1')).toBe(2)
    })

    it('includes nested children in count', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null, childIds: ['msg-2'] },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null, childIds: ['msg-3'] },
        'msg-3': { id: 'msg-3', question: 'Q3', response: 'R3', responseSummary: null }
      }

      const { getMissingSummaryCountInNotebook } = useSpacedRepetition()
      expect(getMissingSummaryCountInNotebook('notebook-1')).toBe(3)
    })
  })

  describe('getMessagesWithSummaryInNotebook', () => {
    it('returns empty array when notebook does not exist', () => {
      const { getMessagesWithSummaryInNotebook } = useSpacedRepetition()
      expect(getMessagesWithSummaryInNotebook('nonexistent')).toEqual([])
    })

    it('returns messages with summaries in notebook', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const { getMessagesWithSummaryInNotebook } = useSpacedRepetition()
      const result = getMessagesWithSummaryInNotebook('notebook-1')

      expect(result).toHaveLength(1)
      expect(result[0].messageId).toBe('msg-1')
    })

    it('includes child messages with summaries', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1', childIds: ['msg-2'] },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Summary 2' }
      }

      const { getMessagesWithSummaryInNotebook } = useSpacedRepetition()
      const result = getMessagesWithSummaryInNotebook('notebook-1')

      expect(result).toHaveLength(2)
      expect(result.map(r => r.messageId)).toEqual(['msg-1', 'msg-2'])
    })
  })

  describe('getSummaryCountInNotebook', () => {
    it('returns 0 when notebook does not exist', () => {
      const { getSummaryCountInNotebook } = useSpacedRepetition()
      expect(getSummaryCountInNotebook('nonexistent')).toBe(0)
    })

    it('returns count of messages with summaries', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2', 'msg-3'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null },
        'msg-3': { id: 'msg-3', question: 'Q3', response: 'R3', responseSummary: 'Summary 3' }
      }

      const { getSummaryCountInNotebook } = useSpacedRepetition()
      expect(getSummaryCountInNotebook('notebook-1')).toBe(2)
    })
  })

  describe('clearSummariesInNotebook', () => {
    it('returns 0 when notebook does not exist', () => {
      const { clearSummariesInNotebook } = useSpacedRepetition()
      expect(clearSummariesInNotebook('nonexistent')).toBe(0)
    })

    it('clears all summaries in notebook', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Summary 2' }
      }

      const { clearSummariesInNotebook } = useSpacedRepetition()
      const result = clearSummariesInNotebook('notebook-1')

      expect(result).toBe(2)
      expect(chatStore.messagesById['msg-1'].responseSummary).toBe(null)
      expect(chatStore.messagesById['msg-2'].responseSummary).toBe(null)
    })

    it('clears summaries from child messages', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1', childIds: ['msg-2'] },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Summary 2' }
      }

      const { clearSummariesInNotebook } = useSpacedRepetition()
      const result = clearSummariesInNotebook('notebook-1')

      expect(result).toBe(2)
      expect(chatStore.messagesById['msg-1'].responseSummary).toBe(null)
      expect(chatStore.messagesById['msg-2'].responseSummary).toBe(null)
    })

    it('only clears summaries from specified notebook', () => {
      chatStore.chats = [
        { id: 'notebook-1', rootMessageIds: ['msg-1'] },
        { id: 'notebook-2', rootMessageIds: ['msg-2'] }
      ]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary 1' },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: 'Summary 2' }
      }

      const { clearSummariesInNotebook } = useSpacedRepetition()
      clearSummariesInNotebook('notebook-1')

      expect(chatStore.messagesById['msg-1'].responseSummary).toBe(null)
      expect(chatStore.messagesById['msg-2'].responseSummary).toBe('Summary 2')
    })

    it('returns 0 when no summaries to clear', () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null }
      }

      const { clearSummariesInNotebook } = useSpacedRepetition()
      expect(clearSummariesInNotebook('notebook-1')).toBe(0)
    })
  })

  describe('generateSummariesForNotebook', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      api.sendChatMessage.mockImplementation(async (model, messages, onChunk) => {
        onChunk('Generated summary')
      })
    })

    it('returns 0 when notebook does not exist', async () => {
      const { generateSummariesForNotebook } = useSpacedRepetition()
      const result = await generateSummariesForNotebook('nonexistent', 'gpt-4')
      expect(result).toBe(0)
    })

    it('returns 0 when no messages missing summaries', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Already has summary' }
      }

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const result = await generateSummariesForNotebook('notebook-1', 'gpt-4')
      expect(result).toBe(0)
    })

    it('generates summaries for all messages missing them', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4')

      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe(2)
      expect(updateSpy).toHaveBeenCalledTimes(2)
      expect(updateSpy).toHaveBeenCalledWith('msg-1', 'Generated summary')
      expect(updateSpy).toHaveBeenCalledWith('msg-2', 'Generated summary')
    })

    it('generates summaries for nested child messages', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Has summary', childIds: ['msg-2'] },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4')

      await vi.runAllTimersAsync()
      await promise

      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith('msg-2', 'Generated summary')
    })

    it('initializes SR cards for messages not in SR system', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }
      // msg-1 is already in SR, msg-2 is not
      chatStore.srData = { 'msg-1': { messageId: 'msg-1' } }

      const initSpy = vi.spyOn(chatStore, 'initializeSRCard')

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4')

      await vi.runAllTimersAsync()
      await promise

      // Should only initialize msg-2 (msg-1 was already in SR)
      expect(initSpy).toHaveBeenCalledTimes(1)
      expect(initSpy).toHaveBeenCalledWith('msg-2')
      // Both should now be in SR
      expect(chatStore.srData['msg-1']).toBeDefined()
      expect(chatStore.srData['msg-2']).toBeDefined()
    })

    it('calls onProgress callback with correct status', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const progressCalls = []
      const onProgress = (p) => progressCalls.push({ ...p })

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4', onProgress)

      await vi.runAllTimersAsync()
      await promise

      // Should have: generating(0), waiting(1), generating(1), done(2)
      expect(progressCalls.length).toBeGreaterThanOrEqual(3)
      expect(progressCalls[0]).toEqual({ completed: 0, total: 2, status: 'generating' })
      expect(progressCalls[progressCalls.length - 1]).toEqual({ completed: 2, total: 2, status: 'done' })
    })

    it('only generates summaries for specified notebook', async () => {
      chatStore.chats = [
        { id: 'notebook-1', rootMessageIds: ['msg-1'] },
        { id: 'notebook-2', rootMessageIds: ['msg-2'] }
      ]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { generateSummariesForNotebook } = useSpacedRepetition()
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4')

      await vi.runAllTimersAsync()
      await promise

      // Only msg-1 should be updated (from notebook-1)
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(updateSpy).toHaveBeenCalledWith('msg-1', 'Generated summary')
    })

    it('can be cancelled with abort signal', async () => {
      chatStore.chats = [{ id: 'notebook-1', rootMessageIds: ['msg-1', 'msg-2'] }]
      chatStore.messagesById = {
        'msg-1': { id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: null },
        'msg-2': { id: 'msg-2', question: 'Q2', response: 'R2', responseSummary: null }
      }

      const abortController = new AbortController()
      const updateSpy = vi.spyOn(chatStore, 'updateSRResponseSummary')

      const { generateSummariesForNotebook } = useSpacedRepetition()

      // Start the generation and immediately set up rejection handling
      const promise = generateSummariesForNotebook('notebook-1', 'gpt-4', null, abortController.signal)
        .catch(err => err) // Convert rejection to resolved value for testing

      // Let first message complete
      await vi.advanceTimersByTimeAsync(100)

      // Abort before second message
      abortController.abort()

      // Try to complete remaining timers
      await vi.runAllTimersAsync()

      // Should have thrown cancelled error (now resolved as the error object)
      const result = await promise
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('Cancelled')

      // Only first message should have been processed
      expect(updateSpy).toHaveBeenCalledTimes(1)
    })
  })
})
