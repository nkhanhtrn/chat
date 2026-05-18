import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore'
import { getFirebaseAuth } from '@/services/firebase'
import type { Project, ProjectMessage, ProjectWindow } from '@/types/project'

function getUid(): string | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser?.uid ?? null
}

// ── Projects ──

export async function saveProjectToCloud(project: Project): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'studio-projects', project.id)
    await setDoc(ref, {
      ...JSON.parse(JSON.stringify(project)),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreStudio] Failed to save project:', error)
  }
}

export async function loadProjectsFromCloud(): Promise<Project[]> {
  const uid = getUid()
  if (!uid) return []

  try {
    const db = getFirestore()
    const colRef = collection(db, 'users', uid, 'studio-projects')
    const snap = await getDocs(colRef)
    return snap.docs.map(d => {
      const data = d.data()
      delete (data as any).lastUpdated
      return data as unknown as Project
    })
  } catch (error) {
    console.error('[FirestoreStudio] Failed to load projects:', error)
    return []
  }
}

export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  const db = getFirestore()
  try {
    await deleteDoc(doc(db, 'users', uid, 'studio-projects', projectId))

    for (const col of ['studio-chat', 'studio-tool']) {
      const colRef = collection(db, 'users', uid, col)
      const snap = await getDocs(colRef)
      const batch = writeBatch(db)
      for (const d of snap.docs) {
        if (d.id.startsWith(projectId + '-')) {
          batch.delete(d.ref)
        }
      }
      if (batch._mutations.length > 0) await batch.commit()
    }
  } catch (error) {
    console.error('[FirestoreStudio] Failed to delete project:', error)
  }
}

// ── Chat (messages + session per dataKey) ──

export async function saveChatToCloud(
  dataKey: string,
  data: { messages: ProjectMessage[]; sessionId?: string | null }
): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'studio-chat', dataKey)
    await setDoc(ref, {
      messages: JSON.parse(JSON.stringify(data.messages)),
      sessionId: data.sessionId ?? null,
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreStudio] Failed to save chat:', error)
  }
}

export async function loadChatFromCloud(dataKey: string): Promise<{
  messages: ProjectMessage[]
  sessionId: string | null
} | null> {
  const uid = getUid()
  if (!uid) return null

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'studio-chat', dataKey)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      messages: (data.messages as ProjectMessage[]) ?? [],
      sessionId: (data.sessionId as string) ?? null,
    }
  } catch (error) {
    console.error('[FirestoreStudio] Failed to load chat:', error)
    return null
  }
}

export async function deleteChatFromCloud(dataKey: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    await deleteDoc(doc(db, 'users', uid, 'studio-chat', dataKey))
  } catch (error) {
    console.error('[FirestoreStudio] Failed to delete chat:', error)
  }
}

// ── Tools (one doc per window) ──

export async function saveToolToCloud(
  dataKey: string,
  windowId: string,
  data: { window: ProjectWindow; toolState?: Record<string, unknown> }
): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const ref = doc(db, 'users', uid, 'studio-tool', `${dataKey}-${windowId}`)
    await setDoc(ref, {
      window: JSON.parse(JSON.stringify(data.window)),
      toolStateJson: JSON.stringify(data.toolState ?? {}),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error('[FirestoreStudio] Failed to save tool:', error)
  }
}

export async function loadToolsFromCloud(dataKey: string): Promise<{
  windows: ProjectWindow[]
  toolStates: Record<string, Record<string, unknown>>
}> {
  const uid = getUid()
  if (!uid) return { windows: [], toolStates: {} }

  try {
    const db = getFirestore()
    const colRef = collection(db, 'users', uid, 'studio-tool')
    const snap = await getDocs(colRef)
    const windows: ProjectWindow[] = []
    const toolStates: Record<string, Record<string, unknown>> = {}

    for (const d of snap.docs) {
      if (!d.id.startsWith(dataKey + '-')) continue
      const data = d.data()
      const win = data.window as ProjectWindow
      if (win) {
        windows.push(win)
        const raw = data.toolStateJson as string | undefined
        if (raw) {
          try {
            const state = JSON.parse(raw) as Record<string, unknown>
            if (Object.keys(state).length > 0) {
              toolStates[win.id] = state
            }
          } catch { /* skip corrupt state */ }
        }
      }
    }
    return { windows, toolStates }
  } catch (error) {
    console.error('[FirestoreStudio] Failed to load tools:', error)
    return { windows: [], toolStates: {} }
  }
}

export async function deleteToolFromCloud(dataKey: string, windowId: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    await deleteDoc(doc(db, 'users', uid, 'studio-tool', `${dataKey}-${windowId}`))
  } catch (error) {
    console.error('[FirestoreStudio] Failed to delete tool:', error)
  }
}

export async function deleteAllToolsFromCloud(dataKey: string): Promise<void> {
  const uid = getUid()
  if (!uid) return

  try {
    const db = getFirestore()
    const colRef = collection(db, 'users', uid, 'studio-tool')
    const snap = await getDocs(colRef)
    const batch = writeBatch(db)
    for (const d of snap.docs) {
      if (d.id.startsWith(dataKey + '-')) {
        batch.delete(d.ref)
      }
    }
    if (batch._mutations.length > 0) await batch.commit()
  } catch (error) {
    console.error('[FirestoreStudio] Failed to delete tools:', error)
  }
}
