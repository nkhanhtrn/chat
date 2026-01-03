/**
 * Firestore Books Sync Module
 *
 * Handles cloud sync for Books:
 * - Sync book metadata to/from Firestore
 * - Upload/download EPUB files to/from Firebase Storage
 * - Sync reading progress (device-specific)
 * - Data completeness conflict resolution
 * - Debounced sync for metadata and progress
 */

import { doc, setDoc, getDoc, getDocs, deleteDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFirebaseDb, getFirebaseStorage } from '../firebase.js'
import { waitForAuth, sanitizeForFirestore, deserializeFromFirestore } from './firestore-utils.js'

// Debounced sync state for books
let bookSyncDebounceTimer = null
let progressSyncDebounceTimers = new Map() // bookId -> timer
const BOOK_SYNC_DEBOUNCE_MS = 3000 // 3 seconds for metadata
const PROGRESS_SYNC_DEBOUNCE_MS = 5000 // 5 seconds for progress

/**
 * Get or generate a unique device ID for progress tracking
 * @returns {string} Device ID
 */
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('booksDeviceId')
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem('booksDeviceId', deviceId)
    // Also store device name for user-friendly display
    const deviceName = `${navigator.platform || 'Unknown'}-${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`
    localStorage.setItem('booksDeviceName', deviceName)
  }
  return deviceId
}

/**
 * Compare data completeness between two book versions
 * Returns the version with more populated fields
 * @param {Object} bookA - First book to compare
 * @param {Object} bookB - Second book to compare
 * @returns {Object} { scoreA, scoreB }
 */
function compareDataCompleteness(bookA, bookB) {
  const fields = {
    title: 10,
    author: 8,
    coverUrl: 5,
    lastReadCfi: 3,
    totalProgress: 2,
    lastReadAt: 2
  }

  let scoreA = 0
  let scoreB = 0

  for (const [field, weight] of Object.entries(fields)) {
    const hasA = bookA[field] !== null && bookA[field] !== undefined && bookA[field] !== ''
    const hasB = bookB[field] !== null && bookB[field] !== undefined && bookB[field] !== ''

    if (hasA) scoreA += weight
    if (hasB) scoreB += weight
  }

  return { scoreA, scoreB }
}

/**
 * Merge two book versions using data completeness
 * @param {Object} cloudBook - Book from cloud
 * @param {Object} localBook - Book from local storage
 * @returns {Object} { book, conflict, resolution }
 */
export const mergeBooksByDataCompleteness = (cloudBook, localBook) => {
  const { scoreA: cloudScore, scoreB: localScore } = compareDataCompleteness(cloudBook, localBook)

  // Base result: higher score wins
  const base = localScore >= cloudScore ? { ...localBook } : { ...cloudBook }
  const other = localScore >= cloudScore ? cloudBook : localBook

  // Take the most recent timestamps
  base.createdAt = Math.min(cloudBook.createdAt || 0, localBook.createdAt || 0)
  base.updatedAt = Math.max(cloudBook.updatedAt || 0, localBook.updatedAt || 0)
  base.lastReadAt = Math.max(cloudBook.lastReadAt || 0, localBook.lastReadAt || 0)

  // Take the higher progress
  base.totalProgress = Math.max(cloudBook.totalProgress || 0, localBook.totalProgress || 0)

  // Keep the file storage reference that exists
  if (!base.fileInStorage && other.fileInStorage) {
    base.fileInStorage = other.fileInStorage
    base.fileStoragePath = other.fileStoragePath
    base.fileSize = other.fileSize
  }

  // Determine resolution
  const conflict = cloudScore === localScore && localScore > 0
  const resolution = localScore > cloudScore ? 'local' :
                     cloudScore > localScore ? 'cloud' : 'cloud-tie'

  return {
    book: base,
    conflict,
    resolution
  }
}

/**
 * Upload EPUB file to Firebase Storage
 * @param {string} bookId - Book ID
 * @param {ArrayBuffer} fileData - EPUB file data
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{path: string, url: string}>}
 */
export const uploadBookFileToStorage = async (bookId, fileData, onProgress) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      throw new Error('No authenticated user')
    }

    const storage = getFirebaseStorage()
    const path = `users/${user.uid}/books/${bookId}/book.epub`
    const storageRef = ref(storage, path)

    // Convert ArrayBuffer to Base64
    const bytes = new Uint8Array(fileData)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // Upload as raw base64 string (uploadString with 'base64' format expects raw base64, not data URL)
    await uploadString(storageRef, base64, 'base64', {
      contentType: 'application/epub+zip'
    })

    // Get download URL
    const url = await getDownloadURL(storageRef)
    console.log(`Book file uploaded: ${path}`)

    return { path, url }
  } catch (error) {
    console.error('Failed to upload book file to Storage:', error)
    throw error
  }
}

