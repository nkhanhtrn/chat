import type { BookData, BookCreateParams, BookMetadata } from '@/types/book'

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
    }
  }

  static toPlain(bookData: Partial<BookData>): BookData {
    return new Book(bookData).toPlain()
  }

  static extractMetadata(book: Record<string, unknown>): BookMetadata {
    const { fileData, fileDataArrayBuffer, ...rest } = book
    return Book.toPlain(rest as Partial<BookData>)
  }

  static fromPlain(data: BookCreateParams): Book {
    return new Book(data)
  }

  touch(): BookData {
    this.updatedAt = Date.now()
    return this.toPlain()
  }
}
