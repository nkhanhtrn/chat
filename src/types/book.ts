/** Book data model */
export interface BookData {
  id: string
  title: string
  author: string
  coverUrl: string
  fileSize: number
  fileInStorage: boolean
  fileStoragePath: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  lastCfi: string | null
  fileCachedAt: number | null
}

/** Book metadata (excludes file data) */
export type BookMetadata = Omit<BookData, never>

/** Book with optional file data for reading */
export interface BookWithData extends BookData {
  fileData?: ArrayBuffer | null
  fileDataArrayBuffer?: ArrayBuffer | null
}

/** Book create/update params */
export interface BookCreateParams {
  id?: string
  title?: string
  author?: string
  coverUrl?: string
  fileSize?: number
  fileInStorage?: boolean
  fileStoragePath?: string
  lastCfi?: string | null
}
