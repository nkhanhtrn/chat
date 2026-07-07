import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

function isE2EMode(): boolean {
  return typeof window !== 'undefined' && (
    window.location.search.includes('e2e=true') ||
    localStorage.getItem('__e2e__') === 'true'
  )
}

const MOCK_AUTH_API = 'http://localhost:3001'
let mockCurrentUser: User | null = null
let mockAuthListeners: Array<(user: User | null) => void> = []

function notifyMockAuthListeners(): void {
  for (const cb of mockAuthListeners) {
    try { cb(mockCurrentUser) } catch { /* ignore */ }
  }
}

async function mockSignInUser(email: string, _password: string): Promise<User> {
  const response = await fetch(`${MOCK_AUTH_API}/v1/accounts:signInWithPassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: _password, returnSecureToken: true })
  })
  const data = await response.json() as Record<string, any>
  if (!response.ok) {
    const error = new Error(data.error?.message ?? 'SIGN_IN_FAILED')
    ;(error as any).code = data.error?.message ?? 'auth/unknown-error'
    throw error
  }

  const user = {
    uid: data.localId, email: data.email,
    displayName: data.displayName ?? '', emailVerified: false, isAnonymous: false,
    providerData: [{ providerId: 'password' }],
    getIdToken: async () => data.idToken,
    reload: async () => {}, delete: async () => {}
  } as unknown as User

  mockCurrentUser = user
  notifyMockAuthListeners()
  return user
}

export async function signInUser(email: string, password: string): Promise<User> {
  if (isE2EMode()) return mockSignInUser(email, password)

  const auth = getFirebaseAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  setTimeout(() => window.location.reload(), 100)
  return credential.user
}

export async function signOutUser(): Promise<void> {
  if (isE2EMode()) {
    mockCurrentUser = null
    notifyMockAuthListeners()
    setTimeout(() => window.location.reload(), 100)
    return
  }
  const auth = getFirebaseAuth()
  await signOut(auth)
  setTimeout(() => window.location.reload(), 100)
}

export function getCurrentUser(): User | null {
  if (isE2EMode()) return mockCurrentUser
  return getFirebaseAuth().currentUser
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (isE2EMode()) {
    mockAuthListeners.push(callback)
    try { callback(mockCurrentUser) } catch { /* ignore */ }
    return () => { mockAuthListeners = mockAuthListeners.filter(l => l !== callback) }
  }
  return onAuthStateChanged(getFirebaseAuth(), callback)
}
