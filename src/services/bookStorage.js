// Book storage service for IndexedDB + Firestore + Firebase Storage sync
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage } from './firebase.js'
import {
  saveBookToIDB,
  loadBooksFromIDB,
  deleteBookFromIDB,
  getBookFileFromIDB,
  saveBookFileToIDB
} from './indexedDB.js'
import { mergeCloudLocal } from './firestore.js'

// ============================================================================
// IndexedDB Functions (re-exported from indexedDB.js)
// ============================================================================

export { saveBookToIDB, loadBooksFromIDB, deleteBookFromIDB, getBookFileFromIDB, saveBookFileToIDB }

// ============================================================================
// Firestore Functions
// ============================================================================

/**
 * Get the books collection reference for the current user
 */
const getBooksCollection = () => {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) {
    throw new Error('User not authenticated')
  }
  const db = getFirebaseDb()
  return collection(db, 'users', auth.currentUser.uid, 'books')
}

/**
 * Get a book document reference
 */
const getBookDocRef = (bookId) => {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) {
    throw new Error('User not authenticated')
  }
  const db = getFirebaseDb()
  return doc(db, 'users', auth.currentUser.uid, 'books', bookId)
}

/**
 * Save book metadata to Firestore
 */
export const saveBookToFirestore = async (book) => {
  try {
    const bookRef = getBookDocRef(book.id)
    await setDoc(bookRef, {
      ...book,
      lastUpdated: serverTimestamp()
    }, { merge: true })
  } catch (error) {
    console.error('Failed to save book to Firestore:', error)
    throw error
  }
}

/**
 * Load all books from Firestore
 */
export const loadBooksFromFirestore = async () => {
  try {
    const auth = getFirebaseAuth()
    if (!auth.currentUser) {
      return []
    }

    const booksCollection = getBooksCollection()
    const snapshot = await getDocs(booksCollection)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      // Remove serverTimestamp fields as they're not needed locally
      delete data.lastUpdated
      return data
    })
  } catch (error) {
    console.error('Failed to load books from Firestore:', error)
    return []
  }
}

/**
 * Delete a book from Firestore
 */
export const deleteBookFromFirestore = async (bookId) => {
  try {
    const bookRef = getBookDocRef(bookId)
    await deleteDoc(bookRef)
  } catch (error) {
    console.error('Failed to delete book from Firestore:', error)
    throw error
  }
}

// ============================================================================
// Firebase Storage Functions (for EPUB files)
// ============================================================================

/**
 * Get the Firebase Storage reference for a book file
 */
const getBookStorageRef = (bookId) => {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) {
    throw new Error('User not authenticated')
  }
  const storage = getFirebaseStorage()
  return ref(storage, `books/${auth.currentUser.uid}/${bookId}.epub`)
}

/**
 * Upload an EPUB file to Firebase Storage
 * @param {File|ArrayBuffer} file - The file or ArrayBuffer to upload
 * @param {string} bookId - The book ID
 * @returns {Promise<string>} The download URL
 */
export const uploadBookToStorage = async (file, bookId) => {
  try {
    const storageRef = getBookStorageRef(bookId)
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
    await uploadBytes(storageRef, arrayBuffer)
    const downloadUrl = await getDownloadURL(storageRef)
    return downloadUrl
  } catch (error) {
    console.error('Failed to upload book to Firebase Storage:', error)
    throw error
  }
}

/**
 * Get the download URL for a book file
 * @param {string} bookId - The book ID
 * @returns {Promise<string>} The download URL
 */
export const getBookDownloadUrl = async (bookId) => {
  try {
    const storageRef = getBookStorageRef(bookId)
    return await getDownloadURL(storageRef)
  } catch (error) {
    console.error('Failed to get book download URL:', error)
    throw error
  }
}

/**
 * Download a book file from Firebase Storage as ArrayBuffer
 * @param {string} bookId - The book ID
 * @param {string} url - The download URL (optional, will fetch if not provided)
 * @returns {Promise<ArrayBuffer>} The book file data
 */
export const downloadBookFromStorage = async (bookId, url = null) => {
  try {
    const downloadUrl = url || await getBookDownloadUrl(bookId)
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download book: ${response.statusText}`)
    }
    return await response.arrayBuffer()
  } catch (error) {
    console.error('Failed to download book from Firebase Storage:', error)
    throw error
  }
}

/**
 * Delete a book file from Firebase Storage
 */
export const deleteBookFromFirebaseStorage = async (bookId) => {
  try {
    const storageRef = getBookStorageRef(bookId)
    await deleteObject(storageRef)
  } catch (error) {
    console.error('Failed to delete book from Firebase Storage:', error)
    // Don't throw - metadata deletion is more important
  }
}

// ============================================================================
// Combined Storage Functions
// ============================================================================

/**
 * Save a book to both IndexedDB and Firestore
 */
export const saveBookToStorage = async (book) => {
  // Deep clone to remove Vue reactive proxies
  const plainBook = JSON.parse(JSON.stringify(book))
  await saveBookToIDB(plainBook)
  await saveBookToFirestore(plainBook)
}

/**
 * Load books from both IndexedDB and Firestore, merging with cloud priority
 */
export const loadBooksFromStorage = async () => {
  try {
    const localBooks = await loadBooksFromIDB()
    const cloudBooks = await loadBooksFromFirestore()

    // Use mergeCloudLocal utility from firestore.js
    const { merged } = mergeCloudLocal(cloudBooks, localBooks)

    // Update IndexedDB with merged data
    for (const book of merged) {
      await saveBookToIDB(book)
    }

    return { hasConflict: false, state: { books: merged } }
  } catch (error) {
    console.error('Failed to load books from storage:', error)
    return { hasConflict: false, state: { books: [] } }
  }
}

/**
 * Delete a book from all storage
 */
export const deleteBookFromStorage = async (bookId) => {
  // Delete from IndexedDB
  await deleteBookFromIDB(bookId)

  // Delete from Firestore
  await deleteBookFromFirestore(bookId)

  // Delete file from Firebase Storage
  await deleteBookFromFirebaseStorage(bookId)
}

/**
 * Get or download book file data
 * Flow: Check IndexedDB first → Download from Firebase Storage if not cached → Cache in IndexedDB
 * @param {string} bookId - The book ID
 * @param {string} storagePath - The Firebase Storage path (for getting download URL)
 * @returns {Promise<ArrayBuffer>} The book file data
 */
export const getOrDownloadBookFile = async (bookId, storagePath) => {
  // Check IndexedDB first
  const cachedFile = await getBookFileFromIDB(bookId)
  if (cachedFile) {
    console.log('Book file loaded from IndexedDB cache')
    return cachedFile
  }

  // Download from Firebase Storage
  console.log('Downloading book file from Firebase Storage...')
  const fileData = await downloadBookFromStorage(bookId)

  // Cache in IndexedDB for next time
  await saveBookFileToIDB(bookId, fileData)
  console.log('Book file cached in IndexedDB')

  return fileData
}
