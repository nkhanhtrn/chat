export type BookCategory = 'book' | 'paper'

export interface BaseMeta {
  year: number | null
  abstract: string | null
  keywords: string[]
  language: string | null
}

export interface BookMeta extends BaseMeta {
  publisher: string | null
  isbn: string | null
  series: string | null
  edition: string | null
}

export interface PaperMeta extends BaseMeta {
  doi: string | null
  journal: string | null
  bibtex: string | null
  citationCount: number | null
}

export type ItemMeta = BookMeta | PaperMeta

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
  category: BookCategory
  meta: ItemMeta | null
  paperMeta?: PaperMeta | null
}

/** Unified TOC item for both EPUB and PDF */
export interface TocItem {
  id: string | undefined
  label: string
  href: string
  subitems?: TocItem[]
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
  category?: BookCategory
  meta?: ItemMeta | null
  paperMeta?: PaperMeta | null
}
