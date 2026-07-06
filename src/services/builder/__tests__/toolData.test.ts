import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseToolDataFromResponse,
  buildToolDataContext,
  getToolState,
  writeToolData,
  findWindowByToolName,
  stripDataMarkers,
  type ToolDataMarker,
} from '../toolData'
import type { ProjectWindow } from '@/types/project'

function makeToolWindow(overrides: Partial<ProjectWindow> = {}): ProjectWindow {
  return {
    id: `win-${Math.random().toString(36).slice(2)}`,
    title: 'Counter',
    type: 'tool',
    code: '<template><button>{{ count }}</button></template>',
    displayState: 'open',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 300 },
    zIndex: 1,
    sessionId: 'dk-test',
    ...overrides,
  }
}

describe('parseToolDataFromResponse', () => {
  it('returns empty array when no @data markers', () => {
    expect(parseToolDataFromResponse('just some text')).toEqual([])
    expect(parseToolDataFromResponse('')).toEqual([])
  })

  it('parses a single @data marker with JSON in code fence', () => {
    const response = `I'll update the counter.\n\n<!-- @data: Counter -->\n\`\`\`json\n{"count": 42}\n\`\`\`\n\nDone!`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(1)
    expect(markers[0].toolName).toBe('Counter')
    expect(markers[0].data).toEqual({ count: 42 })
  })

  it('parses @data marker with raw JSON (no code fence)', () => {
    const response = `<!-- @data: Calculator 🧮 -->\n{"count": 100, "name": "test"}\n\nUpdated!`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(1)
    expect(markers[0].toolName).toBe('Calculator 🧮')
    expect(markers[0].data).toEqual({ count: 100, name: 'test' })
  })

  it('parses multiple @data markers', () => {
    const response = `<!-- @data: Tool A -->\n\`\`\`json\n{"a": 1}\n\`\`\`\n\n<!-- @data: Tool B -->\n\`\`\`json\n{"b": 2}\n\`\`\`\n`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(2)
    expect(markers[0].toolName).toBe('Tool A')
    expect(markers[0].data).toEqual({ a: 1 })
    expect(markers[1].toolName).toBe('Tool B')
    expect(markers[1].data).toEqual({ b: 2 })
  })

  it('skips markers with invalid JSON', () => {
    const response = `<!-- @data: Counter -->\nnot valid json\n`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(0)
  })

  it('skips markers with non-object JSON (arrays)', () => {
    const response = `<!-- @data: Counter -->\n\`\`\`json\n[1, 2, 3]\n\`\`\`\n`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(0)
  })

  it('skips markers with non-object JSON (primitives)', () => {
    const response = `<!-- @data: Counter -->\n\`\`\`json\n"hello"\n\`\`\`\n`
    const markers = parseToolDataFromResponse(response)
    expect(markers).toHaveLength(0)
  })
})

describe('getToolState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty object when no state stored', () => {
    const state = getToolState('dk', 'win-1')
    expect(state).toEqual({})
  })

  it('returns stored state', () => {
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ count: 5, name: 'test' }))
    const state = getToolState('dk', 'win-1')
    expect(state).toEqual({ count: 5, name: 'test' })
  })

  it('returns empty object for invalid JSON', () => {
    localStorage.setItem('tool-state-dk-win-1', 'not json')
    const state = getToolState('dk', 'win-1')
    expect(state).toEqual({})
  })
})

describe('buildToolDataContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty string when no windows', () => {
    expect(buildToolDataContext('dk', [])).toBe('')
  })

  it('returns empty string when tools have no state', () => {
    const windows = [makeToolWindow()]
    expect(buildToolDataContext('dk', windows)).toBe('')
  })

  it('includes tool state in context string', () => {
    const win = makeToolWindow({ id: 'win-1' })
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ count: 42, items: ['a'] }))
    const result = buildToolDataContext('dk', [win])
    expect(result).toContain('Counter')
    expect(result).toContain('count: 42')
    expect(result).toContain('items: ["a"]')
  })

  it('skips closed windows', () => {
    const win = makeToolWindow({ id: 'win-1', displayState: 'closed' })
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ count: 1 }))
    expect(buildToolDataContext('dk', [win])).toBe('')
  })

  it('skips non-tool windows', () => {
    const win = makeToolWindow({ id: 'win-1', type: 'code' })
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ count: 1 }))
    expect(buildToolDataContext('dk', [win])).toBe('')
  })

  it('includes multiple tools with state', () => {
    const win1 = makeToolWindow({ id: 'win-1', title: 'Tool A' })
    const win2 = makeToolWindow({ id: 'win-2', title: 'Tool B' })
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ a: 1 }))
    localStorage.setItem('tool-state-dk-win-2', JSON.stringify({ b: 2 }))
    const result = buildToolDataContext('dk', [win1, win2])
    expect(result).toContain('Tool A')
    expect(result).toContain('Tool B')
  })
})

