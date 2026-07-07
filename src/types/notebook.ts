/** A single chat/notebook session */
export interface Notebook {
  id: string
  name: string
  rootMessageIds: string[]
  scratchpad?: string
  messageCount?: number
  lastAccessedAt?: number
}

/** Computed list item for the notebooks home page */
export interface NotebookListItem {
  id: string
  title: string
  messageCount: number
  questions: Array<{
    id: string
    text: string
    chatId: string
    rootIndex: number
  }>
}
