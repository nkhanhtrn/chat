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

const MAX_LOG_ENTRIES = 300
const logBuffer = ref<DebugLogEntry[]>([])
const isCapturing = ref(false)

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

export function useDebugInfo() {
  return {
    logBuffer,
    isCapturing,
    startCapture,
    stopCapture,
    clearLogs,
    gatherStorageInfo,
    gatherBrowserInfo,
  }
}
