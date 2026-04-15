import type { CustomContent, LinkedFromEntry, MessageData, MessageCreateParams } from '@/types/message'

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
  }

  get hasChildren(): boolean {
    return this.childIds.length > 0
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

  toPlain(): MessageData {
    return {
      id: this.id,
      question: this.question,
      questionSummarized: this.questionSummarized,
      response: this.response,
      responseSummary: this.responseSummary,
      parentId: this.parentId,
      childIds: [...this.childIds],
      highlightedText: this.highlightedText,
      lastVisitedChild: this.lastVisitedChild,
      customContent: this.customContent.map(c => ({ ...c })),
      scrollPosition: this.scrollPosition,
      createdAt: this.createdAt,
      chatId: this.chatId,
      ...(this.linkedFrom ? { linkedFrom: [...this.linkedFrom] } : {})
    }
  }
}
