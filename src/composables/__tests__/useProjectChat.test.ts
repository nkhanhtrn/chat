import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { useProjectChat } from '../useProjectChat'
import { openCodeProvider } from '@/services/llm/providers/opencode'
import type { ProjectMessage, ProjectWindow } from '@/types/project'

function makeMessage(overrides: Partial<ProjectMessage> = {}): ProjectMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function makeToolWindow(overrides: Partial<ProjectWindow> = {}): ProjectWindow {
  return {
    id: `win-${Math.random().toString(36).slice(2)}`,
    title: 'Counter Tool',
    type: 'tool',
    code: '<template><button>0</button></template>',
    displayState: 'open',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 300 },
    zIndex: 1,
    sessionId: 'dk',
    ...overrides,
  }
}

async function* mockStream(chunks: string[]) {
  for (const chunk of chunks) yield chunk
}

describe('useProjectChat - compactChat', () => {
  let store: ReturnType<typeof useProjectStore>
  let chat: ReturnType<typeof useProjectChat>
  let dataKey: string

  beforeEach(() => {
    vi.mocked(openCodeProvider.sendStream).mockClear()
    vi.mocked(openCodeProvider.deleteSession).mockClear()
    vi.mocked(openCodeProvider.createSession).mockClear()
    vi.mocked(openCodeProvider.send).mockClear().mockResolvedValue('ok')
    setActivePinia(createPinia())
    localStorage.clear()
    store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    dataKey = store.currentDataKey!
    chat = useProjectChat()
  })

  it('sends /compact command to the session', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')

    await chat.compactChat()

    expect(openCodeProvider.send).toHaveBeenCalledWith('ses_123', '/compact')
  })

  it('clears messages after compacting', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')
    store.addMessage(dataKey, makeMessage({ content: 'User msg' }))
    store.addMessage(dataKey, makeMessage({ role: 'assistant', content: 'AI reply' }))

    await chat.compactChat()

    expect(store.currentMessages).toEqual([])
  })

  it('keeps tools/windows after compacting', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')
    store.addWindow(dataKey, makeToolWindow())
    store.addMessage(dataKey, makeMessage())

    await chat.compactChat()

    expect(store.currentWindows).toHaveLength(1)
    expect(store.currentWindows[0].type).toBe('tool')
  })

  it('does not delete the session', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')

    await chat.compactChat()

    expect(openCodeProvider.deleteSession).not.toHaveBeenCalled()
  })

  it('preserves the session ID in localStorage', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')

    await chat.compactChat()

    expect(localStorage.getItem(`project-session-${dataKey}`)).toBe('ses_123')
  })

  it('does nothing when there is no session', async () => {
    store.addMessage(dataKey, makeMessage())

    await chat.compactChat()

    expect(openCodeProvider.send).not.toHaveBeenCalled()
    expect(store.currentMessages).toHaveLength(1)
  })

  it('loads session from localStorage if not in memory', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_loaded')

    await chat.compactChat()

    expect(openCodeProvider.send).toHaveBeenCalledWith('ses_loaded', '/compact')
  })

  it('handles send errors gracefully and still clears messages', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')
    vi.mocked(openCodeProvider.send).mockRejectedValue(new Error('Send failed'))
    store.addMessage(dataKey, makeMessage())

    await chat.compactChat()

    expect(store.currentMessages).toEqual([])
  })

  it('does not set isStreaming', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')

    await chat.compactChat()

    expect(chat.isStreaming.value).toBe(false)
  })
})

