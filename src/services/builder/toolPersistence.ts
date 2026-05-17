const STORAGE_PREFIX = 'tool-state'

function storageKey(projectId: string, toolId: string): string {
  return `${STORAGE_PREFIX}-${projectId}-${toolId}`
}

export interface ToolPersistApi {
  get: (key: string, defaultValue?: unknown) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  update: (updates: Record<string, unknown>) => Promise<void>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>
  getState: () => Promise<Record<string, unknown>>
  getStateSync: () => Record<string, unknown>
}

export function createToolPersistence(projectId: string, toolId: string): ToolPersistApi {
  const key = storageKey(projectId, toolId)
  let cachedState: Record<string, unknown> | null = null

  function loadState(): Record<string, unknown> {
    if (cachedState !== null) return cachedState
    try {
      const raw = localStorage.getItem(key)
      cachedState = raw ? JSON.parse(raw) : {}
    } catch {
      cachedState = {}
    }
    return cachedState
  }

  function saveState(state: Record<string, unknown>): void {
    cachedState = state
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (e) {
      console.warn('[toolPersistence] Failed to save:', e)
    }
  }

  return {
    async get(k: string, defaultValue?: unknown): Promise<unknown> {
      const state = loadState()
      return k in state ? state[k] : defaultValue
    },
    async set(k: string, value: unknown): Promise<void> {
      const state = loadState()
      state[k] = value
      saveState(state)
    },
    async update(updates: Record<string, unknown>): Promise<void> {
      const state = loadState()
      Object.assign(state, updates)
      saveState(state)
    },
    async remove(k: string): Promise<void> {
      const state = loadState()
      delete state[k]
      saveState(state)
    },
    async clear(): Promise<void> {
      cachedState = {}
      localStorage.removeItem(key)
    },
    async getState(): Promise<Record<string, unknown>> {
      return { ...loadState() }
    },
    getStateSync(): Record<string, unknown> {
      return { ...loadState() }
    },
  }
}

export function deleteToolPersistence(projectId: string, toolId: string): void {
  const key = storageKey(projectId, toolId)
  localStorage.removeItem(key)
}
