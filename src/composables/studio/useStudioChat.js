import { ref, watch } from 'vue'
import { truncateUrl, truncateFileName } from '../../utils/format.js'
import StudioStorage from '../../services/StudioStorage.js'
import { analyzeGenerateAndExecute } from '../../services/llm/taskRouter.js'
import {
  buildRawAttachments,
  formatUploadedFilesForPrompt,
  formatFetchedContentForPrompt,
  buildAttachmentsForDisplay
} from './studioAttachments.js'

/**
 * Composable for managing chat messages and streaming in StudioChat.
 *
 * Pattern: Each component manages its own state by watching activeSessionId
 * - Loads chat state when session changes
 * - Saves to session-specific storage key
 * - No central state manager coordination needed
 */
export function useStudioChat(sessions) {
  // Messages state
  const messages = ref([])
  const isStreaming = ref(false)
  const isRouting = ref(false)
  const currentVerifyAttempt = ref(0)

  // Refs for DOM elements
  const messagesContainer = ref(null)

  // Abort controller for stopping requests
  let abortController = null

  // Message ID counter
  let nextMessageId = 1

  // Output event callbacks
  let onOutputCallback = null

  // ============================================================
  // Session-aware storage (delegates to StudioStorage)
  // ============================================================

  /**
   * Save messages to session-specific storage
   */
  function saveToStorage() {
    const sessionId = sessions.activeSessionId?.value
    if (!sessionId) return

    StudioStorage.saveChatState(sessionId, {
      messages: messages.value,
      nextMessageId
    })
  }

  /**
   * Load messages from session-specific storage
   */
  function loadFromStorage(sessionId) {
    if (!sessionId) {
      messages.value = []
      nextMessageId = 1
      return
    }

    const state = StudioStorage.loadChatState(sessionId)
    messages.value = state.messages || []
    nextMessageId = state.nextMessageId || 1
  }

  // ============================================================
  // Watch session changes and auto-load
  // ============================================================

  watch(() => sessions.activeSessionId?.value, (newId, oldId) => {
    // Save old session's data
    if (oldId) {
      StudioStorage.saveChatState(oldId, {
        messages: messages.value,
        nextMessageId
      })
    }

    // Load new session's data
    if (newId) {
      loadFromStorage(newId)
    } else {
      messages.value = []
      nextMessageId = 1
    }
  })

  // ============================================================
  // Output Events
  // ============================================================

  function onOutput(callback) {
    onOutputCallback = callback
  }

  function emitOutput(output) {
    if (onOutputCallback) {
      onOutputCallback(output)
    }
  }

  // ============================================================
  // UI Helpers
  // ============================================================

  function scrollToBottom() {
    // Use nextTick from the component's context
    import('vue').then(({ nextTick }) => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    })
  }

  function getLastMessage() {
    return messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  }

  function updateLastMessage(updates) {
    if (messages.value.length > 0) {
      Object.assign(messages.value[messages.value.length - 1], updates)
    }
  }

  // ============================================================
  // Message Operations
  // ============================================================

  function generateMessageId() {
    return `msg-${nextMessageId++}`
  }

  function prepareUserMessage(inputText, attachmentSnapshot) {
    const { uploadedFiles, detectedUrls, fetchedContents } = attachmentSnapshot
    const userMessage = inputText.trim()

    // Build the full message with fetched URL content and uploaded files
    const urlContent = formatFetchedContentForPrompt(fetchedContents)
    const fileContent = formatUploadedFilesForPrompt(uploadedFiles)

    let fullMessage = userMessage
    if (urlContent) fullMessage += `\n\n${urlContent}`
    if (fileContent) fullMessage += `\n\n${fileContent}`

    // Build attachments list for display
    const attachmentsForDisplay = buildAttachmentsForDisplay(
      uploadedFiles,
      detectedUrls,
      truncateFileName,
      truncateUrl
    )

    // Build raw attachments for taskRouter (2-model mode)
    const rawAttachments = buildRawAttachments(uploadedFiles, detectedUrls, fetchedContents)

    return {
      displayContent: userMessage,
      fullContent: fullMessage,
      attachmentsForDisplay,
      rawAttachments
    }
  }

  function addUserMessage(preparedMessage) {
    messages.value.push({
      role: 'user',
      content: preparedMessage.displayContent,
      fullContent: preparedMessage.fullContent,
      attachments: preparedMessage.attachmentsForDisplay,
      rawAttachments: preparedMessage.rawAttachments
    })
    saveToStorage()
    scrollToBottom()
  }

  function addEmptyAssistantMessage() {
    const msg = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      analysis: null,
      generatedCode: null,
      execution: null,
      visualization: null,
      tool: null,
      buildSteps: null,
      attempts: 0,
      webSearchResults: null,
      stdout: ''
    }
    messages.value.push(msg)
    return msg
  }

  // ============================================================
  // Send Message
  // ============================================================

  async function sendMessage(options) {
    const {
      inputText,
      attachmentSnapshot,
      useThinkingMode = false,
      searchCallbacks,
      planningCallbacks
    } = options

    // Prepare and add user message
    const preparedMessage = prepareUserMessage(inputText, attachmentSnapshot)
    addUserMessage(preparedMessage)

    // API messages for two-model mode (just the current user message)
    const apiMessages = [{ role: 'user', content: inputText.trim() }]

    // Add empty assistant message for streaming
    addEmptyAssistantMessage()
    isStreaming.value = true
    isRouting.value = true
    currentVerifyAttempt.value = 0
    abortController = new AbortController()

    try {
      const result = await analyzeGenerateAndExecute(
        apiMessages,
        (chunk) => {
          messages.value[messages.value.length - 1].content += chunk
          scrollToBottom()
        },
        abortController.signal,
        {
          useThinkingMode,
          attachments: preparedMessage.rawAttachments,
          onAttachmentsParsed: (parsed) => {
            console.log('Attachments parsed by taskRouter:', parsed.length)
          },
          onAnalysis: (analysis) => {
            updateLastMessage({ analysis })
            isRouting.value = false
            if (analysis.needsWebSearch && analysis.searchQuery) {
              searchCallbacks.onWebSearchStart(analysis.searchQuery)
            }
            scrollToBottom()
          },
          onWebSearchResult: (result, index) => {
            searchCallbacks.onWebSearchResult(result, index, getLastMessage)
          },
          onWebSearchComplete: (results) => {
            searchCallbacks.onWebSearchComplete(results, (filteredResults) => {
              updateLastMessage({ webSearchResults: filteredResults })
            })
          },
          onVerifyAttempt: (attempt, error) => {
            currentVerifyAttempt.value = attempt
            console.log(`Verify attempt ${attempt}: fixing error "${error}"`)
          },
          onCodeGenerated: (code) => {
            updateLastMessage({ generatedCode: code })
            scrollToBottom()
          },
          onExecutionComplete: (execution) => {
            updateLastMessage({ execution })
            if (execution.success) {
              const lastMsg = getLastMessage()
              emitOutput({
                messageId: lastMsg.id,
                type: 'codeResult',
                content: {
                  result: execution.result,
                  code: lastMsg.generatedCode || ''
                }
              })
            }
            scrollToBottom()
          },
          onVisualizationGenerated: (visualization) => {
            updateLastMessage({ visualization })
            const lastMsg = getLastMessage()
            emitOutput({
              messageId: lastMsg.id,
              type: visualization.type,
              content: visualization.content
            })
            scrollToBottom()
          },
          onToolGenerated: (tool) => {
            updateLastMessage({ tool })
            const lastMsg = getLastMessage()
            emitOutput({
              messageId: lastMsg.id,
              type: 'tool',
              content: tool
            })
            scrollToBottom()
          },
          onBuildStepStart: (stepInfo) => {
            const lastMsg = getLastMessage()
            const buildSteps = lastMsg.buildSteps || []
            buildSteps.push({
              step: stepInfo.step,
              task: stepInfo.task,
              status: 'running',
              output: null
            })
            updateLastMessage({ buildSteps: [...buildSteps] })
            scrollToBottom()
          },
          onBuildStepComplete: (stepInfo) => {
            const lastMsg = getLastMessage()
            const buildSteps = lastMsg.buildSteps || []
            const stepIndex = buildSteps.findIndex(s => s.step === stepInfo.step)
            if (stepIndex !== -1) {
              buildSteps[stepIndex] = {
                ...buildSteps[stepIndex],
                status: 'complete',
                output: stepInfo.output
              }
              updateLastMessage({ buildSteps: [...buildSteps] })
            }
            scrollToBottom()
          },
          sessionId: sessions.activeSessionId?.value || null,
          ...searchCallbacks,
          ...planningCallbacks
        }
      )

      // Set content from finalResponse if not already streamed
      if (result.finalResponse && !messages.value[messages.value.length - 1].content) {
        messages.value[messages.value.length - 1].content = result.finalResponse
      }

      // Store additional result data
      updateLastMessage({
        attempts: result.attempts,
        ...(result.webSearchResults?.length > 0 && { webSearchResults: result.webSearchResults }),
        ...(result.visualization && { visualization: result.visualization }),
        ...(result.tool && { tool: result.tool }),
        ...(result.planning && { planning: result.planning, planningComplete: true }),
        ...(result.usage && { usage: result.usage })
      })
    } catch (error) {
      if (error.name !== 'AbortError') {
        messages.value[messages.value.length - 1].content = `Error: ${error.message}`
      }
    } finally {
      isStreaming.value = false
      isRouting.value = false
      currentVerifyAttempt.value = 0
      abortController = null
      saveToStorage()
      scrollToBottom()
    }
  }

  // ============================================================
  // Actions
  // ============================================================

  function stopStreaming() {
    if (abortController) {
      abortController.abort()
    }
  }

  function deleteMessagePair(messageIndex) {
    const userMsg = messages.value[messageIndex]
    if (!userMsg || userMsg.role !== 'user') return

    const removeCount = messages.value[messageIndex + 1]?.role === 'assistant' ? 2 : 1
    messages.value.splice(messageIndex, removeCount)
    saveToStorage()
  }

  function clearChat() {
    messages.value = []
    nextMessageId = 1
    saveToStorage()
  }

  // ============================================================
  // Return API
  // ============================================================

  return {
    // State
    messages,
    isStreaming,
    isRouting,
    currentVerifyAttempt,
    messagesContainer,

    // Actions
    scrollToBottom,
    getLastMessage,
    updateLastMessage,
    sendMessage,
    deleteMessagePair,
    stopStreaming,
    clearChat,
    onOutput,
    saveToStorage
  }
}
