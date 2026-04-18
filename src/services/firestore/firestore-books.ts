import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { getStorage, ref, uploadBytesResumable, uploadBytes, getBlob, getDownloadURL, getBytes, deleteObject } from 'firebase/storage'
import { getFirebaseAuth } from '@/services/firebase'
import type { BookData } from '@/types/book'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

export async function saveBookToFirestore(bookData: BookData): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  const bookRef = doc(db, 'users', uid, 'books', bookData.id)

  // Serialize to plain object to strip Vue reactive proxies
  const serializable = JSON.parse(JSON.stringify(bookData))
  // Don't store coverUrl in Firestore — covers can be large base64 data URLs
  // that exceed Firestore's 1MB property limit. Covers are stored in Firebase Storage.
  delete serializable.coverUrl
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

  // Also try to delete files from storage
  try {
    const storage = getStorage()
    await Promise.all([
      deleteObject(ref(storage, `users/${uid}/books/${bookId}/book.epub`)),
      deleteObject(ref(storage, `users/${uid}/books/${bookId}/cover.jpg`)),
    ])
  } catch {
    // Files may not exist in storage, that's fine
  }
}

export function uploadBookFileToStorage(
  bookId: string,
  fileData: ArrayBuffer,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const uid = getUid()
  if (!uid) return Promise.resolve()

  const storage = getStorage()
  const fileRef = ref(storage, `users/${uid}/books/${bookId}/book.epub`)

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

export async function uploadCoverImage(bookId: string, coverData: ArrayBuffer): Promise<string> {
  const uid = getUid()
  if (!uid) return ''

  const storage = getStorage()
  const coverRef = ref(storage, `users/${uid}/books/${bookId}/cover.jpg`)
  await uploadBytes(coverRef, coverData)
  return await getDownloadURL(coverRef)
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

export function downloadBookFileFromStorage(
  bookId: string,
  onProgress?: (progress: number) => void,
): Promise<ArrayBuffer | null> {
  const uid = getUid()
  if (!uid) return Promise.resolve(null)

  const storage = getStorage()
  const fileRef = ref(storage, `users/${uid}/books/${bookId}/book.epub`)

  // Get metadata first for total size, then download with progress
  return getBlob(fileRef).then(async (blob) => {
    const total = blob.size
    if (total === 0) return null

    // Read with progress via ReadableStream
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
  }).catch((error: unknown) => {
    console.warn('[FirestoreBooks] Failed to download book file:', error)
    return null
  })
}
