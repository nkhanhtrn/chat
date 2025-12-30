import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveBookToFirestore,
  loadBooksFromFirestore,
  deleteBookFromFirestore,
  uploadBookToStorage,
  getBookDownloadUrl,
  downloadBookFromStorage,
  deleteBookFromFirebaseStorage,
  saveBookToStorage,
  loadBooksFromStorage,
  deleteBookFromStorage,
  getOrDownloadBookFile
} from '../bookStorage.js'
import * as indexedDB from '../indexedDB.js'

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => ({ __timestamp: true }))
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(() => Promise.resolve({})),
  getDownloadURL: vi.fn(() => Promise.resolve('https://storage.example.com/book.epub')),
  deleteObject: vi.fn(() => Promise.resolve())
}))

vi.mock('../firebase.js', () => ({
  getFirebaseDb: vi.fn(() => ({})),
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user-123' }
  })),
  getFirebaseStorage: vi.fn(() => ({}))
}))

vi.mock('../indexedDB.js', () => ({
  saveBookToIDB: vi.fn(() => Promise.resolve()),
  loadBooksFromIDB: vi.fn(() => Promise.resolve([])),
  deleteBookFromIDB: vi.fn(() => Promise.resolve()),
  getBookFileFromIDB: vi.fn(() => Promise.resolve(null)),
  saveBookFileToIDB: vi.fn(() => Promise.resolve())
}))

vi.mock('../firestore.js', () => ({
  mergeCloudLocal: vi.fn(() => ({
    merged: [],
    toUpload: [],
    fromCloud: 0,
    toCloud: 0
  }))
}))

describe('bookStorage.js - Firestore Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset to authenticated user by default
    const { getFirebaseAuth } = await import('../firebase.js')
    vi.mocked(getFirebaseAuth).mockReturnValue({ currentUser: { uid: 'test-user-123' } })
  })

  describe('saveBookToFirestore', () => {
    it('saves book metadata to Firestore', async () => {
      const { setDoc } = await import('firebase/firestore')
      const book = {
        id: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        fileData: new ArrayBuffer(1024), // Should be excluded
        coverUrl: 'data:image/png;base64,abc'
      }

      await saveBookToFirestore(book)

      expect(setDoc).toHaveBeenCalled()
      const savedData = setDoc.mock.calls[0][1]
      expect(savedData.id).toBe('book-123')
      expect(savedData.title).toBe('Test Book')
      expect(savedData.fileData).toBeUndefined() // fileData should be excluded
    })

    it('includes server timestamp', async () => {
      const { setDoc, serverTimestamp } = await import('firebase/firestore')
      const book = { id: 'book-123', title: 'Test' }

      await saveBookToFirestore(book)

      const savedData = setDoc.mock.calls[0][1]
      expect(savedData.lastUpdated).toEqual({ __timestamp: true })
    })

    it('handles Firestore errors', async () => {
      const { setDoc } = await import('firebase/firestore')
      vi.mocked(setDoc).mockRejectedValueOnce(new Error('Firestore error'))

      const book = { id: 'book-123', title: 'Test' }

      await expect(saveBookToFirestore(book)).rejects.toThrow()
    })
  })

  describe('loadBooksFromFirestore', () => {
    it('loads books from Firestore', async () => {
      const { getDocs, collection } = await import('firebase/firestore')
      const mockDocs = [
        { data: () => ({ id: 'book-1', title: 'Book 1' }) },
        { data: () => ({ id: 'book-2', title: 'Book 2' }) }
      ]
      getDocs.mockResolvedValue({ docs: mockDocs })

      const books = await loadBooksFromFirestore()

      expect(books).toHaveLength(2)
      expect(books[0].title).toBe('Book 1')
    })

    it('returns empty array when user not authenticated', async () => {
      const { getFirebaseAuth } = await import('../firebase.js')
      vi.mocked(getFirebaseAuth).mockReturnValue({ currentUser: null })

      const books = await loadBooksFromFirestore()

      expect(books).toEqual([])
    })

    it('handles Firestore errors gracefully', async () => {
      const { getDocs } = await import('firebase/firestore')
      vi.mocked(getDocs).mockRejectedValueOnce(new Error('Network error'))

      const books = await loadBooksFromFirestore()

      expect(books).toEqual([])
    })
  })

  describe('deleteBookFromFirestore', () => {
    it('deletes book from Firestore', async () => {
      const { deleteDoc } = await import('firebase/firestore')

      await deleteBookFromFirestore('book-123')

      expect(deleteDoc).toHaveBeenCalled()
    })

    it('handles delete errors', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('Delete failed'))

      await expect(deleteBookFromFirestore('book-123')).rejects.toThrow()
    })
  })
})

