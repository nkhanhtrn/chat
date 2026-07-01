import { getFirebaseAuth } from '@/services/firebase'

/**
 * Download a book's EPUB file as an ArrayBuffer.
 *
 * Why this exists: the reader dev server runs on a different port than the
 * main app, so it isn't in the Cloud Storage bucket's CORS allowlist. In dev
 * we route the request through a same-origin Vite proxy (see vite.reader.config.ts)
 * to avoid CORS entirely. In production both apps share an origin that is already
 * allowed, so we hit Firebase Storage directly.
 */
export async function downloadEpubFile(
  bookId: string,
  uid: string,
  onProgress?: (progress: number) => void,
): Promise<ArrayBuffer | null> {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
  if (!bucket) throw new Error('Missing VITE_FIREBASE_STORAGE_BUCKET')

  const objectPath = `users/${uid}/books/${bookId}/book.epub`
  const encoded = encodeURIComponent(objectPath)

  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) return null
  const token = await user.getIdToken()

  const path = `/v0/b/${bucket}/o/${encoded}?alt=media`
  const url = import.meta.env.DEV
    ? `/fs-proxy${path}`
    : `https://firebasestorage.googleapis.com${path}`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Download failed (${res.status})`)
  }

  const total = Number(res.headers.get('Content-Length')) || 0
  if (!res.body) {
    const buf = await res.arrayBuffer()
    onProgress?.(1)
    return buf
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      if (total > 0) onProgress?.(received / total)
    }
  }

  const result = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  onProgress?.(1)
  return result.buffer as ArrayBuffer
}
