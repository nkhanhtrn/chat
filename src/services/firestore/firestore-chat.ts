import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

export async function syncChatStateWithSubcollections(
  state: Record<string, unknown>,
  _changedIds: Set<string> | null,
  _deletedIds: Set<string> | null
): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  const { messagesById, rootMessageIds, ...metaData } = state

  try {
    const metaRef = doc(db, 'users', uid, 'chat-state', 'metadata')
    await setDoc(metaRef, {
      chats: JSON.parse(JSON.stringify(metaData.chats ?? [])),
      currentChatId: metaData.currentChatId ?? null,
      currentModel: metaData.currentModel ?? null,
      vocabData: JSON.parse(JSON.stringify(metaData.vocabData ?? {})),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreChat] Failed to save metadata:', error)
  }

  const currentChatId = state.currentChatId as string | null
  if (currentChatId && messagesById && Object.keys(messagesById as Record<string, unknown>).length > 0) {
    try {
      const messagesRef = doc(db, 'users', uid, 'chat-messages', currentChatId)
      await setDoc(messagesRef, {
        messagesById: JSON.parse(JSON.stringify(messagesById)),
        lastUpdated: Date.now(),
      })
    } catch (error) {
      console.error('[FirestoreChat] Failed to save messages:', error)
    }
  }
}

export async function loadChatMetadata(): Promise<Record<string, unknown> | null> {
  const uid = getUid()
  if (!uid) return null

  try {
    const db = getFirestore()
    const metaRef = doc(db, 'users', uid, 'chat-state', 'metadata')
    const snap = await getDoc(metaRef)
    if (!snap.exists()) return null
    return snap.data() as Record<string, unknown>
  } catch (error) {
    console.error('[FirestoreChat] Failed to load metadata:', error)
    return null
  }
}

export async function loadMessagesForChat(chatId: string): Promise<Record<string, unknown>> {
  const uid = getUid()
  if (!uid) return {}

  try {
    const db = getFirestore()
    const messagesRef = doc(db, 'users', uid, 'chat-messages', chatId)
    const snap = await getDoc(messagesRef)
    if (!snap.exists()) return {}
    const data = snap.data()
    return (data.messagesById as Record<string, unknown>) ?? {}
  } catch (error) {
    console.error('[FirestoreChat] Failed to load messages:', error)
    return {}
  }
}
