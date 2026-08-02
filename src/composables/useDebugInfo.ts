import { ref } from 'vue'

export interface DebugLogEntry {
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  time: string
}

export interface DebugStorageInfo {
  localStorageEntries: number
  localStorageBytes: number
  indexedDBName: string | null
  indexedDBVersion: number | null
  indexedDBStores: { name: string; count: number }[]
  cacheStoreCount: number
  quotaUsage: number | null
  quotaLimit: number | null
}

export interface DebugBrowserInfo {
  userAgent: string
  platform: string
  language: string
  online: boolean
  viewport: string
  devicePixelRatio: number
  screen: string
  appVersion: string
}

export interface FirestoreCollectionInfo {
  name: string
  count: number
  bytes: number
}

export interface DebugFirestoreInfo {
  signedIn: boolean
  uid: string | null
  collections: FirestoreCollectionInfo[]
  totalBytes: number
  error: string | null
}

export interface CloudStorageItem {
  name: string
  bytes: number
}

export interface DebugCloudStorageInfo {
  fileCount: number
  totalBytes: number
  files: CloudStorageItem[]
  error: string | null
}

const MAX_LOG_ENTRIES = 300
const logBuffer = ref<DebugLogEntry[]>([])
const isCapturing = ref(false)

const storageInfo = ref<DebugStorageInfo | null>(null)
const browserInfo = ref<Partial<Record<keyof DebugBrowserInfo, string>>>({})
const firestoreInfo = ref<DebugFirestoreInfo | null>(null)
const cloudStorageInfo = ref<DebugCloudStorageInfo | null>(null)
const cloudStorageLoading = ref(false)
let debugInfoLoaded = false

const nativeConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
}

