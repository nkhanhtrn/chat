import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

export async function loadSettingsFromCloud(): Promise<Record<string, unknown> | null> {
  const uid = getUid()
  if (!uid) return null

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'settings', 'user-settings')
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    delete (data as any).lastUpdated
    return data as Record<string, unknown>
  } catch (error) {
    console.error('[FirestoreSettings] Failed to load:', error)
    return null
  }
}

export async function saveSettingsToCloud(settings: Record<string, unknown>): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'settings', 'user-settings')
    await setDoc(ref, {
      ...JSON.parse(JSON.stringify(settings)),
      lastUpdated: Date.now(),
    }, { merge: true })
  } catch (error) {
    console.error('[FirestoreSettings] Failed to save:', error)
  }
}
