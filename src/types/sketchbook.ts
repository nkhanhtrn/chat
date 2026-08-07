export interface Sketchbook {
  id: string
  title: string
  /** Number of pages (at least 1). Persisted so blank navigated pages survive. */
  pageCount: number
  createdAt: number
  updatedAt: number
}

/** The IndexedDB/Firestore key prefix used to namespace a sketchbook's strokes. */
export function sketchbookKey(id: string): string {
  return `notebook:${id}`
}

/** A4 page size at 96 DPI (210mm × 297mm). The logical coordinate space for strokes. */
export const PAGE_WIDTH = 794
export const PAGE_HEIGHT = 1123

