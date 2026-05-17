import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Project, ProjectMessage, ProjectWindow, WindowDisplayState } from '@/types/project'

const STORAGE_KEY = 'projects-data'

function generateId(): string {
  return crypto.randomUUID()
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

  const currentMessages = computed(() =>
    currentProjectId.value
      ? (messages.value.get(currentProjectId.value) ?? [])
      : []
  )

  const currentWindows = computed(() =>
    currentProjectId.value
      ? (windows.value.get(currentProjectId.value) ?? [])
      : []
  )

  const activeWindows = computed(() =>
    currentWindows.value.filter(w => w.displayState !== 'closed')
  )

  watch(projects, (val) => saveToStorage(val), { deep: true })

  function createProject(name?: string): Project {
    const project: Project = {
      id: generateId(),
      name: name ?? `Project ${projects.value.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      windowCount: 0,
    }
    projects.value.push(project)
    messages.value.set(project.id, [])
    windows.value.set(project.id, [])
    return project
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    messages.value.delete(id)
    windows.value.delete(id)
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
    if (!messages.value.has(id)) messages.value.set(id, [])
    if (!windows.value.has(id)) windows.value.set(id, [])
  }

  function addMessage(projectId: string, message: ProjectMessage) {
    const list = messages.value.get(projectId)
    if (list) {
      list.push(message)
      const project = projects.value.find(p => p.id === projectId)
      if (project) {
        project.messageCount = list.length
        project.updatedAt = Date.now()
      }
    }
  }

  function clearMessages(projectId: string) {
    messages.value.set(projectId, [])
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.messageCount = 0
      project.updatedAt = Date.now()
    }
  }

  function addWindow(projectId: string, window: ProjectWindow) {
    const list = windows.value.get(projectId)
    if (list) {
      list.push(window)
      const project = projects.value.find(p => p.id === projectId)
      if (project) {
        project.windowCount = list.length
        project.updatedAt = Date.now()
      }
    }
  }

  function updateWindow(projectId: string, windowId: string, updates: Partial<ProjectWindow>) {
    const list = windows.value.get(projectId)
    if (list) {
      const idx = list.findIndex(w => w.id === windowId)
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates }
      }
    }
  }

  function removeWindow(projectId: string, windowId: string) {
    const list = windows.value.get(projectId)
    if (list) {
      const filtered = list.filter(w => w.id !== windowId)
      windows.value.set(projectId, filtered)
      const project = projects.value.find(p => p.id === projectId)
      if (project) project.windowCount = filtered.length
    }
  }

  function setWindowDisplayState(projectId: string, windowId: string, state: WindowDisplayState) {
    updateWindow(projectId, windowId, { displayState: state })
  }

  let nextZ = 100
  function getNextZIndex(): number {
    return ++nextZ
  }

  return {
    projects,
    currentProjectId,
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
    addMessage,
    clearMessages,
    addWindow,
    updateWindow,
    removeWindow,
    setWindowDisplayState,
    getNextZIndex,
  }
})
