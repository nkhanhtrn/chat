import { defineStore } from 'pinia'
import lmService from '@/services/llm/LMService'
import { getFirebaseAuth } from '@/services/firebase'
import type { LLMMessage } from '@/types/llm'
import type { SideChatScopeData } from '@/services/firestore/firestore-sidechat'

function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?>[\s\S]*$/gi, '')
}

export interface SideChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export const GLOBAL_SCOPE = 'global'

export function bookScopeId(bookId: string): string {
  return `book-${bookId}`
}

interface ScopeState {
  messages: SideChatMessage[]
  sessionId: string | null
  lastUpdated: number
}

function emptyScope(): ScopeState {
  return { messages: [], sessionId: null, lastUpdated: 0 }
}

const STORAGE_KEY = 'side-chat'
const SESSION_TITLE = 'Side Chat'

interface PersistedState {
  scopes: Record<string, ScopeState>
  activeScope: string
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { scopes: {}, activeScope: GLOBAL_SCOPE }
    const parsed = JSON.parse(raw)

    // Migrate legacy single-thread shape: { messages, sessionId }
    if (parsed && parsed.messages && !parsed.scopes) {
      const scope: ScopeState = {
        messages: Array.isArray(parsed.messages) ? parsed.messages as SideChatMessage[] : [],
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
        lastUpdated: Date.now(),
      }
      return { scopes: { [GLOBAL_SCOPE]: scope }, activeScope: GLOBAL_SCOPE }
    }

    const scopes: Record<string, ScopeState> = {}
    if (parsed && parsed.scopes && typeof parsed.scopes === 'object') {
      for (const [id, s] of Object.entries(parsed.scopes as Record<string, Partial<ScopeState>>)) {
        scopes[id] = {
          messages: Array.isArray(s.messages) ? s.messages as SideChatMessage[] : [],
          sessionId: typeof s.sessionId === 'string' ? s.sessionId : null,
          lastUpdated: typeof s.lastUpdated === 'number' ? s.lastUpdated : 0,
        }
      }
    }
    return {
      scopes,
      activeScope: typeof parsed.activeScope === 'string' ? parsed.activeScope : GLOBAL_SCOPE,
    }
  } catch {
    return { scopes: {}, activeScope: GLOBAL_SCOPE }
  }
}

let _cloudSyncTimer: ReturnType<typeof setTimeout> | null = null
const CLOUD_SYNC_DEBOUNCE_MS = 2000
let _cloudInitialized = false

function isSignedIn(): boolean {
  return !!getFirebaseAuth()?.currentUser
}

function mergeScope(local: ScopeState, cloud: SideChatScopeData): ScopeState {
  const cloudMessages = Array.isArray(cloud.messages) ? cloud.messages : []
  // Newer side wins outright; otherwise union messages by id (local order first)
  if ((cloud.lastUpdated ?? 0) >= (local.lastUpdated ?? 0)) {
    return {
      messages: cloudMessages,
      sessionId: cloud.sessionId ?? null,
      lastUpdated: cloud.lastUpdated ?? 0,
    }
  }
  const seen = new Set(local.messages.map(m => m.id))
  const merged = [...local.messages]
  for (const m of cloudMessages) {
    if (!seen.has(m.id)) merged.push(m)
  }
  return {
    messages: merged,
    sessionId: local.sessionId ?? cloud.sessionId ?? null,
    lastUpdated: Math.max(local.lastUpdated ?? 0, cloud.lastUpdated ?? 0),
  }
}

