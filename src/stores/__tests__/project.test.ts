import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/stores/project'
import type { ProjectMessage, ProjectWindow } from '@/types/project'

function makeWindow(overrides: Partial<ProjectWindow> = {}): ProjectWindow {
  return {
    id: 'win-1',
    title: 'Test Window',
    type: 'code',
    content: 'console.log("hello")',
    displayState: 'open',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 300 },
    zIndex: 1,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<ProjectMessage> = {}): ProjectMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function dataKey(store: ReturnType<typeof useProjectStore>, projectId: string): string {
  const project = store.projects.find(p => p.id === projectId)
  return `${projectId}-${project!.activeSubprojectId}`
}

describe('useProjectStore', () => {
  let store: ReturnType<typeof useProjectStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useProjectStore()
    localStorage.clear()
  })

  describe('createProject', () => {
    it('creates a project with default name', () => {
      const project = store.createProject()

      expect(project.name).toBe('Project 1')
      expect(store.projects).toHaveLength(1)
    })

    it('creates a project with custom name', () => {
      const project = store.createProject('My App')

      expect(project.name).toBe('My App')
    })

    it('creates a default Main subproject', () => {
      const project = store.createProject()

      expect(project.subprojects).toHaveLength(1)
      expect(project.subprojects[0].name).toBe('Main')
      expect(project.activeSubprojectId).toBe(project.subprojects[0].id)
    })

    it('initializes empty messages and windows for default subproject', () => {
      const project = store.createProject()
      const key = dataKey(store, project.id)

      expect(store.messages.has(key)).toBe(true)
      expect(store.messages.get(key)).toEqual([])
      expect(store.windows.has(key)).toBe(true)
      expect(store.windows.get(key)).toEqual([])
    })

    it('increments default name for subsequent projects', () => {
      store.createProject()
      const second = store.createProject()

      expect(second.name).toBe('Project 2')
    })

    it('persists to localStorage', async () => {
      store.createProject('Persisted')

      await vi.waitFor(() => {
        const raw = localStorage.getItem('projects-data')
        expect(raw).not.toBeNull()
        const parsed = JSON.parse(raw!)
        expect(parsed[0].name).toBe('Persisted')
      })
    })
  })

  describe('deleteProject', () => {
    it('removes the project from the list', () => {
      const project = store.createProject()
      store.deleteProject(project.id)

      expect(store.projects).toHaveLength(0)
    })

    it('removes associated messages and windows', () => {
      const project = store.createProject()
      const key = dataKey(store, project.id)
      store.addMessage(key, makeMessage())
      store.addWindow(key, makeWindow())

      store.deleteProject(project.id)

      expect(store.messages.has(key)).toBe(false)
      expect(store.windows.has(key)).toBe(false)
    })

    it('removes session from localStorage', () => {
      const project = store.createProject()
      const key = dataKey(store, project.id)
      localStorage.setItem(`project-session-${key}`, 'ses_123')

      store.deleteProject(project.id)

      expect(localStorage.getItem(`project-session-${key}`)).toBeNull()
    })

    it('switches currentProjectId to another project if deleting current', () => {
      const p1 = store.createProject('First')
      const p2 = store.createProject('Second')
      store.switchToProject(p1.id)

      store.deleteProject(p1.id)

      expect(store.currentProjectId).toBe(p2.id)
    })

    it('sets currentProjectId to null if no projects remain', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      store.deleteProject(project.id)

      expect(store.currentProjectId).toBeNull()
    })
  })

  describe('renameProject', () => {
    it('renames the project', () => {
      const project = store.createProject('Old Name')
      store.renameProject(project.id, 'New Name')

      expect(project.name).toBe('New Name')
    })

    it('updates the updatedAt timestamp', () => {
      const project = store.createProject('Test')
      const originalUpdatedAt = project.updatedAt

      store.renameProject(project.id, 'Renamed')

      expect(project.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('does nothing for non-existent project', () => {
      store.createProject('Exists')
      store.renameProject('nonexistent', 'Ghost')

      expect(store.projects[0].name).toBe('Exists')
    })
  })

  describe('switchToProject', () => {
    it('sets the currentProjectId', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      expect(store.currentProjectId).toBe(project.id)
    })

    it('sets currentSubprojectId', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      expect(store.currentSubprojectId).toBe(project.activeSubprojectId)
    })

    it('sets currentDataKey', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      expect(store.currentDataKey).toBe(`${project.id}-${project.activeSubprojectId}`)
    })

    it('initializes messages and windows for subproject if not present', () => {
      const project = store.createProject()
      const key = dataKey(store, project.id)
      store.messages.delete(key)
      store.windows.delete(key)

      store.switchToProject(project.id)

      expect(store.messages.get(key)).toEqual([])
      expect(store.windows.get(key)).toEqual([])
    })
  })

  describe('subprojects', () => {
    it('createSubProject adds a new subproject and switches to it', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      const mainSubId = project.activeSubprojectId

      const newSub = store.createSubProject(project.id, 'Subproject 2')

      expect(newSub).not.toBeNull()
      expect(newSub!.name).toBe('Subproject 2')
      expect(project.subprojects).toHaveLength(2)
      expect(project.activeSubprojectId).toBe(newSub!.id)
      expect(store.currentSubprojectId).toBe(newSub!.id)
    })

    it('createSubProject auto-names if no name given', () => {
      const project = store.createProject()

      const newSub = store.createSubProject(project.id)

      expect(newSub!.name).toBe('Subproject 2')
    })

    it('createSubProject initializes empty messages/windows for new sub', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      const newSub = store.createSubProject(project.id)
      const key = `${project.id}-${newSub!.id}`

      expect(store.messages.has(key)).toBe(true)
      expect(store.windows.has(key)).toBe(true)
    })

    it('deleteSubProject removes sub and switches to another', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      const mainSubId = project.subprojects[0].id
      const newSub = store.createSubProject(project.id, 'Subproject 2')

      store.deleteSubProject(project.id, newSub!.id)

      expect(project.subprojects).toHaveLength(1)
      expect(project.activeSubprojectId).toBe(mainSubId)
    })

    it('deleteSubProject can delete the last subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      store.deleteSubProject(project.id, project.subprojects[0].id)

      expect(project.subprojects).toHaveLength(0)
    })

    it('deleteSubProject cleans up localStorage', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      const newSub = store.createSubProject(project.id, 'Subproject 2')
      const key = `${project.id}-${newSub!.id}`
      localStorage.setItem(`project-messages-${key}`, '[]')
      localStorage.setItem(`project-windows-${key}`, '[]')

      store.deleteSubProject(project.id, newSub!.id)

      expect(localStorage.getItem(`project-messages-${key}`)).toBeNull()
      expect(localStorage.getItem(`project-windows-${key}`)).toBeNull()
    })

    it('switchSubProject changes activeSubprojectId', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      const newSub = store.createSubProject(project.id, 'Subproject 2')
      const mainSubId = project.subprojects[0].id

      store.switchSubProject(project.id, mainSubId)

      expect(project.activeSubprojectId).toBe(mainSubId)
      expect(store.currentSubprojectId).toBe(mainSubId)
    })

    it('switchSubProject does nothing if already on that sub', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      const mainSubId = project.activeSubprojectId
      const before = project.updatedAt

      store.switchSubProject(project.id, mainSubId)

      expect(project.activeSubprojectId).toBe(mainSubId)
    })

    it('renameSubProject renames a sub', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      store.renameSubProject(project.id, project.subprojects[0].id, 'Renamed')

      expect(project.subprojects[0].name).toBe('Renamed')
    })
  })

  describe('currentMessages', () => {
    it('returns empty array when no project is selected', () => {
      expect(store.currentMessages).toEqual([])
    })

    it('returns messages for the current subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addMessage(store.currentDataKey!, makeMessage({ content: 'Hello' }))

      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0].content).toBe('Hello')
    })

    it('returns different messages per subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addMessage(store.currentDataKey!, makeMessage({ content: 'Main msg' }))

      const newSub = store.createSubProject(project.id, 'Subproject 2')
      store.addMessage(store.currentDataKey!, makeMessage({ content: 'Subproject 2 msg' }))

      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0].content).toBe('Subproject 2 msg')
    })
  })

  describe('currentWindows', () => {
    it('returns empty array when no project is selected', () => {
      expect(store.currentWindows).toEqual([])
    })

    it('returns windows for the current subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ title: 'Code' }))

      expect(store.currentWindows).toHaveLength(1)
      expect(store.currentWindows[0].title).toBe('Code')
    })
  })

  describe('activeWindows', () => {
    it('excludes closed windows but includes minimized', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1', displayState: 'open' }))
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w2', displayState: 'closed' }))
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w3', displayState: 'minimized' }))

      expect(store.activeWindows).toHaveLength(2)
      expect(store.activeWindows.map(w => w.id)).toEqual(['w1', 'w3'])
    })
  })

  describe('addMessage', () => {
    it('adds a message to the active subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addMessage(store.currentDataKey!, makeMessage())

      const key = dataKey(store, project.id)
      expect(store.messages.get(key)).toHaveLength(1)
    })

    it('does nothing for unknown project', () => {
      store.addMessage('nonexistent', makeMessage())
      expect(store.messages.get('nonexistent')).toBeUndefined()
    })
  })

  describe('clearMessages', () => {
    it('clears all messages for the active subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addMessage(store.currentDataKey!, makeMessage())
      store.addMessage(store.currentDataKey!, makeMessage({ id: 'msg-2' }))

      store.clearMessages(store.currentDataKey!)

      const key = dataKey(store, project.id)
      expect(store.messages.get(key)).toEqual([])
    })
  })

  describe('addWindow', () => {
    it('adds a window to the active subproject', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow())

      const key = dataKey(store, project.id)
      expect(store.windows.get(key)).toHaveLength(1)
    })
  })

  describe('updateWindow', () => {
    it('updates window fields', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1', title: 'Old' }))

      store.updateWindow(store.currentDataKey!, 'w1', { title: 'New' })

      const key = dataKey(store, project.id)
      const win = store.windows.get(key)!.find(w => w.id === 'w1')
      expect(win!.title).toBe('New')
    })

    it('preserves non-updated fields', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1', title: 'Keep', type: 'code' }))

      store.updateWindow(store.currentDataKey!, 'w1', { title: 'Changed' })

      const key = dataKey(store, project.id)
      const win = store.windows.get(key)!.find(w => w.id === 'w1')
      expect(win!.type).toBe('code')
      expect(win!.title).toBe('Changed')
    })
  })

  describe('removeWindow', () => {
    it('removes the window', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1' }))
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w2' }))

      store.removeWindow(store.currentDataKey!, 'w1')

      const key = dataKey(store, project.id)
      const wins = store.windows.get(key)!
      expect(wins).toHaveLength(1)
      expect(wins[0].id).toBe('w2')
    })
  })

  describe('setWindowDisplayState', () => {
    it('sets the display state on a window', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1', displayState: 'open' }))

      store.setWindowDisplayState(store.currentDataKey!, 'w1', 'minimized')

      const key = dataKey(store, project.id)
      const win = store.windows.get(key)!.find(w => w.id === 'w1')
      expect(win!.displayState).toBe('minimized')
    })

    it('cycles through open → minimized → closed → open', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(store.currentDataKey!, makeWindow({ id: 'w1', displayState: 'open' }))

      const key = dataKey(store, project.id)

      store.setWindowDisplayState(store.currentDataKey!, 'w1', 'minimized')
      expect(store.windows.get(key)![0].displayState).toBe('minimized')

      store.setWindowDisplayState(store.currentDataKey!, 'w1', 'closed')
      expect(store.windows.get(key)![0].displayState).toBe('closed')

      store.setWindowDisplayState(store.currentDataKey!, 'w1', 'open')
      expect(store.windows.get(key)![0].displayState).toBe('open')
    })
  })

  describe('getNextZIndex', () => {
    it('returns incrementing z-index values', () => {
      const z1 = store.getNextZIndex()
      const z2 = store.getNextZIndex()
      const z3 = store.getNextZIndex()

      expect(z2).toBeGreaterThan(z1)
      expect(z3).toBeGreaterThan(z2)
    })
  })

  describe('localStorage persistence', () => {
    it('saves projects to localStorage on change', async () => {
      store.createProject('Alpha')
      store.createProject('Beta')

      await vi.waitFor(() => {
        const raw = localStorage.getItem('projects-data')
        expect(raw).not.toBeNull()
        const saved = JSON.parse(raw!)
        expect(saved).toHaveLength(2)
        expect(saved.map((p: { name: string }) => p.name)).toEqual(['Alpha', 'Beta'])
      })
    })

    it('persists subprojects', async () => {
      const project = store.createProject('Test')
      store.switchToProject(project.id)
      store.createSubProject(project.id, 'Extra Subproject')

      await vi.waitFor(() => {
        const raw = localStorage.getItem('projects-data')
        const saved = JSON.parse(raw!)
        expect(saved[0].subprojects).toHaveLength(2)
        expect(saved[0].subprojects[1].name).toBe('Extra Subproject')
      })
    })

    it('loads projects from localStorage on init', async () => {
      store.createProject('Existing')
      await vi.waitFor(() => {
        expect(localStorage.getItem('projects-data')).not.toBeNull()
      })

      const freshPinia = createPinia()
      setActivePinia(freshPinia)
      const freshStore = useProjectStore()

      expect(freshStore.projects).toHaveLength(1)
      expect(freshStore.projects[0].name).toBe('Existing')
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('projects-data', '{invalid json}')

      const freshPinia = createPinia()
      setActivePinia(freshPinia)
      const freshStore = useProjectStore()

      expect(freshStore.projects).toEqual([])
    })
  })
})