describe('useProjectChat - clearChat', () => {
  let store: ReturnType<typeof useProjectStore>
  let chat: ReturnType<typeof useProjectChat>
  let dataKey: string

  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    dataKey = store.currentDataKey!
    chat = useProjectChat()
  })

  it('removes session from localStorage when sessionId was set', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')
    vi.mocked(openCodeProvider.sendStream).mockReturnValue(mockStream(['ok']))
    vi.mocked(openCodeProvider.createSession).mockResolvedValue('ses_new')

    await chat.sendMessage('hi')
    expect(localStorage.getItem(`project-session-${dataKey}`)).not.toBeNull()

    await chat.clearChat()
    expect(localStorage.getItem(`project-session-${dataKey}`)).toBeNull()
  })

  it('removes session from localStorage', async () => {
    localStorage.setItem(`project-session-${dataKey}`, 'ses_123')
    vi.spyOn(openCodeProvider, 'deleteSession').mockResolvedValue(undefined)

    await chat.clearChat()

    expect(localStorage.getItem(`project-session-${dataKey}`)).toBeNull()
  })

  it('clears messages', async () => {
    store.addMessage(dataKey, makeMessage())
    vi.spyOn(openCodeProvider, 'deleteSession').mockResolvedValue(undefined)

    await chat.clearChat()

    expect(store.currentMessages).toEqual([])
  })

  it('keeps tools/windows', async () => {
    store.addWindow(dataKey, makeToolWindow())
    vi.spyOn(openCodeProvider, 'deleteSession').mockResolvedValue(undefined)

    await chat.clearChat()

    expect(store.currentWindows).toHaveLength(1)
  })
})

