import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { BookData } from '@/types/book'

// Mock Firebase modules
const mockSetDoc = vi.fn()
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref')
const mockDeleteDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: vi.fn().mockReturnValue('mock-col-ref'),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}))

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn().mockReturnValue({}),
  ref: vi.fn().mockReturnValue('mock-storage-ref'),
  uploadBytesResumable: vi.fn(),
  getBlob: vi.fn(),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}))

const mockGetFirebaseAuth = vi.fn().mockReturnValue({
  currentUser: { uid: 'test-user-123' },
})

vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}))

// Import after mocks
import { saveBookToFirestore, deleteBookFromFirestore, loadBooksFromFirestore } from '../firestore/firestore-books'

function makeBook(overrides: Partial<BookData> = {}): BookData {
  return {
    id: 'book-123',
    title: 'Test Book',
    author: 'Test Author',
    coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJ...',
    fileSize: 1024,
    fileInStorage: true,
    fileStoragePath: 'users/test-user-123/books/book-123/book.epub',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastCfi: null,
    fileCachedAt: null,
    readingProgress: 0,
    ...overrides,
  }
}

describe('firestore-books', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-establish auth mock after clearAllMocks
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: { uid: 'test-user-123' },
    })
  })

  describe('saveBookToFirestore', () => {
    it('saves book to Firestore with merge', async () => {
      const book = makeBook()
      await saveBookToFirestore(book)

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'test-user-123',
        'books',
        'book-123',
      )
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.any(Object),
        { merge: true },
      )
    })

    it('preserves coverUrl in Firestore payload', async () => {
      const book = makeBook({ coverUrl: 'data:image/jpeg;base64,abc123' })

      await saveBookToFirestore(book)

      const savedData = mockSetDoc.mock.calls[0][1]
      expect(savedData.coverUrl).toBe('data:image/jpeg;base64,abc123')
    })

    it('preserves other fields when stripping coverUrl', async () => {
      const book = makeBook({ title: 'My Book', author: 'Author', readingProgress: 42 })

      await saveBookToFirestore(book)

      const savedData = mockSetDoc.mock.calls[0][1]
      expect(savedData.id).toBe('book-123')
      expect(savedData.title).toBe('My Book')
      expect(savedData.author).toBe('Author')
      expect(savedData.readingProgress).toBe(42)
      expect(savedData.fileInStorage).toBe(true)
    })

    it('returns early if no authenticated user', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)

      await saveBookToFirestore(makeBook())

      expect(mockSetDoc).not.toHaveBeenCalled()
    })

    it('handles Vue reactive proxies by serializing to plain JSON', async () => {
      const book = makeBook()
      const reactiveBook = new Proxy(book, {
        get(target, prop) {
          return target[prop as keyof typeof target]
        },
      })

      await saveBookToFirestore(reactiveBook)

      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ id: 'book-123', title: 'Test Book' }),
        { merge: true },
      )
      const savedData = mockSetDoc.mock.calls[0][1]
      expect(savedData.coverUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJ...')
    })
  })

  describe('deleteBookFromFirestore', () => {
    it('deletes the Firestore document', async () => {
      await deleteBookFromFirestore('book-123')

      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref')
    })

    it('returns early if no authenticated user', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)

      await deleteBookFromFirestore('book-123')

      expect(mockDeleteDoc).not.toHaveBeenCalled()
    })
  })

  describe('loadBooksFromFirestore', () => {
    it('returns empty array if no authenticated user', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)

      const result = await loadBooksFromFirestore()

      expect(result).toEqual([])
    })
  })
})
