import { ref, nextTick } from 'vue'
import { sendChatMessage } from '../services/llm/index.js'
import { analyzeGenerateAndExecute } from '../services/llm/taskRouter.js'
import { truncateUrl, truncateFileName } from '../utils/format.js'
import {
  buildRawAttachments,
  formatUploadedFilesForPrompt,
  formatFetchedContentForPrompt,
  buildAttachmentsForDisplay
} from '../utils/studioAttachments.js'

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
      attachments: preparedMessage.attachmentsForDisplay
    })
    scrollToBottom()
  }

  /**
   * Add empty assistant message for streaming
   * @returns {Object} The created message object
   */
  function addEmptyAssistantMessage() {
    const msg = {
      role: 'assistant',
      content: '',
      analysis: null,
      generatedCode: null,
      execution: null,
      visualization: null,
      tool: null,
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
          scrollToBottom()
        },
        onVisualizationGenerated: (visualization) => {
          updateLastMessage({ visualization })
          scrollToBottom()
        },
        onToolGenerated: (tool) => {
          updateLastMessage({ tool })
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
   * Clear all messages
   */
  function clearChat() {
    messages.value = []
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
    stopStreaming,
    clearChat
  }
}
