import type { CustomContent, LinkedFromEntry, MessageCreateParams } from '@/types/message'

export class Message {
  id: string
  question: string
  questionSummarized: string | null
  response: string
  responseSummary: string
  parentId: string | null
  childIds: string[]
  highlightedText: string | null
  lastVisitedChild: string | null
  customContent: CustomContent[]
  scrollPosition: number
  createdAt: number
  chatId: string | null
  linkedFrom?: LinkedFromEntry[]
  openCodeSessionId?: string | null

  static createChildMessage(
    parentId: string,
    question: string,
    highlightedText: string | null = null,
    chatId: string | null = null
  ): Message {
    return new Message({
      id: crypto.randomUUID(),
      question,
      response: '',
      parentId,
      childIds: [],
      highlightedText,
      chatId,
      createdAt: Date.now()
    })
  }

  constructor(params: MessageCreateParams & { id?: string }) {
    this.id = params.id ?? crypto.randomUUID()
    this.question = params.question
    this.questionSummarized = params.questionSummarized ??
      (params.question.length > 100 ? params.question.slice(0, 100) + '...' : params.question)
    this.response = params.response ?? ''
    this.responseSummary = params.responseSummary ?? ''
    this.parentId = params.parentId ?? null
    this.childIds = params.childIds ?? []
    this.highlightedText = params.highlightedText ?? null
    this.lastVisitedChild = params.lastVisitedChild ?? null
    this.customContent = params.customContent ?? []
    this.scrollPosition = params.scrollPosition ?? 0
    this.createdAt = params.createdAt ?? Date.now()
    this.chatId = params.chatId ?? null
    this.openCodeSessionId = params.openCodeSessionId ?? null
  }

  addChild(childId: string): void {
    this.childIds.push(childId)
    this.lastVisitedChild = childId
  }

  updateQuestionSummarized(summary?: string | null): void {
    if (summary) {
      this.questionSummarized = summary
    } else if (typeof this.response === 'string') {
      const lines = this.response.split('\n')
      this.questionSummarized = lines[0] ?? ''
      this.response = lines.slice(1).join('\n')
    }
  }
}