/**
 * Download EPUB file from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<ArrayBuffer>}
 */
export const downloadBookFileFromStorage = async (storagePath) => {
  try {
    const storage = getFirebaseStorage()
    const storageRef = ref(storage, storagePath)

    const url = await getDownloadURL(storageRef)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log(`Book file downloaded: ${storagePath}`)
    return arrayBuffer
  } catch (error) {
    console.error('Failed to download book file from Storage:', error)
    throw error
  }
}

/**
 * Delete EPUB file from Firebase Storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<void>}
 */
export const deleteBookFileFromStorage = async (storagePath) => {
  try {
    const storage = getFirebaseStorage()
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
    console.log(`Book file deleted: ${storagePath}`)
  } catch (error) {
    if (error.code !== 'storage/object-not-found') {
      console.error('Failed to delete book file from Storage:', error)
    }
  }
}

/**
 * Save a single book to Firestore
 * @param {Object} book - Book object
 * @returns {Promise<void>}
 */
export const saveBookToFirestore = async (book) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, skipping book cloud sync')
      return
    }

    const db = getFirebaseDb()
    const bookRef = doc(db, 'users', user.uid, 'books', book.id)

    // Prepare book data - exclude fileData from Firestore
    const { fileData, fileCachedAt, ...bookMetadata } = book

    const bookData = {
      ...sanitizeForFirestore(bookMetadata),
      schemaVersion: 1,
      lastUpdated: serverTimestamp()
    }

    await setDoc(bookRef, bookData, { merge: true })
    console.log(`Book "${book.title}" synced to cloud`)
  } catch (error) {
    console.error('Failed to save book to Firestore:', error)
    throw error
  }
}

/**
 * Save multiple books to Firestore in batch
 * @param {Array} books - Array of book objects
 * @returns {Promise<void>}
 */
export const saveBooksToFirestore = async (books) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, skipping books cloud sync')
      return
    }

    const db = getFirebaseDb()
    const batch = writeBatch(db)

    for (const book of books) {
      const bookRef = doc(db, 'users', user.uid, 'books', book.id)

      // Prepare book data - exclude fileData from Firestore
      const { fileData, fileCachedAt, ...bookMetadata } = book

      const bookData = {
        ...sanitizeForFirestore(bookMetadata),
        schemaVersion: 1,
        lastUpdated: serverTimestamp()
      }

      batch.set(bookRef, bookData, { merge: true })
    }

    await batch.commit()
    console.log(`Synced ${books.length} books to cloud`)
  } catch (error) {
    console.error('Failed to save books to Firestore:', error)
    throw error
  }
}

/**
 * Load all books from Firestore
 * @returns {Promise<Object|null>} Object with { books, conflicts } or null
 */
export const loadBooksFromFirestore = async () => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, cannot load books from cloud')
      return null
    }

    const db = getFirebaseDb()
    const booksRef = collection(db, 'users', user.uid, 'books')
    const snapshot = await getDocs(booksRef)

    const books = []
    const conflicts = []

    for (const docSnap of snapshot.docs) {
      let book = deserializeFromFirestore(docSnap.data())
      book.id = docSnap.id

      // Clean up Firestore fields
      delete book.lastUpdated
      delete book.schemaVersion

      books.push(book)
    }

    console.log(`Loaded ${books.length} books from cloud`)
    return { books, conflicts }
  } catch (error) {
    console.error('Failed to load books from Firestore:', error)
    return null
  }
}

/**
 * Sync books bidirectionally with cloud
 * @param {Array} localBooks - Local books array
 * @returns {Promise<Object>} { mergedBooks, toUpload, fromCloud, conflicts }
 */