describe('bookStorage.js - Firebase Storage Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset to authenticated user by default
    const { getFirebaseAuth } = await import('../firebase.js')
    vi.mocked(getFirebaseAuth).mockReturnValue({ currentUser: { uid: 'test-user-123' } })
  })

  describe('uploadBookToStorage', () => {
    it('uploads File to Firebase Storage', async () => {
      const { uploadBytes, getDownloadURL } = await import('firebase/storage')
      const mockFile = new File([new ArrayBuffer(1024)], 'test.epub')

      const url = await uploadBookToStorage(mockFile, 'book-123')

      expect(uploadBytes).toHaveBeenCalled()
      expect(getDownloadURL).toHaveBeenCalled()
      expect(url).toBe('https://storage.example.com/book.epub')
    })

    it('uploads ArrayBuffer to Firebase Storage', async () => {
      const { uploadBytes, getDownloadURL } = await import('firebase/storage')
      const mockBuffer = new ArrayBuffer(1024)

      const url = await uploadBookToStorage(mockBuffer, 'book-123')

      expect(uploadBytes).toHaveBeenCalled()
      expect(url).toBe('https://storage.example.com/book.epub')
    })

    it('handles upload errors', async () => {
      const { uploadBytes } = await import('firebase/storage')
      vi.mocked(uploadBytes).mockRejectedValueOnce(new Error('Upload failed'))

      const mockFile = new File([new ArrayBuffer(1024)], 'test.epub')

      await expect(uploadBookToStorage(mockFile, 'book-123')).rejects.toThrow()
    })
  })

  describe('getBookDownloadUrl', () => {
    it('returns download URL', async () => {
      const { getDownloadURL } = await import('firebase/storage')

      const url = await getBookDownloadUrl('book-123')

      expect(url).toBe('https://storage.example.com/book.epub')
    })

    it('handles URL fetch errors', async () => {
      const { getDownloadURL } = await import('firebase/storage')
      vi.mocked(getDownloadURL).mockRejectedValueOnce(new Error('Not found'))

      await expect(getBookDownloadUrl('book-123')).rejects.toThrow()
    })
  })

  describe('downloadBookFromStorage', () => {
    it('downloads book as ArrayBuffer', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
        })
      )

      const buffer = await downloadBookFromStorage('book-123', 'https://example.com/book.epub')

      expect(buffer).toBeInstanceOf(ArrayBuffer)
      expect(buffer.byteLength).toBe(2048)
    })

    it('fetches URL if not provided', async () => {
      const { getDownloadURL } = await import('firebase/storage')
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        })
      )

      await downloadBookFromStorage('book-123')

      expect(getDownloadURL).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith('https://storage.example.com/book.epub')
    })

    it('throws error for empty download', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
        })
      )

      await expect(downloadBookFromStorage('book-123')).rejects.toThrow('Downloaded EPUB file is empty')
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Not Found'
        })
      )

      await expect(downloadBookFromStorage('book-123')).rejects.toThrow()
    })
  })

  describe('deleteBookFromFirebaseStorage', () => {
    it('deletes book file from Firebase Storage', async () => {
      const { deleteObject } = await import('firebase/storage')

      await deleteBookFromFirebaseStorage('book-123')

      expect(deleteObject).toHaveBeenCalled()
    })

    it('handles delete errors gracefully', async () => {
      const { deleteObject } = await import('firebase/storage')
      vi.mocked(deleteObject).mockRejectedValueOnce(new Error('Delete failed'))

      // Should not throw
      await expect(deleteBookFromFirebaseStorage('book-123')).resolves.not.toThrow()
    })
  })
})

