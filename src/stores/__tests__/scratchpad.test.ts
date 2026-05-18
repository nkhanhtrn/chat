import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/stores/project'

describe('Project Store - Scratchpad', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts with empty currentScratchpad', () => {
    const store = useProjectStore()
    store.createProject('Test')
    expect(store.currentScratchpad).toBe('')
  })

  it('updateScratchpad saves content', () => {
    const store = useProjectStore()
    const project = store.createProject('Test')
    const key = `${project.id}-${project.activeSubprojectId}`
    store.switchToProject(project.id)

    store.updateScratchpad(key, 'Remember to use dark theme')
    expect(store.currentScratchpad).toBe('Remember to use dark theme')
  })

  it('persists scratchpad to localStorage', () => {
    const store = useProjectStore()
    const project = store.createProject('Test')
    const key = `${project.id}-${project.activeSubprojectId}`

    store.updateScratchpad(key, 'Persist me')
    expect(localStorage.getItem(`project-scratchpad-${key}`)).toBe('Persist me')
  })

  it('loads scratchpad from localStorage on loadSubData', () => {
    localStorage.setItem('projects-data', JSON.stringify([{
      id: 'p1', name: 'P', createdAt: 1, updatedAt: 1,
      subprojects: [{ id: 's1', name: 'Main', createdAt: 1 }],
      activeSubprojectId: 's1',
    }]))
    localStorage.setItem('project-scratchpad-p1-s1', 'Saved notes')

    const store = useProjectStore()
    store.switchToProject('p1')
    expect(store.currentScratchpad).toBe('Saved notes')
  })

  it('scratchpad survives clearMessages', () => {
    const store = useProjectStore()
    const project = store.createProject('Test')
    const key = `${project.id}-${project.activeSubprojectId}`
    store.switchToProject(project.id)

    store.updateScratchpad(key, 'Important context')
    store.addMessage(key, { id: 'm1', role: 'user', content: 'hello', timestamp: Date.now() })
    store.clearMessages(key)

    expect(store.currentScratchpad).toBe('Important context')
    expect(store.currentMessages).toEqual([])
  })

  it('each subproject has independent scratchpad', () => {
    const store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    const firstSubId = project.activeSubprojectId
    const key1 = `${project.id}-${firstSubId}`
    store.updateScratchpad(key1, 'Notes A')

    const sub2 = store.createSubProject(project.id, 'Sub 2')
    const key2 = `${project.id}-${sub2!.id}`
    store.updateScratchpad(key2, 'Notes B')

    store.switchSubProject(project.id, firstSubId)
    expect(store.currentScratchpad).toBe('Notes A')

    store.switchSubProject(project.id, sub2!.id)
    expect(store.currentScratchpad).toBe('Notes B')
  })

  it('scratchpad is cleared when subproject is deleted', () => {
    const store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    const firstSubId = project.activeSubprojectId
    const key1 = `${project.id}-${firstSubId}`
    store.updateScratchpad(key1, 'Notes A')

    const sub2 = store.createSubProject(project.id, 'Sub 2')
    const key2 = `${project.id}-${sub2!.id}`
    store.updateScratchpad(key2, 'Notes B')

    store.deleteSubProject(project.id, sub2!.id)
    expect(localStorage.getItem(`project-scratchpad-${key2}`)).toBeNull()
    store.switchSubProject(project.id, firstSubId)
    expect(store.currentScratchpad).toBe('Notes A')
  })
})
