import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { EpubHighlight } from '@/types/highlight'

function getUid(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null
}

export async function saveHighlightToFirestore(bookId: string, highlight: EpubHighlight): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'books', bookId, 'highlights', highlight.id)
  await setDoc(ref, JSON.parse(JSON.stringify(highlight)))
}

export async function deleteHighlightFromFirestore(bookId: string, highlightId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'books', bookId, 'highlights', highlightId)
  await deleteDoc(ref)
}

export async function loadHighlightsForBook(bookId: string): Promise<EpubHighlight[]> {
  const uid = getUid()
  if (!uid) return []
  const db = getFirestore()
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'books', bookId, 'highlights'))
    return snap.docs.map(d => ({ ...(d.data() as EpubHighlight), id: d.id }))
  } catch {
    return []
  }
}

export async function wipeHighlightsForBook(bookId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'books', bookId, 'highlights'))
    if (snap.docs.length === 0) return
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
  } catch {
    // ignore — best-effort cleanup
  }
}
