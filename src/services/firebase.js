// Firebase configuration and initialization
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7xhfxskPmmGjDlX8il68e91yQgwnSoe8",
  authDomain: "nkhanhtrn.github.io",
  projectId: "nkhanhtrn-chat",
  storageBucket: "nkhanhtrn-chat.firebasestorage.app",
  messagingSenderId: "755232849374",
  appId: "1:755232849374:web:90883dad132dcb7bb1314f",
  measurementId: "G-WX0PGRC0J1"
}


// Initialize Firebase
let app = null
let db = null
let auth = null

export const initializeFirebase = () => {
  try {
    if (!app) {
      app = initializeApp(firebaseConfig)
      db = getFirestore(app)
      auth = getAuth(app)
      console.log('Firebase initialized successfully')
    }
    return { app, db, auth }
  } catch (error) {
    console.error('Error initializing Firebase:', error)
    throw error
  }
}

export const getFirebaseDb = () => {
  if (!db) {
    initializeFirebase()
  }
  return db
}

export const getFirebaseAuth = () => {
  if (!auth) {
    initializeFirebase()
  }
  return auth
}
