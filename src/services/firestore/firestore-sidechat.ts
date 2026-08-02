import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, getDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { SideChatMessage } from '@/stores/sideChat'

function getUid(): string | null {
  return getFirebaseAuth()?.currentUser?.uid ?? null
}

export interface SideChatScopeData {
  messages: SideChatMessage[]
  sessionId: string | null
  lastUpdated: number
}

export async function saveSideChatScope(scopeId: string, data: SideChatScopeData): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  const ref = doc(db, 'users', uid, 'side-chat', scopeId)
  await setDoc(ref, JSON.parse(JSON.stringify(data)))
}

export async function loadSideChatScope(scopeId: string): Promise<SideChatScopeData | null> {
  const uid = getUid()
  if (!uid) return null
  const db = getFirestore()
  try {
    const ref = doc(db, 'users', uid, 'side-chat', scopeId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return snap.data() as SideChatScopeData
  } catch {
    return null
  }
}

export async function loadAllSideChatScopes(): Promise<Record<string, SideChatScopeData>> {
  const uid = getUid()
  if (!uid) return {}
  const db = getFirestore()
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'side-chat'))
    const result: Record<string, SideChatScopeData> = {}
    snap.docs.forEach(d => {
      result[d.id] = d.data() as SideChatScopeData
    })
    return result
  } catch {
    return {}
  }
}

export async function deleteSideChatScope(scopeId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return
  const db = getFirestore()
  try {
    const ref = doc(db, 'users', uid, 'side-chat', scopeId)
    await deleteDoc(ref)
  } catch {
    // ignore — best-effort cleanup
  }
}