export const useSideChatStore = defineStore('sideChat', {
  state: () => {
    const persisted = loadPersisted()
    if (!persisted.scopes[persisted.activeScope]) {
      persisted.scopes[persisted.activeScope] = emptyScope()
    }
    return {
      scopes: persisted.scopes,
      activeScope: persisted.activeScope,
      loadedScopes: {} as Record<string, boolean>,
      isStreaming: false,
      streamingContent: '',
      error: null as string | null,
      contextLabel: '' as string,
    }
  },

  getters: {
    currentScope(state): ScopeState {
      return state.scopes[state.activeScope] ?? emptyScope()
    },
    messages(): SideChatMessage[] {
      return this.currentScope.messages
    },
    sessionId(): string | null {
      return this.currentScope.sessionId
    },
    hasMessages(): boolean {
      return this.currentScope.messages.length > 0
    },
    scopeCount(state): number {
      return Object.keys(state.scopes).length
    },
  },

  actions: {
    setActiveScope(scopeId: string): void {
      if (this.activeScope === scopeId) {
        this.ensureScopeLoaded(scopeId)
        return
      }
      if (!this.scopes[scopeId]) this.scopes[scopeId] = emptyScope()
      this.activeScope = scopeId
      this.error = null
      this.streamingContent = ''
      this.persist()
      this.ensureScopeLoaded(scopeId)
    },

    setContextLabel(label: string): void {
      this.contextLabel = label
    },

    async ensureScopeLoaded(scopeId: string): Promise<void> {
      if (this.loadedScopes[scopeId] || !isSignedIn() || !navigator.onLine) return
      this.loadedScopes[scopeId] = true
      try {
        const { loadSideChatScope } = await import('@/services/firestore/firestore-sidechat')
        const cloud = await loadSideChatScope(scopeId)
        if (!cloud) return
        const local = this.scopes[scopeId] ?? emptyScope()
        this.scopes[scopeId] = mergeScope(local, cloud)
        this.persist()
      } catch (e) {
        console.warn('[sideChat] Failed to load scope from cloud:', e)
      }
    },

    async initFromCloud(): Promise<void> {
      if (_cloudInitialized || !isSignedIn() || !navigator.onLine) return
      _cloudInitialized = true
      try {
        const { loadAllSideChatScopes } = await import('@/services/firestore/firestore-sidechat')
        const cloudScopes = await loadAllSideChatScopes()
        for (const [id, cloud] of Object.entries(cloudScopes)) {
          const local = this.scopes[id] ?? emptyScope()
          this.scopes[id] = mergeScope(local, cloud)
          this.loadedScopes[id] = true
        }
        this.persist()
      } catch (e) {
        console.warn('[sideChat] Cloud init failed:', e)
      }
    },

    async sendMessage(text: string): Promise<void> {
      if (!text.trim() || this.isStreaming) return

      this.error = null

      if (!this.scopes[this.activeScope]) this.scopes[this.activeScope] = emptyScope()
      const scope = this.scopes[this.activeScope]

      const userMsg: SideChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      }
      scope.messages.push(userMsg)
      scope.lastUpdated = Date.now()
      this.persist()

      this.isStreaming = true
      this.streamingContent = ''
      let rawContent = ''

      try {
        if (!scope.sessionId) {
          scope.sessionId = await lmService.ensureSession(
            'side-chat',
            null,
            SESSION_TITLE
          )
          scope.lastUpdated = Date.now()
        }

        const llmMessages: LLMMessage[] = [
          {
            role: 'system',
            content: this.contextLabel
              ? `You are a helpful assistant. Be concise and clear. Use markdown formatting when helpful.\n\nCurrent context: ${this.contextLabel}`
              : 'You are a helpful assistant. Be concise and clear. Use markdown formatting when helpful.',
          },
        ]

        for (const msg of scope.messages) {
          llmMessages.push({
            role: msg.role,
            content: msg.content,
          })
        }

        const fullContent = await lmService.chat(
          scope.sessionId,
          llmMessages,
          (chunk: string) => {
            rawContent += chunk
            this.streamingContent = stripThinking(rawContent)
          }
        )

        scope.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: stripThinking(fullContent ?? rawContent),
        })
        scope.lastUpdated = Date.now()
        this.persist()
        this.scheduleCloudSync()
      } catch (err) {
        this.error = (err as Error).message
      } finally {
        this.isStreaming = false
        this.streamingContent = ''
      }
    },

    clearChat(): void {
      const scope = this.scopes[this.activeScope]
      if (scope) {
        scope.messages = []
        scope.sessionId = null
        scope.lastUpdated = Date.now()
      }
      this.error = null
      this.streamingContent = ''
      this.persist()
      this.scheduleCloudDelete(this.activeScope)
    },

    persist(): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          scopes: this.scopes,
          activeScope: this.activeScope,
        } as PersistedState))
      } catch (e) {
        console.warn('[sideChat] Failed to persist chat:', e)
      }
    },

    scheduleCloudSync(): void {
      if (!isSignedIn() || !navigator.onLine) return
      if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer)
      _cloudSyncTimer = setTimeout(async () => {
        const scopeId = this.activeScope
        const scope = this.scopes[scopeId]
        if (!scope) return
        try {
          const { saveSideChatScope } = await import('@/services/firestore/firestore-sidechat')
          await saveSideChatScope(scopeId, {
            messages: scope.messages,
            sessionId: scope.sessionId,
            lastUpdated: scope.lastUpdated,
          })
        } catch (e) {
          console.warn('[sideChat] Cloud sync failed:', e)
        }
      }, CLOUD_SYNC_DEBOUNCE_MS)
    },

    scheduleCloudDelete(scopeId: string): void {
      if (!isSignedIn() || !navigator.onLine) return
      setTimeout(async () => {
        try {
          const { deleteSideChatScope } = await import('@/services/firestore/firestore-sidechat')
          await deleteSideChatScope(scopeId)
        } catch (e) {
          console.warn('[sideChat] Cloud delete failed:', e)
        }
      }, CLOUD_SYNC_DEBOUNCE_MS)
    },
  },
})
