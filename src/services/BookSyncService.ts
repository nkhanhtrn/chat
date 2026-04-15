// Stub - will be fully implemented when porting book sync operations
import { getLocalChatList } from './sync/IndexedDBService'
import type { BookData } from '@/types/book'

export async function syncBookList(): Promise<Record<string, unknown>> {
  const localData = await getLocalChatList()
  return {
    books: (localData?.books as BookData[]) ?? [],
    lastSyncedAt: localData?.lastSyncedAt ?? null,
    hasConflict: false,
  }
}

export async function syncBookContent(bookId: string): Promise<{ book: Record<string, unknown> | null }> {
  return { book: null }
}

export async function saveBookList(data: Record<string, unknown>): Promise<void> {
  // Stub: save book list to IndexedDB
}

export async function saveBook(bookData: Record<string, unknown>): Promise<void> {
  // Stub: save individual book to IndexedDB
}

export async function deleteBook(bookId: string): Promise<void> {
  // Stub: delete book from IndexedDB
}

export async function resolveBookListConflict(
  _choice: string,
  _conflictData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return { books: [], lastSyncedAt: null }
}
