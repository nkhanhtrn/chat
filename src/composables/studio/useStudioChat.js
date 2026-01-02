import { ref, nextTick, watch } from 'vue'
import { sendChatMessage } from '../../services/llm/index.js'
import { analyzeGenerateAndExecute, getProvider } from '../../services/llm/taskRouter.js'
import { getProviderConfigById } from '../../services/llm/providers.js'
import BuildCapability from '../../services/llm/capabilities/BuildCapability.js'
import { VisualizationCapability } from '../../services/llm/capabilities/VisualizationCapability.js'
import { CodeCapability } from '../../services/llm/capabilities/CodeCapability.js'
import { truncateUrl, truncateFileName } from '../../utils/format.js'
import {
  buildRawAttachments,
  formatUploadedFilesForPrompt,
  formatFetchedContentForPrompt,
  buildAttachmentsForDisplay
} from './studioAttachments.js'

const STORAGE_KEY = 'studio-chat'
let sessionManager = null

/**
 * Composable for managing chat messages and streaming in StudioChat
 */
export function useStudioChat() {
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

  // Watch for changes and save to session
  watch(messages, () => {
    saveToStorage()
  }, { deep: true })

  /**
   * Set the session manager (called by parent component)
   */
  function setSessionManager(manager) {
    sessionManager = manager
  }

  /**
   * Load state from session data (for session switching)
   */
  function loadState(chatState) {
    if (chatState) {
      messages.value = chatState.messages || []
      nextMessageId = chatState.nextMessageId || 1
    } else {
      messages.value = []
      nextMessageId = 1
    }
  }

  /**
   * Get current state (for session switching)
   */
  function getState() {
    return {
      messages: messages.value,
      nextMessageId
    }
  }

  /**
   * Save messages to session (via session manager or localStorage)
   */
  function saveToStorage() {
    const state = {
      messages: messages.value,
      nextMessageId
    }

    // If session manager is available, use it
    if (sessionManager) {
      sessionManager.updateChatState(state)
      return
    }

    // Fall back to localStorage for backwards compatibility
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Failed to save chat messages:', e)
    }
  }

  /**
   * Load messages from storage (no longer used, kept for compatibility)
   */
  function loadFromStorage() {
    // State is now loaded via loadState() when sessions are initialized
    return false
  }

  /**
   * Generate unique message ID
   */
  function generateMessageId() {
    return `msg-${nextMessageId++}`
  }

  /**
   * Set callback for output events
   */
  function onOutput(callback) {
    onOutputCallback = callback
  }

  /**
   * Emit output event
   */
  function emitOutput(output) {
    if (onOutputCallback) {
      onOutputCallback(output)
    }
  }

  /**
   * Scroll messages container to bottom
   */
  function scrollToBottom() {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }

  /**
   * Get the last message in the messages array
   * @returns {Object|null} Last message or null
   */
  function getLastMessage() {
    return messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  }

  /**
   * Update the last assistant message with new properties
   * @param {Object} updates - Properties to update
   */
  function updateLastMessage(updates) {
    if (messages.value.length > 0) {
      Object.assign(messages.value[messages.value.length - 1], updates)
    }
  }

  /**
   * Prepare user message with attachments
   * @param {string} inputText - Raw user input
   * @param {Object} attachmentSnapshot - Snapshot from useAttachments
   * @returns {Object} Prepared message object
   */
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

  /**
   * Add user message to chat
   * @param {Object} preparedMessage - Prepared message from prepareUserMessage
   */
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

  /**
   * Add empty assistant message for streaming
   * @returns {Object} The created message object
   */
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

  /**
   * Handle single model chat
   * @param {string} modelId - Selected model ID
   * @param {Array} apiMessages - Messages for API
   */
  async function handleSingleModelChat(modelId, apiMessages) {
    await sendChatMessage(
      modelId,
      apiMessages,
      (chunk) => {
        messages.value[messages.value.length - 1].content += chunk
        scrollToBottom()
      },
      abortController.signal
    )
  }

  /**
   * Handle two-model chat with router and executor
   * @param {Object} options - Chat options
   */
  async function handleTwoModelChat(options) {
    const {
      apiMessages,
      routerId,
      routerProviderId,
      executorId,
      executorProviderId,
      rawAttachments,
      useThinkingMode,
      searchCallbacks,
      planningCallbacks
    } = options

    isRouting.value = true

    const result = await analyzeGenerateAndExecute(
      apiMessages,
      {
        routerId,
        routerProviderId,
        executorId,
        executorProviderId
      },
      (chunk) => {
        messages.value[messages.value.length - 1].content += chunk
        scrollToBottom()
      },
      abortController.signal,
      {
        useThinkingMode: useThinkingMode || false,
        attachments: rawAttachments,
        verifyMode: true,
        maxRetries: 3,
        onAttachmentsParsed: (parsed) => {
          console.log('Attachments parsed by taskRouter:', parsed.length)
        },
        onAnalysis: (analysis) => {
          updateLastMessage({ analysis })
          isRouting.value = false
          // Start searching if needed
          if (analysis.needsWebSearch && analysis.searchQuery) {
            searchCallbacks.onWebSearchStart(analysis.searchQuery)
          }
          scrollToBottom()
        },
        onWebSearchStart: searchCallbacks.onWebSearchStart,
        onWebSearchProgress: searchCallbacks.onWebSearchProgress,
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
          // Emit output event for successful execution
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
          // Emit output event
          const lastMsg = getLastMessage()
          emitOutput({
            messageId: lastMsg.id,
            type: visualization.type, // 'chart', 'mermaid', 'svg'
            content: visualization.content
          })
          scrollToBottom()
        },
        onToolGenerated: (tool) => {
          updateLastMessage({ tool })
          // Emit output event
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
        onPlanGenerated: planningCallbacks.onPlanGenerated,
        onStepStart: planningCallbacks.onStepStart,
        onStepComplete: planningCallbacks.onStepComplete,
        onPlanComplete: planningCallbacks.onPlanComplete,
        sessionId: sessionManager?.activeSessionId?.value || null
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

    return result
  }

  /**
   * Send a message (main entry point)
   * @param {Object} options - Send options
   */
  async function sendMessage(options) {
    const {
      inputText,
      attachmentSnapshot,
      twoModelMode,
      modelSelection,
      searchCallbacks,
      planningCallbacks
    } = options

    // Prepare and add user message
    const preparedMessage = prepareUserMessage(inputText, attachmentSnapshot)
    addUserMessage(preparedMessage)

    // Prepare API messages
    let apiMessages
    if (twoModelMode) {
      apiMessages = [{ role: 'user', content: inputText.trim() }]
    } else {
      apiMessages = messages.value
        .filter(m => m.role !== 'assistant' || m.content)
        .map(m => ({
          role: m.role,
          content: m.fullContent || m.content
        }))
    }

    // Add empty assistant message for streaming
    addEmptyAssistantMessage()
    isStreaming.value = true
    currentVerifyAttempt.value = 0
    abortController = new AbortController()

    try {
      if (twoModelMode) {
        await handleTwoModelChat({
          apiMessages,
          routerId: modelSelection.routerModel,
          routerProviderId: modelSelection.routerProviderId,
          executorId: modelSelection.executorModel,
          executorProviderId: modelSelection.executorProviderId,
          rawAttachments: preparedMessage.rawAttachments,
          useThinkingMode: modelSelection.useThinkingMode || false,
          searchCallbacks,
          planningCallbacks
        })
      } else {
        await handleSingleModelChat(modelSelection.selectedModel, apiMessages)
      }
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

  /**
   * Stop current streaming request
   */
  function stopStreaming() {
    if (abortController) {
      abortController.abort()
    }
  }

  /**
   * Delete a user message and its assistant response
   * @param {number} messageIndex - Index of the user message to delete
   */
  function deleteMessagePair(messageIndex) {
    const userMsg = messages.value[messageIndex]
    if (!userMsg || userMsg.role !== 'user') return

    const removeCount = messages.value[messageIndex + 1]?.role === 'assistant' ? 2 : 1
    messages.value.splice(messageIndex, removeCount)
    saveToStorage()
  }

  /**
   * Clear all messages
   */
  function clearChat() {
    messages.value = []
    nextMessageId = 1
    saveToStorage()
  }

  /**
   * Edit an existing window content using the appropriate capability
   * @param {Object} options - Edit options
   * @param {string} options.windowType - Type of window (tool, chart, mermaid, svg, codeResult)
   * @param {Object|string} options.currentContent - Current window content
   * @param {string} options.prompt - Edit request
   * @param {Object} options.modelSelection - Model selection config
   * @param {boolean} options.useThinkingMode - Whether to use Code API (thinking mode)
   * @param {Function} options.onComplete - Callback with updated content
   * @param {Function} options.onStdoutChunk - Callback for streaming stdout chunks (displayed in chat)
   */
  async function editWindow(options) {
    const { windowType, currentContent, prompt, modelSelection, useThinkingMode = false, onComplete, onStdoutChunk } = options
    console.log('[useStudioChat] editWindow - useThinkingMode:', useThinkingMode)

    const localAbortController = new AbortController()

    try {
      const providerId = modelSelection.executorProviderId || modelSelection.routerProviderId || 'lmstudio'
      const modelId = modelSelection.executorModel || modelSelection.selectedModel
      const provider = getProvider(providerId)
      const config = getProviderConfigById(providerId)

      let result

      switch (windowType) {
        case 'tool': {
          const buildCapability = new BuildCapability()
          const codeOrSpec = currentContent.type === 'vue-sfc' ? currentContent.code : currentContent

          // Accumulate stdout for this edit operation
          let accumulatedStdout = ''

          // Create a wrapper callback for streaming stdout
          const wrappedStdoutCallback = (chunk) => {
            accumulatedStdout += chunk
            if (onStdoutChunk) {
              onStdoutChunk(chunk)
            }
          }

          const toolResult = await buildCapability.editTool(
            codeOrSpec,
            prompt,
            modelId,
            provider,
            config,
            localAbortController.signal,
            useThinkingMode,
            wrappedStdoutCallback
          )

          // Include accumulated stdout in result
          result = {
            ...toolResult,
            stdout: toolResult.stdout || accumulatedStdout
          }
          break
        }

        case 'chart':
        case 'mermaid':
        case 'svg': {
          const vizCapability = new VisualizationCapability()
          const contentStr = typeof currentContent === 'string'
            ? currentContent
            : JSON.stringify(currentContent, null, 2)
          const vizResult = await vizCapability.editVisualization(
            contentStr,
            windowType,
            prompt,
            modelId,
            provider,
            config,
            localAbortController.signal
          )
          // For chart, parse back to JSON if it was originally an object
          if (windowType === 'chart' && typeof currentContent !== 'string') {
            try {
              result = JSON.parse(vizResult.content)
            } catch {
              result = vizResult.content
            }
          } else {
            result = vizResult.content
          }
          break
        }

        case 'codeResult': {
          const codeCapability = new CodeCapability()

          // Accumulate stdout for this edit operation
          let accumulatedStdout = ''

          // Create a wrapper callback that updates the last message's stdout field
          const wrappedStdoutCallback = (chunk) => {
            accumulatedStdout += chunk
            if (onStdoutChunk) {
              onStdoutChunk(chunk)
            }
            // Also update the last message's stdout field for persistence
            const lastMsg = getLastMessage()
            if (lastMsg) {
              lastMsg.stdout = (lastMsg.stdout || '') + chunk
            }
          }

          const codeResult = await codeCapability.editCode(
            currentContent.code || '',
            prompt,
            modelId,
            provider,
            config,
            localAbortController.signal,
            useThinkingMode,
            wrappedStdoutCallback
          )
          result = {
            code: codeResult.code,
            result: codeResult.result,
            stdout: accumulatedStdout
          }
          break
        }

        default:
          throw new Error(`Unknown window type: ${windowType}`)
      }

      if (onComplete) {
        onComplete(result)
      }

      return result
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Window edit failed:', error)
        throw error
      }
    }
  }

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
    editWindow,
    deleteMessagePair,
    stopStreaming,
    clearChat,
    onOutput,

    // Session support
    setSessionManager,
    loadState,
    getState
  }
}
