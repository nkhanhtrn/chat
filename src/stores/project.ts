import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Project, SubProject, ProjectMessage, ProjectWindow, WindowDisplayState } from '@/types/project'
import { deleteToolPersistence } from '@/services/builder/toolPersistence'

const STORAGE_KEY = 'projects-data'
const MESSAGES_KEY_PREFIX = 'project-messages-'
const WINDOWS_KEY_PREFIX = 'project-windows-'

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

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>(loadFromStorage())
  const currentProjectId = ref<string | null>(null)
  const messages = ref<Map<string, ProjectMessage[]>>(new Map())
  const windows = ref<Map<string, ProjectWindow[]>>(new Map())

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

  watch(projects, (val) => saveToStorage(val), { deep: true })

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
  }

  function renameProject(id: string, name: string) {
    const project = projects.value.find(p => p.id === id)
    if (project) {
      project.name = name
      project.updatedAt = Date.now()
    }
  }

  function switchToProject(id: string) {
    currentProjectId.value = id
    const project = projects.value.find(p => p.id === id)
    if (!project) return
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

    switchSubProject(projectId, sub.id)
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
    localStorage.removeItem(MESSAGES_KEY_PREFIX + key)
    localStorage.removeItem(WINDOWS_KEY_PREFIX + key)
    localStorage.removeItem(`project-session-${key}`)

    project.subprojects.splice(idx, 1)
    project.updatedAt = Date.now()

    if (project.activeSubprojectId === subprojectId) {
      if (project.subprojects.length > 0) {
        const newIdx = Math.min(idx, project.subprojects.length - 1)
        project.activeSubprojectId = project.subprojects[newIdx].id
        loadSubData(projectId, project.activeSubprojectId)
      }
    }
  }

  function switchSubProject(projectId: string, subprojectId: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    if (project.activeSubprojectId === subprojectId) return

    project.activeSubprojectId = subprojectId
    project.updatedAt = Date.now()
    loadSubData(projectId, subprojectId)
  }

  function renameSubProject(projectId: string, subprojectId: string, name: string) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    const sub = project.subprojects.find(s => s.id === subprojectId)
    if (sub) {
      sub.name = name
      project.updatedAt = Date.now()
    }
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
  }

  function updateWindow(dataKey: string, windowId: string, updates: Partial<ProjectWindow>) {
    if (!dataKey) return
    const list = windows.value.get(dataKey)
    if (!list) return
    const idx = list.findIndex(w => w.id === windowId)
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates }
      saveWindows(dataKey, list)
    }
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
  }

  function setWindowDisplayState(dataKey: string, windowId: string, state: WindowDisplayState) {
    updateWindow(dataKey, windowId, { displayState: state })
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
    projectList,
    currentProject,
    currentMessages,
    currentWindows,
    activeWindows,
    createProject,
    deleteProject,
    renameProject,
    switchToProject,
    createSubProject,
    deleteSubProject,
    switchSubProject,
    renameSubProject,
    addMessage,
    clearMessages,
    truncateMessages,
    addWindow,
    updateWindow,
    removeWindow,
    setWindowDisplayState,
    getNextZIndex,
  }
})