describe('useProjectChat - handleToolDetection with @edit', () => {
  let store: ReturnType<typeof useProjectStore>
  let chat: ReturnType<typeof useProjectChat>
  let dataKey: string

  const TOOL_CODE = `<template><div class="tool-container">
  <div class="header"><h3>Counter</h3></div>
  <div class="content"><button class="btn primary" @click="increment">Count: {{ count }}</button></div>
</div></template>
<script>
export default { data() { return { count: 0 } }, methods: { increment() { this.count++ } } }
</script>`

  const EDIT_RESPONSE = `<!-- @tool: Counter -->
<!-- @edit -->
<search>
count: 0
</search>
<replace>
count: 10
</replace>`

  const FULL_UPDATE_RESPONSE = `<!-- @tool: Counter -->
<template><div class="tool-container">
  <div class="header"><h3>Counter</h3></div>
  <div class="content"><button class="btn primary" @click="increment">Count: {{ count }}</button></div>
</div></template>
<script>
export default { data() { return { count: 99 } }, methods: { increment() { this.count++ } } }
</script>`

  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    dataKey = store.currentDataKey!
    chat = useProjectChat()
  })

  it('applies @edit patch to existing tool', async () => {
    store.addWindow(dataKey, makeToolWindow({ title: 'Counter', code: TOOL_CODE }))
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([EDIT_RESPONSE]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_edit')

    await chat.sendMessage('change count to 10')

    const win = store.currentWindows.find(w => w.title === 'Counter')
    expect(win).toBeDefined()
    expect(win!.code).toContain('count: 10')
    expect(win!.code).not.toContain('count: 0')
  })

  it('updates assistant message to say Edited', async () => {
    store.addWindow(dataKey, makeToolWindow({ title: 'Counter', code: TOOL_CODE }))
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([EDIT_RESPONSE]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_edit')

    await chat.sendMessage('change count')

    const msgs = store.currentMessages
    const last = msgs[msgs.length - 1]
    expect(last.content).toContain('Edited')
    expect(last.content).toContain('Counter')
  })

  it('falls back to full code replacement when no @edit marker', async () => {
    store.addWindow(dataKey, makeToolWindow({ title: 'Counter', code: TOOL_CODE }))
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([FULL_UPDATE_RESPONSE]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_full')

    await chat.sendMessage('rewrite the counter')

    const win = store.currentWindows.find(w => w.title === 'Counter')
    expect(win).toBeDefined()
    expect(win!.code).toContain('count: 99')
  })

  it('creates new tool when @edit targets non-existent tool', async () => {
    const NEW_TOOL_EDIT = `<!-- @tool: NewThing -->
<!-- @edit -->
<search>
old code
</search>
<replace>
new code
</replace>`
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([NEW_TOOL_EDIT]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_new')

    await chat.sendMessage('make something')

    expect(store.currentWindows).toHaveLength(0)
  })

  it('full code creates new tool when no existing match', async () => {
    const NEW_TOOL = `<!-- @tool: BrandNew -->
<template><div>new tool</div></template>
<script>export default {}</script>`
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([NEW_TOOL]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_new')

    await chat.sendMessage('build a new tool')

    expect(store.currentWindows).toHaveLength(1)
    expect(store.currentWindows[0].title).toContain('BrandNew')
  })
})

describe('useProjectChat - @data marker handling', () => {
  let store: ReturnType<typeof useProjectStore>
  let chat: ReturnType<typeof useProjectChat>
  let dataKey: string

  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    store = useProjectStore()
    const project = store.createProject('Test')
    store.switchToProject(project.id)
    dataKey = store.currentDataKey!
    chat = useProjectChat()
  })

  it('writes data to tool when AI returns @data marker', async () => {
    const win = makeToolWindow({ id: 'win-1', title: 'Counter', sessionId: dataKey })
    store.addWindow(dataKey, win)
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([
      `I'll set the count.\n\n<!-- @data: Counter -->\n\`\`\`json\n{"count": 100}\n\`\`\`\n\nDone!`
    ]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('set count to 100')

    const stored = JSON.parse(localStorage.getItem(`tool-state-${dataKey}-win-1`)!)
    expect(stored.count).toBe(100)
  })

  it('updates assistant message when only @data markers are present', async () => {
    const win = makeToolWindow({ id: 'win-1', title: 'Counter', sessionId: dataKey })
    store.addWindow(dataKey, win)
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([
      `<!-- @data: Counter -->\n\`\`\`json\n{"count": 50}\n\`\`\`\n`
    ]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('set count to 50')

    const msgs = store.currentMessages
    const last = msgs[msgs.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).not.toContain('@data')
  })

  it('does not override assistant message when @tool code is also present', async () => {
    const win = makeToolWindow({ id: 'win-1', title: 'Counter', sessionId: dataKey })
    store.addWindow(dataKey, win)
    const response = `<!-- @data: Counter -->\n\`\`\`json\n{"count": 5}\n\`\`\`\n\n<!-- @tool: Counter -->\n<template><div>updated</div></template>\n<script>export default {}</script>`
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([response]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('update counter')

    const msgs = store.currentMessages
    const last = msgs[msgs.length - 1]
    expect(last.content).toContain('Updated')
    expect(last.content).toContain('Counter')
  })

  it('writes data to multiple tools', async () => {
    const win1 = makeToolWindow({ id: 'win-1', title: 'Tool A', sessionId: dataKey })
    const win2 = makeToolWindow({ id: 'win-2', title: 'Tool B', sessionId: dataKey })
    store.addWindow(dataKey, win1)
    store.addWindow(dataKey, win2)
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([
      `<!-- @data: Tool A -->\n\`\`\`json\n{"val": 1}\n\`\`\`\n\n<!-- @data: Tool B -->\n\`\`\`json\n{"val": 2}\n\`\`\`\n`
    ]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('update both')

    const stored1 = JSON.parse(localStorage.getItem(`tool-state-${dataKey}-win-1`)!)
    const stored2 = JSON.parse(localStorage.getItem(`tool-state-${dataKey}-win-2`)!)
    expect(stored1.val).toBe(1)
    expect(stored2.val).toBe(2)
  })

  it('ignores @data marker for non-existent tool', async () => {
    vi.spyOn(openCodeProvider, 'sendStream').mockReturnValue(mockStream([
      `<!-- @data: Missing -->\n\`\`\`json\n{"x": 1}\n\`\`\`\n\nNo tool found.`
    ]))
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('update missing tool')

    expect(store.currentWindows).toHaveLength(0)
  })

  it('includes tool data context in prompt', async () => {
    const win = makeToolWindow({ id: 'win-1', title: 'Counter', sessionId: dataKey })
    store.addWindow(dataKey, win)
    localStorage.setItem(`tool-state-${dataKey}-win-1`, JSON.stringify({ count: 7 }))

    let capturedText = ''
    vi.spyOn(openCodeProvider, 'sendStream').mockImplementation(function*(sid: string, text: string) {
      capturedText = text
      return yield* mockStream(['Done']) as any
    } as any)
    vi.spyOn(openCodeProvider, 'createSession').mockResolvedValue('ses_data')

    await chat.sendMessage('what is the count?')

    expect(capturedText).toContain('count: 7')
    expect(capturedText).toContain('Counter')
  })
})
