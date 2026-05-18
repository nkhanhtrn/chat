import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/stores/project'

describe('Project Store - Tool Code Revert', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  function setupProject() {
    const store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    const dataKey = `${project.id}-${project.activeSubprojectId}`
    const windowId = 'win-1'
    store.windows.set(dataKey, [{
      id: windowId,
      sessionId: dataKey,
      title: 'Tool',
      type: 'tool',
      displayState: 'open',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      zIndex: 1,
      code: 'version-1',
    }])
    return { store, dataKey, windowId }
  }

  it('saves previousCode when code is updated', () => {
    const { store, dataKey, windowId } = setupProject()

    store.updateWindow(dataKey, windowId, { code: 'version-2' })

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-2')
    expect(win.previousCode).toBe('version-1')
    expect(win.isReverted).toBeFalsy()
  })

  it('does not set previousCode when code is unchanged', () => {
    const { store, dataKey, windowId } = setupProject()

    store.updateWindow(dataKey, windowId, { code: 'version-1' })

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.previousCode).toBeUndefined()
  })

  it('revert swaps code and previousCode', () => {
    const { store, dataKey, windowId } = setupProject()
    store.updateWindow(dataKey, windowId, { code: 'version-2' })

    store.revertWindowCode(dataKey, windowId)

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-1')
    expect(win.previousCode).toBe('version-2')
    expect(win.isReverted).toBe(true)
  })

  it('revert toggles back to current version', () => {
    const { store, dataKey, windowId } = setupProject()
    store.updateWindow(dataKey, windowId, { code: 'version-2' })

    store.revertWindowCode(dataKey, windowId)
    store.revertWindowCode(dataKey, windowId)

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-2')
    expect(win.previousCode).toBe('version-1')
    expect(win.isReverted).toBe(false)
  })

  it('revert is no-op when no previousCode exists', () => {
    const { store, dataKey, windowId } = setupProject()

    store.revertWindowCode(dataKey, windowId)

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-1')
    expect(win.previousCode).toBeUndefined()
  })

  it('previousCode persists to localStorage', () => {
    const { store, dataKey, windowId } = setupProject()
    store.updateWindow(dataKey, windowId, { code: 'version-2' })

    const saved = JSON.parse(localStorage.getItem(`project-windows-${dataKey}`)!)
    const win = saved.find((w: any) => w.id === windowId)
    expect(win.previousCode).toBe('version-1')
    expect(win.isReverted).toBeFalsy()
  })

  it('isReverted persists after revert', () => {
    const { store, dataKey, windowId } = setupProject()
    store.updateWindow(dataKey, windowId, { code: 'version-2' })
    store.revertWindowCode(dataKey, windowId)

    const saved = JSON.parse(localStorage.getItem(`project-windows-${dataKey}`)!)
    const win = saved.find((w: any) => w.id === windowId)
    expect(win.isReverted).toBe(true)
    expect(win.code).toBe('version-1')
    expect(win.previousCode).toBe('version-2')
  })

  it('chains multiple code updates keeping only one previous', () => {
    const { store, dataKey, windowId } = setupProject()

    store.updateWindow(dataKey, windowId, { code: 'version-2' })
    store.updateWindow(dataKey, windowId, { code: 'version-3' })

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-3')
    expect(win.previousCode).toBe('version-2')
  })

  it('revert after chained updates goes to last previousCode', () => {
    const { store, dataKey, windowId } = setupProject()

    store.updateWindow(dataKey, windowId, { code: 'version-2' })
    store.updateWindow(dataKey, windowId, { code: 'version-3' })
    store.revertWindowCode(dataKey, windowId)

    const win = store.windows.get(dataKey)!.find(w => w.id === windowId)!
    expect(win.code).toBe('version-2')
    expect(win.previousCode).toBe('version-3')
    expect(win.isReverted).toBe(true)
  })
})
