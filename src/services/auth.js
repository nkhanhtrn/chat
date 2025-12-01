// Firebase Authentication service
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase.js'

/**
 * Sign in an existing user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
export const signInUser = async (email, password) => {
  try {
    const auth = getFirebaseAuth()
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    console.log('User signed in:', userCredential.user.email)
    return userCredential.user
  } catch (error) {
    console.error('Sign in error:', error)
    throw error
  }
}

/**
 * Create a new user account with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
export const signUpUser = async (email, password) => {
  try {
    const auth = getFirebaseAuth()
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    console.log('User signed up:', userCredential.user.email)
    return userCredential.user
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export const signOutUser = async () => {
  try {
    const auth = getFirebaseAuth()
    await signOut(auth)
    console.log('User signed out')
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}

/**
 * Get the currently signed-in user
 * @returns {User|null}
 */
export const getCurrentUser = () => {
  const auth = getFirebaseAuth()
  return auth.currentUser
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export const onAuthChange = (callback) => {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, callback)
}
