import { ref, computed, watch } from 'vue'
import { openCodeProvider } from '@/services/llm/providers/opencode'
import { BUILDER_SYSTEM_PROMPT, buildToolContext } from '@/services/builder/systemPrompt'
import { parseToolFromResponse, parseToolEditFromResponse, applyToolEdits } from '@/services/builder/sfcParser'
import { searchWeb, fetchResultContent, formatSearchResultsForPrompt, extractSearchQuery, type SearchResult } from '@/services/builder/webSearch'
import { buildToolDataContext, parseToolDataFromResponse, writeToolData, findWindowByToolName, stripDataMarkers } from '@/services/builder/toolData'
import { useProjectStore } from '@/stores/project'
import type { ProjectMessage, ProjectWindow, WebSearchResult } from '@/types/project'

const MAX_SEARCH_ROUNDS = 3

export interface UseProjectChatReturn {
  isStreaming: ReturnType<typeof ref<boolean>>
  sendMessage: (content: string, targetTool?: ProjectWindow | null) => Promise<void>
  stopStreaming: () => void
  editAndResend: (index: number, newContent: string) => Promise<void>
  compactChat: () => Promise<void>
  clearChat: () => Promise<void>
}

export function useProjectChat(): UseProjectChatReturn {
  const projectStore = useProjectStore()
  const isStreaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const sessionId = ref<string | null>(null)
  const systemPromptSent = ref(false)

  const dataKey = computed(() => projectStore.currentDataKey ?? '')

  function sessionKey(): string {
    return `project-session-${dataKey.value}`
  }

  function loadSessionId(): string | null {
    return localStorage.getItem(sessionKey())
  }

  function saveSessionId(id: string | null): void {
    if (id) {
      localStorage.setItem(sessionKey(), id)
    } else {
      localStorage.removeItem(sessionKey())
    }
  }

  async function ensureSession(): Promise<string> {
    if (!sessionId.value) {
      const saved = loadSessionId()
      if (saved) sessionId.value = saved
    }

    if (sessionId.value) {
      try {
        const sid = await openCodeProvider.validateSession(sessionId.value)
        if (sid) return sid
      } catch { /* session gone */ }
      sessionId.value = null
      saveSessionId(null)
      systemPromptSent.value = false
    }

    const name = projectStore.currentProject?.name || 'Project'
    sessionId.value = await openCodeProvider.createSession(name)
    saveSessionId(sessionId.value)
    systemPromptSent.value = false
    return sessionId.value
  }

  function stripThinking(text: string): string {
    return text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
  }

  async function streamPrompt(sid: string, promptText: string, assistantMessageId: string, signal: AbortSignal): Promise<string> {
    let fullContent = ''
    let thinkingOpen = false
    for await (const chunk of openCodeProvider.sendStream(sid, promptText, signal)) {
      fullContent += chunk
      const openTag = /<think(?:ing)?>\s*$/i.test(fullContent)
      if (openTag) thinkingOpen = true
      const displayContent = thinkingOpen ? '' : stripThinking(fullContent)
      updateAssistantMessage(assistantMessageId, displayContent)
      if (thinkingOpen && /<\/think(?:ing)?>/i.test(fullContent)) {
        thinkingOpen = false
        updateAssistantMessage(assistantMessageId, stripThinking(fullContent))
      }
    }
    return stripThinking(fullContent)
  }

  async function sendMessage(content: string, targetTool?: ProjectWindow | null): Promise<void> {
    if (!content.trim() || isStreaming.value) return

    const userMessage: ProjectMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      targetToolName: targetTool?.title || undefined,
    }
    projectStore.addMessage(dataKey.value, userMessage)

    const assistantMessage: ProjectMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    projectStore.addMessage(dataKey.value, assistantMessage)

    isStreaming.value = true
    abortController.value = new AbortController()

    try {
      const sid = await ensureSession()

      let promptText: string
      if (!systemPromptSent.value) {
        const scratchpad = projectStore.currentScratchpad?.trim()
        const ctx = scratchpad ? `\n\nUSER CONTEXT (persisted notes, carry across sessions):\n${scratchpad}\n` : ''
        const dataCtx = buildToolDataContext(dataKey.value, projectStore.activeWindows)
        promptText = `[System]: ${BUILDER_SYSTEM_PROMPT}${ctx}${dataCtx}\n\n${content.trim()}`
        systemPromptSent.value = true
      } else {
        const parts: string[] = []
        const toolCtx = buildToolContext(projectStore.activeWindows)
        if (toolCtx) parts.push(toolCtx)
        const dataCtx = buildToolDataContext(dataKey.value, projectStore.activeWindows)
        if (dataCtx) parts.push(dataCtx)
        if (targetTool && targetTool.code) {
          parts.push(`TARGET TOOL: "${targetTool.title}" — current code:\n\n\`\`\`\n${targetTool.code}\n\`\`\`\n\nPrefer using @edit format for modifications (faster). Only output full code for major rewrites. Use marker: <!-- @tool: ${targetTool.title} -->`)
        }
        parts.push(content.trim())
        promptText = parts.join('\n\n')
      }

      let fullContent = await streamPrompt(sid, promptText, assistantMessage.id, abortController.value.signal)

      for (let round = 0; round < MAX_SEARCH_ROUNDS; round++) {
        const search = extractSearchQuery(fullContent)
        if (!search) break

        updateAssistantMessage(assistantMessage.id, `Searching: "${search.query}"...`)
        let results: SearchResult[]
        try {
          results = await searchWeb(search.query)
          results = await fetchResultContent(results)
        } catch (err: any) {
          updateAssistantMessage(assistantMessage.id, `Search failed: ${err.message}. Retrying without search results...`)
          const retryPrompt = `[Previous response requested a search for "${search.query}" but it failed: ${err.message}]\n\nPlease respond without web search results.`
          fullContent = await streamPrompt(sid, retryPrompt, assistantMessage.id, abortController.value.signal)
          break
        }

        const webResults: WebSearchResult[] = results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }))
        updateAssistantMessageWithSearch(assistantMessage.id, `Searched: "${search.query}"`, webResults)

        const searchPrompt = formatSearchResultsForPrompt(results) + '\n\nNow respond to the user\'s request using these search results.'
        fullContent = await streamPrompt(sid, searchPrompt, assistantMessage.id, abortController.value.signal)
      }

      handleDataMarkers(fullContent, assistantMessage.id)
      handleToolDetection(fullContent, assistantMessage.id)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateAssistantMessage(
          assistantMessage.id,
          `Error: ${err.message || 'Failed to get response'}`,
          true,
        )
      }
    } finally {
      isStreaming.value = false
      abortController.value = null
      if (dataKey.value) projectStore.syncChatNow(dataKey.value)
    }
  }

  function updateAssistantMessage(messageId: string, content: string, isError = false): void {
    const key = dataKey.value
    if (!key) return
    const msgs = projectStore.messages.get(key)
    if (!msgs) return
    const idx = msgs.findIndex(m => m.id === messageId)
    if (idx !== -1) {
      msgs[idx].content = content
      msgs[idx].isError = isError
      const storageKey = `project-messages-${key}`
      localStorage.setItem(storageKey, JSON.stringify(msgs))
    }
  }

  function updateAssistantMessageWithSearch(messageId: string, content: string, results: WebSearchResult[]): void {
    const key = dataKey.value
    if (!key) return
    const msgs = projectStore.messages.get(key)
    if (!msgs) return
    const idx = msgs.findIndex(m => m.id === messageId)
    if (idx !== -1) {
      msgs[idx].content = content
      msgs[idx].webSearchResults = results
      const storageKey = `project-messages-${key}`
      localStorage.setItem(storageKey, JSON.stringify(msgs))
    }
  }

  function findExistingTool(key: string, name: string): ProjectWindow | undefined {
    const windows = projectStore.windows.get(key) || []
    const normalized = name.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim()
    return windows.find(w => {
      if (w.type !== 'tool' || !w.title) return false
      const t = w.title.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, '').trim()
      return t === normalized || w.title === name || w.title.includes(name)
    })
  }

  function handleDataMarkers(responseContent: string, assistantMessageId: string): void {
    const key = dataKey.value
    if (!key) return

    const markers = parseToolDataFromResponse(responseContent)
    if (!markers.length) return

    const allWindows = projectStore.windows.get(key) || []
    const appliedNames: string[] = []

    for (const marker of markers) {
      const win = findWindowByToolName(allWindows, marker.toolName)
      if (!win || win.type !== 'tool') continue

      writeToolData(key, win.id, marker.data)
      appliedNames.push(marker.toolName)
    }

    if (appliedNames.length > 0 && !parseToolFromResponse(responseContent) && !parseToolEditFromResponse(responseContent)) {
      const cleanContent = stripDataMarkers(responseContent)
      const update = cleanContent || `Updated data in ${appliedNames.join(', ')}`
      updateAssistantMessage(assistantMessageId, update)
    }
  }

  function handleToolDetection(responseContent: string, assistantMessageId: string): void {
    const key = dataKey.value
    if (!key) return

    const edit = parseToolEditFromResponse(responseContent)
    if (edit) {
      const existing = findExistingTool(key, edit.name)
      if (existing && existing.code) {
        const patched = applyToolEdits(existing.code, edit)
        projectStore.updateWindow(key, existing.id, { code: patched })
        updateAssistantMessage(assistantMessageId, `Edited **${edit.name}** ${edit.emoji || ''}`)
        return
      }
    }

    const parsed = parseToolFromResponse(responseContent)
    if (!parsed) return

    const existingTool = findExistingTool(key, parsed.name)
    if (existingTool) {
      projectStore.updateWindow(key, existingTool.id, { code: parsed.code })
      updateAssistantMessage(assistantMessageId, `Updated **${parsed.name}** ${parsed.emoji || ''}`)
      return
    }

    const existingWindows = projectStore.windows.get(key) || []
    const baseX = 40 + (existingWindows.length % 5) * 40
    const baseY = 40 + (existingWindows.length % 5) * 40

    const toolWindow: ProjectWindow = {
      id: crypto.randomUUID(),
      sessionId: key,
      title: `${parsed.emoji ? parsed.emoji + ' ' : ''}${parsed.name}`,
      type: 'tool',
      displayState: 'open',
      position: { x: baseX, y: baseY },
      size: { width: 500, height: 450 },
      zIndex: projectStore.getNextZIndex(),
      code: parsed.code,
      toolInstanceId: crypto.randomUUID(),
    }
    projectStore.addWindow(key, toolWindow)

    updateAssistantMessage(assistantMessageId, `Built **${parsed.name}** ${parsed.emoji || ''}`)
  }

  function stopStreaming(): void {
    abortController.value?.abort()
    isStreaming.value = false
  }

  async function editAndResend(index: number, newContent: string): Promise<void> {
    if (isStreaming.value) return
    projectStore.truncateMessages(dataKey.value, index)
    await sendMessage(newContent)
  }

  async function compactChat(): Promise<void> {
    if (!sessionId.value) {
      const saved = loadSessionId()
      if (saved) sessionId.value = saved
    }
    if (!sessionId.value) return

    stopStreaming()
    try {
      await openCodeProvider.send(sessionId.value, '/compact')
    } catch { /* ignore */ }

    systemPromptSent.value = false
    projectStore.clearMessages(dataKey.value)
    if (dataKey.value) projectStore.syncChatNow(dataKey.value)
  }

  async function clearChat(): Promise<void> {
    stopStreaming()
    if (sessionId.value) {
      try { await openCodeProvider.deleteSession(sessionId.value) } catch { /* ignore */ }
    }
    sessionId.value = null
    saveSessionId(null)
    systemPromptSent.value = false
    projectStore.clearMessages(dataKey.value)
    projectStore.syncChatNow(dataKey.value)
  }

  watch(() => projectStore.currentDataKey, (newKey, oldKey) => {
    if (newKey !== oldKey) {
      stopStreaming()
      sessionId.value = null
      systemPromptSent.value = false
    }
  })

  return {
    isStreaming,
    sendMessage,
    stopStreaming,
    editAndResend,
    compactChat,
    clearChat,
  }
}
