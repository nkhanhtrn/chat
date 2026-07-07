import type { BookData, BookCreateParams, ItemMeta, PaperMeta } from '@/types/book'

export class Book {
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
  category: 'book' | 'paper'
  meta: ItemMeta | null

  constructor(data: BookCreateParams = {}) {
    this.id = data.id ?? crypto.randomUUID()
    this.title = data.title ?? ''
    this.author = data.author ?? ''
    this.coverUrl = data.coverUrl ?? ''
    this.fileSize = data.fileSize ?? 0
    this.fileInStorage = data.fileInStorage ?? false
    this.fileStoragePath = data.fileStoragePath ?? ''
    this.createdAt = Date.now()
    this.updatedAt = Date.now()
    this.lastCfi = data.lastCfi ?? null
    this.fileCachedAt = null
    this.readingProgress = data.readingProgress ?? 0
    this.fileType = data.fileType ?? 'epub'
    this.lastPage = data.lastPage ?? null
    this.totalPages = data.totalPages ?? null
    this.category = data.category ?? 'book'
    this.meta = data.meta ?? data.paperMeta ?? null
  }

  toPlain(): BookData {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      coverUrl: this.coverUrl,
      fileSize: this.fileSize,
      fileInStorage: this.fileInStorage,
      fileStoragePath: this.fileStoragePath,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastCfi: this.lastCfi,
      fileCachedAt: this.fileCachedAt,
      readingProgress: this.readingProgress,
      fileType: this.fileType,
      lastPage: this.lastPage,
      totalPages: this.totalPages,
      category: this.category,
      meta: this.meta,
    }
  }

  static toPlain(bookData: Partial<BookData>): BookData {
    return new Book(bookData).toPlain()
  }

  static fromPlain(data: BookCreateParams): Book {
    return new Book(data)
  }

  touch(): BookData {
    this.updatedAt = Date.now()
    return this.toPlain()
  }
}
