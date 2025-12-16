import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHighlights } from '../useHighlights.js'

describe('useHighlights', () => {
  let mockStore
  let currentMessage

  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'mock-uuid-123'
    })

    currentMessage = {
      id: 'msg-1',
      response: 'Hello world this is a test',
      customContent: []
    }

    mockStore = {
      addCustomContent: vi.fn(),
      removeCustomContent: vi.fn(),
      updateCustomContent: vi.fn(),
      findVocabCardByWord: vi.fn(),
      addVocabCard: vi.fn()
    }
  })

  describe('addHighlight', () => {
    it('adds highlight to store', () => {
      const { addHighlight } = useHighlights(mockStore, () => currentMessage)

      const result = addHighlight('world', 6, 11, 0)

      expect(result).toBe('mock-uuid-123')
      expect(mockStore.addCustomContent).toHaveBeenCalledWith('msg-1', {
        id: 'mock-uuid-123',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11
      })
    })

    it('returns null when text is empty', () => {
      const { addHighlight } = useHighlights(mockStore, () => currentMessage)

      const result = addHighlight('', 0, 0, 0)

      expect(result).toBe(null)
      expect(mockStore.addCustomContent).not.toHaveBeenCalled()
    })

    it('returns null when message is null', () => {
      const { addHighlight } = useHighlights(mockStore, () => null)

      const result = addHighlight('text', 0, 4, 0)

      expect(result).toBe(null)
      expect(mockStore.addCustomContent).not.toHaveBeenCalled()
    })

    it('returns null when offsets are undefined', () => {
      const { addHighlight } = useHighlights(mockStore, () => currentMessage)

      const result = addHighlight('text', undefined, 4, 0)

      expect(result).toBe(null)
      expect(mockStore.addCustomContent).not.toHaveBeenCalled()
    })

    it('uses provided color index', () => {
      const { addHighlight } = useHighlights(mockStore, () => currentMessage)

      addHighlight('text', 0, 4, 3)

      expect(mockStore.addCustomContent).toHaveBeenCalledWith('msg-1', expect.objectContaining({
        colorIndex: 3
      }))
    })
  })

  describe('removeHighlight', () => {
    it('removes highlight from store', () => {
      const { removeHighlight } = useHighlights(mockStore, () => currentMessage)

      removeHighlight('h123')

      expect(mockStore.removeCustomContent).toHaveBeenCalledWith('msg-1', 'h123')
    })

    it('does nothing when highlightId is null', () => {
      const { removeHighlight } = useHighlights(mockStore, () => currentMessage)

      removeHighlight(null)

      expect(mockStore.removeCustomContent).not.toHaveBeenCalled()
    })

    it('does nothing when message is null', () => {
      const { removeHighlight } = useHighlights(mockStore, () => null)

      removeHighlight('h123')

      expect(mockStore.removeCustomContent).not.toHaveBeenCalled()
    })
  })

  describe('updateHighlight', () => {
    it('updates highlight in store', () => {
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight('h123', { colorIndex: 2 })

      expect(mockStore.updateCustomContent).toHaveBeenCalledWith('msg-1', 'h123', { colorIndex: 2 })
    })

    it('does nothing when highlightId is null', () => {
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight(null, { colorIndex: 2 })

      expect(mockStore.updateCustomContent).not.toHaveBeenCalled()
    })

    it('does nothing when message is null', () => {
      const { updateHighlight } = useHighlights(mockStore, () => null)

      updateHighlight('h123', { colorIndex: 2 })

      expect(mockStore.updateCustomContent).not.toHaveBeenCalled()
    })
  })

  describe('addHighlightWithNote', () => {
    it('adds highlight with note to store', () => {
      const { addHighlightWithNote } = useHighlights(mockStore, () => currentMessage)

      const result = addHighlightWithNote({
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        colorIndex: 1,
        noteContent: 'my note'
      })

      expect(result).toBe('mock-uuid-123')
      expect(mockStore.addCustomContent).toHaveBeenCalledWith('msg-1', {
        id: 'mock-uuid-123',
        type: 'highlight',
        text: 'test',
        colorIndex: 1,
        startOffset: 0,
        endOffset: 4,
        hasNote: true,
        noteContent: 'my note'
      })
    })

    it('returns null when text is empty', () => {
      const { addHighlightWithNote } = useHighlights(mockStore, () => currentMessage)

      const result = addHighlightWithNote({
        text: '',
        startOffset: 0,
        endOffset: 0,
        noteContent: 'note'
      })

      expect(result).toBe(null)
    })

    it('creates vocab card with highlightId when adding highlight with note', () => {
      mockStore.findVocabCardByWord.mockReturnValue(null)
      const { addHighlightWithNote } = useHighlights(mockStore, () => currentMessage)

      addHighlightWithNote({
        text: 'vocabulary',
        startOffset: 0,
        endOffset: 10,
        noteContent: 'definition here'
      })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('vocabulary')
      expect(mockStore.addVocabCard).toHaveBeenCalledWith({
        word: 'vocabulary',
        definition: '',
        context: '',
        messageId: 'msg-1',
        highlightId: 'mock-uuid-123'
      })
    })

    it('does not create vocab card if word already exists', () => {
      mockStore.findVocabCardByWord.mockReturnValue({ id: 'existing-vocab' })
      const { addHighlightWithNote } = useHighlights(mockStore, () => currentMessage)

      addHighlightWithNote({
        text: 'vocabulary',
        startOffset: 0,
        endOffset: 10,
        noteContent: 'definition here'
      })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('vocabulary')
      expect(mockStore.addVocabCard).not.toHaveBeenCalled()
    })
  })

  describe('addQuestionLink', () => {
    it('adds question link to store', () => {
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      const result = addQuestionLink({
        text: 'link text',
        targetMessageId: 'target-123',
        startOffset: 10,
        endOffset: 20
      })

      expect(result).toBe('mock-uuid-123')
      expect(mockStore.addCustomContent).toHaveBeenCalledWith('msg-1', {
        id: 'mock-uuid-123',
        type: 'question-link',
        text: 'link text',
        targetMessageId: 'target-123',
        startOffset: 10,
        endOffset: 20
      })
    })

    it('includes note when noteContent is provided', () => {
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      addQuestionLink({
        text: 'link',
        targetMessageId: 'target-123',
        startOffset: 0,
        endOffset: 4,
        noteContent: 'preserved note'
      })

      expect(mockStore.addCustomContent).toHaveBeenCalledWith('msg-1', expect.objectContaining({
        hasNote: true,
        noteContent: 'preserved note'
      }))
    })

    it('returns null when text is empty', () => {
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      const result = addQuestionLink({
        text: '',
        targetMessageId: 'target-123',
        startOffset: 0,
        endOffset: 0
      })

      expect(result).toBe(null)
    })

    it('creates vocab card with highlightId when adding question link with note', () => {
      mockStore.findVocabCardByWord.mockReturnValue(null)
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      addQuestionLink({
        text: 'linked term',
        targetMessageId: 'target-123',
        startOffset: 0,
        endOffset: 11,
        noteContent: 'some note'
      })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('linked term')
      expect(mockStore.addVocabCard).toHaveBeenCalledWith({
        word: 'linked term',
        definition: '',
        context: '',
        messageId: 'msg-1',
        highlightId: 'mock-uuid-123'
      })
    })

    it('does not create vocab card when question link has no note', () => {
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      addQuestionLink({
        text: 'linked term',
        targetMessageId: 'target-123',
        startOffset: 0,
        endOffset: 11
      })

      expect(mockStore.addVocabCard).not.toHaveBeenCalled()
    })

    it('does not create vocab card if word already exists', () => {
      mockStore.findVocabCardByWord.mockReturnValue({ id: 'existing-vocab' })
      const { addQuestionLink } = useHighlights(mockStore, () => currentMessage)

      addQuestionLink({
        text: 'linked term',
        targetMessageId: 'target-123',
        startOffset: 0,
        endOffset: 11,
        noteContent: 'some note'
      })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('linked term')
      expect(mockStore.addVocabCard).not.toHaveBeenCalled()
    })
  })

  describe('updateHighlight - vocab card creation', () => {
    it('creates vocab card with highlightId when adding note to existing highlight', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', text: 'existing word', startOffset: 0, endOffset: 13 }
      ]
      mockStore.findVocabCardByWord.mockReturnValue(null)
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight('h1', { hasNote: true, noteContent: 'new note' })

      expect(mockStore.updateCustomContent).toHaveBeenCalledWith('msg-1', 'h1', { hasNote: true, noteContent: 'new note' })
      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('existing word')
      expect(mockStore.addVocabCard).toHaveBeenCalledWith({
        word: 'existing word',
        definition: '',
        context: '',
        messageId: 'msg-1',
        highlightId: 'h1'
      })
    })

    it('creates vocab card when editing note if card does not exist', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', text: 'existing word', startOffset: 0, endOffset: 13, hasNote: true }
      ]
      mockStore.findVocabCardByWord.mockReturnValue(null)
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight('h1', { noteContent: 'edited note' })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('existing word')
      expect(mockStore.addVocabCard).toHaveBeenCalledWith({
        word: 'existing word',
        definition: '',
        context: '',
        messageId: 'msg-1',
        highlightId: 'h1'
      })
    })

    it('does not create vocab card if one already exists for the word', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', text: 'existing word', startOffset: 0, endOffset: 13 }
      ]
      mockStore.findVocabCardByWord.mockReturnValue({ id: 'vocab-123' })
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight('h1', { noteContent: 'updated note' })

      expect(mockStore.findVocabCardByWord).toHaveBeenCalledWith('existing word')
      expect(mockStore.addVocabCard).not.toHaveBeenCalled()
    })

    it('does not create vocab card when updating other properties', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', text: 'word', startOffset: 0, endOffset: 4 }
      ]
      const { updateHighlight } = useHighlights(mockStore, () => currentMessage)

      updateHighlight('h1', { colorIndex: 2 })

      expect(mockStore.updateCustomContent).toHaveBeenCalled()
      expect(mockStore.addVocabCard).not.toHaveBeenCalled()
    })
  })

  describe('createEffectiveCustomContent', () => {
    it('returns base custom content when no temp highlight', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }
      ]

      const { createEffectiveCustomContent } = useHighlights(mockStore, () => currentMessage)
      const effectiveContent = createEffectiveCustomContent(() => null)

      expect(effectiveContent.value).toEqual(currentMessage.customContent)
    })

    it('appends temp highlight when no overlap', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', startOffset: 0, endOffset: 5 }
      ]

      const tempHighlight = {
        id: 'temp',
        type: 'highlight',
        startOffset: 10,
        endOffset: 15,
        text: 'test'
      }

      const { createEffectiveCustomContent } = useHighlights(mockStore, () => currentMessage)
      const effectiveContent = createEffectiveCustomContent(() => tempHighlight)

      expect(effectiveContent.value).toHaveLength(2)
    })

    it('merges overlapping highlights', () => {
      currentMessage.customContent = [
        { id: 'h1', type: 'highlight', startOffset: 0, endOffset: 10 }
      ]

      const tempHighlight = {
        id: 'temp',
        type: 'highlight',
        startOffset: 5,
        endOffset: 15,
        text: 'overlap'
      }

      const { createEffectiveCustomContent } = useHighlights(mockStore, () => currentMessage)
      const effectiveContent = createEffectiveCustomContent(() => tempHighlight)

      expect(effectiveContent.value).toHaveLength(1)
      expect(effectiveContent.value[0].startOffset).toBe(0)
      expect(effectiveContent.value[0].endOffset).toBe(15)
    })

    it('returns empty array when message has no customContent', () => {
      currentMessage.customContent = undefined

      const { createEffectiveCustomContent } = useHighlights(mockStore, () => currentMessage)
      const effectiveContent = createEffectiveCustomContent(() => null)

      expect(effectiveContent.value).toEqual([])
    })

    it('is reactive to temp highlight changes', () => {
      currentMessage.customContent = []

      let tempValue = null

      const { createEffectiveCustomContent } = useHighlights(mockStore, () => currentMessage)
      const effectiveContent = createEffectiveCustomContent(() => tempValue)

      expect(effectiveContent.value).toHaveLength(0)

      // Note: In a real Vue scenario, you'd use ref() for tempValue
      // Here we're just testing the function logic
    })
  })
})
