/**
 * Firestore Shared Utilities
 *
 * Common utilities used across all Firestore sync modules:
 * - Auth helpers
 * - Data sanitization
 * - Firebase Storage helpers
 */

import { debugLog } from '../../utils/debug.js'
import { doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, uploadString, getBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage } from '../firebase.js'

// ============================================
// Auth Helpers
// ============================================

/**
 * Wait for Firebase Auth to be ready and return the current user
 * @returns {Promise<User|null>}
 */
export const waitForAuth = () => {
  return new Promise((resolve) => {
    const auth = getFirebaseAuth()
    // Always use onAuthStateChanged to ensure auth is fully initialized
    // Checking auth.currentUser directly can throw "Params are not set" if auth isn't ready
    let unsubscribe = null
    let resolved = false
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (resolved) return
      resolved = true
      // Use queueMicrotask to ensure unsubscribe is assigned before we call it
      queueMicrotask(() => unsubscribe?.())
      resolve(user)
    })
  })
}

// ============================================
// Firebase Storage Helpers for Large Data
// ============================================

const FIRESTORE_MAX_SIZE = 900000 // 900KB safe threshold for Firestore

/**
 * Check if data size exceeds Firestore limit
 * @param {*} data - Data to check
 * @returns {boolean} True if data is too large for Firestore
 */
export function isDataTooLarge(data) {
  try {
    return JSON.stringify(data).length > FIRESTORE_MAX_SIZE
  } catch {
    return true // If we can't stringify, it's definitely too large
  }
}

/**
 * Save data to Firebase Storage
 * @param {string} path - Storage path (e.g., 'users/uid/sessions/sessionId/chatState.json')
 * @param {*} data - Data to save (will be JSON stringified)
 * @returns {Promise<void>}
 */
export async function saveToStorage(path, data) {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    const storage = getFirebaseStorage()
    const storageRef = ref(storage, path)

    const jsonString = JSON.stringify(data)
    await uploadString(storageRef, jsonString, 'raw')

    console.log(`Saved large data to Firebase Storage: ${path}`)
  } catch (error) {
    console.error(`Failed to save to Firebase Storage (${path}):`, error)
    throw error
  }
}

/**
 * Load data from Firebase Storage
 * @param {string} path - Storage path
 * @returns {Promise<*>} Parsed JSON data or null if not found
 */
export async function loadFromStorage(path) {
  try {
    const storage = getFirebaseStorage()
    const storageRef = ref(storage, path)

    const url = await getDownloadURL(storageRef)
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      return null
    }
    console.error(`Failed to load from Firebase Storage (${path}):`, error)
    return null
  }
}

// ============================================
// Data Sanitization
// ============================================

/**
 * Sanitize data for Firestore by removing invalid field names and structures.
 * - Firestore doesn't allow fields that begin and end with "__" (e.g., Vue internal properties)
 * - Firestore doesn't support nested arrays (arrays containing arrays)
 * - Can't store: Functions, Symbols, DOM elements, Window objects
 * - BigInt converted to string
 * @param {*} value - The value to sanitize
 * @param {WeakSet} seen - Set of objects already visited (for circular reference detection)
 * @returns {*} Sanitized value
 */
export function sanitizeForFirestore(value, seen = new WeakSet()) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Skip functions (can't be stored)
  if (typeof value === 'function') {
    return null
  }

  // Skip symbols (can't be stored)
  if (typeof value === 'symbol') {
    return null
  }

  // Convert BigInt to string (can't be stored directly)
  if (typeof value === 'bigint') {
    return value.toString()
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return value
  }

  // Skip DOM elements and Window objects
  if (value instanceof Element) {
    return null
  }
  if (value instanceof Window) {
    return null
  }
  if (value instanceof Node) {
    return null
  }

  // Check for circular references - skip them
  if (seen.has(value)) {
    return null
  }
  seen.add(value)

  // Handle arrays - check for nested arrays first
  if (Array.isArray(value)) {
    // Check if any element is an array (nested array)
    const hasNestedArray = value.some(item => Array.isArray(item))
    if (hasNestedArray) {
      // Convert to JSON string to avoid nested array error
      return JSON.stringify(value, (key, val) => {
        // Skip functions
        if (typeof val === 'function') {
          return null
        }
        // Skip symbols
        if (typeof val === 'symbol') {
          return null
        }
        // Convert BigInt to string
        if (typeof val === 'bigint') {
          return val.toString()
        }
        // Skip DOM elements
        if (val instanceof Element || val instanceof Window || val instanceof Node) {
          return null
        }
        // Skip WeakMap/WeakSet
        if (val instanceof WeakMap || val instanceof WeakSet) {
          return null
        }
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return null
          }
          seen.add(val)
        }
        return val
      })
    }
    // Simple array - recursively sanitize elements
    return value.map(item => sanitizeForFirestore(item, seen))
  }

  // For objects, first try to convert Vue reactive objects using JSON round-trip
  const isVueReactive = value.__v_isReactive === true ||
                        value.__v_isRef === true ||
                        value.__v_isReadonly === true ||
                        value.__v_isShallow === true

  if (isVueReactive) {
    // Convert Vue reactive object to plain object
    return JSON.parse(JSON.stringify(value, (key, val) => {
      // Skip functions
      if (typeof val === 'function') {
        return null
      }
      // Skip symbols
      if (typeof val === 'symbol') {
        return null
      }
      // Convert BigInt to string
      if (typeof val === 'bigint') {
        return val.toString()
      }
      // Skip DOM elements
      if (val instanceof Element || val instanceof Window || val instanceof Node) {
        return null
      }
      // Skip WeakMap/WeakSet
      if (val instanceof WeakMap || val instanceof WeakSet) {
        return null
      }
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return null
        }
        seen.add(val)
      }
      return val
    }))
  }

  // Regular object - remove __ properties and recursively sanitize
  const result = {}
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      // Skip Vue internal properties
      if (key.startsWith('__') && key.endsWith('__')) {
        continue
      }
      const val = value[key]
      // Skip functions
      if (typeof val === 'function') {
        continue
      }
      // Skip symbols
      if (typeof val === 'symbol') {
        continue
      }
      // Convert BigInt to string
      if (typeof val === 'bigint') {
        result[key] = val.toString()
        continue
      }
      // Skip DOM elements and nodes
      if (val instanceof Element || val instanceof Node || val instanceof Window) {
        continue
      }
      // Skip WeakMap/WeakSet
      if (val instanceof WeakMap || val instanceof WeakSet) {
        continue
      }
      try {
        result[key] = sanitizeForFirestore(val, seen)
      } catch (e) {
        console.warn(`Skipping property "${key}" due to sanitization error:`, e)
      }
    }
  }
  return result
}

/**
 * Deserialize data from Firestore by converting JSON strings back to nested arrays.
 * This is the inverse of sanitizeForFirestore.
 * @param {*} value - The value to deserialize
 * @returns {*} Deserialized value
 */
export function deserializeFromFirestore(value) {
  if (value === null || value === undefined) {
    return value
  }

  // Handle primitives (strings, numbers, booleans)
  if (typeof value !== 'object') {
    // Check if this is a JSON string that was a nested array
    if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(value)
        // Only return the parsed value if it's actually an array
        if (Array.isArray(parsed)) {
          return deserializeFromFirestore(parsed)
        }
      } catch (e) {
        // Not valid JSON, return original string
      }
    }
    return value
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => deserializeFromFirestore(item))
  }

  // Handle objects
  const result = {}
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      result[key] = deserializeFromFirestore(value[key])
    }
  }
  return result
}