describe('bookStorage.js - Combined Storage Functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset to authenticated user by default
    const { getFirebaseAuth } = await import('../firebase.js')
    vi.mocked(getFirebaseAuth).mockReturnValue({ currentUser: { uid: 'test-user-123' } })
  })

  describe('saveBookToStorage', () => {
    it('saves to both IndexedDB and Firestore', async () => {
      const book = {
        id: 'book-123',
        title: 'Test Book',
        fileData: new ArrayBuffer(1024)
      }

      await saveBookToStorage(book)

      expect(indexedDB.saveBookToIDB).toHaveBeenCalled()
      // Check that fileData was excluded
      const savedToIDB = indexedDB.saveBookToIDB.mock.calls[0][0]
      expect(savedToIDB.fileData).toBeUndefined()
    })
  })

  describe('loadBooksFromStorage', () => {
    it('loads and merges books from both sources', async () => {
      const localBooks = [
        { id: 'book-1', title: 'Local Book' }
      ]
      const { mergeCloudLocal } = await import('../firestore.js')
      mergeCloudLocal.mockReturnValue({
        merged: localBooks,
        fromCloud: 0,
        toCloud: 0
      })

      vi.mocked(indexedDB.loadBooksFromIDB).mockResolvedValue(localBooks)

      const result = await loadBooksFromStorage()

      expect(result.state.books).toEqual(localBooks)
    })

    it('handles errors gracefully', async () => {
      vi.mocked(indexedDB.loadBooksFromIDB).mockRejectedValue(new Error('Load failed'))

      const result = await loadBooksFromStorage()

      expect(result.hasConflict).toBe(false)
      expect(result.state.books).toEqual([])
    })
  })

  describe('deleteBookFromStorage', () => {
    it('deletes from all storage sources', async () => {
      await deleteBookFromStorage('book-123')

      expect(indexedDB.deleteBookFromIDB).toHaveBeenCalledWith('book-123')
    })
  })

  describe('getOrDownloadBookFile', () => {
    it('returns cached file from IndexedDB', async () => {
      const cachedBuffer = new ArrayBuffer(1024)
      vi.mocked(indexedDB.getBookFileFromIDB).mockResolvedValue(cachedBuffer)

      const result = await getOrDownloadBookFile('book-123', 'storage-path')

      expect(result).toBe(cachedBuffer)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('downloads and caches file when not in IndexedDB', async () => {
      vi.mocked(indexedDB.getBookFileFromIDB).mockResolvedValue(null)

      const downloadedBuffer = new ArrayBuffer(2048)
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(downloadedBuffer)
        })
      )

      const result = await getOrDownloadBookFile('book-123', 'storage-path')

      expect(result).toBe(downloadedBuffer)
      expect(indexedDB.saveBookFileToIDB).toHaveBeenCalledWith('book-123', downloadedBuffer)
    })

    it('uses cached file with content', async () => {
      const cachedBuffer = new ArrayBuffer(100)
      vi.mocked(indexedDB.getBookFileFromIDB).mockResolvedValue(cachedBuffer)

      const result = await getOrDownloadBookFile('book-123', 'storage-path')

      expect(result.byteLength).toBe(100)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('downloads when cache is empty', async () => {
      const emptyBuffer = new ArrayBuffer(0)
      vi.mocked(indexedDB.getBookFileFromIDB).mockResolvedValue(emptyBuffer)

      const downloadedBuffer = new ArrayBuffer(2048)
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(downloadedBuffer)
        })
      )

      const result = await getOrDownloadBookFile('book-123', 'storage-path')

      expect(result).toBe(downloadedBuffer)
      expect(fetch).toHaveBeenCalled()
    })
  })
})
