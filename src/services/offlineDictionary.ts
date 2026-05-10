type DictEntry = { d: string; p?: string }
type DictData = Record<string, DictEntry>

const CACHE_KEY = 'offline-dictionary-v4'

let cache: DictData | null = null
let wordList: string[] | null = null
let loading: Promise<DictData | null> | null = null
let loadError = false

async function loadFromIndexedDB(): Promise<DictData | null> {
  try {
    const { getDB } = await import('@/services/sync/IndexedDBService')
    const db = await getDB()
    const data = await db.get('app-data', CACHE_KEY)
    return data ?? null
  } catch {
    return null
  }
}

async function saveToIndexedDB(data: DictData): Promise<void> {
  try {
    const { getDB } = await import('@/services/sync/IndexedDBService')
    const db = await getDB()
    await db.put('app-data', data, CACHE_KEY)
  } catch {}
}

async function fetchDictionary(): Promise<DictData | null> {
  try {
    const resp = await fetch(import.meta.env.BASE_URL + 'dictionary.json')
    if (!resp.ok) {
      console.warn('[OfflineDictionary] fetch failed:', resp.status)
      return null
    }
    const data = await resp.json()
    if (data && typeof data === 'object') {
      console.log('[OfflineDictionary] loaded', Object.keys(data).length, 'words')
      return data
    }
  } catch (e) {
    console.warn('[OfflineDictionary] fetch error:', (e as Error).message)
  }
  return null
}

async function ensureLoaded(): Promise<DictData | null> {
  if (cache) return cache
  if (loadError) return null
  if (loading) return loading

  loading = (async () => {
    const cached = await loadFromIndexedDB()
    if (cached && Object.keys(cached).length > 0) {
      cache = cached
      return cache
    }

    const fetched = await fetchDictionary()
    if (fetched) {
      cache = fetched
      saveToIndexedDB(fetched)
      return cache
    }

    loadError = true
    return null
  })()

  loading.finally(() => { loading = null })
  return loading
}

function getWordList(dict: DictData): string[] {
  if (wordList) return wordList
  wordList = Object.keys(dict)
  return wordList
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = new Array(m + 1)

  for (let i = 0; i <= m; i++) dp[i] = i
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return dp[m]
}

function fuzzyMatch(input: string, dict: DictData): string | null {
  const words = getWordList(dict)
  const inputLower = input.toLowerCase().trim()

  let bestWord: string | null = null
  let bestScore = Infinity
  const maxDist = Math.max(1, Math.ceil(inputLower.length / 3))

  for (const w of words) {
    if (Math.abs(w.length - inputLower.length) > maxDist) continue

    const dist = editDistance(inputLower, w)
    if (dist < bestScore && dist <= maxDist) {
      bestScore = dist
      bestWord = w
      if (dist === 1) break
    }
  }

  if (!bestWord) return null
  return bestWord
}

export interface LookupResult {
  definition: string
  pronunciation: string
  fuzzy: boolean
}

function toResult(entry: DictEntry, fuzzy: boolean): LookupResult {
  return {
    definition: entry.d,
    pronunciation: entry.p || '',
    fuzzy,
  }
}

export async function dictionaryLookup(word: string): Promise<LookupResult | null> {
  const dict = await ensureLoaded()
  if (!dict) return null

  const normalized = word.toLowerCase().trim()

  const exact = dict[normalized]
  if (exact) return toResult(exact, false)

  const fuzzyWord = fuzzyMatch(normalized, dict)
  if (fuzzyWord && dict[fuzzyWord]) return toResult(dict[fuzzyWord], true)

  return null
}

export async function isDictionaryLoaded(): Promise<boolean> {
  const dict = await ensureLoaded()
  return dict !== null && Object.keys(dict).length > 0
}

export const _test = { editDistance, fuzzyMatch, toResult }
