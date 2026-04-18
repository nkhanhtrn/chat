import { getDB } from './sync/IndexedDBService'
import { loadBooksFromFirestore } from './firestore/firestore-books'
import { getFirebaseAuth } from './firebase'
import type { BookData } from '@/types/book'

const BOOKS_STORE = 'books'

export async function syncBookList(): Promise<Record<string, unknown>> {
  try {
    const db = await getDB()

    // Step 1: Load from IndexedDB
    let localBooks: BookData[] = []
    if (db.objectStoreNames?.contains(BOOKS_STORE)) {
      const allBooks = await db.getAll(BOOKS_STORE)
      localBooks = allBooks as BookData[]
    }

    // Step 2: Load from Firestore if online
    let cloudBooks: BookData[] = []
    const authUser = getFirebaseAuth()?.currentUser
    if (typeof navigator !== 'undefined' && navigator.onLine && authUser) {
      try {
        const result = await loadBooksFromFirestore()
        cloudBooks = Array.isArray(result) ? result : []
      } catch {
        // Cloud load failed, use local data
      }
    }

    // Step 3: Merge - cloud wins for metadata, keep local-only books
    let mergedBooks: BookData[] = []

    if (cloudBooks.length > 0) {
      const cloudIds = new Set(cloudBooks.map(b => b.id))
      mergedBooks = [...cloudBooks]

      // Add local-only books (not yet in cloud)
      for (const localBook of localBooks) {
        if (!cloudIds.has(localBook.id)) {
          mergedBooks.push(localBook)
        }
      }

      // Persist merged list to IndexedDB
      for (const book of mergedBooks) {
        await saveBookMetadata(book)
      }
    } else {
      mergedBooks = localBooks
    }

    return {
      books: mergedBooks,
      lastSyncedAt: Date.now(),
      hasConflict: false,
    }
  } catch (error) {
    console.error('[BookSync] syncBookList error:', error)
    return { books: [], lastSyncedAt: Date.now(), hasConflict: false }
  }
}

export async function syncBookContent(bookId: string): Promise<{ book: BookData | null }> {
  try {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOKS_STORE)) return { book: null }

    const book = await db.get(BOOKS_STORE, bookId) as BookData | null
    return { book }
  } catch (error) {
    console.error('[BookSync] syncBookContent error:', error)
    return { book: null }
  }
}

async function saveBookMetadata(book: BookData): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames?.contains(BOOKS_STORE)) return
  // Serialize to plain object to strip Vue reactive proxies
  const plain = JSON.parse(JSON.stringify(book))
  await db.put(BOOKS_STORE, plain)
}

export async function saveBookList(data: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames?.contains(BOOKS_STORE)) return

  const books = (data.books as BookData[]) ?? []
  for (const book of books) {
    await saveBookMetadata(book)
  }
}

export async function saveBook(bookData: BookData): Promise<void> {
  await saveBookMetadata(bookData)
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames?.contains(BOOKS_STORE)) return
  await db.delete(BOOKS_STORE, bookId)
}

export async function resolveBookListConflict(
  _choice: string,
  _conflictData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return { books: [], lastSyncedAt: null }
}
