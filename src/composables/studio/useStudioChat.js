import { ref, nextTick } from 'vue'
import { sendChatMessage } from '../../services/llm/index.js'
import { analyzeGenerateAndExecute, getProvider } from '../../services/llm/taskRouter.js'
import { getProviderConfigById } from '../../services/llm/providers.js'
import BuildCapability from '../../services/llm/capabilities/BuildCapability.js'
import { truncateUrl, truncateFileName } from '../../utils/format.js'
import {
  buildRawAttachments,
  formatUploadedFilesForPrompt,
  formatFetchedContentForPrompt,
  buildAttachmentsForDisplay
} from './studioAttachments.js'

/**
 * Composable for managing chat messages and streaming in StudioChat
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - localStorage key for persistence (default: 'studio-chat-history')
 */
export function useStudioChat(options = {}) {
  const storageKey = options.storageKey || 'studio-chat-history'

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

  /**
   * Save messages to localStorage
   */
  function saveToStorage() {
    try {
      const state = {
        messages: messages.value,
        nextMessageId
      }
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch (e) {
      console.warn('Failed to save chat history:', e)
    }
  }

  /**
   * Load messages from localStorage
   */
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const state = JSON.parse(stored)
        messages.value = state.messages || []
        nextMessageId = state.nextMessageId || 1
        return true
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e)
    }
    return false
  }

  // Load from storage on init
  loadFromStorage()

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
      webSearchResults: null
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
        onPlanComplete: planningCallbacks.onPlanComplete
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
      ...(result.planning && { planning: result.planning, planningComplete: true })
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
   * Improve an existing tool using the Build capability directly
   * @param {Object} options - Improvement options
   * @param {Object} options.currentSpec - Current tool specification
   * @param {string} options.prompt - Improvement request
   * @param {Object} options.modelSelection - Model selection config
   * @param {Function} options.onComplete - Callback with improved tool
   */
  async function improveTool(options) {
    const { currentSpec, prompt, modelSelection, onComplete } = options

    // Don't set isStreaming - let the caller manage their own loading state
    const localAbortController = new AbortController()

    try {
      const buildCapability = new BuildCapability()

      // Use executor model/provider for tool editing
      const providerId = modelSelection.executorProviderId || modelSelection.routerProviderId || 'lmstudio'
      const modelId = modelSelection.executorModel || modelSelection.selectedModel

      const provider = getProvider(providerId)
      const config = getProviderConfigById(providerId)

      // For Vue SFC tools, pass the code; for legacy JSON, pass the spec
      const codeOrSpec = currentSpec.type === 'vue-sfc' ? currentSpec.code : currentSpec

      const improvedTool = await buildCapability.editTool(
        codeOrSpec,
        prompt,
        modelId,
        provider,
        config,
        localAbortController.signal
      )

      // Call the completion callback with the improved tool
      if (onComplete) {
        onComplete(improvedTool)
      }

      return improvedTool
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Tool improvement failed:', error)
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
    improveTool,
    deleteMessagePair,
    stopStreaming,
    clearChat,
    onOutput
  }
}
