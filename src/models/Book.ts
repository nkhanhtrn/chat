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
  deletedAt: number | null
  lastCfi: string | null
  fileCachedAt: number | null

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
    this.deletedAt = null
    this.lastCfi = data.lastCfi ?? null
    this.fileCachedAt = null
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
      deletedAt: this.deletedAt,
      lastCfi: this.lastCfi,
      fileCachedAt: this.fileCachedAt
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
