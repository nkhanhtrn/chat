export type StrokeTool = 'pen' | 'highlighter'

export interface StrokePoint {
  x: number
  y: number
}

export interface Stroke {
  id: string
  bookId: string
  page: number
  tool: StrokeTool
  colorIndex: number
  points: StrokePoint[]
  createdAt: number
  updatedAt: number
}

/** Emitted by the drawing layer before it becomes a persisted Stroke. */
export interface StrokeDraft {
  id: string
  page: number
  tool: StrokeTool
  colorIndex: number
  points: StrokePoint[]
}