describe('writeToolData', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('writes data to localStorage', () => {
    writeToolData('dk', 'win-1', { count: 99 })
    const stored = JSON.parse(localStorage.getItem('tool-state-dk-win-1')!)
    expect(stored.count).toBe(99)
  })

  it('merges with existing data', () => {
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ count: 1, name: 'old' }))
    writeToolData('dk', 'win-1', { count: 99 })
    const stored = JSON.parse(localStorage.getItem('tool-state-dk-win-1')!)
    expect(stored.count).toBe(99)
    expect(stored.name).toBe('old')
  })

  it('dispatches tool-data-updated event', () => {
    const handler = vi.fn()
    window.addEventListener('tool-data-updated', handler)
    writeToolData('dk', 'win-1', { count: 5 })
    window.removeEventListener('tool-data-updated', handler)
    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail
    expect(detail.dataKey).toBe('dk')
    expect(detail.windowId).toBe('win-1')
    expect(detail.data).toEqual({ count: 5 })
  })

  it('deep-merges nested objects across writes', () => {
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ config: { a: 1, b: 2 } }))
    writeToolData('dk', 'win-1', { config: { b: 99 } })
    const stored = JSON.parse(localStorage.getItem('tool-state-dk-win-1')!)
    expect(stored.config).toEqual({ a: 1, b: 99 })
  })

  it('dispatches the merged full state, not just the patch', () => {
    localStorage.setItem('tool-state-dk-win-1', JSON.stringify({ config: { a: 1, b: 2 }, other: 'x' }))
    const handler = vi.fn()
    window.addEventListener('tool-data-updated', handler)
    writeToolData('dk', 'win-1', { config: { b: 99 } })
    window.removeEventListener('tool-data-updated', handler)
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail
    expect(detail.data).toEqual({ config: { a: 1, b: 99 }, other: 'x' })
  })
})

describe('findWindowByToolName', () => {
  it('finds window by exact title', () => {
    const win = makeToolWindow({ title: 'Counter' })
    expect(findWindowByToolName([win], 'Counter')).toBe(win)
  })

  it('finds window by title with emoji', () => {
    const win = makeToolWindow({ title: '🧮 Calculator' })
    expect(findWindowByToolName([win], 'Calculator')).toBe(win)
  })

  it('finds window matching name with emoji stripped from search', () => {
    const win = makeToolWindow({ title: 'Calculator 🧮' })
    expect(findWindowByToolName([win], 'Calculator 🧮')).toBe(win)
  })

  it('finds window by partial name match', () => {
    const win = makeToolWindow({ title: 'Counter Tool' })
    expect(findWindowByToolName([win], 'Counter')).toBe(win)
  })

  it('returns undefined for no match', () => {
    const win = makeToolWindow({ title: 'Timer' })
    expect(findWindowByToolName([win], 'Counter')).toBeUndefined()
  })

  it('skips closed windows', () => {
    const win = makeToolWindow({ title: 'Counter', displayState: 'closed' })
    expect(findWindowByToolName([win], 'Counter')).toBeUndefined()
  })

  it('skips non-tool windows', () => {
    const win = makeToolWindow({ title: 'Counter', type: 'code' })
    expect(findWindowByToolName([win], 'Counter')).toBeUndefined()
  })
})

describe('stripDataMarkers', () => {
  it('returns unchanged text when no markers', () => {
    expect(stripDataMarkers('hello world')).toBe('hello world')
  })

  it('removes @data markers and their content', () => {
    const input = `Some text\n\n<!-- @data: Counter -->\n\`\`\`json\n{"count": 42}\n\`\`\`\n`
    const result = stripDataMarkers(input)
    expect(result).not.toContain('@data')
    expect(result).toContain('Some text')
    expect(result).not.toContain('Counter')
  })

  it('removes multiple @data markers', () => {
    const input = `<!-- @data: A -->\n\`\`\`json\n{"a":1}\n\`\`\`\n\n<!-- @data: B -->\n\`\`\`json\n{"b":2}\n\`\`\`\n`
    const result = stripDataMarkers(input)
    expect(result).not.toContain('@data')
    expect(result).not.toContain('"a":1')
    expect(result).not.toContain('"b":2')
  })
})
