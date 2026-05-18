import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Project, SubProject, ProjectMessage, ProjectWindow, WindowDisplayState } from '@/types/project'
import { deleteToolPersistence } from '@/services/builder/toolPersistence'
import {
  saveProjectToCloud,
  loadProjectsFromCloud,
  deleteProjectFromCloud,
  saveChatToCloud,
  loadChatFromCloud,
  deleteChatFromCloud,
  saveToolToCloud,
  loadToolsFromCloud,
  deleteToolFromCloud,
  deleteAllToolsFromCloud,
} from '@/services/firestore/firestore-studio'
import { getCurrentUser } from '@/services/auth'

const STORAGE_KEY = 'projects-data'
const MESSAGES_KEY_PREFIX = 'project-messages-'
const WINDOWS_KEY_PREFIX = 'project-windows-'
const TOOL_STATE_PREFIX = 'tool-state-'
const SCRATCHPAD_KEY_PREFIX = 'project-scratchpad-'
const SYNC_DEBOUNCE_MS = 1000

function generateId(): string {
  return crypto.randomUUID()
}

function storageKey(projectId: string, subprojectId: string): string {
  return `${projectId}-${subprojectId}`
}

function loadFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

function loadMessages(key: string): ProjectMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY_PREFIX + key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(key: string, msgs: ProjectMessage[]) {
  localStorage.setItem(MESSAGES_KEY_PREFIX + key, JSON.stringify(msgs))
}

