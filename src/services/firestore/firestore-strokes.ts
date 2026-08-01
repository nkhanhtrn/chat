import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { Stroke } from '@/types/stroke'

function getUid(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null
}

export async function saveStrokeToFirestore(bookId: string, stroke: Stroke): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'books', bookId, 'strokes', stroke.id)
  await setDoc(ref, JSON.parse(JSON.stringify(stroke)))
}

export async function deleteStrokeFromFirestore(bookId: string, strokeId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'books', bookId, 'strokes', strokeId)
  await deleteDoc(ref)
}

export async function loadStrokesForBook(bookId: string): Promise<Stroke[]> {
  const uid = getUid()
  if (!uid) return []
  const db = getFirestore()
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'books', bookId, 'strokes'))
    return snap.docs.map(d => ({ ...(d.data() as Stroke), id: d.id }))
  } catch {
    return []
  }
}

export async function wipeStrokesForBook(bookId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'books', bookId, 'strokes'))
    if (snap.docs.length === 0) return
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
  } catch {
    // ignore — best-effort cleanup
  }
}
