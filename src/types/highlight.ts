export interface EpubHighlight {
  id: string
  bookId: string
  cfiRange: string
  text: string
  context?: string
  colorIndex: number
  note?: string
  createdAt: number
  updatedAt: number
}

export interface EpubHighlightDraft {
  cfiRange: string
  text: string
  context?: string
  colorIndex: number
  note?: string
}