export const syncBooksWithCloud = async (localBooks) => {
  try {
    const cloudData = await loadBooksFromFirestore()
    if (!cloudData) {
      // No cloud data, upload all local books
      await saveBooksToFirestore(localBooks)
      return {
        mergedBooks: localBooks,
        toUpload: localBooks,
        fromCloud: 0,
        conflicts: []
      }
    }

    const { books: cloudBooks } = cloudData
    const localMap = new Map(localBooks.map(b => [b.id, b]))
    const cloudMap = new Map(cloudBooks.map(b => [b.id, b]))

    const mergedBooks = []
    const toUpload = []
    const conflicts = []
    let fromCloud = 0
    let toCloud = 0

    // Get all unique book IDs
    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()])

    for (const id of allIds) {
      const localBook = localMap.get(id)
      const cloudBook = cloudMap.get(id)

      if (!cloudBook) {
        // Local-only book - skip if already being uploaded (has fileInStorage flag)
        if (localBook.fileInStorage && localBook.fileStoragePath) {
          // Upload is in progress or complete via addBook, don't duplicate
          mergedBooks.push(localBook)
        } else {
          mergedBooks.push(localBook)
          toUpload.push(localBook)
          toCloud++
        }
      } else if (!localBook) {
        // Cloud-only book (not deleted locally)
        if (!cloudBook.deletedAt) {
          mergedBooks.push(cloudBook)
          fromCloud++
        }
      } else {
        // Both exist - merge using data completeness
        const result = mergeBooksByDataCompleteness(cloudBook, localBook)

        if (result.conflict) {
          conflicts.push({
            bookId: id,
            title: result.book.title,
            resolution: result.resolution
          })
        }

        mergedBooks.push(result.book)

        // If local won or has changes, upload
        if (result.resolution === 'local') {
          toUpload.push(result.book)
          toCloud++
        } else if (result.resolution === 'cloud') {
          fromCloud++
        }
      }
    }

    // Upload books that need to be synced
    if (toUpload.length > 0) {
      await saveBooksToFirestore(toUpload)
    }

    console.log(`Book sync complete: ${toCloud} uploaded, ${fromCloud} from cloud, ${conflicts.length} conflicts`)

    return {
      mergedBooks,
      toUpload,
      fromCloud,
      conflicts
    }
  } catch (error) {
    console.error('Failed to sync books with cloud:', error)
    throw error
  }
}

/**
 * Save reading progress to Firestore (device-specific)
 * @param {string} bookId - Book ID
 * @param {Object} progressData - Progress data { lastReadCfi, totalProgress, lastReadAt }
 * @returns {Promise<void>}
 */
export const saveBookProgressToFirestore = async (bookId, progressData) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, skipping progress cloud sync')
      return
    }

    const db = getFirebaseDb()
    const deviceId = getDeviceId()
    const deviceName = localStorage.getItem('booksDeviceName') || 'Unknown Device'
    const progressRef = doc(db, 'users', user.uid, 'books', bookId, 'progress', deviceId)

    await setDoc(progressRef, {
      ...sanitizeForFirestore(progressData),
      deviceId,
      deviceName,
      updatedAt: Date.now(),
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log(`Progress synced for book ${bookId}`)
  } catch (error) {
    console.error('Failed to save book progress to Firestore:', error)
  }
}

/**
 * Load reading progress for current device
 * @param {string} bookId - Book ID
 * @returns {Promise<Object|null>} Progress data or null
 */
export const loadBookProgressFromFirestore = async (bookId) => {
  try {
    const user = await waitForAuth()
    if (!user) return null

    const db = getFirebaseDb()
    const deviceId = getDeviceId()
    const progressRef = doc(db, 'users', user.uid, 'books', bookId, 'progress', deviceId)
    const snap = await getDoc(progressRef)

    if (snap.exists()) {
      const data = deserializeFromFirestore(snap.data())
      delete data.lastUpdated
      delete data.deviceId
      delete data.deviceName
      return data
    }

    return null
  } catch (error) {
    console.error('Failed to load book progress from Firestore:', error)
    return null
  }
}

/**
 * Merge progress from all devices (max progress wins)
 * @param {string} bookId - Book ID
 * @returns {Promise<Object|null>} Merged progress or null
 */
export const mergeProgressFromCloud = async (bookId) => {
  try {
    const user = await waitForAuth()
    if (!user) return null

    const db = getFirebaseDb()
    const progressRef = collection(db, 'users', user.uid, 'books', bookId, 'progress')
    const snap = await getDocs(progressRef)

    if (snap.empty) return null

    let maxProgress = 0
    let mostRecent = 0
    let bestCfi = null

    snap.forEach(doc => {
      const data = doc.data()
      if ((data.totalProgress || 0) > maxProgress) {
        maxProgress = data.totalProgress
        bestCfi = data.lastReadCfi
      }
      if ((data.lastReadAt || 0) > mostRecent) {
        mostRecent = data.lastReadAt
      }
    })

    return {
      lastReadCfi: bestCfi,
      totalProgress: maxProgress,
      lastReadAt: mostRecent
    }
  } catch (error) {
    console.error('Failed to merge progress from cloud:', error)
    return null
  }
}

