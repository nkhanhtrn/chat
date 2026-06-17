import { getFirestore, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { BookChatMessage } from '@/stores/bookChat'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

export async function saveBookChatToFirestore(bookId: string, messages: BookChatMessage[]): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'book-chats', bookId)
  await setDoc(ref, { messages, lastUpdated: Date.now() })
}

export async function loadBookChatFromFirestore(bookId: string): Promise<BookChatMessage[] | null> {
  const uid = getUid()
  if (!uid) return null

  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'book-chats', bookId)
  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data() as { messages?: BookChatMessage[] }
    return data.messages ?? null
  } catch (err) {
    console.warn('[FirestoreBookChat] Failed to load:', err)
    return null
  }
}

export async function deleteBookChatFromFirestore(bookId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  try {
    await deleteDoc(doc(db, 'users', uid, 'book-chats', bookId))
  } catch (err) {
    console.warn('[FirestoreBookChat] Failed to delete:', err)
  }
}
