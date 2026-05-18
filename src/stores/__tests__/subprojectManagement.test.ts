import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/stores/project'

describe('Project Store - Subproject management', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  function setupProject(subCount = 3) {
    const store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    for (let i = 1; i < subCount; i++) {
      store.createSubProject(project.id)
    }
    return { store, project, projectId: project.id }
  }

  describe('closeSubProject', () => {
    it('adds subproject to closedSubprojectIds', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.closeSubProject(projectId, subs[1].id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.closedSubprojectIds).toContain(subs[1].id)
    })

    it('does not duplicate closed id', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.closeSubProject(projectId, subs[1].id)
      store.closeSubProject(projectId, subs[1].id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.closedSubprojectIds!.filter(id => id === subs[1].id)).toHaveLength(1)
    })

    it('switches to another open subproject when closing active', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects
      store.switchSubProject(projectId, subs[1].id)

      store.closeSubProject(projectId, subs[1].id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.activeSubprojectId).not.toBe(subs[1].id)
      expect(proj.closedSubprojectIds).toContain(subs[1].id)
    })

    it('switches to home when all subprojects are closed', () => {
      const { store, projectId } = setupProject(1)
      const sub = store.currentProject!.subprojects[0]

      store.closeSubProject(projectId, sub.id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.activeSubprojectId).toBe('')
    })
  })

  describe('reopenSubProject', () => {
    it('removes subproject from closedSubprojectIds', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.closeSubProject(projectId, subs[1].id)
      store.reopenSubProject(projectId, subs[1].id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.closedSubprojectIds).not.toContain(subs[1].id)
    })

    it('is no-op when subproject is not closed', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.reopenSubProject(projectId, subs[0].id)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.closedSubprojectIds).toBeUndefined()
    })
  })

  describe('openSubprojects computed', () => {
    it('returns all subprojects when none are closed', () => {
      const { store } = setupProject()

      expect(store.openSubprojects).toHaveLength(3)
    })

    it('excludes closed subprojects', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.closeSubProject(projectId, subs[1].id)

      expect(store.openSubprojects).toHaveLength(2)
      expect(store.openSubprojects.map(s => s.id)).not.toContain(subs[1].id)
    })

    it('returns empty when all closed', () => {
      const { store, projectId } = setupProject(1)
      const sub = store.currentProject!.subprojects[0]

      store.closeSubProject(projectId, sub.id)

      expect(store.openSubprojects).toHaveLength(0)
    })
  })

  describe('reorderSubProjects', () => {
    it('reorders subprojects by id array', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects
      const reversed = [...subs].reverse().map(s => s.id)

      store.reorderSubProjects(projectId, reversed)

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.subprojects.map(s => s.id)).toEqual(reversed)
    })

    it('ignores unknown ids', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.reorderSubProjects(projectId, [subs[2].id, 'unknown-id', subs[0].id, subs[1].id])

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.subprojects.map(s => s.id)).toEqual([subs[2].id, subs[0].id, subs[1].id])
    })

    it('preserves subproject data on reorder', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects
      const originalName = subs[0].name

      store.reorderSubProjects(projectId, [subs[2].id, subs[1].id, subs[0].id])

      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.subprojects[2].name).toBe(originalName)
    })
  })

  describe('close + reopen + delete integration', () => {
    it('can close, reopen, then close and delete', () => {
      const { store, projectId } = setupProject()
      const subs = store.currentProject!.subprojects

      store.closeSubProject(projectId, subs[1].id)
      expect(store.openSubprojects).toHaveLength(2)

      store.reopenSubProject(projectId, subs[1].id)
      expect(store.openSubprojects).toHaveLength(3)

      store.deleteSubProject(projectId, subs[1].id)
      const proj = store.projects.find(p => p.id === projectId)!
      expect(proj.subprojects).toHaveLength(2)
    })

    it('closed subproject data persists until deletion', () => {
      const { store, projectId } = setupProject(2)
      const subs = store.currentProject!.subprojects
      const key = `${projectId}-${subs[1].id}`

      store.closeSubProject(projectId, subs[1].id)
      expect(store.messages.has(key)).toBe(true)

      store.deleteSubProject(projectId, subs[1].id)
      expect(store.messages.has(key)).toBe(false)
    })
  })
})
