/** Custom content item types that can be attached to a message */
export type CustomContentType = 'question-link' | 'note'

/** Base custom content item */
export interface CustomContentBase {
  id: string
  type: CustomContentType
  text: string
  startOffset: number
  endOffset: number
  hasNote?: boolean
  noteContent?: string
  colorIndex?: number
}

/** A link from text to another question/message */
export interface QuestionLink extends CustomContentBase {
  type: 'question-link'
  targetMessageId: string
}

/** An inline note attached to text */
export interface NoteContent extends CustomContentBase {
  type: 'note'
}

/** Union of all custom content types */
export type CustomContent = QuestionLink | NoteContent

/** Back-reference from a target message to linking messages */
export interface LinkedFromEntry {
  sourceMessageId: string
  linkId: string
}

/** Plain object representation of a Message (for serialization) */
export interface MessageData {
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
}

/** Data needed to create a new message */
export interface MessageCreateParams {
  id?: string
  question: string
  response?: string
  parentId?: string | null
  childIds?: string[]
  highlightedText?: string | null
  questionSummarized?: string | null
  lastVisitedChild?: string | null
  customContent?: CustomContent[]
  scrollPosition?: number
  responseSummary?: string
  createdAt?: number
  chatId?: string | null
  openCodeSessionId?: string | null
}
