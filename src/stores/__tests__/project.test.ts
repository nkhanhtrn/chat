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
      expect(project.messageCount).toBe(0)
      expect(project.windowCount).toBe(0)
      expect(store.projects).toHaveLength(1)
    })

    it('creates a project with custom name', () => {
      const project = store.createProject('My App')

      expect(project.name).toBe('My App')
    })

    it('initializes empty messages and windows maps', () => {
      const project = store.createProject()

      expect(store.messages.has(project.id)).toBe(true)
      expect(store.messages.get(project.id)).toEqual([])
      expect(store.windows.has(project.id)).toBe(true)
      expect(store.windows.get(project.id)).toEqual([])
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
      store.addMessage(project.id, makeMessage())
      store.addWindow(project.id, makeWindow())

      store.deleteProject(project.id)

      expect(store.messages.has(project.id)).toBe(false)
      expect(store.windows.has(project.id)).toBe(false)
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

    it('does not change currentProjectId if deleting a different project', () => {
      const p1 = store.createProject('Keep')
      const p2 = store.createProject('Delete')
      store.switchToProject(p1.id)

      store.deleteProject(p2.id)

      expect(store.currentProjectId).toBe(p1.id)
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

    it('initializes messages and windows maps if not present', () => {
      const project = store.createProject()
      store.messages.delete(project.id)
      store.windows.delete(project.id)

      store.switchToProject(project.id)

      expect(store.messages.get(project.id)).toEqual([])
      expect(store.windows.get(project.id)).toEqual([])
    })
  })

  describe('projectList', () => {
    it('returns projects sorted by updatedAt descending', async () => {
      store.createProject('Old')
      await new Promise(r => setTimeout(r, 5))
      store.createProject('New')

      await vi.waitFor(() => {
        expect(store.projectList[0].name).toBe('New')
        expect(store.projectList[1].name).toBe('Old')
      })
    })

    it('returns empty array when no projects', () => {
      expect(store.projectList).toEqual([])
    })
  })

  describe('currentProject', () => {
    it('returns null when no project is selected', () => {
      expect(store.currentProject).toBeNull()
    })

    it('returns the selected project', () => {
      const project = store.createProject()
      store.switchToProject(project.id)

      expect(store.currentProject).toEqual(project)
    })
  })

  describe('currentMessages', () => {
    it('returns empty array when no project is selected', () => {
      expect(store.currentMessages).toEqual([])
    })

    it('returns messages for the current project', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addMessage(project.id, makeMessage({ content: 'Hello' }))

      expect(store.currentMessages).toHaveLength(1)
      expect(store.currentMessages[0].content).toBe('Hello')
    })
  })

  describe('currentWindows', () => {
    it('returns empty array when no project is selected', () => {
      expect(store.currentWindows).toEqual([])
    })

    it('returns windows for the current project', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(project.id, makeWindow({ title: 'Code' }))

      expect(store.currentWindows).toHaveLength(1)
      expect(store.currentWindows[0].title).toBe('Code')
    })
  })

  describe('activeWindows', () => {
    it('excludes closed windows', () => {
      const project = store.createProject()
      store.switchToProject(project.id)
      store.addWindow(project.id, makeWindow({ id: 'w1', displayState: 'open' }))
      store.addWindow(project.id, makeWindow({ id: 'w2', displayState: 'closed' }))
      store.addWindow(project.id, makeWindow({ id: 'w3', displayState: 'minimized' }))

      expect(store.activeWindows).toHaveLength(2)
      expect(store.activeWindows.map(w => w.id)).toEqual(['w1', 'w3'])
    })
  })

  describe('addMessage', () => {
    it('adds a message to the project', () => {
      const project = store.createProject()
      store.addMessage(project.id, makeMessage())

      expect(store.messages.get(project.id)).toHaveLength(1)
    })

    it('updates messageCount on the project', () => {
      const project = store.createProject()
      store.addMessage(project.id, makeMessage())
      store.addMessage(project.id, makeMessage({ id: 'msg-2' }))

      expect(project.messageCount).toBe(2)
    })

    it('updates updatedAt timestamp', () => {
      const project = store.createProject()
      const before = project.updatedAt

      store.addMessage(project.id, makeMessage())

      expect(project.updatedAt).toBeGreaterThanOrEqual(before)
    })

    it('does nothing for unknown project', () => {
      store.addMessage('nonexistent', makeMessage())
      expect(store.messages.get('nonexistent')).toBeUndefined()
    })
  })

  describe('clearMessages', () => {
    it('clears all messages for a project', () => {
      const project = store.createProject()
      store.addMessage(project.id, makeMessage())
      store.addMessage(project.id, makeMessage({ id: 'msg-2' }))

      store.clearMessages(project.id)

      expect(store.messages.get(project.id)).toEqual([])
      expect(project.messageCount).toBe(0)
    })

    it('updates updatedAt timestamp', () => {
      const project = store.createProject()
      store.addMessage(project.id, makeMessage())
      const before = project.updatedAt

      store.clearMessages(project.id)

      expect(project.updatedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe('addWindow', () => {
    it('adds a window to the project', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow())

      expect(store.windows.get(project.id)).toHaveLength(1)
    })

    it('updates windowCount on the project', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow())
      store.addWindow(project.id, makeWindow({ id: 'win-2' }))

      expect(project.windowCount).toBe(2)
    })

    it('updates updatedAt timestamp', () => {
      const project = store.createProject()
      const before = project.updatedAt

      store.addWindow(project.id, makeWindow())

      expect(project.updatedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe('updateWindow', () => {
    it('updates window fields', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1', title: 'Old' }))

      store.updateWindow(project.id, 'w1', { title: 'New' })

      const win = store.windows.get(project.id)!.find(w => w.id === 'w1')
      expect(win!.title).toBe('New')
    })

    it('preserves non-updated fields', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1', title: 'Keep', type: 'code' }))

      store.updateWindow(project.id, 'w1', { title: 'Changed' })

      const win = store.windows.get(project.id)!.find(w => w.id === 'w1')
      expect(win!.type).toBe('code')
      expect(win!.title).toBe('Changed')
    })

    it('does nothing for unknown window', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1' }))

      store.updateWindow(project.id, 'nonexistent', { title: 'Ghost' })

      expect(store.windows.get(project.id)).toHaveLength(1)
    })
  })

  describe('removeWindow', () => {
    it('removes the window', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1' }))
      store.addWindow(project.id, makeWindow({ id: 'w2' }))

      store.removeWindow(project.id, 'w1')

      const wins = store.windows.get(project.id)!
      expect(wins).toHaveLength(1)
      expect(wins[0].id).toBe('w2')
    })

    it('updates windowCount', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow())
      store.addWindow(project.id, makeWindow({ id: 'win-2' }))

      store.removeWindow(project.id, 'win-1')

      expect(project.windowCount).toBe(1)
    })
  })

  describe('setWindowDisplayState', () => {
    it('sets the display state on a window', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1', displayState: 'open' }))

      store.setWindowDisplayState(project.id, 'w1', 'minimized')

      const win = store.windows.get(project.id)!.find(w => w.id === 'w1')
      expect(win!.displayState).toBe('minimized')
    })

    it('cycles through open → minimized → closed → open', () => {
      const project = store.createProject()
      store.addWindow(project.id, makeWindow({ id: 'w1', displayState: 'open' }))

      store.setWindowDisplayState(project.id, 'w1', 'minimized')
      expect(store.windows.get(project.id)![0].displayState).toBe('minimized')

      store.setWindowDisplayState(project.id, 'w1', 'closed')
      expect(store.windows.get(project.id)![0].displayState).toBe('closed')

      store.setWindowDisplayState(project.id, 'w1', 'open')
      expect(store.windows.get(project.id)![0].displayState).toBe('open')
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

      const freshStore = useProjectStore()
      expect(freshStore.projects).toEqual([])
    })
  })
})
