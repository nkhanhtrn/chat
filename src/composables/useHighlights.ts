import type { Message } from '@/models/Message'
import type { CustomContent } from '@/types/message'

export interface HighlightStore {
  addCustomContent: (messageId: string, content: CustomContent) => string | null
  removeCustomContent: (messageId: string, contentId: string) => void
  updateCustomContent: (messageId: string, contentId: string, updates: Partial<CustomContent>) => void
}

export function useHighlights(store: HighlightStore, getMessage: () => Message | null) {
  function addQuestionLink(params: {
    text: string; targetMessageId: string; startOffset: number; endOffset: number; noteContent?: string; colorIndex?: number
  }): string | null {
    const message = getMessage()
    if (!params.text || !message) return null

    const link: CustomContent = {
      id: crypto.randomUUID(),
      type: 'question-link',
      text: params.text,
      targetMessageId: params.targetMessageId,
      startOffset: params.startOffset,
      endOffset: params.endOffset,
      colorIndex: params.colorIndex,
    }

    if (params.noteContent) {
      link.hasNote = true
      link.noteContent = params.noteContent
    }

    store.addCustomContent(message.id, link)
    return link.id
  }

  function removeContent(contentId: string): void {
    const message = getMessage()
    if (!contentId || !message) return
    store.removeCustomContent(message.id, contentId)
  }

  function updateContent(contentId: string, updates: Partial<CustomContent>): void {
    const message = getMessage()
    if (!contentId || !message) return
    store.updateCustomContent(message.id, contentId, updates)
  }

  function addNote(params: {
    text: string; startOffset: number; endOffset: number; noteContent: string; colorIndex?: number
  }): string | null {
    const message = getMessage()
    if (!params.text || !message) return null

    const note: CustomContent = {
      id: crypto.randomUUID(),
      type: 'note',
      text: params.text,
      startOffset: params.startOffset,
      endOffset: params.endOffset,
      hasNote: true,
      noteContent: params.noteContent,
      colorIndex: params.colorIndex,
    }

    store.addCustomContent(message.id, note)
    return note.id
  }

  return {
    addQuestionLink,
    addNote,
    removeContent,
    updateContent,
  }
}