function loadWindows(key: string): ProjectWindow[] {
  try {
    const raw = localStorage.getItem(WINDOWS_KEY_PREFIX + key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWindows(key: string, wins: ProjectWindow[]) {
  localStorage.setItem(WINDOWS_KEY_PREFIX + key, JSON.stringify(wins))
}

function loadScratchpad(key: string): string {
  try {
    return localStorage.getItem(SCRATCHPAD_KEY_PREFIX + key) ?? ''
  } catch {
    return ''
  }
}

function saveScratchpad(key: string, content: string) {
  localStorage.setItem(SCRATCHPAD_KEY_PREFIX + key, content)
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let projectSyncTimer: ReturnType<typeof setTimeout> | null = null
let isApplyingCloud = false
const loadedCloudKeys = new Set<string>()
let syncInitialized = false
const pendingProjectSync = new Set<string>()
const pendingToolSync = new Set<string>()
const pendingDeletes = new Set<{ type: 'chat' | 'tool'; key: string; windowId?: string }>()

function getToolState(dataKey: string, windowId: string): Record<string, unknown> {
  const raw = localStorage.getItem(`${TOOL_STATE_PREFIX}${dataKey}-${windowId}`)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>(loadFromStorage())
  const currentProjectId = ref<string | null>(null)
  const messages = ref<Map<string, ProjectMessage[]>>(new Map())
  const windows = ref<Map<string, ProjectWindow[]>>(new Map())
  const scratchpads = ref<Map<string, string>>(new Map())

  const projectList = computed(() =>
    [...projects.value].sort((a, b) => b.updatedAt - a.updatedAt)
  )

  const currentProject = computed(() =>
    projects.value.find(p => p.id === currentProjectId.value) ?? null
  )

  const currentSubprojectId = computed(() =>
    currentProject.value?.activeSubprojectId ?? null
  )

  const currentDataKey = computed(() => {
    if (!currentProjectId.value || !currentSubprojectId.value) return null
    return storageKey(currentProjectId.value, currentSubprojectId.value)
  })

  const currentMessages = computed(() =>
    currentDataKey.value
      ? (messages.value.get(currentDataKey.value) ?? [])
      : []
  )

  const currentWindows = computed(() =>
    currentDataKey.value
      ? (windows.value.get(currentDataKey.value) ?? [])
      : []
  )

  const activeWindows = computed(() =>
    currentWindows.value.filter(w => w.displayState !== 'closed')
  )

  const currentScratchpad = computed(() =>
    currentDataKey.value
      ? (scratchpads.value.get(currentDataKey.value) ?? '')
      : ''
  )

  const openSubprojects = computed(() => {
    const project = currentProject.value
    if (!project) return []
    const closed = new Set(project.closedSubprojectIds ?? [])
    return project.subprojects.filter(s => !closed.has(s.id))
  })

  watch(projects, (val) => saveToStorage(val), { deep: true })

  // ── Cloud sync: single batched flush ──

  async function flushSync(): Promise<void> {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return

    for (const d of pendingDeletes) {
      if (d.type === 'chat') await deleteChatFromCloud(d.key)
      else if (d.type === 'tool' && d.windowId) await deleteToolFromCloud(d.key, d.windowId)
    }
    pendingDeletes.clear()

    for (const key of pendingToolSync) {
      const [dk, wid] = key.split(':')
      const wins = windows.value.get(dk) ?? []
      const win = wins.find(w => w.id === wid)
      if (!win) continue
      const toolState = getToolState(dk, wid)
      await saveToolToCloud(dk, wid, { window: win, toolState })
    }
    pendingToolSync.clear()
  }

  function scheduleSync(): void {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      flushSync().catch(err =>
        console.error('[StudioSync] Flush failed:', err)
      )
    }, SYNC_DEBOUNCE_MS)
  }

  function markProject(projectId: string): void {
    pendingProjectSync.add(projectId)
    if (projectSyncTimer) clearTimeout(projectSyncTimer)
    projectSyncTimer = setTimeout(async () => {
      const user = getCurrentUser()
      if (!user || !navigator.onLine) return
      for (const pid of pendingProjectSync) {
        const project = projects.value.find(p => p.id === pid)
        if (project) await saveProjectToCloud(project)
      }
      pendingProjectSync.clear()
    }, 100)
  }

  function syncChatNow(dataKey: string): void {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return
    const msgs = messages.value.get(dataKey)
    if (!msgs) return
    const sessionId = localStorage.getItem(`project-session-${dataKey}`)
    saveChatToCloud(dataKey, { messages: msgs, sessionId }).catch(err =>
      console.error('[StudioSync] Chat sync failed:', err)
    )
  }

  function markTool(dataKey: string, windowId: string): void {
    pendingToolSync.add(`${dataKey}:${windowId}`)
    scheduleSync()
  }

  function markDelete(type: 'chat' | 'tool', key: string, windowId?: string): void {
    pendingDeletes.add({ type, key, windowId })
    scheduleSync()
  }

  // ── Cloud sync: pull ──

  async function pullProjectsFromCloud(): Promise<void> {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return

    const cloudProjects = await loadProjectsFromCloud()
    if (cloudProjects.length === 0) return

    isApplyingCloud = true
    try {
      const localById = new Map(projects.value.map(p => [p.id, p]))
      const result: Project[] = []

      for (const cloud of cloudProjects) {
        const local = localById.get(cloud.id)
        localById.delete(cloud.id)
        if (!local || cloud.updatedAt >= local.updatedAt) {
          result.push(cloud)
        } else {
          result.push(local)
        }
      }
      for (const local of localById.values()) {
        result.push(local)
      }
      projects.value.splice(0, projects.value.length, ...result)
    } finally {
      isApplyingCloud = false
    }
  }

  async function pullDataKeyFromCloud(dataKey: string): Promise<void> {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return
    if (loadedCloudKeys.has(dataKey)) return
    loadedCloudKeys.add(dataKey)

    const [chatData, toolData] = await Promise.all([
      loadChatFromCloud(dataKey),
      loadToolsFromCloud(dataKey),
    ])

    isApplyingCloud = true
    try {
      if (chatData) {
        messages.value.set(dataKey, chatData.messages)
        if (chatData.sessionId) {
          localStorage.setItem(`project-session-${dataKey}`, chatData.sessionId)
        }
        saveMessages(dataKey, chatData.messages)
      }
      if (toolData.windows.length > 0) {
        windows.value.set(dataKey, toolData.windows)
        saveWindows(dataKey, toolData.windows)
        for (const [toolId, state] of Object.entries(toolData.toolStates)) {
          localStorage.setItem(`${TOOL_STATE_PREFIX}${dataKey}-${toolId}`, JSON.stringify(state))
        }
      }
    } finally {
      isApplyingCloud = false
    }
  }

  function handleOnline(): void {
    flushSync().catch(err =>
      console.error('[StudioSync] Online flush failed:', err)
    )
  }

  function initSync(): void {
    if (syncInitialized) return
    syncInitialized = true

    pullProjectsFromCloud().catch(err =>
      console.error('[StudioSync] Initial pull failed:', err)
    )

    watch(currentDataKey, (dk) => {
      if (dk) {
        pullDataKeyFromCloud(dk).catch(err =>
          console.error('[StudioSync] Data key pull failed:', err)
        )
      }
    }, { immediate: true })

    window.addEventListener('online', handleOnline)

    if (import.meta.hot) {
      import.meta.hot?.dispose(() => {
        if (syncTimer) clearTimeout(syncTimer)
        if (projectSyncTimer) clearTimeout(projectSyncTimer)
        window.removeEventListener('online', handleOnline)
        syncInitialized = false
        loadedCloudKeys.clear()
        pendingProjectSync.clear()
        pendingToolSync.clear()
        pendingDeletes.clear()
      })
    }
  }

  // ── CRUD ──

  function createProject(name?: string): Project {
    const defaultSub: SubProject = { id: generateId(), name: 'Main', createdAt: Date.now() }
    const project: Project = {
      id: generateId(),
      name: name ?? `Project ${projects.value.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subprojects: [defaultSub],
      activeSubprojectId: defaultSub.id,
    }
    projects.value.push(project)
    const key = storageKey(project.id, defaultSub.id)
    messages.value.set(key, [])
    windows.value.set(key, [])
    markProject(project.id)
    return project
  }

  function deleteProject(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return

    const subIds = project.subprojects.map(s => s.id)
    for (const subId of subIds) {
      deleteSubProject(id, subId)
    }

    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProjectId.value === id) {
      currentProjectId.value = projects.value[0]?.id ?? null
    }

    deleteProjectFromCloud(id).catch(err =>
      console.error('[StudioSync] Cloud delete failed:', err)
    )
  }

  function renameProject(id: string, name: string) {
    const project = projects.value.find(p => p.id === id)
    if (project) {
      project.name = name
      project.updatedAt = Date.now()
    }
    markProject(id)
  }

  function switchToProject(id: string) {
    currentProjectId.value = id
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    project.updatedAt = Date.now()
    if (!project.activeSubprojectId && project.subprojects.length > 0) {
      project.activeSubprojectId = project.subprojects[0].id
    }
    if (project.activeSubprojectId) {
      loadSubData(id, project.activeSubprojectId)
    }
  }

  function loadSubData(projectId: string, subprojectId: string) {
    const key = storageKey(projectId, subprojectId)
    if (!messages.value.has(key)) {
      messages.value.set(key, loadMessages(key))
    }
    if (!windows.value.has(key)) {
      windows.value.set(key, loadWindows(key))
    }
    if (!scratchpads.value.has(key)) {
      scratchpads.value.set(key, loadScratchpad(key))
    }
  }

  function createSubProject(projectId: string, name?: string): SubProject | null {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return null

    const sub: SubProject = {
      id: generateId(),
      name: name ?? `Subproject ${project.subprojects.length + 1}`,
      createdAt: Date.now(),
    }
    project.subprojects.push(sub)
    project.updatedAt = Date.now()

    const key = storageKey(projectId, sub.id)
    messages.value.set(key, [])
    windows.value.set(key, [])
    scratchpads.value.set(key, '')

    switchSubProject(projectId, sub.id)
    markProject(projectId)
    return sub
  }

  function deleteSubProject(projectId: string, subprojectId: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return

    const idx = project.subprojects.findIndex(s => s.id === subprojectId)
    if (idx === -1) return

    const key = storageKey(projectId, subprojectId)
    const wins = windows.value.get(key) || []
    for (const w of wins) {
      deleteToolPersistence(key, w.id)
    }
    messages.value.delete(key)
    windows.value.delete(key)
    scratchpads.value.delete(key)
    localStorage.removeItem(MESSAGES_KEY_PREFIX + key)
    localStorage.removeItem(WINDOWS_KEY_PREFIX + key)
    localStorage.removeItem(`project-session-${key}`)
    localStorage.removeItem(SCRATCHPAD_KEY_PREFIX + key)

    project.subprojects.splice(idx, 1)
    project.updatedAt = Date.now()

    if (project.activeSubprojectId === subprojectId) {
      if (project.subprojects.length > 0) {
        const newIdx = Math.min(idx, project.subprojects.length - 1)
        project.activeSubprojectId = project.subprojects[newIdx].id
        loadSubData(projectId, project.activeSubprojectId)
      }
    }

    Promise.all([
      deleteChatFromCloud(key),
      deleteAllToolsFromCloud(key),
    ]).catch(err =>
      console.error('[StudioSync] Cloud data delete failed:', err)
    )
    markProject(projectId)
  }

  function switchSubProject(projectId: string, subprojectId: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    if (project.activeSubprojectId === subprojectId) return

    project.activeSubprojectId = subprojectId
    project.updatedAt = Date.now()
    loadSubData(projectId, subprojectId)
    markProject(projectId)
  }

  function renameSubProject(projectId: string, subprojectId: string, name: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    const sub = project.subprojects.find(s => s.id === subprojectId)
    if (sub) {
      sub.name = name
      project.updatedAt = Date.now()
    }
    markProject(projectId)
  }

  function closeSubProject(projectId: string, subprojectId: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    if (!project.closedSubprojectIds) project.closedSubprojectIds = []
    if (!project.closedSubprojectIds.includes(subprojectId)) {
      project.closedSubprojectIds.push(subprojectId)
    }
    if (project.activeSubprojectId === subprojectId) {
      const closed = new Set(project.closedSubprojectIds)
      const openSubs = project.subprojects.filter(s => !closed.has(s.id))
      if (openSubs.length > 0) {
        const idx = project.subprojects.findIndex(s => s.id === subprojectId)
        const newIdx = Math.min(idx, openSubs.length - 1)
        project.activeSubprojectId = openSubs[newIdx].id
        loadSubData(projectId, project.activeSubprojectId)
      } else {
        project.activeSubprojectId = ''
      }
    }
    project.updatedAt = Date.now()
    markProject(projectId)
  }

  function reopenSubProject(projectId: string, subprojectId: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project || !project.closedSubprojectIds) return
    project.closedSubprojectIds = project.closedSubprojectIds.filter(id => id !== subprojectId)
    project.updatedAt = Date.now()
    markProject(projectId)
  }

  function reorderSubProjects(projectId: string, orderedIds: string[]) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    const map = new Map(project.subprojects.map(s => [s.id, s]))
    project.subprojects = orderedIds
      .filter(id => map.has(id))
      .map(id => map.get(id)!)
    project.updatedAt = Date.now()
    markProject(projectId)
  }

  function addMessage(dataKey: string, message: ProjectMessage) {
    if (!dataKey) return
    const list = messages.value.get(dataKey)
    if (!list) return
    list.push(message)
    if (currentProject.value) currentProject.value.updatedAt = Date.now()
    saveMessages(dataKey, list)
  }

  function clearMessages(dataKey: string) {
    if (!dataKey) return
    messages.value.set(dataKey, [])
    if (currentProject.value) currentProject.value.updatedAt = Date.now()
    saveMessages(dataKey, [])
  }

  function truncateMessages(dataKey: string, upToIndex: number) {
    if (!dataKey) return
    const list = messages.value.get(dataKey)
    if (!list) return
    const kept = list.slice(0, upToIndex)
    messages.value.set(dataKey, kept)
    if (currentProject.value) currentProject.value.updatedAt = Date.now()
    saveMessages(dataKey, kept)
  }

  function addWindow(dataKey: string, window: ProjectWindow) {
    if (!dataKey) return
    const list = windows.value.get(dataKey)
    if (!list) return
    list.push(window)
    if (currentProject.value) currentProject.value.updatedAt = Date.now()
    saveWindows(dataKey, list)
    markTool(dataKey, window.id)
  }

  function updateWindow(dataKey: string, windowId: string, updates: Partial<ProjectWindow>) {
    if (!dataKey) return
    const list = windows.value.get(dataKey)
    if (!list) return
    const idx = list.findIndex(w => w.id === windowId)
    if (idx !== -1) {
      if (updates.code !== undefined && updates.code !== list[idx].code) {
        updates.previousCode = list[idx].code
      }
      list[idx] = { ...list[idx], ...updates }
      saveWindows(dataKey, list)
      markTool(dataKey, windowId)
    }
  }

  function revertWindowCode(dataKey: string, windowId: string) {
    if (!dataKey) return
    const list = windows.value.get(dataKey)
    if (!list) return
    const idx = list.findIndex(w => w.id === windowId)
    if (idx === -1) return
    const win = list[idx]
    if (!win.previousCode) return
    const current = win.code
    win.code = win.previousCode
    win.previousCode = current
    win.isReverted = !win.isReverted
    saveWindows(dataKey, list)
    markTool(dataKey, windowId)
  }

  function removeWindow(dataKey: string, windowId: string) {
    if (!dataKey) return
    const list = windows.value.get(dataKey)
    if (!list) return
    const win = list.find(w => w.id === windowId)
    if (win) deleteToolPersistence(dataKey, win.id)
    const filtered = list.filter(w => w.id !== windowId)
    windows.value.set(dataKey, filtered)
    saveWindows(dataKey, filtered)
    deleteToolFromCloud(dataKey, windowId).catch(err =>
      console.error('[StudioSync] Tool cloud delete failed:', err)
    )
  }

  function setWindowDisplayState(dataKey: string, windowId: string, state: WindowDisplayState) {
    updateWindow(dataKey, windowId, { displayState: state })
  }

  function updateScratchpad(dataKey: string, content: string) {
    if (!dataKey) return
    scratchpads.value.set(dataKey, content)
    saveScratchpad(dataKey, content)
  }

  let nextZ = 100
  function getNextZIndex(): number {
    return ++nextZ
  }

  return {
    projects,
    currentProjectId,
    currentSubprojectId,
    currentDataKey,
    messages,
    windows,
    scratchpads,
    projectList,
    currentProject,
    currentMessages,
    currentWindows,
    activeWindows,
    currentScratchpad,
    openSubprojects,
    initSync,
    syncChatNow,
    createProject,
    deleteProject,
    renameProject,
    switchToProject,
    createSubProject,
    deleteSubProject,
    switchSubProject,
    renameSubProject,
    closeSubProject,
    reopenSubProject,
    reorderSubProjects,
    addMessage,
    clearMessages,
    truncateMessages,
    addWindow,
    updateWindow,
    revertWindowCode,
    removeWindow,
    setWindowDisplayState,
    updateScratchpad,
    getNextZIndex,
  }
})