/**
 * Delete a book (soft delete)
 * @param {string} bookId - Book ID
 * @returns {Promise<void>}
 */
export const deleteBookFromFirestore = async (bookId) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, cannot delete from cloud')
      return
    }

    const db = getFirebaseDb()
    const bookRef = doc(db, 'users', user.uid, 'books', bookId)

    await setDoc(bookRef, {
      deletedAt: Date.now(),
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log(`Book ${bookId} marked as deleted in cloud`)
  } catch (error) {
    console.error('Failed to delete book from Firestore:', error)
  }
}

/**
 * Permanently delete a book from Firestore and Storage
 * @param {string} bookId - Book ID
 * @param {string} storagePath - Optional storage path to delete
 * @returns {Promise<void>}
 */
export const permanentlyDeleteBookFromFirestore = async (bookId, storagePath = null) => {
  try {
    const user = await waitForAuth()
    if (!user) {
      console.warn('No authenticated user, cannot delete from cloud')
      return
    }

    const db = getFirebaseDb()
    const storage = getFirebaseStorage()

    // Delete from Firestore
    const bookRef = doc(db, 'users', user.uid, 'books', bookId)
    await deleteDoc(bookRef)

    // Delete progress subcollection
    const progressRef = collection(db, 'users', user.uid, 'books', bookId, 'progress')
    const progressSnap = await getDocs(progressRef)
    const batch = writeBatch(db)
    progressSnap.forEach(doc => {
      batch.delete(doc.ref)
    })
    await batch.commit()

    // Delete file from Storage if path provided
    if (storagePath) {
      const storageRef = ref(storage, storagePath)
      await deleteObject(storageRef).catch(err => {
        if (err.code !== 'storage/object-not-found') {
          console.warn(`Failed to delete storage file:`, err)
        }
      })
    }

    console.log(`Book ${bookId} permanently deleted from cloud`)
  } catch (error) {
    console.error('Failed to permanently delete book from Firestore:', error)
  }
}

/**
 * Trigger debounced book sync
 * @param {boolean} forceSync - If true, sync immediately
 * @returns {Promise<void>}
 */
export const debouncedSyncBooks = async (forceSync = false) => {
  if (forceSync) {
    // Clear timer and sync immediately
    if (bookSyncDebounceTimer) {
      clearTimeout(bookSyncDebounceTimer)
      bookSyncDebounceTimer = null
    }
    // The actual sync will be triggered by the caller
    return
  }

  // Clear existing timer
  if (bookSyncDebounceTimer) {
    clearTimeout(bookSyncDebounceTimer)
  }

  // Set new timer
  bookSyncDebounceTimer = setTimeout(() => {
    console.log('Debounced book sync triggered')
    // The store will handle the actual sync
    bookSyncDebounceTimer = null
  }, BOOK_SYNC_DEBOUNCE_MS)
}

/**
 * Flush pending book sync immediately
 * @returns {Promise<void>}
 */
export const flushBookSync = async () => {
  if (bookSyncDebounceTimer) {
    clearTimeout(bookSyncDebounceTimer)
    bookSyncDebounceTimer = null
    console.log('Book sync flushed')
  }
}

/**
 * Trigger debounced progress sync for a specific book
 * @param {string} bookId - Book ID
 * @param {Object} progressData - Progress data
 * @returns {void}
 */
export const debouncedSyncProgress = (bookId, progressData) => {
  const timerKey = bookId

  // Clear existing timer for this book
  if (progressSyncDebounceTimers.has(timerKey)) {
    clearTimeout(progressSyncDebounceTimers.get(timerKey))
  }

  // Set new timer
  const timer = setTimeout(() => {
    saveBookProgressToFirestore(bookId, progressData)
    progressSyncDebounceTimers.delete(timerKey)
  }, PROGRESS_SYNC_DEBOUNCE_MS)

  progressSyncDebounceTimers.set(timerKey, timer)
}

/**
 * Flush all pending progress syncs
 * @returns {Promise<void>}
 */
export const flushProgressSync = async () => {
  for (const [bookId, timer] of progressSyncDebounceTimers) {
    clearTimeout(timer)
  }
  progressSyncDebounceTimers.clear()
  console.log('All progress syncs flushed')
}
