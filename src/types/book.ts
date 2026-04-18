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
  lastCfi: string | null
  fileCachedAt: number | null
  readingProgress: number
  fileType: 'epub' | 'pdf'
  lastPage: number | null
  totalPages: number | null
}

/** Unified TOC item for both EPUB and PDF */
export interface TocItem {
  id: string | undefined
  label: string
  href: string
  subitems?: TocItem[]
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
  readingProgress?: number
  fileType?: 'epub' | 'pdf'
  lastPage?: number | null
  totalPages?: number | null
}