function formatArgs(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.name}: ${a.message}`
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

function pushEntry(level: DebugLogEntry['level'], args: unknown[]) {
  const entry: DebugLogEntry = {
    level,
    message: formatArgs(args),
    time: new Date().toLocaleTimeString(),
  }
  logBuffer.value.push(entry)
  if (logBuffer.value.length > MAX_LOG_ENTRIES) {
    logBuffer.value.splice(0, logBuffer.value.length - MAX_LOG_ENTRIES)
  }
}

function startCapture() {
  if (isCapturing.value) return
  isCapturing.value = true

  console.log = (...args: unknown[]) => { nativeConsole.log(...args); pushEntry('log', args) }
  console.warn = (...args: unknown[]) => { nativeConsole.warn(...args); pushEntry('warn', args) }
  console.error = (...args: unknown[]) => { nativeConsole.error(...args); pushEntry('error', args) }
  console.info = (...args: unknown[]) => { nativeConsole.info(...args); pushEntry('info', args) }
}

function stopCapture() {
  if (!isCapturing.value) return
  isCapturing.value = false
  console.log = nativeConsole.log
  console.warn = nativeConsole.warn
  console.error = nativeConsole.error
  console.info = nativeConsole.info
}

function clearLogs() {
  logBuffer.value = []
}

function getLocalStorageBytes(): number {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const val = localStorage.getItem(key) ?? ''
      total += key.length + val.length
    }
  }
  return total * 2
}

async function gatherStorageInfo(): Promise<DebugStorageInfo> {
  const info: DebugStorageInfo = {
    localStorageEntries: localStorage.length,
    localStorageBytes: getLocalStorageBytes(),
    indexedDBName: null,
    indexedDBVersion: null,
    indexedDBStores: [],
    cacheStoreCount: 0,
    quotaUsage: null,
    quotaLimit: null,
  }

  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      info.quotaUsage = est.usage ?? null
      info.quotaLimit = est.quota ?? null
    }
  } catch { /* noop */ }

  try {
    const dbNames = await indexedDB.databases()
    const dbName = dbNames?.[0]?.name ?? 'chat-clone-db'
    info.indexedDBName = dbName

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    info.indexedDBVersion = db.version

    const storeNames = Array.from(db.objectStoreNames)
    const stores = await Promise.all(storeNames.map(name =>
      new Promise<{ name: string; count: number }>((resolve) => {
        const tx = db.transaction(name, 'readonly')
        const store = tx.objectStore(name)
        const countReq = store.count()
        countReq.onsuccess = () => resolve({ name, count: countReq.result })
        countReq.onerror = () => resolve({ name, count: -1 })
      })
    ))
    info.indexedDBStores = stores
    db.close()
  } catch { /* noop */ }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      info.cacheStoreCount = keys.length
    }
  } catch { /* noop */ }

  return info
}

function gatherBrowserInfo(): DebugBrowserInfo {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language,
    online: navigator.onLine,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    appVersion: import.meta.env.VITE_APP_VERSION ?? 'dev',
  }
}

async function gatherFirestoreInfo(): Promise<DebugFirestoreInfo> {
  const result: DebugFirestoreInfo = {
    signedIn: false,
    uid: null,
    collections: [],
    totalBytes: 0,
    error: null,
  }

  try {
    const { getFirebaseAuth } = await import('@/services/firebase')
    const auth = getFirebaseAuth()
    const uid = auth?.currentUser?.uid ?? null
    if (!uid) return result
    result.signedIn = true
    result.uid = uid

    const { getFirestore, collection, getDocs } = await import('firebase/firestore')
    const db = getFirestore()

    const collectionNames = [
      'chat-state',
      'chat-messages',
      'books',
      'studio-projects',
      'studio-tool',
      'studio-global-tools',
      'studio-sessions',
    ]

    const colInfos = await Promise.all(collectionNames.map(async (name) => {
      try {
        const snap = await getDocs(collection(db, 'users', uid, name))
        let bytes = 0
        snap.forEach(d => { try { bytes += JSON.stringify(d.data()).length * 2 } catch { /* skip */ } })
        return { name, count: snap.size, bytes }
      } catch {
        return { name, count: -1, bytes: 0 }
      }
    }))

    result.collections = colInfos.filter(c => c.count > 0)
    result.totalBytes = colInfos.reduce((sum, c) => sum + c.bytes, 0)
  } catch (e: any) {
    result.error = e?.message ?? 'Failed to read Firestore'
  }

  return result
}

async function gatherCloudStorageInfo(): Promise<DebugCloudStorageInfo> {
  const result: DebugCloudStorageInfo = { fileCount: 0, totalBytes: 0, files: [], error: null }
  try {
    const { getFirebaseAuth } = await import('@/services/firebase')
    const auth = getFirebaseAuth()
    const uid = auth?.currentUser?.uid ?? null
    if (!uid) return result

    const { getStorage, ref, listAll, getMetadata } = await import('firebase/storage')
    const storage = getStorage()

    async function listRecursive(dirRef: ReturnType<typeof ref>): Promise<ReturnType<typeof ref>[]> {
      const res = await listAll(dirRef)
      const items = [...res.items]
      for (const prefix of res.prefixes) {
        try { items.push(...await listRecursive(prefix)) } catch { /* skip */ }
      }
      return items
    }

    const allItems = await listRecursive(ref(storage, `users/${uid}`))

    const fileInfos = await Promise.all(allItems.map(async (item) => {
      try {
        const meta = await getMetadata(item)
        return { name: item.fullPath.replace(`users/${uid}/`, ''), bytes: meta.size }
      } catch {
        return { name: item.fullPath.replace(`users/${uid}/`, ''), bytes: 0 }
      }
    }))

    result.files = fileInfos.sort((a, b) => b.bytes - a.bytes)
    result.fileCount = fileInfos.length
    result.totalBytes = fileInfos.reduce((sum, f) => sum + f.bytes, 0)
  } catch (e: any) {
    result.error = e?.message ?? 'Failed to read Cloud Storage'
  }
  return result
}

export function useDebugInfo() {
  async function refresh() {
    browserInfo.value = gatherBrowserInfo()
    storageInfo.value = await gatherStorageInfo()
    firestoreInfo.value = await gatherFirestoreInfo()
    debugInfoLoaded = true
  }

  async function refreshCloudStorage() {
    cloudStorageLoading.value = true
    try {
      cloudStorageInfo.value = await gatherCloudStorageInfo()
    } finally {
      cloudStorageLoading.value = false
    }
  }

  async function ensureLoaded() {
    if (debugInfoLoaded) return
    await refresh()
  }

  return {
    logBuffer,
    isCapturing,
    startCapture,
    stopCapture,
    clearLogs,
    storageInfo,
    browserInfo,
    firestoreInfo,
    cloudStorageInfo,
    cloudStorageLoading,
    refresh,
    refreshCloudStorage,
    ensureLoaded,
  }
}
