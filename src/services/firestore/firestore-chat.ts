import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { Notebook } from '@/types/notebook'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

// ── Chat metadata (list + settings + vocab) ──

export async function saveChatMetadataToCloud(data: {
  chats: Notebook[]
  currentChatId: string | null
  currentModel: string | null
  vocabData: Record<string, unknown>
  vocabScratchpad: string
}): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'chat-state', 'metadata')
    await setDoc(ref, {
      chats: JSON.parse(JSON.stringify(data.chats)),
      currentChatId: data.currentChatId ?? null,
      currentModel: data.currentModel ?? null,
      vocabData: JSON.parse(JSON.stringify(data.vocabData ?? {})),
      vocabScratchpad: data.vocabScratchpad ?? '',
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreChat] Failed to save metadata:', error)
  }
}

export async function loadChatMetadataFromCloud(): Promise<{
  chats: Notebook[]
  currentChatId: string | null
  currentModel: string | null
  vocabData: Record<string, unknown>
  vocabScratchpad: string
  lastUpdated: number
} | null> {
  const uid = getUid()
  if (!uid) return null

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'chat-state', 'metadata')
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      chats: (data.chats as Notebook[]) ?? [],
      currentChatId: (data.currentChatId as string) ?? null,
      currentModel: (data.currentModel as string) ?? null,
      vocabData: (data.vocabData as Record<string, unknown>) ?? {},
      vocabScratchpad: (data.vocabScratchpad as string) ?? '',
      lastUpdated: (data.lastUpdated as number) ?? 0,
    }
  } catch (error) {
    console.error('[FirestoreChat] Failed to load metadata:', error)
    return null
  }
}

// ── Messages (one doc per chat) ──

export async function saveChatMessagesToCloud(
  chatId: string,
  messagesById: Record<string, unknown>
): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'chat-messages', chatId)
    await setDoc(ref, {
      messagesById: JSON.parse(JSON.stringify(messagesById)),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreChat] Failed to save messages:', error)
  }
}

export async function loadChatMessagesFromCloud(chatId: string): Promise<Record<string, unknown>> {
  const uid = getUid()
  if (!uid) return {}

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'chat-messages', chatId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return {}
    const data = snap.data()
    return (data.messagesById as Record<string, unknown>) ?? {}
  } catch (error) {
    console.error('[FirestoreChat] Failed to load messages:', error)
    return {}
  }
}

export async function deleteChatMessagesFromCloud(chatId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    await deleteDoc(doc(db, 'users', uid, 'chat-messages', chatId))
  } catch (error) {
    console.error('[FirestoreChat] Failed to delete messages:', error)
  }
}
