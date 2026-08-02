import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { getStorage, ref, uploadBytesResumable, getBlob, deleteObject } from 'firebase/storage'
import { getFirebaseAuth } from '@/services/firebase'
import type { BookData } from '@/types/book'
import { wipeStrokesForBook } from './firestore-strokes'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

export async function saveBookToFirestore(bookData: BookData): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  const bookRef = doc(db, 'users', uid, 'books', bookData.id)

  const serializable = JSON.parse(JSON.stringify(bookData))
  await setDoc(bookRef, serializable, { merge: true })
}

export async function deleteBookFromFirestore(bookId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  const bookRef = doc(db, 'users', uid, 'books', bookId)

  try {
    await deleteDoc(bookRef)
  } catch (error) {
    console.warn('[FirestoreBooks] Failed to delete book doc:', error)
  }

  // Purge any drawing annotations for this book (best-effort)
  wipeStrokesForBook(bookId).catch(() => {})

  // Also try to delete files from storage
  try {
    const storage = getStorage()
    await Promise.allSettled([
      deleteObject(ref(storage, `users/${uid}/books/${bookId}/book.epub`)),
      deleteObject(ref(storage, `users/${uid}/books/${bookId}/book.pdf`)),
    ])
  } catch {
    // Files may not exist in storage, that's fine
  }
}

export function uploadBookFileToStorage(
  bookId: string,
  fileData: ArrayBuffer,
  onProgress?: (progress: number) => void,
  fileType: 'epub' | 'pdf' = 'epub',
): Promise<void> {
  const uid = getUid()
  if (!uid) return Promise.resolve()

  const extension = fileType === 'pdf' ? 'pdf' : 'epub'
  const storage = getStorage()
  const fileRef = ref(storage, `users/${uid}/books/${bookId}/book.${extension}`)

  const uploadTask = uploadBytesResumable(fileRef, fileData)

  return new Promise<void>((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = snapshot.bytesTransferred / snapshot.totalBytes
        onProgress?.(progress)
      },
      (error) => reject(error),
      () => resolve(),
    )
  })
}

export async function loadBooksFromFirestore(): Promise<BookData[]> {
  const uid = getUid()
  if (!uid) return []

  const db = getFirestore()
  const booksCol = collection(db, 'users', uid, 'books')

  try {
    const snapshot = await getDocs(booksCol)
    return snapshot.docs
      .map(docSnap => {
        const data = docSnap.data() as Record<string, unknown>
        return { ...data, id: docSnap.id } as BookData
      })
      .filter(book => !(book as any).deletedAt)
  } catch {
    return []
  }
}

export async function downloadBookFileFromStorage(
  bookId: string,
  onProgress?: (progress: number) => void,
  fileType?: 'epub' | 'pdf',
): Promise<ArrayBuffer | null> {
  const uid = getUid()
  if (!uid) return null

  const storage = getStorage()

  const downloadWithExtension = async (ext: string): Promise<ArrayBuffer | null> => {
    const fileRef = ref(storage, `users/${uid}/books/${bookId}/book.${ext}`)
    const blob = await getBlob(fileRef)
    const total = blob.size
    if (total === 0) return null

    const reader = blob.stream().getReader()
    const chunks: Uint8Array[] = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress?.(received / total)
    }

    const result = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result.buffer as ArrayBuffer
  }

  if (fileType) {
    // Known type — download directly
    const ext = fileType === 'pdf' ? 'pdf' : 'epub'
    return downloadWithExtension(ext)
  }

  // Unknown type — try epub first (legacy), then pdf
  try {
    return await downloadWithExtension('epub')
  } catch (epubError) {
    try {
      return await downloadWithExtension('pdf')
    } catch (pdfError) {
      throw new Error(
        `Book download failed — epub: ${(epubError as Error).message}; pdf: ${(pdfError as Error).message}`,
      )
    }
  }
}
